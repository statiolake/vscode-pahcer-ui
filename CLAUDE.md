# Claude Code への指示

## プロジェクト情報

このプロジェクトは pahcer ツールの VS Code Extension UI です。

## 開発環境

- **パッケージマネージャー**: pnpm を使用しています（npm や yarn は使用しないでください）
- **pahcer ツール**: pahcer フォルダに Rust で実装されたコマンドラインツールがあります

## pahcer について

pahcer は AtCoder Heuristic Contest (AHC) のローカルテスト並列実行ツールです。

主なコマンド:
- `pahcer init`: 初期設定
- `pahcer run`: テストケースを並列実行
- `pahcer list`: 過去のテスト実行結果を一覧表示
- `pahcer prune`: pahcer が作成した Git タグを削除

実行結果は `./pahcer/json/result_*.json` に保存されます。
