# Claude Code への指示

## プロジェクト情報

このプロジェクトは pahcer ツールの VS Code Extension UI です。

## 開発環境

- **パッケージマネージャー**: pnpm を使用しています（npm や yarn は使用しないでください）
- **pahcer ツール**: pahcer フォルダに Rust で実装されたコマンドラインツールがあります
- **ビルドツール**: esbuild を使用（拡張機能本体とWebView UIを個別にバンドル）
- **フォーマッター**: Biome を使用

## pahcer について

pahcer は AtCoder Heuristic Contest (AHC) のローカルテスト並列実行ツールです。

主なコマンド:
- `pahcer init`: 初期設定
- `pahcer run`: テストケースを並列実行
- `pahcer list`: 過去のテスト実行結果を一覧表示
- `pahcer prune`: pahcer が作成した Git タグを削除

実行結果は `./pahcer/json/result_*.json` に保存されます。

---

## アーキテクチャ設計

このプロジェクトは **レイヤードアーキテクチャ** と **ドメイン駆動設計（DDD）** の原則に基づいて設計されています。

### アーキテクチャ概要

```
┌─────────────────────────────────────┐
│  コントローラ層（Controller Layer）  │  ← WebViewとのIPC、VSCode UIの制御
│  - TreeViewコントローラ              │
│  - WebViewコントローラ               │
│  - コマンドハンドラ                  │
└─────────────────────────────────────┘
          ↓ 依存
┌─────────────────────────────────────┐
│   ドメイン層（Domain Layer）         │  ← 純粋なビジネスロジック、モデル定義
│  - モデル定義                        │
│  - 純粋関数                          │
└─────────────────────────────────────┘
          ↑ データ取得
┌─────────────────────────────────────┐
│  インフラ層（Infrastructure Layer）  │  ← ファイルI/O、外部システム連携
│  - ファイルシステム操作              │
│  - pahcer JSONリーダー               │
│  - 設定の永続化                      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      ビュー層（View Layer）          │  ← UI構築（TreeItem、WebView UI）
│  - TreeItem生成                      │
│  - WebView React コンポーネント      │
└─────────────────────────────────────┘
          ↑ 使用される
        コントローラ層
```

### 依存関係のルール

**重要**: 依存関係は常に一方向です。

- ✅ **コントローラ層 → ドメイン層**: OK
- ✅ **コントローラ層 → インフラ層**: OK
- ✅ **コントローラ層 → ビュー層**: OK
- ✅ **インフラ層 → ドメイン層**: OK（インフラ読み出し後はドメインモデルを返却）
- ✅ **ビュー層 → ドメイン層**: OK（UI構築にドメインモデルを使用）
- ❌ **ドメイン層 → インフラ層**: NG（ドメインは純粋に保つ）
- ❌ **ドメイン層 → コントローラ層**: NG
- ❌ **ドメイン層 → ビュー層**: NG
- ❌ **インフラ層 → コントローラ層**: NG
- ❌ **インフラ層 → ビュー層**: NG
- ❌ **ビュー層 → インフラ層**: NG
- ❌ **ビュー層 → コントローラ層**: NG

---

## ディレクトリ構造

```
.
├── pahcer/
│   └── json/
│       └── result_*.json           # pahcer が出力するテスト実行結果
├── tools/
│   ├── in/                         # 入力ファイル
│   ├── out/                        # 出力ファイル（最新実行）
│   └── err/                        # エラーファイル（最新実行）
├── .pahcer-ui/                     # この拡張機能が作成するディレクトリ
│   ├── config.json                 # 比較モード設定
│   ├── results/                    # 実行結果の保存先
│   │   └── result_${id}/
│   │       ├── out/                # 各実行の出力ファイルのコピー
│   │       ├── err/                # 各実行のエラーファイルのコピー
│   │       └── meta.json           # コメント等のメタ情報
│   └── visualizer/                 # ビジュアライザのダウンロード先
│       ├── *.html                  # ビジュアライザHTML
│       ├── *.js                    # JavaScript
│       ├── *.css                   # CSS
│       └── *_bg.wasm               # WASM
└── src/
    ├── domain/                     # ドメイン層
    │   ├── models/                 # ドメインモデル
    │   │   ├── pahcerResult.ts     # 実行結果モデル
    │   │   ├── testCase.ts         # テストケースモデル
    │   │   ├── resultMetadata.ts   # メタデータモデル
    │   │   ├── comparisonConfig.ts # 比較設定モデル
    │   │   └── visualizerConfig.ts # ビジュアライザ設定モデル
    │   ├── valueObjects/           # 値オブジェクト
    │   │   ├── resultId.ts         # 実行結果ID
    │   │   ├── seed.ts             # Seed番号
    │   │   ├── score.ts            # スコア
    │   │   └── executionTime.ts    # 実行時間
    │   └── services/               # ドメインサービス（純粋関数）
    │       ├── groupingService.ts  # グルーピングロジック
    │       ├── sortingService.ts   # ソートロジック
    │       ├── aggregationService.ts # 集計ロジック
    │       └── expressionEvaluator.ts # 数式評価
    │
    ├── infrastructure/             # インフラ層（フラット構造）
    │   ├── pahcerResultRepository.ts # JSON読み込み
    │   ├── inputFileRepository.ts  # 入力ファイル読み込み
    │   ├── outputFileRepository.ts # 出力ファイル読み込み
    │   ├── metadataRepository.ts   # メタデータ読み書き
    │   ├── configRepository.ts     # 比較設定の永続化
    │   ├── fileWatcher.ts          # ファイル監視
    │   ├── visualizerDownloader.ts # HTML/依存ファイルダウンロード
    │   ├── visualizerCache.ts      # キャッシュ管理
    │   ├── workspaceAdapter.ts     # ワークスペース情報取得
    │   ├── configAdapter.ts        # VSCode設定読み書き
    │   └── terminalAdapter.ts      # ターミナル操作
    │
    ├── controller/                 # コントローラ層
    │   ├── commands/               # コマンドハンドラ
    │   │   ├── runCommand.ts       # pahcer run コマンド
    │   │   ├── refreshCommand.ts   # リフレッシュコマンド
    │   │   ├── switchModeCommand.ts # モード切り替えコマンド
    │   │   ├── addCommentCommand.ts # コメント追加コマンド
    │   │   └── changeSortOrderCommand.ts # ソート順変更コマンド
    │   ├── pahcerTreeViewController.ts # TreeViewのメインコントローラ
    │   ├── visualizerViewController.ts # ビジュアライザWebViewコントローラ
    │   └── comparisonViewController.ts # 比較WebViewコントローラ
    │
    ├── view/                       # ビュー層（UI構築）
    │   ├── treeView/               # TreeView UI構築
    │   │   └── treeItemBuilder.ts  # TreeItem生成
    │   └── webview/                # WebView内UI
    │       ├── comparison/         # 比較ビュー
    │       │   ├── ComparisonView.tsx
    │       │   ├── components/
    │       │   │   ├── ComparisonChart.tsx
    │       │   │   ├── ControlPanel.tsx
    │       │   │   └── StatsTable.tsx
    │       │   ├── types.ts
    │       │   └── index.tsx
    │       └── shared/             # 共有ユーティリティ
    │           └── utils/
    │               ├── vscode.ts   # VSCode API取得
    │               └── expression.ts # 数式評価
    │
    └── extension.ts                # エントリポイント（コマンド登録のみ）
```

---

## 各層の責務

### 1. ドメイン層（Domain Layer）

**責務**: ビジネスロジックとドメインモデルの定義

**特徴**:
- 外部依存を一切持たない（`node:fs`, `vscode`, `node:https` 等を使用しない）
- 純粋関数のみで構成
- インフラ層からデータを受け取り、処理結果を返す

**ファイル命名規則**: camelCase（例: `pahcerResult.ts`, `groupingService.ts`）

**例**:
```typescript
// ドメインモデル
export interface PahcerResult {
	startTime: string;
	caseCount: number;
	totalScore: number;
	// ...
}

// 純粋関数
export function sortTestCases(cases: TestCase[], order: ExecutionSortOrder): TestCase[] {
	// 外部依存なし、入力に対して決定的な出力を返す
}
```

### 2. インフラ層（Infrastructure Layer）

**責務**: 外部システムとの通信、データの永続化

**特徴**:
- ファイルI/O、ネットワーク通信等の副作用を持つ処理
- ドメインモデルの型でデータを返す
- エラーハンドリングはインフラ層で行う
- フラット構造（サブディレクトリなし）

**ファイル命名規則**: camelCase（例: `pahcerResultRepository.ts`, `configAdapter.ts`）

**例**:
```typescript
export class PahcerResultRepository {
	async loadLatestResults(limit = 10): Promise<PahcerResultWithId[]> {
		// ファイルI/Oを行い、ドメインモデルに変換して返す
	}
}
```

### 3. コントローラ層（Controller Layer）

**責務**: UIとドメインロジックの橋渡し

**特徴**:
- VSCode UIとドメインロジックの橋渡し
- WebViewとのIPC抽象化
- インフラ層からデータを取得し、ドメインロジックで処理し、UIに表示
- コマンドハンドラとして動作

**ファイル命名規則**: camelCase（例: `pahcerTreeViewController.ts`, `runCommand.ts`）

**例**:
```typescript
export class PahcerTreeViewController implements vscode.TreeDataProvider<PahcerTreeItem> {
	private resultRepository: PahcerResultRepository;
	private configAdapter: ConfigAdapter;
	private treeItemBuilder: TreeItemBuilder;

	async getChildren(element?: PahcerTreeItem): Promise<PahcerTreeItem[]> {
		// インフラ層からデータ取得
		const results = await this.resultRepository.loadLatestResults(10);

		// ドメインロジックで処理
		const grouped = groupByExecution(results);

		// ビュー層でUI構築
		return grouped.map(g => this.treeItemBuilder.buildExecutionItem(g));
	}
}
```

### 4. ビュー層（View Layer）

**責務**: UI構築に専念

**特徴**:
- UI構築のみ（TreeItem生成、React コンポーネント）
- コントローラ層から呼び出される
- ドメインやインフラに依存しない

**ファイル命名規則**:
- TypeScript: camelCase（例: `treeItemBuilder.ts`）
- React: PascalCase（例: `ComparisonView.tsx`）

**例**:
```typescript
export class TreeItemBuilder {
	buildExecutionItem(item: PahcerResultWithId, comment: string): vscode.TreeItem {
		// VSCode TreeItemを構築するだけ
		// ビジネスロジックは含まない
	}
}
```

---

## 拡張機能の主要機能

### 1. テスト実行結果の表示

- `pahcer/json/result_*.json` から最新 10 件の実行結果を読み込み
- TreeView でテスト結果を表示
- AC/WA の状態、スコア、相対スコア、実行時間などを表示
- ファイル監視により、新しい実行結果が作成されると自動的にリフレッシュ

**実装箇所**:
- コントローラ: [pahcerTreeViewController.ts](src/controller/pahcerTreeViewController.ts)
- インフラ: [pahcerResultRepository.ts](src/infrastructure/pahcerResultRepository.ts)
- ドメイン: [pahcerResult.ts](src/domain/models/pahcerResult.ts)

### 2. 表示モードの切り替え

2 つのグルーピングモードがあります:

- **実行ごと (byExecution)**: デフォルトモード。各実行結果をトップレベルに表示し、展開すると個別のテストケースが表示される
- **Seed ごと (bySeed)**: 各 Seed をトップレベルに表示し、展開するとその Seed の複数回の実行結果が表示される

**実装箇所**:
- ドメイン: [groupingService.ts](src/domain/services/groupingService.ts)
- コントローラ: [switchModeCommand.ts](src/controller/commands/switchModeCommand.ts)

### 3. ソート機能

実行ごとモード:
- シードの昇順/降順
- 相対スコアの昇順/降順
- 絶対スコアの昇順/降順

Seedごとモード:
- 実行の昇順/降順（時系列）
- 絶対スコアの昇順/降順

**実装箇所**:
- ドメイン: [sortingService.ts](src/domain/services/sortingService.ts)
- コントローラ: [changeSortOrderCommand.ts](src/controller/commands/changeSortOrderCommand.ts)

### 4. テスト実行

- ツールバーの「Run」ボタンから `pahcer run` を VS Code ターミナルで実行
- 実行結果は自動的にパネルに反映される

**実装箇所**:
- コントローラ: [runCommand.ts](src/controller/commands/runCommand.ts)
- インフラ: [terminalAdapter.ts](src/infrastructure/terminalAdapter.ts)

### 5. ビジュアライザ連携

- テストケースをクリックすると AtCoder 公式ビジュアライザで表示
- 初回クリック時にユーザーにビジュアライザの URL を入力させる
- HTML ファイルと依存関係（JS、CSS、WASM など）を自動ダウンロード
- ダウンロードしたファイルは `.pahcer-ui/visualizer/` ディレクトリにキャッシュ
- Webview で表示し、seed、input、output を自動セット
- ズーム機能（+/-ボタン、Ctrl+ホイール、Ctrl+/-/0）
- ズームレベルの永続化

**実装箇所**:
- コントローラ: [visualizerViewController.ts](src/controller/visualizerViewController.ts)
- インフラ: [visualizerDownloader.ts](src/infrastructure/visualizerDownloader.ts), [visualizerCache.ts](src/infrastructure/visualizerCache.ts)

### 6. コメント機能

- 実行結果を右クリック→「コメントを追加」でコメント入力
- コメントは `.pahcer-ui/results/result_${id}/meta.json` に保存
- TreeViewのラベルに `[コメント]` として表示

**実装箇所**:
- コントローラ: [addCommentCommand.ts](src/controller/commands/addCommentCommand.ts)
- インフラ: [metadataRepository.ts](src/infrastructure/metadataRepository.ts)
- ドメイン: [resultMetadata.ts](src/domain/models/resultMetadata.ts)

### 7. 比較モード

- 複数の実行結果を選択して比較
- 統計テーブルとグラフで可視化
- Features設定: 入力ファイルの1行目からパラメータを抽出（例: "N M K"）
- X軸設定: seed, N, M, log(N), N*M 等の数式表現に対応
- Y軸設定: absolute（絶対スコア）, relative（相対スコア）
- グラフタイプ: line（折れ線）, scatter（散布図）
- 失敗ケースをスキップ機能
- 設定の永続化（`.pahcer-ui/config.json`）

**実装箇所**:
- コントローラ: [comparisonViewController.ts](src/controller/comparisonViewController.ts)
- ビュー: [ComparisonView.tsx](src/view/webview/comparison/ComparisonView.tsx)
- ドメイン: [expressionEvaluator.ts](src/domain/services/expressionEvaluator.ts)
- インフラ: [configRepository.ts](src/infrastructure/configRepository.ts)

### 8. 出力ファイルの保存

- 新しい実行結果が作成されると、`tools/out` と `tools/err` のディレクトリを `.pahcer-ui/results/result_${id}/` にコピー
- 過去の実行結果のビジュアライズも可能

**実装箇所**:
- インフラ: [outputFileRepository.ts](src/infrastructure/outputFileRepository.ts)

---

## コマンド一覧

| コマンドID | タイトル | 実装 |
|-----------|---------|------|
| `pahcer-ui.run` | テストを実行 | [runCommand.ts](src/controller/commands/runCommand.ts) |
| `pahcer-ui.refresh` | 結果を更新 | [refreshCommand.ts](src/controller/commands/refreshCommand.ts) |
| `pahcer-ui.switchToSeed` | Seedごとにグルーピング | [switchModeCommand.ts](src/controller/commands/switchModeCommand.ts) |
| `pahcer-ui.switchToExecution` | 実行ごとにグルーピング | [switchModeCommand.ts](src/controller/commands/switchModeCommand.ts) |
| `pahcer-ui.toggleComparisonMode` | 比較モードを切り替え | [extension.ts](src/extension.ts) |
| `pahcer-ui.addComment` | コメントを追加 | [addCommentCommand.ts](src/controller/commands/addCommentCommand.ts) |
| `pahcer-ui.changeSortOrder` | 並び順を変更 | [changeSortOrderCommand.ts](src/controller/commands/changeSortOrderCommand.ts) |
| `pahcer-ui.showVisualizer` | ビジュアライザを表示 | [extension.ts](src/extension.ts) |

---

## 設定

### VSCode設定

- `pahcer-ui.groupingMode`: 表示モード（`byExecution` / `bySeed`）
- `pahcer-ui.executionSortOrder`: 実行ごとモードのソート順
- `pahcer-ui.seedSortOrder`: Seedごとモードのソート順
- `pahcer-ui.visualizerZoomLevel`: ビジュアライザのズームレベル（0.5〜3.0）

### ワークスペース固有設定

- `.pahcer-ui/config.json`: 比較モードの設定（features, xAxis, yAxis）
- `.pahcer-ui/results/result_${id}/meta.json`: 実行結果ごとのコメント

---

## 開発ガイドライン

### 新機能を追加する際の手順

1. **ドメイン層から設計**
   - まずドメインモデルと純粋関数を定義
   - 外部依存を一切含めない

2. **インフラ層を実装**
   - 必要なリポジトリやアダプターを作成
   - ドメインモデルの型でデータを返す

3. **コントローラ層を実装**
   - インフラ層とドメイン層を組み合わせる
   - VSCode APIとの橋渡し

4. **ビュー層を実装**（必要に応じて）
   - UI構築ロジックを分離

5. **extension.tsに登録**
   - コマンドやTreeViewを登録

### コーディング規約

- **ファイル名**: camelCase（React ComponentはPascalCase）
- **クラス名**: PascalCase
- **関数名**: camelCase
- **型名**: PascalCase
- **フォーマッター**: Biome（`pnpm run format`）
- **Linter**: ESLint（`pnpm run lint`）
- **型チェック**: `pnpm run check-types`

### テスト

現時点では自動テストは実装されていませんが、以下を手動で確認：

1. 型チェック: `pnpm run check-types`
2. ビルド: `pnpm run build`
3. 動作確認: VS CodeでF5を押して拡張機能を起動

詳細は [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) を参照。

---

## トラブルシューティング

### ビルドエラー

```bash
# 型チェック
pnpm run check-types

# クリーンビルド
rm -rf dist node_modules
pnpm install
pnpm run build
```

### 依存関係のエラー

依存関係のルールに違反していないか確認：
- ドメイン層は外部依存を持たない
- インフラ層はドメイン層に依存しない
- ビュー層はドメイン・インフラに依存しない

---

## 参考資料

- [FEATURES.md](FEATURES.md): 全機能の詳細
- [REFACTORING_PLAN.md](REFACTORING_PLAN.md): リファクタリング計画
- [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md): 動作確認チェックリスト
