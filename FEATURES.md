# Pahcer UI 機能一覧

このドキュメントは、Pahcer UI の全機能を詳細にまとめたものです。

## 1. テスト実行結果の表示

### 1.1 TreeView による結果表示
- **場所**: Activity Bar の Pahcer アイコン → Test Results
- **機能**:
  - `pahcer/json/result_*.json` から最新10件の実行結果を読み込み
  - 各実行結果のサマリー情報を表示:
    - 実行時刻
    - AC数/全ケース数
    - 平均スコア（絶対値）
    - 平均相対スコア
    - 最大実行時間
    - タグ名（pahcerが自動生成するGitタグ）
    - ユーザーコメント（手動追加）
  - アイコンによる状態表示:
    - 緑のチェック: 全ケースAC
    - 黄色の警告: 一部ケースAC
    - 赤のエラー: 全ケースWA

### 1.2 ファイル監視による自動更新
- **機能**:
  - `pahcer/json/result_*.json` ファイルの作成/変更/削除を監視
  - 新しい実行結果が作成されると自動的にTreeViewをリフレッシュ
  - 実行結果作成時に出力ファイルを自動保存（後述）

## 2. 表示モードの切り替え

### 2.1 実行ごとグルーピング (byExecution)
- **デフォルトモード**
- **表示構造**:
  ```
  実行1 (2025/01/07 12:34:56 - AC:95/100 Score:1234.56 Rel:0.789)
    ├─ Summary: Total Score, Max Time
    ├─ Seed 0000: score (relative%)
    ├─ Seed 0001: score (relative%)
    └─ ...
  実行2 (2025/01/07 12:30:00 - AC:90/100 Score:1200.00 Rel:0.750)
    └─ ...
  ```
- **ソート順の変更可能**:
  - シードの昇順/降順
  - 相対スコアの昇順/降順
  - 絶対スコアの昇順/降順

### 2.2 Seedごとグルーピング (bySeed)
- **表示構造**:
  ```
  0000 (10 runs - Avg: 1234.56 (0.789%))
    ├─ 2025/01/07 12:34:56: 1250 (0.800%)
    ├─ 2025/01/07 12:30:00: 1220 (0.780%)
    └─ ...
  0001 (10 runs - Avg: 1100.00 (0.750%))
    └─ ...
  ```
- **機能**:
  - 各Seedに対する複数回の実行結果を時系列で比較
  - スコアの推移を確認しやすい
- **ソート順の変更可能**:
  - 実行の昇順/降順（時系列）
  - 絶対スコアの昇順/降順
- **特殊表示**:
  - スコア順ソート時、最新実行に青いフォーカスアイコンを表示

### 2.3 切り替え方法
- TreeViewのツールバーにあるトグルボタンをクリック
- VS Code設定 `pahcer-ui.groupingMode` で永続化

## 3. テスト実行機能

### 3.1 Runコマンド
- **実行方法**: TreeViewツールバーの「▶」ボタン
- **動作**:
  - 新しいVS Codeターミナルを開く
  - `pahcer run` コマンドを実行
  - 実行結果は自動的にTreeViewに反映

### 3.2 出力ファイルの自動保存
- **機能**:
  - 新しい実行結果 `result_${id}.json` が作成されると自動発動
  - `tools/out/` と `tools/err/` の内容を `.pahcer-ui/results/result_${id}/` にコピー
  - 過去の実行結果のビジュアライズを可能にする

## 4. ビジュアライザ連携

### 4.1 ビジュアライザの表示
- **起動方法**: TreeView内のテストケース（Seed）をクリック
- **初回起動時**:
  - ビジュアライザのURL入力を促す
  - AtCoder公式ビジュアライザのURL（`https://img.atcoder.jp/...`）を受け付ける
  - HTML本体と依存ファイル（JS、CSS、WASM等）を自動ダウンロード
  - `.pahcer-ui/visualizer/` にキャッシュ

### 4.2 WebViewでの表示
- **機能**:
  - ダウンロードしたビジュアライザをWebViewで表示
  - Seed、入力、出力を自動的にセット
  - `window.PAHCER_SEED`, `window.PAHCER_INPUT`, `window.PAHCER_OUTPUT` として注入
  - ビジュアライザのフォームフィールドを自動入力

### 4.3 ズーム機能
- **操作方法**:
  - 右上のズームUIボタン（+/-/100%）
  - Ctrl/Cmd + マウスホイール
  - Ctrl/Cmd + `+`/`-`/`0` キーボードショートカット
- **設定の永続化**:
  - ズームレベルはVS Code設定 `pahcer-ui.visualizerZoomLevel` に保存
  - 次回ビジュアライザ起動時に同じズームレベルを適用

### 4.4 WebViewの再利用
- **機能**:
  - 既にビジュアライザが開いている場合、同じWebViewパネルを再利用
  - WebViewをリロードせずにIPCでSeed/入力/出力のみ更新
  - スクロール位置やズームレベルが保持される

### 4.5 過去実行結果のビジュアライズ
- **機能**:
  - 過去の実行結果（`.pahcer-ui/results/result_${id}/out/`）も表示可能
  - TreeViewで過去の実行を選択してクリック

## 5. コメント機能

### 5.1 コメント追加
- **操作方法**:
  - TreeViewで実行結果を右クリック → 「コメントを追加」
- **機能**:
  - 実行結果に対してユーザーコメントを記録
  - `.pahcer-ui/results/result_${id}/meta.json` に保存
  - TreeViewのラベルに `[コメント]` として表示

### 5.2 コメント編集
- **機能**: 同じ操作で既存コメントを編集可能

## 6. 比較モード

### 6.1 比較モードの有効化
- **操作方法**: TreeViewツールバーの「📊」ボタンをクリック
- **機能**:
  - TreeViewの各実行結果にチェックボックスが表示される
  - チェックボックスをON/OFFすると自動的に比較ビューを更新

### 6.2 比較ビュー
- **表示内容**:
  - 統計テーブル: 選択した実行結果のサマリー
  - 比較チャート: Seed別スコアの折れ線/散布図

### 6.3 コントロールパネル
- **Features設定**:
  - 入力ファイルの1行目からパラメータ名を指定（例: "N M K"）
  - 各パラメータの値が各Seedに対して抽出される
- **X軸設定**:
  - `seed`: Seed番号
  - `N`, `M`, `K`等: Features設定で指定したパラメータ
  - 式: `log(N)`, `N*M`, `sqrt(K)` 等の数式表現に対応
- **Y軸設定**:
  - `absolute`: 絶対スコア
  - `relative`: 相対スコア（%）
- **グラフタイプ**:
  - 折れ線グラフ（line）
  - 散布図（scatter）
- **失敗ケースをスキップ**:
  - ONにするとスコア0のケースをグラフから除外

### 6.4 グラフからビジュアライザ起動
- **機能**: グラフ上のポイントをクリックすると、そのSeedのビジュアライザが開く

### 6.5 設定の永続化
- **保存先**: `.pahcer-ui/config.json`
- **保存項目**:
  - `features`: Features設定
  - `xAxis`: X軸設定
  - `yAxis`: Y軸設定

## 7. リフレッシュ機能

### 7.1 手動リフレッシュ
- **操作方法**: TreeViewツールバーの「🔄」ボタン
- **機能**: TreeViewを手動で再読み込み

## 8. 並び順変更

### 8.1 並び順変更コマンド
- **操作方法**: TreeViewツールバーの「☰」ボタン
- **機能**:
  - 現在のグルーピングモードに応じたソート順を選択
  - クイックピックメニューで選択

### 8.2 並び順の永続化
- **設定項目**:
  - `pahcer-ui.executionSortOrder`: 実行ごとモードのソート順
  - `pahcer-ui.seedSortOrder`: Seedごとモードのソート順

## 9. 設定管理

### 9.1 VS Code設定
- `pahcer-ui.groupingMode`: 表示モード（byExecution / bySeed）
- `pahcer-ui.executionSortOrder`: 実行ごとモードのソート順
- `pahcer-ui.seedSortOrder`: Seedごとモードのソート順
- `pahcer-ui.visualizerZoomLevel`: ビジュアライザのズームレベル（0.5〜3.0）

### 9.2 ワークスペース固有設定
- `.pahcer-ui/config.json`: 比較モードの設定（features, xAxis, yAxis）
- `.pahcer-ui/results/result_${id}/meta.json`: 実行結果ごとのコメント

## 10. ディレクトリ構造

```
ワークスペースルート/
├── pahcer/
│   └── json/
│       └── result_*.json        # pahcer が出力する実行結果
├── tools/
│   ├── in/                      # 入力ファイル
│   ├── out/                     # 出力ファイル（最新実行）
│   └── err/                     # エラーファイル（最新実行）
└── .pahcer-ui/                  # この拡張機能が作成
    ├── config.json              # 比較モード設定
    ├── results/                 # 過去の実行結果
    │   └── result_${id}/
    │       ├── out/             # 出力ファイルのコピー
    │       ├── err/             # エラーファイルのコピー
    │       └── meta.json        # コメント等のメタ情報
    └── visualizer/              # ビジュアライザキャッシュ
        ├── *.html               # ビジュアライザHTML
        ├── *.js                 # JavaScript
        ├── *.css                # CSS
        └── *_bg.wasm            # WASM
```

## 11. コマンド一覧

| コマンドID | タイトル | 機能 |
|-----------|---------|------|
| `pahcer-ui.run` | テストを実行 | pahcer run をターミナルで実行 |
| `pahcer-ui.refresh` | 結果を更新 | TreeViewを手動リフレッシュ |
| `pahcer-ui.switchToSeed` | Seedごとにグルーピング | Seedごと表示モードに切り替え |
| `pahcer-ui.switchToExecution` | 実行ごとにグルーピング | 実行ごと表示モードに切り替え |
| `pahcer-ui.toggleComparisonMode` | 比較モードを切り替え | チェックボックス表示のON/OFF |
| `pahcer-ui.addComment` | コメントを追加 | 実行結果にコメントを追加/編集 |
| `pahcer-ui.changeSortOrder` | 並び順を変更 | ソート順を選択 |
| `pahcer-ui.showVisualizer` | ビジュアライザを表示 | ビジュアライザを開く（内部コマンド） |

## 12. 主要なクラス/ファイル

| ファイル | 役割 |
|---------|------|
| `src/extension.ts` | エントリポイント、コマンド登録、ファイル監視 |
| `src/pahcerResultsProvider.ts` | TreeViewデータプロバイダー、グルーピング・ソート処理 |
| `src/visualizerView.ts` | ビジュアライザのダウンロード・表示管理 |
| `src/comparisonView.ts` | 比較ビューのWebView管理 |
| `src/configManager.ts` | 比較モード設定の読み書き |
| `src/pahcerPanel.ts` | （未使用?）レガシーパネル実装 |
| `webview/comparison/ComparisonView.tsx` | 比較ビューのReactコンポーネント |
| `webview/comparison/components/ComparisonChart.tsx` | Chart.jsを使った比較グラフ |
| `webview/comparison/components/StatsTable.tsx` | 統計テーブル |
| `webview/comparison/components/ControlPanel.tsx` | コントロールパネル |

## 13. 技術スタック

- **拡張機能本体**: TypeScript + VS Code Extension API
- **WebView（比較ビュー）**: React + Chart.js
- **パッケージマネージャー**: pnpm
- **ビルドツール**: esbuild
