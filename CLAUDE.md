# CLAUDE.md

このファイルはClaude Codeがこのプロジェクトで作業する際に毎回読み込む。簡潔さを優先しているので、
一次資料・設計判断の根拠を確認したいときは `docs/requirements.md`（要求仕様書。原文のまま格納、
直接編集しない）・`docs/design.md`（要求仕様書からの追加決定・実装方針）・
`docs/implementation-plan.md`（フェーズ計画・実施結果）を参照すること。

## プロジェクト概要

マスタ管理システムのPoC（Proof of Concept）。JSON定義駆動型アーキテクチャ
（マスタ定義・バリデーション・連携ファイル仕様をJSONで外部化する設計）の技術的実現可能性を
検証することが目的であり、将来の本番システム（Java/Spring Boot構成）への移行を見据えて
仕様の詳細をPoCの実装・動作確認を通じて確定させる（要求仕様書§1）。

対象読者は開発チームメンバー。商用製品ではなく検証用PoC。

**姉妹リポジトリ`production_system_sim`との関係**: `production_system_sim`は生産管理ドメインの
シミュレーターで、React + TypeScript + Vite・バックエンドなし・ドメインロジックを純粋関数として
UIから分離する設計を採用している。本リポジトリはその技術スタックと「ロジックをUIから分離する」
設計思想を踏襲しつつ、テーマは全く異なる（JSON定義駆動でのマスタ管理・IndexedDB・Web Worker）
独立した新規プロジェクトである。ドメインロジック・型定義をそのまま移植することはしない
（検証対象そのものが異なるため）。

## 技術スタック・アーキテクチャ

- React 18 + TypeScript + Vite。**バックエンドサーバーは持たない**（`docs/design.md` §1・§2）
- データ永続化はブラウザの**IndexedDB**のみ（`idb`ラッパー使用）。サーバー不要、ユーザーのブラウザ
  ローカルに閉じる
- CSVパースは**Web Worker**上で`papaparse`を用いて行い、UIスレッドをブロックしない（要求仕様書DO-3）
- **DAO生成タイミングは実行時**: アプリ起動時に`table-definitions/*.json`をfetchし、動的に
  IndexedDBのオブジェクトストア（スキーマ）とアクセス関数（DAO）を構築する（要求仕様書§4）。
  JSON定義の差し替えだけでテストケースを増やせるようにするための採用であり、ビルド時のコード生成は
  採用しない
- IndexedDBのバージョン管理は簡易方針：テーブル定義JSON群のハッシュが変わったら既存データを削除して
  再作成する（`docs/design.md` §4.3）。本番相当のマイグレーション機構は実装しない

## ディレクトリ構成（計画時点）

以下は`docs/design.md` §4.4の初期案。実装が進むにつれて確定した構成に随時更新すること。

```
poc_master_data_management_sys/
├── CLAUDE.md               # このファイル
├── README.md               # 人間向けの概要
├── docs/
│   ├── requirements.md      # 要求仕様書（原文、直接編集しない）
│   ├── design.md            # 要求仕様書との差分・追加決定（★まず読む）
│   └── implementation-plan.md # フェーズ計画・実施結果
├── table-definitions/       # マスタテーブル定義JSON（実行時fetch対象、DO-1）
│   ├── index.json             # 配置済みtableId一覧（GitHub Pagesにディレクトリ一覧APIがないため。design.md §4.6）
│   ├── m_item.json           # 品目マスタ
│   └── m_partner.json        # 取引先マスタ
├── export-definitions/      # 連携ファイル定義JSON（実行時fetch対象、DO-8）
│   └── item_export_v1.json
├── package.json / tsconfig.json / vite.config.ts / index.html
├── .github/workflows/
│   ├── test.yml              # PRごとの型チェック・ビルド・vitest
│   └── deploy.yml            # main push時のビルド・gh-pagesデプロイ
└── src/
    ├── main.tsx
    ├── App.tsx              # 画面本体。タブ切り替え・MasterDataAccessProviderの配線
    ├── useMasterDataAccess.ts        # 起動時のDAO初期化（loadTableDefinitions→initMasterDataAccess）
    ├── MasterDataAccessContext.tsx   # 上記の結果を全画面で共有するReact Context
    ├── core/                # ★最重要ディレクトリ（ドメインロジック本体）
    │   ├── schema/            # テーブル定義JSONの型定義・読み込み・定義自体のバリデーション
    │   ├── dao/               # 実行時DAO生成・IndexedDBスキーマ構築（idbベース）
    │   └── validation/        # バリデーションエンジン（型/NotNull/長さ/定数/ユニーク）
    ├── workers/
    │   ├── csvImport.worker.ts # 薄いWorkerラッパー（DB接続・メッセージ送受信のみ）
    │   └── importCsvFile.ts    # パース・バリデーション・Upsert登録・取込ログ生成の中核ロジック
    ├── screens/
    │   ├── DataAccessGate.tsx      # 起動時DAO初期化の完了待ち・エラー表示ガード（各画面が使用）
    │   ├── ImportScreen.tsx        # SCR-1 CSV取込画面
    │   ├── SearchExportScreen.tsx  # SCR-2 マスタ検索・出力画面
    │   └── ImportLogScreen.tsx     # SCR-3 取込実行ログ画面
    └── **/*.test.ts
```

## コマンド（計画時点。Phase 0実装後に確定）

```bash
npm install
npm run dev          # 開発サーバー起動
npm run build         # 型チェック（tsc）＋ビルド（vite build）
npx tsc --noEmit      # 型チェックのみ実行
npm test              # vitestによる自動テスト全件実行
npm run preview       # build成果物をGitHub Pages相当のbaseパスで動作確認
```

## デプロイ

`docs/design.md` §2の解釈（DONT-4が禁止するのは「アプリ実行時のバックエンド処理」であり、
ビルド・デプロイ・CIの自動化は対象外）に基づき、`production_system_sim`と同様の構成を採る。

- `main`へのpushを契機に`.github/workflows/deploy.yml`が自動ビルドし、`gh-pages`ブランチへpushする
  （`peaceiris/actions-gh-pages`使用）
- PRの作成・更新時は`.github/workflows/test.yml`が型チェック・ビルド・vitestを実行する
- `vite.config.ts`の`base`はビルド用途ごとに変える：`npm run dev`はルート配信、
  通常のbuild/previewは`/poc_master_data_management_sys/`

## 現在の実装状況

`docs/implementation-plan.md`のPhase 0〜4（プロジェクト初期化／マスタテーブル定義JSON＋実行時
DAO生成／バリデーションエンジン／CSV取込・Web Worker／画面実装）まで完了。
`table-definitions/`（index.jsonマニフェスト＋m_item/m_partner）・`src/core/schema/`
（定義JSONの型・fetch・定義自体の検証）・`src/core/dao/`（idbベースの動的スキーマ構築・
汎用DAO・import_logs用DAO）・`src/core/validation/`（型→NotNull→長さ→定数→ユニークの
5手順バリデーション関数群）・`src/workers/`（CSV取込の中核ロジックと薄いWorkerラッパー）・
`src/screens/`（SCR-1〜3の3画面）・`src/useMasterDataAccess.ts`/
`src/MasterDataAccessContext.tsx`（アプリ起動時のDAO初期化とContext共有）を実装済み。
連携ファイル作成機能（DO-8）は未着手。
次に着手すべきは`docs/implementation-plan.md`のPhase 5（連携ファイル作成機能）。

## 実装時に確認すべき設計判断（要求仕様書「やらない事」の再掲）

以下は要求仕様書§3で明示的にスコープ外とされている機能。要求や関連する会話の中でこれらに近い機能への
言及があっても実装に含めないこと。**疑問があれば実装を止めてユーザーに確認すること**（要求仕様書§7項番1）。

| ID | 項目 |
|----|------|
| DONT-1 | テーブル間整合性チェック（外部キー的な参照整合性・関連テーブルのレコード存在チェック） |
| DONT-2 | 複合キーでのユニーク制約（単一カラムのみサポート） |
| DONT-3 | 1回の取込での複数テーブル一括取込（1ファイル＝1テーブルに限定） |
| DONT-4 | バックエンドサーバー・API・DBサーバーの構築（IndexedDBのみ。ただしビルド・デプロイ・CIとしての GitHub Actions利用は許可、`docs/design.md` §2参照） |
| DONT-5 | 認証・認可機能 |
| DONT-6 | 大量データ（万件単位）を想定したパフォーマンスチューニング |
| DONT-7 | マスタデータ自体の変更履歴・監査ログ（取込バッチ単位のログのみ対象） |
| DONT-8 | 本番相当のセキュリティ対策（データ暗号化・詳細なセキュリティ監査） |
| DONT-9 | 多言語対応・アクセシビリティ対応（日本語UIのみ） |

## コーディング上の注意

- バリデーションは要求仕様書§5.2の順序（①型→②NotNull→③長さ→④定数→⑤ユニーク）を厳守すること。
  順序を変えると、エラーメッセージの内容や、どのチェックで最初に弾かれるかの期待動作が要求仕様書と
  食い違う
- DAO生成ロジック・バリデーションロジックは`src/core/`に集約する。画面（`src/screens/`）や
  Web Worker（`src/workers/`）から個別にIndexedDBを直接操作したり、独自のバリデーション判定を
  重複実装したりしないこと
- primaryKey=trueのカラムはnotNull=true, unique=trueとして自動的に扱う。定義JSON側で
  明示的にfalseが指定されている場合は、実装を進めず定義エラーとして起動時に警告を出す
  （要求仕様書§5.1「制約条件」）
- Upsertは主キー一致時のみ行う。それ以外のunique制約違反は重複エラーとしてスキップする
  （要求仕様書§5.2手順5・§5.3）
- エラー行はスキップし、正常な行のみ登録する（部分成功を許容、All or Nothingにしない。
  要求仕様書§5.3）
- EFFECT-1・EFFECT-2（要求仕様書§1.2）を新規マスタテーブル追加のシナリオで実際に動作確認できる状態を
  常に保つこと。実装方針に迷った場合はこの2つの効果基準を優先する

## ロジック検証ループ

- レビュー専用のサブエージェントを用意している：
  - `logic-reviewer`（`.claude/agents/logic-reviewer.md`）: `src/core/`配下のDAO生成ロジック・
    バリデーションエンジンの実装とテストが`docs/requirements.md`・`docs/design.md`の仕様と
    矛盾していないかを確認する
  - `ux-reviewer`（`.claude/agents/ux-reviewer.md`）: SCR-1〜3（取込／検索・出力／取込ログ）の
    UI/UXの操作性・メッセージ表現・破壊的操作（Upsert）の安全性をレビューする
  - `scope-reviewer`（`.claude/agents/scope-reviewer.md`）: 要求仕様書§3「やらない事」（DONT-1〜9）
    への逸脱がないか、§1.2の効果基準（EFFECT-1/2）が実証可能な実装になっているかを専門に確認する
- 各`src/core/*.ts`・`*.test.ts`を変更した後は`logic-reviewer`を、画面（`src/screens/*.tsx`）を
  変更した後は`ux-reviewer`を、フェーズ完了時には`scope-reviewer`を実行する運用とする
  （`docs/implementation-plan.md`の各フェーズ末尾に対応するSubagentを明記）
