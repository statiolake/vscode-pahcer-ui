# Pahcer UI for VS Code

AtCoder Heuristic Contest (AHC) のローカルテスト並列実行ツール「pahcer」の VS Code 拡張機能です。

## 機能

### テスト実行結果の表示

- pahcer で実行したテストケースの結果をツリービューで表示
- 実行結果を自動取得
- AC/WA の状態、スコア、相対スコア、実行時間を表示
- 実行結果は自動的にリフレッシュ

### 表示モードの切り替え

ツールバーのトグルボタンで 2 つの表示モードを切り替え可能:

- **実行ごと**: 各実行をグループ化し、その下に個別のテストケースを表示
- **Seed ごと**: 各 Seed をグループ化し、その下に複数回の実行結果を表示

### テスト実行

- ツールバーの「Run」ボタンから `pahcer run` を実行
- VS Code のターミナルで実行過程を確認可能
- 実行結果は自動的にパネルに反映

### ビジュアライザ連携

- テストケースをクリックすると AtCoder 公式ビジュアライザで表示
- 初回クリック時にビジュアライザの URL を入力
- ビジュアライザと依存ファイルを自動ダウンロード・キャッシュ
- seed、input、output を自動セット
- 各実行の出力ファイルを `.pahcer-ui/results/result_${id}/` に保存し、過去の実行結果も確認可能

## 必要要件

- [pahcer](https://github.com/terry-u16/pahcer) がインストールされていること
- `pahcer init` が実行済みであること
- npm がインストールされていること（開発時）

## 使い方

1. AtCoder のコンテストディレクトリで VS Code を開く
2. サイドバーに表示される Pahcer アイコンをクリック
3. ツールバーの「Run」ボタンでテストを実行
4. テストケースをクリックしてビジュアライザで確認
5. トグルボタンで表示モードを切り替え

## ターミナルから使う

`pahcer-ui` は `pahcer_config.toml` を含むディレクトリをワークスペースのルートとして検出します。現在のディレクトリから親方向に探索するため、ワークスペース内のどのディレクトリからでも実行できます。

```bash
# 未初期化のワークスペースで一度だけ実行
pahcer-ui init

# サーバーを起動または再利用してブラウザを開く
pahcer-ui

# ブラウザを開かずにサーバーを起動
pahcer-ui start

# 状態確認・URL表示・停止
pahcer-ui status
pahcer-ui url
pahcer-ui stop
```

サーバーはワークスペースごとに `.pahcer-ui/server.json` で管理され、ポートは自動割り当てされます。`pahcer-ui` の最初の実行で起動し、以後の実行では同じサーバーを再利用します。停止は `pahcer-ui stop` で明示的に行えます。

`pahcer-ui init` は対話的に `pahcer init` を実行します。非対話的に初期化する場合は、例えば次のように指定できます。

```bash
pahcer-ui init --problem ahc999 --objective max --lang rust
```

Dev Containerなどで外部からポートを転送する場合は、必要に応じてlisten先を指定してください。

```bash
pahcer-ui start --host 0.0.0.0
```

## ディレクトリ構造

```
.
├── pahcer/
│   └── json/
│       └── result_*.json    # テスト実行結果
├── tools/
│   ├── in/                  # 入力ファイル
│   ├── out/                 # 出力ファイル（最新実行）
│   └── err/                 # エラーファイル（最新実行）
└── .pahcer-ui/
    ├── results/             # 実行結果の保存先
    │   └── result_*/
    │       ├── out/         # 各実行の出力ファイル
    │       └── err/         # 各実行のエラーファイル
    └── visualizer/          # ビジュアライザのダウンロード先
        └── *.html           # ビジュアライザファイル
```

## 開発

```bash
# 依存関係のインストール
npm install

# ビルド
npm run compile

# 開発中のCLIをPATHに登録
npm run build
npm link

# 拡張機能のデバッグ実行
F5 キーを押す
```

## ライセンス

MIT
