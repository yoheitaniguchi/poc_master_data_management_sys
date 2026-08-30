# poc_master_data_management_sys

マスタ管理システムのPoC（Proof of Concept）。JSON定義駆動型アーキテクチャ
（マスタ定義・バリデーション・連携ファイル仕様をJSONで外部化する設計）の技術的実現可能性を
検証する検証用アプリ。詳細は `CLAUDE.md` を参照。

バックエンドを持たず、データはブラウザのIndexedDBに閉じる。CSVファイルからマスタデータを取り込み、
検索・CSVダウンロード・連携ファイル出力ができる。

## 主な機能

- CSV取込（Web Workerでバリデーション・Upsert登録。エラー行はスキップし部分成功を許容）
- マスタ検索・CSVダウンロード（全カラムそのまま、取込画面へ再投入可能な形式）
- 連携ファイル出力（`export-definitions/*.json`で定義した出力カラム・ヘッダー名・区切り文字に変換）
- 取込実行ログ（バッチ単位の成功/失敗件数・エラー明細）

マスタテーブル定義（`public/table-definitions/*.json`）を追加・変更するだけで、コード修正なしに
新しいテーブルの取込・検索・出力に対応できる（JSON定義駆動アーキテクチャ）。

## ドキュメント

- `docs/requirements.md`: 要求仕様書（一次資料、原文のまま格納）
- `docs/design.md`: 要求仕様書からの追加決定・実装方針
- `docs/implementation-plan.md`: フェーズ計画・実施結果

## 現在の状態

`docs/implementation-plan.md`のPhase 0〜7（プロジェクト初期化〜GitHub Pagesビルド・デプロイ構成）
まで完了。

## ローカル実行

```
npm install
npm run dev          # 開発サーバー起動
npm run build         # 型チェック（tsc）＋ビルド（vite build）
npx tsc --noEmit      # 型チェックのみ実行
npm test              # vitestによる自動テスト全件実行
npm run preview       # build成果物をGitHub Pages相当のbaseパスで動作確認
```

## 公開版

`main`ブランチへのpushを契機に`.github/workflows/deploy.yml`が自動ビルドし、`gh-pages`ブランチへ
配信する（`docs/design.md` §2・`docs/implementation-plan.md` Phase 7参照）。GitHub Pages自体の
公開設定（リポジトリのSettings → Pages → Source を`gh-pages`ブランチに設定）は別途リポジトリ
管理者側での有効化が必要。
