# 実装計画

`docs/requirements.md`（要求仕様書）・`docs/design.md`（追加決定）に基づくフェーズ計画。
各フェーズは完了時に「実施結果」節を追記していく運用とする（`production_system_sim`の
`docs/implementation-plan.md`と同じ運用形式）。現時点ではPhase 0〜8はすべて未着手であり、
実施結果は空欄。

各フェーズの完了時に該当するレビューSubagentを実行し、指摘事項を解消してから次フェーズへ進む。

---

## Phase 0: プロジェクト初期化

- Vite + React + TypeScriptのスカフォールドを作成（`npm create vite@latest`相当の構成を手動整備）
- `tsconfig.json`（strict有効）・`vite.config.ts`（GitHub Pages配信用に`base`をビルド用途ごとに
  切り替え。`docs/design.md` §1・production_system_simの`vite.config.ts`と同じパターン）
- npm scripts: `dev` / `build`（tsc + vite build）/ `preview` / `test`（vitest run）
- 依存関係: `react`, `react-dom`, `idb`, `papaparse`（型定義含む）、devDependenciesに
  `vitest`, `@vitejs/plugin-react`, `typescript`等

### 実施結果

- `npm create vite@latest`（`react-ts`テンプレート、2026年8月時点の最新版）を一時ディレクトリで
  実行して現行テンプレートの構成を確認した上で、本リポジトリに合わせて手動整備した。テンプレートは
  React 19・TypeScript 7系・`tsconfig.app.json`/`tsconfig.node.json`のproject references分割を
  採用していたが、以下の理由で採用しなかった：
  - React: CLAUDE.md/design.md §1で「React 18」と明記されているため`^18.3.1`系に固定
  - TypeScript: レジストリの`latest`（7.0.2）はテンプレート自身も追随しておらず`~6.0.2`を採用していた
    ため、同じく安定版6系（`~6.0.3`）に固定
  - tsconfig分割: `npx tsc --noEmit`単体で型チェックが完結する構成が本ファイル（CLAUDE.md）の
    コマンド一覧に明記されているため、project references（`tsc -b`必須）ではなく単一
    `tsconfig.json`構成を採用
- `package.json`: 依存関係は`react`/`react-dom`/`idb`/`papaparse`、devDependenciesに
  `vite`/`@vitejs/plugin-react`/`typescript`/`vitest`/`@types/react`/`@types/react-dom`/
  `@types/papaparse`/`@types/node`を追加。npm scriptsは計画通り`dev`/`build`
  （`tsc --noEmit && vite build`）/`preview`/`test`（`vitest run`）
- `vite.config.ts`: `command === 'serve'`かどうかで`base`を`/`（dev）と
  `/poc_master_data_management_sys/`（build/preview、GitHub Pagesプロジェクトサイト配信パス）に
  切り替え
- `tsconfig.json`: strict有効・`jsx: react-jsx`・`moduleResolution: Bundler`。`src`と
  `vite.config.ts`の両方を対象に含める
- `src/main.tsx` / `src/App.tsx`: 最小限のプレースホルダー（画面本体はPhase 4で実装）
- 動作確認（すべて成功）: `npm install` → `npx tsc --noEmit`（エラーなし）→
  `npm run build`（`dist/index.html`に`/poc_master_data_management_sys/`配下のasset参照を確認）→
  `npm run dev`（`http://localhost:5173/`にルート配信されることを確認）→
  `npm run preview`（`http://localhost:4173/poc_master_data_management_sys/`配下で配信されることを
  確認）
- `npm test`（`vitest run`）はテストファイルが1件も存在しないため`No test files found, exiting
  with code 1`で終了することを確認済み。これはPhase 0時点では想定通りの挙動であり、Phase 1・2で
  DAO生成ロジック・バリデーションエンジンのテストを追加した時点で解消する

---

## Phase 1: マスタテーブル定義JSON＋実行時DAO生成（DO-1, DO-2）

- `table-definitions/m_item.json`（要求仕様書§5.1のサンプルそのまま）
- `table-definitions/m_partner.json`（`docs/design.md` §4.5、カラム構成の異なる2件目の定義）
- `src/core/schema/`: テーブル定義JSONの型定義（TypeScript型）、fetch＋パース、定義JSON自体の
  検証（primaryKeyがちょうど1つ、primaryKeyカラムへのnotNull=false/unique=false明示指定の検出、
  要求仕様書§5.1「制約条件」）
- `src/core/dao/`: `idb`を用いた起動時のIndexedDBスキーマ動的構築（`docs/design.md` §4.3の
  バージョン管理を含む）、テーブルごとの汎用DAO関数（`findAll`/`findByKey`/`search`/`upsert`/`count`等）

### 実施結果

- `table-definitions/index.json`を新設し、`tableId`一覧を管理するマニフェストとした
  （GitHub Pagesにディレクトリ一覧APIがないための対応。`docs/design.md` §4.6に決定を記録）。
  `loadTableDefinitions`はこのindex.jsonを起点に各定義JSONを個別fetchする
- `src/core/schema/types.ts`: `TableDefinition`/`ColumnDefinition`/`TableDefinitionIndex`の
  TypeScript型を定義（要求仕様書§5.1のフィールド定義に対応）
- `src/core/schema/validateDefinition.ts`: 定義JSON自体の検証（primaryKeyがちょうど1つ・
  primaryKeyカラムへのnotNull=false/unique=false明示指定・columnId重複）。エラーは例外にせず
  `DefinitionValidationError[]`として返し、該当テーブルのみ読み込み対象から除外する方針とした
  （1テーブルの定義エラーがアプリ全体の起動を止めないようにするため）
- `src/core/schema/loadTableDefinitions.ts`: index.json→各定義JSONの順にfetchし、取得失敗・
  定義エラーのテーブルは`errors`に集約、正常なテーブルのみ`definitions`として返す
- `src/core/dao/definitionsHash.ts`: 定義配列をtableId順にソートしてシリアライズし、djb2で
  簡易ハッシュ化（`docs/design.md` §4.3のバージョン管理に使用）
- `src/core/dao/openMasterDb.ts`: `idb`の`openDB`/`deleteDB`を用い、保存済みハッシュと現在の
  ハッシュが異なる場合のみDB削除→再作成する。テーブルごとにprimaryKeyカラムをkeyPathとした
  オブジェクトストアを動的生成し、加えて`import_logs`ストアを固定で生成する
- `src/core/dao/dao.ts`: テーブル定義から汎用DAO（`findAll`/`findByKey`/`search`/`upsert`/
  `count`）を生成する`createMasterDao`。`search`は文字列カラムを部分一致、それ以外は完全一致とし、
  空欄条件は無視する。`upsert`は`db.put`（主キーで自動的に上書き/新規判定）を使用
- `src/core/dao/importLogDao.ts`: `import_logs`ストア用のDAOと、要求仕様書§5.5に対応する
  `ImportLog`型を定義
- `src/core/dao/masterDataAccess.ts`: 上記を束ね、定義配列から`MasterDataAccess`
  （db・definitions・tableIdごとのDAO Map・importLogDao）を構築する`initMasterDataAccess`
- テストは`fake-indexeddb`をvitestのsetupFilesで読み込み、Node環境のままIndexedDB操作を検証。
  `openMasterDb`はハッシュ不変時にデータを保持し、ハッシュ変化時に削除・再作成することを確認
- 動作確認（すべて成功）: `npx tsc --noEmit`（エラーなし）→ `npm test`（vitest run、7ファイル
  30件すべて成功）→ `npm run build`（エラーなし）
- `logic-reviewer`サブエージェントでレビュー済み。要求仕様書・design.mdとの明確な矛盾は
  指摘されなかったが、以下の改善提案を反映した：
  - `validateTableDefinition`のエラーメッセージを、primaryKeyカラムのnotNull/uniqueが
    「明示的にfalse」なのか「未指定」なのかで区別するよう修正（原因の誤解を防ぐため）
  - `ImportLogDao.add`を`save`に改名（Phase 3でRUNNING記録→COMPLETED更新の両方に同じ
    メソッドを使う想定のため、追加専用に見える命名を解消）
  - テストケースを追加: primaryKeyへのnotNull/unique同時false指定、notNull未指定時の
    メッセージ区別、maxLength/constants値のみの変更によるハッシュ変化・DB再作成
    （EFFECT-2のトリガー経路）、search関数のnumber列完全一致

---

## Phase 2: バリデーションエンジン（DO-4）

- `src/core/validation/`: 要求仕様書§5.2の順序（①型→②NotNull→③長さ→④定数→⑤ユニーク）で
  1行・1セル単位の検証を行う関数群
- ユニーク制約チェックは「CSVファイル内での重複」と「IndexedDB内の既存データとの重複」の両方を対象とし、
  primaryKeyと値が一致する既存レコードはUpsert対象として扱う（重複エラーとしない）
- レビュー観点: `logic-reviewer`

### 実施結果

- `src/core/validation/checkType.ts`〜`checkConstants.ts`・`checkUnique.ts`: §5.2の5手順を
  1手順1関数（純粋関数）として実装。空値（CSVの空セル）はNotNullチェックの責務とするため、
  型チェック・定数チェックでは無条件に通過させる方針とした
  - `checkType`: string型はそのまま通過。number型は`Number()`変換、boolean型は`'true'`/`'false'`
    の完全一致のみ許容、date型は`Date.parse()`が`NaN`にならないかで判定（本PoCでは厳密な
    フォーマット規定は行わない簡易方針）
  - `checkUnique`: CSVファイル内・IndexedDB既存データの値集合はI/Oを伴うため呼び出し側
    （Phase 3のCSV取込Worker）が用意する前提とし、本関数は集合を受け取って判定するだけの
    純粋関数とした。`treatExistingMatchAsUpsert`オプションで、primaryKeyカラムに限り
    「既存データとの一致」をUpsert対象として重複エラーにしない（CSVファイル内での重複は
    primaryKeyであっても引き続きエラーとする）
- `src/core/validation/validateRow.ts`: 上記5関数をテーブル定義に従って順序通り呼び出し、
  CSV1行分（`columnId`→生文字列のレコード）を検証する`validateRow`を実装。1カラムでいずれかの
  チェックに失敗したらそのカラムはそこで判定を打ち切り次のカラムへ進む。1行の中で1カラムでも
  エラーがあれば行全体としては`record`を返さない（要求仕様書§5.3の部分成功方針はPhase 3で
  「エラー行のみスキップ・正常行のみ登録」として実現する前提）。unique=trueのカラムに対応する
  `uniqueContext`が渡されない場合は、DO-4の中核要件を静かに読み飛ばす事故を防ぐため例外を投げる
  （呼び出し側の配線ミスを早期検出する契約とした）
- `MasterRecord`/`MasterRecordValue`型は`src/core/dao/dao.ts`から`src/core/schema/types.ts`へ
  移動（schema層を土台としてdao層・validation層の双方が依存する構成に整理。dao.tsは
  re-exportのみ残し既存利用箇所への影響なし）
- 動作確認（すべて成功）: `npx tsc --noEmit`（エラーなし）→ `npm test`（vitest run、13ファイル
  69件すべて成功）→ `npm run build`（エラーなし）
- `logic-reviewer`サブエージェントでレビュー済み。要求仕様書との明確な矛盾は指摘されなかったが、
  以下を反映した：
  - `checkType`のnumber型判定で、空白のみの文字列が`Number()`により`0`に変換されてしまう
    バグを修正（`rawValue.trim() === ''`を明示的にエラー扱いに）
  - `validateRow`の統合テストに、primaryKey以外のunique列は既存データ一致でも重複エラーに
    なる（Upsert対象にならない）ケースと、③長さチェックと④定数チェックが同一カラムで
    同時に違反する場合に長さチェックのみが報告される（手順の優先順位）ケースを追加
  - `src/core/schema/validateDefinition.ts`（Phase 1）を拡張し、primaryKey以外のカラムでも
    notNull/uniqueフィールドの欠落を定義エラーとして検出するようにした（従来はprimaryKey
    カラムの欠落のみ検出しており、非primaryKeyカラムの欠落はバリデーションエンジンが
    「任意項目」として黙って見逃す抜け穴があった）

---

## Phase 3: CSV取込・Web Worker（DO-3）

- `src/workers/csvImport.worker.ts`: papaparseでのパース→Phase 2のバリデーション→正常行のみ
  Upsert登録→`import_logs`ストアへの記録、をメインスレッドをブロックせず実行
- エラー行はスキップし、正常な行のみ登録する（部分成功、要求仕様書§5.3）
- 取込実行ログ（`import_logs`、要求仕様書§5.5のフィールド定義）を1回の取込につき1件生成

### 実施結果

- `src/workers/importCsvFile.ts`: CSV取込の中核ロジック（パース・バリデーション・Upsert・
  取込ログ生成）を、実際のWorker/DOM APIに依存しない純粋な非同期関数として実装。
  `MasterDao`/`ImportLogDao`（Phase 1で定義したインターフェース）に依存する形にしたことで、
  `fake-indexeddb`ベースの単体テストをWorker環境なしに実行できる
  - CSVヘッダーはtable-definitionsの`columnId`と一致させる前提とした（papaparseの
    `header: true`でcolumnIdキーのオブジェクトとしてパース）
  - unique=trueの全カラムについて、取込開始時に`masterDao.findAll()`を1回だけ呼び出して
    IndexedDB内の既存値集合を構築し、CSVファイル内の重複検出用集合（`seenInFile`）を
    行ごとに更新しながら`validateRow`（Phase 2）へ渡す。1行が他カラムのエラーで不採用に
    なった場合でも、`validateRow`が新設した`passedUniqueValues`を使って「そのカラム自身は
    通過した」事実を`seenInFile`へ反映し、後続行との重複判定に活かす
  - 取込ログは開始時に`status: RUNNING`で一旦保存し、完了後に最終状態（`COMPLETED`／
    `COMPLETED_WITH_ERRORS`）で同じ`importId`により上書き保存する。処理中に例外が発生した
    場合は`FAILED`として記録し、例外を呼び出し元へ伝播させない（取込処理自体が要求仕様書
    §5.5の`FAILED`ステータスとして正常に完了する設計）
  - `rowNumber`はヘッダー行を除いたデータ行の1始まり番号と定義した（要求仕様書はrowNumberの
    起点を明示していないため、CSVを表計算ソフトで見たときの直感に合わせた）
- `src/workers/csvImport.worker.ts`: 上記を呼び出す薄いWorkerラッパー。DBスキーマの
  バージョン管理（ハッシュ比較・削除再作成）はアプリ起動時にメインスレッドで完了している
  前提とし、Worker内では`idb`の`openDB(DB_NAME, 1)`で既存DBに接続するだけにした
  （`localStorage`はWorkerから参照できないため）。tsconfigは`lib: ["DOM", ...]`のまま
  変更せず、当該ファイル内のみ`/// <reference lib="webworker" />`と`self`のキャストで
  Worker向けの型を得る方式とした（DOM libとの共存のため）
  - 実際のWorkerインスタンス化（`new Worker(...)`）はPhase 4（画面実装）でSCR-1から行う。
    本フェーズでは`self.onmessage`のロジック自体の型チェックまでを対象とした
- 動作確認（すべて成功）: `npx tsc --noEmit`（エラーなし）→ `npm test`（vitest run、14ファイル
  80件すべて成功）→ `npm run build`（エラーなし）
- `logic-reviewer`サブエージェントでレビュー済み。要求仕様書§5.2〜§5.5との明確な矛盾は
  指摘されなかったが、以下を反映した：
  - `csvImport.worker.ts`: `openDB`・`file.text()`の失敗（`importCsvFile`呼び出しより手前の
    失敗）が捕捉されず、メインスレッドへ一切応答が返らないまま無応答になる経路があったため、
    `onmessage`ハンドラ全体を`try/catch`し、この経路の失敗は`CsvImportErrorMessage`として
    応答するようにした（`import_logs`へ書き込むためのDB接続自体が失敗しているため、この経路の
    失敗はログに記録できない。ユーザーへの応答を返すことを優先した）
  - `importCsvFile.ts`: `Papa.parse`が検出した構文エラー（フィールド数不一致等）を
    `CSVパースエラー: ...`として`errors`に記録するようにした（従来は`parseResult.errors`を
    無視しており、原因が別の理由として誤って記録される可能性があった）
  - `importCsvFile.test.ts`: primaryKey以外のunique列（IndexedDB内既存データ重複・CSVファイル
    内重複の両方）の統合テスト、`importLogDao.save`が「開始時のRUNNING」「完了時の最終状態」の
    2回呼ばれることを検証するテスト、CSVパースエラーの記録を検証するテストを追加
  - **Phase 4への申し送り**: `docs/design.md` §4.8の前提（ユーザーが取込画面を開ける時点で
    アプリ起動時のDBスキーマ構築が完了済み）を実際にどう担保するか（例: 起動処理完了まで
    SCR-1の操作を無効化する等のUI側ガード）をPhase 4で設計すること

---

## Phase 4: 画面実装（DO-5, DO-6, DO-7, DO-9）

- `src/screens/ImportScreen.tsx`（SCR-1）: テーブル選択・CSVファイル選択・取込実行・結果表示
- `src/screens/SearchExportScreen.tsx`（SCR-2）: 条件検索・一覧表示・CSVダウンロード（DO-7、
  全カラムそのまま出力）
- `src/screens/ImportLogScreen.tsx`（SCR-3）: `import_logs`の一覧表示、1件選択でエラー明細を確認
- 画面レイアウトの詳細は要求仕様書§6の通り本実装過程で決定する
- Phase 3からの申し送り: `docs/design.md` §4.8の前提（起動時のDBスキーマ構築完了後でないと
  CSV取込Workerが正しく動作しない）を、SCR-1側でどう担保するか設計すること
  （例: 起動処理完了までインポート操作を無効化する等）
- レビュー観点: `ux-reviewer`

### 実施結果
（未着手）

---

## Phase 5: 連携ファイル作成機能（DO-8）

- `export-definitions/item_export_v1.json`（要求仕様書§5.4のサンプル）
- `SearchExportScreen.tsx`に、定義済みexportIdを選択して検索結果（または全件）を
  出力カラム・ヘッダー名・区切り文字・改行コード等の定義に従って変換出力する機能を追加
- DO-7（素の全カラムCSV）とDO-8（連携先フォーマット変換）の役割分担をUI上で明確に区別する

### 実施結果
（未着手）

---

## Phase 6: 自動テスト整備

`docs/design.md` §3の対象範囲に従い、vitestでユニットテストを整備する。

- DAO生成ロジック: 複数のテーブル定義JSONに対してIndexedDBスキーマ・DAO関数が正しく生成されるか
- バリデーションエンジン: §5.2の5ステップそれぞれの正常系・異常系
- CSV取込: Upsert判定・部分成功（一部行スキップ）・取込ログ生成
- **EFFECT-1検証シナリオ**: `table-definitions/`に新しい定義JSONを1つ追加しアプリを再起動（リロード）
  するだけで、取込・検索・出力の各画面に新テーブルが反映されることをテストで確認する
- **EFFECT-2検証シナリオ**: 既存カラムの`maxLength`や`constants`の値をJSON上で変更し、
  コード修正なしに新しい制約でCSV取込が動作することをテストで確認する

### 実施結果
（未着手）

---

## Phase 7: GitHub Pagesビルド・デプロイ構成（DO-10）

`docs/design.md` §2の解釈に基づき整備する。

- `.github/workflows/test.yml`: PR作成・更新時に型チェック・ビルド・vitest実行
- `.github/workflows/deploy.yml`: `main`へのpush時に自動ビルドし`gh-pages`ブランチへデプロイ
  （`peaceiris/actions-gh-pages`使用）
- `vite.config.ts`の`base`をGitHub Pagesのプロジェクトサイト配信パス
  （`/poc_master_data_management_sys/`）に対応させる

### 実施結果
（未着手）

---

## Phase 8: EFFECT-1・EFFECT-2の実証（要求仕様書§7項番2・3）

- 新規マスタテーブル追加シナリオ: `table-definitions/`に3つ目の定義JSON（`m_item`・`m_partner`とは
  異なるカラム構成）を追加し、コード修正なしに取込・検索・出力の各画面に反映されることを
  実際にブラウザで確認する
- バリデーション値変更シナリオ: 既存カラムの`maxLength`・`constants`をJSON上で変更し、
  コード修正なしに新しい制約でCSV取込が動作することを確認する
- レビュー観点: `scope-reviewer`（要求仕様書§3「やらない事」からの逸脱がないか最終確認）

### 実施結果
（未着手）
