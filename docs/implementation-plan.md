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
（未着手）

---

## Phase 2: バリデーションエンジン（DO-4）

- `src/core/validation/`: 要求仕様書§5.2の順序（①型→②NotNull→③長さ→④定数→⑤ユニーク）で
  1行・1セル単位の検証を行う関数群
- ユニーク制約チェックは「CSVファイル内での重複」と「IndexedDB内の既存データとの重複」の両方を対象とし、
  primaryKeyと値が一致する既存レコードはUpsert対象として扱う（重複エラーとしない）
- レビュー観点: `logic-reviewer`

### 実施結果
（未着手）

---

## Phase 3: CSV取込・Web Worker（DO-3）

- `src/workers/csvImport.worker.ts`: papaparseでのパース→Phase 2のバリデーション→正常行のみ
  Upsert登録→`import_logs`ストアへの記録、をメインスレッドをブロックせず実行
- エラー行はスキップし、正常な行のみ登録する（部分成功、要求仕様書§5.3）
- 取込実行ログ（`import_logs`、要求仕様書§5.5のフィールド定義）を1回の取込につき1件生成

### 実施結果
（未着手）

---

## Phase 4: 画面実装（DO-5, DO-6, DO-7, DO-9）

- `src/screens/ImportScreen.tsx`（SCR-1）: テーブル選択・CSVファイル選択・取込実行・結果表示
- `src/screens/SearchExportScreen.tsx`（SCR-2）: 条件検索・一覧表示・CSVダウンロード（DO-7、
  全カラムそのまま出力）
- `src/screens/ImportLogScreen.tsx`（SCR-3）: `import_logs`の一覧表示、1件選択でエラー明細を確認
- 画面レイアウトの詳細は要求仕様書§6の通り本実装過程で決定する
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
