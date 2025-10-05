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

## 拡張機能の主要機能

### 1. テスト実行結果の表示

- `pahcer/json/result_*.json` から最新 10 件の実行結果を読み込み
- TreeView でテスト結果を表示
- AC/WA の状態、スコア、相対スコア、実行時間などを表示
- ファイル監視により、新しい実行結果が作成されると自動的にリフレッシュ

### 2. 表示モードの切り替え

2 つのグルーピングモードがあります:

- **実行ごと (byExecution)**: デフォルトモード。各実行結果をトップレベルに表示し、展開すると個別のテストケースが表示される
- **Seed ごと (bySeed)**: 各 Seed をトップレベルに表示し、展開するとその Seed の複数回の実行結果が表示される

`PahcerResultsProvider` クラスで管理:
- `setGroupingMode(mode)`: モードを切り替え
- `getGroupingMode()`: 現在のモードを取得

### 3. テスト実行

- ツールバーの「Run」ボタンから `pahcer run` を VS Code ターミナルで実行
- 実行結果は自動的にパネルに反映される

### 4. ビジュアライザ連携

- テストケースをクリックすると AtCoder 公式ビジュアライザで表示
- 初回クリック時にユーザーにビジュアライザの URL を入力させる
- HTML ファイルと依存関係（JS、CSS、WASM など）を自動ダウンロード
- ダウンロードしたファイルは `.pahcer-ui/` ディレクトリにキャッシュ
- Webview で表示し、seed、input、output を自動セット

### 5. 出力ファイルの保存

- 新しい実行結果が作成されると、`tools/out` と `tools/err` のディレクトリを `.pahcer-ui/results/result_${id}/` にコピー
- 過去の実行結果のビジュアライズも可能

## ディレクトリ構造

```
.
├── pahcer/
│   └── json/
│       └── result_*.json    # pahcer が出力するテスト実行結果
├── tools/
│   ├── in/                  # 入力ファイル
│   ├── out/                 # 出力ファイル（最新実行）
│   └── err/                 # エラーファイル（最新実行）
├── .pahcer-ui/              # この拡張機能が作成するディレクトリ
│   ├── results/             # 実行結果の保存先
│   │   └── result_*/
│   │       ├── out/         # 各実行の出力ファイルのコピー
│   │       └── err/         # 各実行のエラーファイルのコピー
│   └── visualizer/          # ビジュアライザのダウンロード先
│       └── *.html           # ダウンロードしたビジュアライザファイル
└── src/
    ├── extension.ts              # メインのエントリポイント
    ├── pahcerResultsProvider.ts  # TreeView プロバイダー
    └── visualizerManager.ts      # ビジュアライザ管理
```

## 主要なファイル

### src/extension.ts

- 拡張機能のアクティベーション
- コマンドの登録
- ファイル監視の設定
- 出力ファイルのコピー処理

### src/pahcerResultsProvider.ts

- TreeView のデータプロバイダー
- 2 つのグルーピングモード (byExecution / bySeed) の実装
- JSON ファイルの読み込みと解析

### src/visualizerManager.ts

- ビジュアライザの URL 入力プロンプト
- HTML と依存ファイルのダウンロード
- Webview での表示
- seed、input、output の自動セット

## コマンド

- `vscode-pahcer-ui.run`: pahcer run を実行
- `vscode-pahcer-ui.refresh`: 結果パネルをリフレッシュ
- `vscode-pahcer-ui.switchToSeed`: Seed ごとの表示に切り替え
- `vscode-pahcer-ui.switchToExecution`: 実行ごとの表示に切り替え
- `vscode-pahcer-ui.showVisualizer`: ビジュアライザを表示（内部コマンド）

## コンテキスト変数

- `pahcer.groupingMode`: 現在のグルーピングモード (`byExecution` または `bySeed`)
  - ツールバーのトグルボタンの表示切り替えに使用
