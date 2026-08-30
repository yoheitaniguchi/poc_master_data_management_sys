# プログラムフロー図

このドキュメントは、実装済みのマスタ管理システムPoCを俯瞰するための図をまとめたもの。
1つ目は全体のモジュール構成（静的な依存関係）、2つ目以降はフロントエンドで操作イベントが
発火してからモジュールがどの順序で呼び出されていくか（動的な呼び出し順）を示す。

一次資料ではなく、実装（`src/`配下）から起こした参考資料。実装を変更した場合はこの図も
あわせて更新すること。インタラクティブに呼び出し順を1ステップずつアニメーション表示する
版が [program-flow.html](./program-flow.html) にある（ブラウザで直接開いて確認できる）。

## 目次

1. [全体構成（俯瞰図）](#1-全体構成俯瞰図)
2. [アプリ起動時の初期化](#2-アプリ起動時の初期化)
3. [CSV取込（SCR-1）](#3-csv取込scr-1)
4. [マスタ検索（SCR-2）](#4-マスタ検索scr-2)
5. [CSVダウンロード・連携ファイル出力（SCR-2）](#5-csvダウンロード連携ファイル出力scr-2)
6. [取込実行ログ表示（SCR-3）](#6-取込実行ログ表示scr-3)

---

## 1. 全体構成（俯瞰図）

画面（`src/screens/`）は`core/`配下のロジックのみを通じてIndexedDBにアクセスし、CSV取込だけは
Web Worker（`src/workers/`）上で完結する。画面やWorkerが`idb`を直接叩くことはない
（CLAUDE.md「コーディング上の注意」）。

```mermaid
flowchart TB
    subgraph UI["画面 (src/screens/)"]
        ImportScreen["ImportScreen<br/>(SCR-1 CSV取込)"]
        SearchExportScreen["SearchExportScreen<br/>(SCR-2 検索・出力)"]
        ImportLogScreen["ImportLogScreen<br/>(SCR-3 取込ログ)"]
        DataAccessGate["DataAccessGate<br/>(初期化完了ガード)"]
    end

    subgraph Boot["起動時初期化"]
        useMasterDataAccess["useMasterDataAccess<br/>(App起動時 useEffect)"]
    end

    subgraph Worker["Web Worker (src/workers/)"]
        CsvImportWorker["csvImport.worker.ts"]
        importCsvFile["importCsvFile.ts"]
    end

    subgraph Core["ドメインロジック (src/core/)"]
        Schema["schema/<br/>loadTableDefinitions<br/>validateDefinition"]
        Dao["dao/<br/>masterDataAccess・dao・importLogDao<br/>openMasterDb・definitionsHash"]
        Validation["validation/<br/>checkType→checkNotNull→<br/>checkLength→checkConstants→checkUnique<br/>(validateRowが順に呼び出す)"]
        Export["export/<br/>loadExportDefinitions<br/>validateExportDefinition・buildExportCsv"]
    end

    subgraph Storage["ブラウザストレージ"]
        IndexedDB[("IndexedDB<br/>(idb)")]
        LocalStorage[("localStorage<br/>(定義ハッシュのみ)")]
        Fetch["fetch()<br/>public/table-definitions/<br/>public/export-definitions/"]
    end

    useMasterDataAccess --> Schema
    useMasterDataAccess --> Dao
    useMasterDataAccess --> Export
    Schema --> Fetch
    Export --> Fetch
    Dao --> IndexedDB
    Dao --> LocalStorage

    DataAccessGate --> useMasterDataAccess
    ImportScreen --> DataAccessGate
    SearchExportScreen --> DataAccessGate
    ImportLogScreen --> DataAccessGate

    ImportScreen -->|"postMessage"| CsvImportWorker
    CsvImportWorker --> importCsvFile
    CsvImportWorker --> Dao
    importCsvFile --> Validation
    importCsvFile --> Dao

    SearchExportScreen --> Dao
    SearchExportScreen --> Export
    ImportLogScreen --> Dao
```

---

## 2. アプリ起動時の初期化

**発火イベント**: ページ読み込み（`App`のマウント）

`src/useMasterDataAccess.ts`の`useEffect`が起点。この完了前は`DataAccessGate`が
全画面の操作をブロックする（`docs/design.md` §4.8）。

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant App as App.tsx
    participant Hook as useMasterDataAccess
    participant Schema as loadTableDefinitions
    participant Init as initMasterDataAccess
    participant OpenDb as openMasterDb
    participant IDB as IndexedDB
    participant LS as localStorage
    participant ExportLoader as loadExportDefinitions
    participant Gate as DataAccessGate

    User->>App: ページを開く
    App->>Hook: マウント（useEffect発火）
    Hook->>Schema: table-definitions/index.json + 各定義をfetch
    Schema-->>Hook: {definitions, errors}<br/>(validateTableDefinitionで検証済み)

    Hook->>Init: initMasterDataAccess(definitions)
    Init->>OpenDb: openMasterDb(definitions)
    OpenDb->>OpenDb: computeDefinitionsHash(definitions)
    OpenDb->>LS: 保存済みhashと比較
    alt hashが変化している
        OpenDb->>IDB: deleteDB（既存データを全削除）
        Note over OpenDb,IDB: 簡易バージョン管理方針（design.md §4.3）<br/>本番相当のマイグレーションは行わない
    end
    OpenDb->>IDB: openDB（upgradeでtableId毎にobjectStore作成）
    OpenDb->>LS: 新しいhashを保存
    OpenDb-->>Init: {db, rebuilt}
    Init->>Init: definition毎にcreateMasterDao／createImportLogDao
    Init-->>Hook: MasterDataAccess

    Hook->>ExportLoader: export-definitions/index.json + 各定義をfetch
    ExportLoader->>ExportLoader: validateExportDefinition<br/>（tableDefinitionsと突き合わせ検証）
    ExportLoader-->>Hook: {exportDefinitions, errors}

    Hook-->>App: state = 'ready'
    App->>Gate: 各画面をContext経由で描画許可
    Gate-->>User: 画面操作可能になる<br/>（rebuilt=trueなら警告バナー表示）
```

---

## 3. CSV取込（SCR-1）

**発火イベント**: 「取込実行」ボタン押下 → 確認ダイアログで「取込を実行する」を確定

パース・バリデーション・Upsert登録は全てメインスレッドをブロックしないWeb Worker
（`csvImport.worker.ts`）側で行う（DO-3）。バリデーションは要求仕様書§5.2の
①型→②NotNull→③長さ→④定数→⑤ユニークの順序を厳守する。

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant Screen as ImportScreen
    participant Confirm as ConfirmDialog
    participant Worker as csvImport.worker.ts
    participant ImportCsv as importCsvFile
    participant LogDao as importLogDao
    participant Validate as validateRow<br/>(①〜⑤を順に実行)
    participant Dao as masterDao

    User->>Screen: ファイル選択 + 「取込実行」クリック
    Screen->>Confirm: 確認ダイアログ表示（Upsertは元に戻せない旨を明示）
    User->>Confirm: 「取込を実行する」をクリック
    Confirm->>Screen: onConfirm（executeImport）

    Screen->>Worker: new Worker() + postMessage(request)
    Note over Screen,Worker: 以降メイン画面の操作は継続可能<br/>（isRunning=trueでボタンのみ無効化）

    Worker->>Worker: openDB（起動時に構築済みのDBへ接続）
    Worker->>Worker: createMasterDao／createImportLogDao
    Worker->>Worker: file.text()
    Worker->>ImportCsv: importCsvFile({definition, csvText, masterDao, importLogDao})

    ImportCsv->>LogDao: save(baseLog: status=RUNNING)
    ImportCsv->>ImportCsv: Papa.parse(csvText, {header:true})
    ImportCsv->>Dao: findAll()（unique制約チェック用の既存値取得）

    loop CSV各行
        ImportCsv->>Validate: validateRow(rawRow, uniqueContexts)
        Validate->>Validate: ①checkType → ②checkNotNull →<br/>③checkLength → ④checkConstants → ⑤checkUnique
        alt 全カラムが通過
            Validate-->>ImportCsv: record
            ImportCsv->>Dao: upsert(record)<br/>（主キー一致時のみ更新、他は新規追加）
        else いずれかのカラムでエラー
            Validate-->>ImportCsv: errors（該当カラムで判定打ち切り）
            ImportCsv->>ImportCsv: この行はスキップし次の行へ<br/>（部分成功、All or Nothingにしない）
        end
    end

    ImportCsv->>LogDao: save(finalLog: COMPLETED / COMPLETED_WITH_ERRORS / FAILED)
    ImportCsv-->>Worker: log
    Worker->>Screen: postMessage(importResult, log)
    Screen-->>User: 取込結果サマリ表示（成功/エラー件数、エラー明細）
```

---

## 4. マスタ検索（SCR-2）

**発火イベント**: テーブル切替（マウント時含む）／検索フォーム送信／「クリア（全件表示）」押下

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant Screen as SearchExportScreen
    participant Dao as masterDao
    participant IDB as IndexedDB

    alt テーブル切替 / 画面表示時
        Screen->>Dao: findAll()
        Dao->>IDB: getAll(tableId)
        IDB-->>Dao: 全レコード
        Dao-->>Screen: records
        Screen-->>User: 一覧再描画
    else 検索フォーム送信
        User->>Screen: 検索条件入力 →「検索」クリック
        Screen->>Screen: handleSearch()<br/>parseSearchValueで入力値を型変換<br/>（変換不能な項目は無視しignoredColumnNamesへ）
        Screen->>Dao: search(criteria)
        Dao->>IDB: getAll(tableId)
        Dao->>Dao: 文字列は部分一致、それ以外は完全一致でフィルタ
        Dao-->>Screen: 該当records
        Screen-->>User: 一覧再描画 + 無視した条件があれば警告表示
    else 「クリア（全件表示）」クリック
        User->>Screen: クリアをクリック
        Screen->>Dao: findAll()
        Dao->>IDB: getAll(tableId)
        Dao-->>Screen: 全レコード
        Screen-->>User: 一覧再描画（検索条件欄もリセット）
    end
```

---

## 5. CSVダウンロード・連携ファイル出力（SCR-2）

**発火イベント**: 「ダウンロード」（全カラムCSV）／「この定義で出力」（連携ファイル定義）押下

DO-7（画面表示中の検索結果をそのままCSVへ）とDO-8（決められた連携先フォーマットへ変換して
出力）は別のボタン・別の変換ロジック（`buildAllColumnsCsv` / `buildExportCsv`）だが、
最終的なファイルダウンロード処理（`downloadCsvText`）は共通。

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant Screen as SearchExportScreen
    participant Build as buildAllColumnsCsv /<br/>buildExportCsv
    participant Papa as Papa.unparse
    participant Download as downloadCsvText
    participant Browser as ブラウザ

    alt 全カラムCSVダウンロード（DO-7）
        User->>Screen: 「ダウンロード」クリック
        Screen->>Build: buildAllColumnsCsv(definition, records)<br/>ヘッダーはcolumnId（再取込可能な形式）
        Build->>Papa: Papa.unparse(rows)
        Papa-->>Build: CSV文字列
        Build-->>Screen: csvBody
    else 連携ファイル定義による出力（DO-8）
        User->>Screen: 連携ファイル定義選択 →「この定義で出力」クリック
        Screen->>Build: buildExportCsv(selectedExportDefinition, records)<br/>outputColumns順・出力ヘッダー名に変換
        Build->>Papa: Papa.unparse(rows, {delimiter, newline})
        Papa-->>Build: CSV/TSV文字列
        Build-->>Screen: csvBody
    end

    Screen->>Download: downloadCsvText(fileName, csvBody)
    Download->>Download: BOM付与 + new Blob() + URL.createObjectURL()
    Download->>Browser: <a download>をクリック → ダウンロード開始
    Download->>Download: URL.revokeObjectURL()
    Screen-->>User: 「ダウンロードを開始しました」表示
```

---

## 6. 取込実行ログ表示（SCR-3）

**発火イベント**: 画面表示（マウント時）／「更新」押下／「詳細を見る」押下

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant Screen as ImportLogScreen
    participant LogDao as importLogDao
    participant IDB as IndexedDB

    User->>Screen: 画面表示 または「更新」クリック
    Screen->>Screen: refresh()
    Screen->>LogDao: findAll()
    LogDao->>IDB: getAll(import_logs)
    IDB-->>LogDao: 全取込ログ
    LogDao-->>Screen: logs
    Screen->>Screen: startedAt降順にソート
    Screen-->>User: 一覧再描画

    User->>Screen: 特定行の「詳細を見る」クリック
    Screen->>Screen: setSelectedImportId(importId)
    Screen-->>User: 該当ログのエラー明細を表示<br/>（IndexedDBへは再アクセスしない。既に取得済みのlogsから参照）
```
