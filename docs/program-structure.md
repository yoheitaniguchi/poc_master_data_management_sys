# プログラム構造説明資料

このドキュメントは、実装済みのマスタ管理システムPoCを**静的な構造**の観点でまとめたもの。
「何が入力され、どう処理され、何が出力されるか（IPO）」「処理の特徴」「該当するデザイン
パターン」を扱う。イベント発火からモジュールが呼び出される**動的な順序**は
[program-flow.md](./program-flow.md)（Mermaid図・[program-flow.html](./program-flow.html)
インタラクティブ版）を参照。実装（`src/`配下）から起こした参考資料であり、実装を変更した
場合はこの資料もあわせて更新すること。

## 目次

1. [システム全体のIPO概要](#1-システム全体のipo概要)
2. [主要処理ごとのIPO](#2-主要処理ごとのipo)
3. [処理の特徴](#3-処理の特徴)
4. [該当するデザインパターン](#4-該当するデザインパターン)

---

## 1. システム全体のIPO概要

| 項目 | 内容 |
|---|---|
| **Input** | ①テーブル定義JSON（`public/table-definitions/*.json`）②連携ファイル定義JSON（`public/export-definitions/*.json`）③ユーザーが選択するCSVファイル ④画面上の操作（検索条件・ボタン押下） |
| **Process** | 起動時に①②をfetchして検証し、IndexedDBスキーマとDAOを実行時に構築する（メタデータ駆動）。以降、画面・Web Workerはこの定義とDAOだけを介してデータを読み書きする。CSV取込はパース→5手順バリデーション→Upsertを Web Worker 上で実行し、検索・出力は取得済みレコードをフィルタ・変換する |
| **Output** | IndexedDBに永続化されたマスタデータ・取込ログ、ブラウザがダウンロードするCSV/TSVファイル、画面に表示される検索結果・取込結果・ログ一覧 |

バックエンドサーバーを持たず、永続化はブラウザの IndexedDB のみ（`docs/design.md` §1・§2）。
入力の性質が「静的JSON定義（アプリの挙動を決める設定）」と「動的なユーザー操作・CSVデータ」の
2種類に分かれ、前者が後者の処理内容（スキーマ・制約・出力形式）を決定する構造になっている点が
このPoCの検証テーマそのものである（要求仕様書§1）。

---

## 2. 主要処理ごとのIPO

### 2.1 起動時初期化

| 項目 | 内容 |
|---|---|
| **Input** | `table-definitions/index.json` と各`{tableId}.json`、`export-definitions/index.json` と各`{exportId}.json`、`localStorage`に保存された前回起動時の定義ハッシュ |
| **Process** | `loadTableDefinitions`が定義JSONをfetch・`validateTableDefinition`で検証 → `openMasterDb`が定義群のハッシュ（`computeDefinitionsHash`）を前回値と比較し、変化していればIndexedDBを削除して`upgrade`でオブジェクトストアを再作成 → テーブル定義ごとに`createMasterDao`、`createImportLogDao`でDAOを生成 → `loadExportDefinitions`が連携ファイル定義をfetchし、`validateExportDefinition`でテーブル定義との整合性を検証 |
| **Output** | `MasterDataAccess`（`db`・`definitions`・`daos`・`importLogDao`・`rebuilt`）をReact Context経由で全画面へ提供。IndexedDBのオブジェクトストア一式。定義変更を検知した場合は`rebuilt=true`として画面に警告表示 |

### 2.2 CSV取込（SCR-1）

| 項目 | 内容 |
|---|---|
| **Input** | ユーザーが選択した1つのCSVファイル、取込先のテーブル定義（`TableDefinition`） |
| **Process** | Web Worker（`csvImport.worker.ts`）上で`importCsvFile`が実行：`Papa.parse`でCSVを解析 → 行ごとに`validateRow`が①型→②NotNull→③長さ→④定数→⑤ユニークの順でチェックし、通過した行のみ`masterDao.upsert`（主キー一致時のみ更新、それ以外は新規追加） → 開始時・完了時に`importLogDao.save`で取込ログを記録 |
| **Output** | IndexedDBへUpsertされたレコード、`import_logs`ストアへの取込ログ1件（合計/成功/エラー件数・エラー明細）、画面への結果サマリ表示 |

### 2.3 マスタ検索（SCR-2）

| 項目 | 内容 |
|---|---|
| **Input** | 画面で入力された検索条件（テーブルの各カラムに対応する文字列）、対象テーブル |
| **Process** | `masterDao.search(criteria)`がIndexedDBの全件を取得し、文字列型カラムは部分一致、それ以外は完全一致でフィルタ。数値/真偽値に変換できない条件は無視して検索を続行 |
| **Output** | 条件に一致するレコード一覧（画面表示）、無視した条件があればその一覧 |

### 2.4 CSV／連携ファイル出力（SCR-2）

| 項目 | 内容 |
|---|---|
| **Input** | 直前の検索結果（画面上のレコード一覧）。連携ファイル出力の場合はさらに選択された連携ファイル定義（`ExportDefinition`） |
| **Process** | 全カラムCSV: `buildAllColumnsCsv`が`columnId`をヘッダーとしてそのまま`Papa.unparse`。連携ファイル出力: `buildExportCsv`が定義の`outputColumns`順・出力ヘッダー名・区切り文字・改行コードに変換して`Papa.unparse`。いずれも`downloadCsvText`がBOM付きBlobを生成しダウンロードを開始する |
| **Output** | ブラウザがダウンロードするCSV/TSVファイル（全カラムCSVは取込画面へ再取込可能な形式、連携ファイルは連携先の決められた形式） |

### 2.5 取込実行ログ表示（SCR-3）

| 項目 | 内容 |
|---|---|
| **Input** | なし（一覧表示は既存の`import_logs`ストアの内容）。詳細表示の場合は選択した`importId` |
| **Process** | `importLogDao.findAll()`で全ログを取得し`startedAt`降順にソート。詳細表示は再フェッチせず取得済みの一覧から該当ログを参照するだけ |
| **Output** | 取込ログ一覧（実行日時・テーブル・ファイル名・ステータス・件数）、選択したログのエラー明細 |

---

## 3. 処理の特徴

- **メタデータ駆動（JSON定義駆動）アーキテクチャ**: テーブル構造・バリデーション制約・連携
  ファイルの出力仕様は、コードではなくJSONとして外部化されており、アプリ起動時にfetchして
  解釈することでIndexedDBスキーマ・DAO・出力ロジックを動的に構築する。定義の追加・変更だけで
  新しいテーブル・新しい制約・新しい出力形式に対応できる（要求仕様書§1.2 EFFECT-1/2で実証）
- **関数コア・命令シェル**: `core/validation/`配下の各チェック関数（`checkType`・
  `checkNotNull`・`checkLength`・`checkConstants`・`checkUnique`）は値と定数を受け取り
  結果を返すだけの副作用のない純粋関数。IndexedDBへのI/Oや値集合の構築はDAO層・Web Worker層
  に閉じ込められており、ドメインロジックとI/Oが分離されている
- **バリデーション順序の固定**: ①型→②NotNull→③長さ→④定数→⑤ユニークの順を厳守し、1カラムで
  いずれかのチェックに失敗した時点でそのカラムの判定を打ち切り次のカラムへ進む。順序を変える
  とエラーメッセージの内容や最初に弾かれる理由が要求仕様書と食い違う
- **部分成功の許容**: CSV取込はAll or Nothingではなく、エラーのある行のみスキップし、正常な
  行は登録する。1行のエラーが取込全体を失敗させない
- **Upsertは主キー一致時のみ**: 主キーが一致するレコードは上書き更新、一致しなければ新規追加。
  主キー以外のunique制約違反は「重複エラー」としてスキップするのみで、更新は行わない
- **UIスレッドを塞がない設計**: CSVのパース・バリデーション・Upsert登録は全てWeb Worker上で
  実行し、取込中もメイン画面の操作を継続できる
- **バックエンドレス構成**: サーバー・APIを持たず、静的JSON（`fetch`）とブラウザの
  IndexedDB／`localStorage`のみでアプリが完結する
- **簡易バージョン管理**: テーブル定義群のハッシュ値を`localStorage`に保存し、前回起動時と
  異なればIndexedDBを全削除して再作成する簡易方式（本番相当のマイグレーション機構は実装しない
  ことをPoCとして明示的に選択している）

---

## 4. 該当するデザインパターン

以下はPoCの規模感に合わせた「該当するパターンの見立て」であり、GoFの定義への厳密な準拠を
目的として設計されたものではない。実装の意図を説明する補助として捉えること。

| パターン | 該当箇所 | 説明 |
|---|---|---|
| **Factory（ファクトリ関数）** | `createMasterDao`（`core/dao/dao.ts`）、`createImportLogDao`（`core/dao/importLogDao.ts`） | テーブル定義というデータを受け取り、その場でDAOオブジェクトを生成する。テーブルごとに専用クラスを書かず、単一の生成関数が全テーブル共通で使われる |
| **Repository / DAO** | `MasterDao`インターフェース（`findAll`・`findByKey`・`search`・`upsert`・`count`） | IndexedDBへの直接アクセスを画面・Web Workerから隠蔽し、ドメイン寄りの操作として公開する。プロジェクト自身も一貫して「DAO」と呼称している |
| **Chain of Responsibility** | `validateRow`（`core/validation/validateRow.ts`） | ①型→②NotNull→③長さ→④定数→⑤ユニークの5つのチェック関数を順に呼び出し、いずれかが失敗した時点でそのカラムの判定を打ち切る。各チェックが「自分の担当を判定し、通過したら次に委ねる」ハンドラの連鎖になっている |
| **Facade** | `MasterDataAccess`（`core/dao/masterDataAccess.ts`） | 複数のDAO・IndexedDB接続・テーブル定義一覧を1つのオブジェクトにまとめ、画面からは単一の窓口として利用できるようにしている |
| **Provider（DIコンテナ的な利用）** | `MasterDataAccessProvider` / `useMasterDataAccessContext`（`MasterDataAccessContext.tsx`、React Context） | 起動時に構築したDAO一式を、props経由のバケツリレーなしで画面ツリー全体へ注入する |
| **Render Props** | `DataAccessGate`の`children`（`screens/DataAccessGate.tsx`） | `children`がJSXではなく`(access, definitionErrors, exportDefinitions, exportDefinitionErrors) => ReactNode`という関数。初期化完了後の値を呼び出し元へ受け渡すのに関数プロパティを使うReact特有のパターン |
| **メッセージ経由のコマンド的やりとり** | `csvImport.worker.ts`の`postMessage`通信 | `{ type, requestId, ... }`という判別可能なメッセージオブジェクト（`CsvImportRequestMessage`/`CsvImportResultMessage`/`CsvImportErrorMessage`）でリクエスト内容をやりとりする、コマンドオブジェクトに近い構造 |
| **依存性注入（テスト容易性のため）** | `openMasterDb(definitions, { storage })`、DAO関数への`db`引数渡し | 本番では`localStorage`・実IndexedDBを使うが、テストでは`src/test/memoryStorage.ts`・`setupFakeIndexedDb.ts`のフェイク実装に差し替え可能。副作用を持つ依存を外側から注入する構造が、上記の関数コア・命令シェル分離を実現している |

---

関連資料: [docs/design.md](./design.md)（要求仕様書からの追加決定・実装方針）、
[docs/requirements.md](./requirements.md)（要求仕様書原文）、
[docs/program-flow.md](./program-flow.md)（動的な呼び出し順序）
