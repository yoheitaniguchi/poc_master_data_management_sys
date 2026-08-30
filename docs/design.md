# 設計書（要求仕様書からの追加決定）

## 0. 読み方

本書は `docs/requirements.md`（要求仕様書、原文のまま格納・直接編集しない一次資料）が実装詳細まで
規定していない点について、実装前に確定させた判断を記録するものである。要求仕様書と本書で記述が
食い違う場合は、要求仕様書の「やる事」「やらない事」の区分を優先し、本書はその範囲内での詳細化に
留める。

`docs/implementation-plan.md`（フェーズ計画）と対で運用する。設計判断の根拠を確認したいときは本書を、
フェーズごとの実装順序・進捗を確認したいときは `implementation-plan.md` を参照する。

---

## §1. 技術スタック確定

要求仕様書は「JSON定義駆動」「実行時DAO生成」「IndexedDB」「Web Worker」「GitHub Pages」のみを
アーキテクチャ前提として指定しており（要求仕様書§4）、UIフレームワークは指定していない。

**決定**: 姉妹PoC `production_system_sim` と同一のスタックを採用する。

- React 18 + TypeScript + Vite
- テストは vitest（ユニットテスト）
- パッケージマネージャは npm

**理由**: 開発チームが既に運用しているツール・レビューSubagentのパターン（`logic-reviewer`・
`ux-reviewer`の観点設計、CIワークフローの構成）をそのまま再利用でき、学習コストと実装コストの両方を
下げられるため。

---

## §2. GitHub Actionsの扱い（要求仕様書DONT-4の解釈確定）

要求仕様書には一見矛盾する2つの記述がある。

- DO-10「GitHub Pages向けビルド構成：サーバーサイド処理を持たない、静的ファイルのみで完結する
  ビルド・デプロイ構成」
- DONT-4「バックエンドサーバー・API・DBサーバーの構築（中略）GitHub Actionsを含む
  サーバーサイド処理は使用しない」

**決定**: DONT-4が禁止するのは「**アプリ実行時**にユーザーのリクエストを処理するバックエンド処理
（API・DBサーバー・認証サーバー等）」であり、ビルド・デプロイ・CI（テスト実行）といった
**開発時・デプロイ時のみ動く自動化**は対象外と解釈する。成果物自体が静的ファイルのみで完結していれば
（＝アプリの実行時にサーバーへリクエストが飛ばなければ）要求仕様書の意図に反しない。

この解釈に基づき、`production_system_sim`と同様に以下を整備する（実装はPhase 7、
`docs/implementation-plan.md`参照）。

- `main`へのpush契機で自動ビルド・`gh-pages`ブランチへのデプロイ（`peaceiris/actions-gh-pages`）
- PR作成・更新時のCI（型チェック・ビルド・vitest実行）

---

## §3. 自動テスト方針

**決定**: vitestによるユニットテストを必須整備する。対象範囲は以下に絞る。

- DAO生成ロジック（`table-definitions/*.json`からのIndexedDBスキーマ構築・DAO関数群）
- バリデーションエンジン（要求仕様書§5.2の5ステップ：型→NotNull→長さ→定数→ユニーク）
- CSV取込のUpsert・部分成功（エラー行スキップ）挙動
- EFFECT-1（JSON追加のみでの新規テーブル反映）・EFFECT-2（バリデーション値変更のみでの拡張）を
  検証するシナリオテスト（要求仕様書§1.2の判定方法をそのままテストケース化する）

**決定（対象外）**: Playwright + axe-core によるアクセシビリティ自動テストは導入しない。
要求仕様書DONT-9「多言語対応・アクセシビリティ対応：日本語UIのみを対象とする」に基づき、
本PoCではアクセシビリティを検証対象に含めない。

---

## §4. 要求仕様書が実装詳細まで規定していない点への追加決定

以下は実装時の手戻りを防ぐため、設計段階で先に決定しておく。要求仕様書の「やる事／やらない事」を
拘束するものではなく、あくまで実装方針の初期案であり、実装フェーズで明確な支障が判明した場合は
本書を更新した上で変更してよい。

### 4.1 IndexedDBアクセス

生のIndexedDB APIを直接使うとコールバックベースの記述になり可読性が落ちるため、軽量なPromiseラッパー
ライブラリ `idb`（Jake Archibald作）を採用する。DAO生成ロジックはこのラッパーの上に構築する。

### 4.2 CSVパース

`papaparse` を採用する。改行コード・引用符エスケープ・BOM等のCSV固有のエッジケースをゼロから
実装することは、本PoCの検証目的（JSON定義駆動アーキテクチャの実現可能性）から外れるため、
実績のあるライブラリに委ねる。Web Worker内でのパース処理（要求仕様書DO-3）もpapaparseの
Worker対応機能を利用できる。

### 4.3 IndexedDBスキーマバージョン管理

要求仕様書§7-4「バージョン変更時は既存データを削除して再作成する」を具体化する。

- 起動時に全テーブル定義JSON（`table-definitions/*.json`）の内容を結合しシリアライズした文字列から
  簡易ハッシュ値を算出する
- 直前に使用したハッシュ値を`localStorage`に保存しておき、起動時に比較する
- 差異があれば、IndexedDBデータベースを削除し、現在のテーブル定義JSONに従って再作成する
  （既存データは失われる。これはPoCとして許容する簡易方針であり、要求仕様書§7-4に明記済みの
  想定挙動である）

### 4.4 ディレクトリ構成（初期案）

```
poc_master_data_management_sys/
├── CLAUDE.md
├── README.md
├── docs/
│   ├── requirements.md         # 要求仕様書（原文、直接編集しない）
│   ├── design.md               # 本書
│   └── implementation-plan.md  # フェーズ計画
├── table-definitions/          # マスタテーブル定義JSON（実行時fetch対象）
│   ├── m_item.json
│   └── m_partner.json
├── export-definitions/         # 連携ファイル定義JSON（実行時fetch対象）
│   └── item_export_v1.json
├── package.json / tsconfig.json / vite.config.ts / index.html
├── .github/workflows/
│   ├── test.yml
│   └── deploy.yml
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── core/
    │   ├── schema/        # テーブル定義JSONの型定義・読み込み・定義自体のバリデーション
    │   ├── dao/           # 実行時DAO生成・IndexedDBスキーマ構築（idbベース）
    │   └── validation/    # バリデーションエンジン（型/NotNull/長さ/定数/ユニーク）
    ├── workers/
    │   └── csvImport.worker.ts  # パース・バリデーション・Upsert登録
    ├── screens/
    │   ├── ImportScreen.tsx        # SCR-1 CSV取込画面
    │   ├── SearchExportScreen.tsx  # SCR-2 マスタ検索・出力画面
    │   └── ImportLogScreen.tsx     # SCR-3 取込実行ログ画面
    └── **/*.test.ts
```

このディレクトリ構成は`production_system_sim`の「`src/domain/`にドメインロジックを分離しUIから
独立させる」という設計方針（同リポジトリCLAUDE.md参照）を踏襲し、本PoCでは`src/core/`が
その役割を担う。

### 4.5 テーブル定義サンプルの複数化

要求仕様書§7項番3「単一のテーブル定義でしか動かない実装は、DAO実行時生成の検証として不十分」を
満たすため、最低2種類のテーブル定義を用意する。

- `m_item`（品目マスタ）: 要求仕様書§5.1のサンプルをそのまま採用
- `m_partner`（取引先マスタ）: カラム構成が異なる例として新規に定義する
  （例: `partner_code`(PK)・`partner_name`・`partner_type`(constants: `得意先`/`仕入先`)・
  `phone_number`・`address`。詳細はPhase 1着手時に確定する）

### 4.6 テーブル定義JSON一覧の管理方法（index.jsonマニフェスト）

GitHub Pages（静的ファイルホスティング）にはディレクトリ一覧を取得するAPIがなく、
`table-definitions/*.json`というワイルドカードを実行時に直接fetchすることはできない。

**決定**: `table-definitions/index.json`に`{"tableIds": ["m_item", "m_partner"]}`の形式で
配置済みの`tableId`一覧を持たせ、起動時にまずこれをfetchしてから、各`tableId`ごとに
`table-definitions/{tableId}.json`を個別にfetchする。`export-definitions/`についても
Phase 5で同様に`export-definitions/index.json`を導入する。

**EFFECT-1との関係**: 新規マスタテーブルを追加する際は、定義JSON本体に加えてこの
`index.json`への`tableId`追記が必要になる。これはコード修正ではなくJSONデータの追記で
あるため、要求仕様書§1.2 EFFECT-1「JSON定義ファイルの追加のみで…コード修正なしに追加できる」
の要件は引き続き満たす。EFFECT-1の検証手順（Phase 6・8）では「定義JSONの追加」と
「index.jsonへの追記」の両方を実施した上で、アプリのリロードだけで反映されることを確認する。

---

## §5. 実装時に確認すべき設計判断（要求仕様書からの再掲）

- **ユニーク制約は単一カラムのみ**（DONT-2）。複合キーでのユニーク制約は実装しない
- **primaryKey=trueのカラムは自動的にnotNull=true, unique=trueとして扱う**。明示的に
  notNull=falseまたはunique=falseが指定されている場合は定義エラーとして起動時に警告する
  （要求仕様書§5.1制約条件）
- **Upsertの判定基準は主キー一致のみ**。CSV内の主キーがIndexedDB内の既存レコードの主キーと一致する
  場合のみUpsert対象とし、それ以外のunique制約違反は重複エラーとして扱う（要求仕様書§5.2 手順5）
- **エラー行はスキップし、正常な行のみ登録する**（部分成功を許容、All or Nothingにしない。
  要求仕様書§5.3）
- **テーブル間整合性チェックは実装しない**（DONT-1）。バリデーションは単一テーブル内で完結させる
- **1回の取込＝1ファイル＝1テーブル**（DONT-3）。複数テーブルの一括取込機能は実装しない
- **認証・認可機能は実装しない**（DONT-5）。ログイン機構を持たない
- **レコード単位の変更履歴・監査ログは対象外**（DONT-7）。取込バッチ単位の実行ログ（`import_logs`、
  要求仕様書§5.5）のみを実装する

疑問点や要求仕様書の記述と実装方針が食い違う可能性に気づいた場合は、要求仕様書§7項番1の申し送り
「実装に含めないこと。疑問があれば実装を止めて確認すること」に従い、実装を進める前にユーザーに
確認する。
