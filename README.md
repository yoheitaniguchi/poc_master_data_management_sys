# poc_master_data_management_sys

マスタ管理システムのPoC（Proof of Concept）。JSON定義駆動型アーキテクチャ
（マスタ定義・バリデーション・連携ファイル仕様をJSONで外部化する設計）の技術的実現可能性を
検証する検証用アプリ。詳細は `CLAUDE.md` を参照。

バックエンドを持たず、データはブラウザのIndexedDBに閉じる。CSVファイルからマスタデータを取り込み、
検索・CSVダウンロード・連携ファイル出力ができる。

## ドキュメント

- `docs/requirements.md`: 要求仕様書（一次資料、原文のまま格納）
- `docs/design.md`: 要求仕様書からの追加決定・実装方針
- `docs/implementation-plan.md`: フェーズ計画・実施結果

## 現在の状態

プロジェクト初期化（`docs/implementation-plan.md` Phase 0）まで完了。
マスタテーブル定義・DAO・バリデーション等のアプリケーションロジックは未着手（Phase 1以降）。

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

`main`ブランチへのpushを契機にGitHub Actionsが自動ビルドし、`gh-pages`ブランチへ配信する予定
（`docs/design.md` §2・`docs/implementation-plan.md` Phase 7参照）。
