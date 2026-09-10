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

`pahcer-ui` は `pahcer_config.toml` を含むディレクトリをワークスペースのルートとして検出します。現在のディレクトリから親方向に探索するため、ワークスペース内のどのディレクトリからでも実行できます。対象を明示する場合は `--workspace` または `-C` を使います。

CLI は操作単位のサブコマンドで構成されています。Web UI サーバーを起動・再利用するのはブラウザ系コマンド (`open` / `view` / `start` / `restart`) だけで、`run` / `results` / `cases` / `case` / `comment` / `source` / `diff` / `visualizer` / `preferences` / `group` / `sort` はターミナル内で完結します。

開発中は `npm link` を使わず、`npm run cli -- ...` で CLI をビルドして実行できます。これは `cargo run` に近い使い方です。

```bash
npm run cli -- help
npm run cli -- -C /path/to/contest results
npm run cli -- -C /path/to/contest run --start-seed 0 --end-seed 100
```

```bash
# 未初期化のワークスペースで一度だけ実行
pahcer-ui init

# ワークスペースを明示して初期化
pahcer-ui --workspace /path/to/contest init

# テストを実行して結果をターミナルに流す
pahcer-ui -C /path/to/contest run --start-seed 0 --end-seed 100 --freeze-best-scores

# 実行結果・テストケース・ファイルを参照する
pahcer-ui results                                   # 実行結果一覧 (別名: tree)
pahcer-ui cases <execution-id>                      # 実行内のテストケース一覧
pahcer-ui case <execution-id> <seed> --kind output  # input/output/error ファイルを表示
pahcer-ui source <execution-id>                     # 実行時点のソースファイル一覧
pahcer-ui source <execution-id> --file src/main.rs  # 実行時点のソース内容
pahcer-ui diff <older-execution-id> <newer-execution-id>

# 実行結果にコメントを付ける (省略時は対話的に入力)
pahcer-ui comment <execution-id> 焼きなましの温度調整

# ビジュアライザのキャッシュを確認・取得する
pahcer-ui visualizer status
pahcer-ui visualizer download <visualizer-url>

# 表示設定 (Web UI と共有) を確認・変更する
pahcer-ui preferences                    # 現在の設定を表示
pahcer-ui preferences --zoom 1.5         # ビジュアライザのズーム倍率
pahcer-ui group seed                     # グルーピングモード (execution / seed)
pahcer-ui sort absoluteScoreDesc         # 現在のモードの並び順

# JSON で出力する
pahcer-ui results --json
pahcer-ui cases <execution-id> --json

# サーバーを起動・再利用してブラウザを開く
pahcer-ui open

# ブラウザを開かずにサーバーを起動 (start と server は同じ動作)
pahcer-ui start

# 状態確認・URL表示・停止・再起動
pahcer-ui status
pahcer-ui url
pahcer-ui stop
pahcer-ui restart

# 特定の結果をブラウザで直接開く
pahcer-ui view execution <execution-id>
pahcer-ui view case <execution-id> <seed>
pahcer-ui view input|output|error <execution-id> <seed>
pahcer-ui view visualizer <execution-id> <seed>
pahcer-ui view comparison <execution-a> <execution-b>
pahcer-ui view diff <execution-a> <execution-b>
pahcer-ui view source <execution-id>
```

`open` と `view ...` に `--no-open` を付けると、ブラウザを起動せずに URL の表示だけを行います (サーバーは起動・再利用されます)。使えるサブコマンドとオプションの一覧は `pahcer-ui help` で確認できます。

サーバーはワークスペースごとに `.pahcer-ui/server.json` で管理され、ポートは自動割り当てされます。`pahcer-ui open` または `pahcer-ui view ...` で起動し、以後のブラウザ操作では同じサーバーを再利用します。停止は `pahcer-ui stop` で明示的に行えます。

`pahcer-ui init` は対話的に `pahcer init` を実行します。非対話的に初期化する場合は、例えば次のように指定できます。

```bash
pahcer-ui init --problem ahc999 --objective max --lang rust
```

CLI のヘルプとエラーメッセージは英語です。Web UI の表示言語は既存の日本語表示を維持します。

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
