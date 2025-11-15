# Claude Code への指示

## プロジェクト情報

このプロジェクトは pahcer ツールの VS Code Extension UI です。

## 開発環境

- **パッケージマネージャー**: npm を使用しています
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
┌────────────────────────────────────────┐
│  プレゼンテーション層(Presentation)    │  ← VSCode UI制御、ユーザー入力処理
│  └─ Controller & View                  │
└────────────────────────────────────────┘
                  ↓ 依存
┌────────────────────────────────────────┐
│  アプリケーション層(Application)       │  ← ユースケース、ワークフロー
│  └─ Use Cases (RunPahcerUseCase等)    │
└────────────────────────────────────────┘
        ↓ 依存（リポジトリ・サービス使用）
  ┌─────────────────────┬───────────────┐
  ↓                     ↓               ↓
┌────────────────┐ ┌─────────────┐ ┌────────────┐
│ インフラ層     │ │ ドメイン層  │ │(Adapter)   │
│ (Repository)   │ │ (Service)   │ │ (外部API)  │
└────────────────┘ └─────────────┘ └────────────┘
      ドメインモデルを返す  ←  純粋ビジネスロジック
```

**依存関係の流れ**:
```
Presentation → Application → (Infrastructure + Domain)
                                    ↓
                             Domain Models
```


---

## ディレクトリ構造

```
src/
├── domain/                         # ドメイン層（純粋なビジネスロジック）
│   ├── models/                     # ドメインモデル定義
│   ├── valueObjects/               # 値オブジェクト
│   └── services/                   # ドメインサービス（純粋関数）
│
├── infrastructure/                 # インフラ層（ファイルI/O、外部API連携）
│   └── （リポジトリ・アダプターのフラット構造）
│
├── application/                    # アプリケーション層（ユースケース・ワークフロー）
│   └── （ユースケースクラス）
│
├── presentation/                   # プレゼンテーション層（UI制御）
│   ├── controller/                 # コマンドハンドラ・UIコントローラ
│   │   └── commands/               # コマンドハンドラ
│   └── view/                       # UI構築（TreeItem、WebView）
│       ├── treeView/               # TreeView UI構築
│       └── webview/                # WebView内UI
│
└── extension.ts                    # エントリポイント
```

---

## 各層の責務

### 1. ドメイン層（Domain Layer）

**責務**: ビジネスロジックとドメインモデルを定義し、エンティティとして存在

**✅ すべき事（SHOULD DO）**:
- ドメインモデル（クラス、インターフェース）を定義
- ビジネス規則と検証ロジックを実装（コンストラクタで不変条件を検証）
- ドメインサービス（純粋関数）を提供：入力→出力が決定的（副作用なし）
- 値オブジェクトで型安全性を確保
- ドメインモデルで `path`、`id` など識別に必要な情報を持つ

**❌ してはいけない事（SHOULD NOT DO）**:
- `node:fs`、`node:http`、`vscode` など外部ライブラリをインポート
- ファイルI/O、ネットワーク通信、データベースアクセス
- インフラ層に依存（import すること自体が違反）
- プレゼンテーション層の詳細（TreeItem、UIコンポーネント）を知る

**ファイル命名規則**: camelCase（例: `pahcerConfig.ts`, `sortingService.ts`）

**例**:
```typescript
// ドメインモデル（不変条件を検証）
export class PahcerConfig {
	constructor(
		private _id: string,
		private _path: string,
		private _startSeed: number,
		private _endSeed: number,
	) {
		if (this._startSeed < 0) throw new Error('startSeed must be non-negative');
		if (this._endSeed < this._startSeed) throw new Error('endSeed must be >= startSeed');
	}
	get path(): string { return this._path; }
	get startSeed(): number { return this._startSeed; }
	set startSeed(value: number) { this._startSeed = value; }
}

// ドメインサービス（純粋関数）
export function sortTestCases(cases: TestCase[], order: ExecutionSortOrder): TestCase[] {
	// 副作用なし、入力に対して決定的な出力を返す
	return cases.sort((a, b) => a.seed - b.seed);
}
```

### 2. インフラ層（Infrastructure Layer）

**責務**: ファイルI/O、外部API呼び出し、データを永続化・取得してドメインモデルに変換

**✅ すべき事（SHOULD DO）**:
- ファイル読み書き、ネットワーク通信などの副作用を処理
- 外部フォーマット（JSON、TOML、CSV）をドメインモデルに変換
- ドメインモデルの型でデータを返す（ドメインに型安全性を保証）
- エラーハンドリング（ファイルがない、フォーマットが不正など）
- リポジトリで複数の関連ファイルをカプセル化（例：`PahcerConfigRepository` は TOML ファイルの読み書き両方を担当）
- アダプターで外部API（pahcer CLI、Git コマンド）をラップ

**❌ してはいけない事（SHOULD NOT DO）**:
- ビジネスロジックを実装（ドメインに任せる）
- ドメインロジックのない「ファイルの読み書き」だけの実装は避け、データの意味を解釈する
- コントローラ層での直接ファイル操作（全てリポジトリ経由）
- ドメインモデルを持たずに raw JSON/オブジェクトで返す
- コマンド実行や file I/O の詳細をコントローラに露出させる

**ファイル命名規則**: camelCase（例: `pahcerConfigRepository.ts`, `pahcerAdapter.ts`）

**例**:
```typescript
// リポジトリ：ファイル I/O とドメインモデル変換
export class PahcerConfigRepository {
	async get(id: 'normal' | 'temporary'): Promise<PahcerConfig> {
		const content = await fs.readFile(this.getPath(id), 'utf-8');
		const startSeed = this.extractStartSeed(content);
		const endSeed = this.extractEndSeed(content);
		return new PahcerConfig(id, path, startSeed, endSeed, 'max');
	}

	async save(config: PahcerConfig): Promise<void> {
		let content = await fs.readFile(config.path, 'utf-8');
		content = this.replaceStartSeed(content, config.startSeed);
		await fs.writeFile(config.path, content, 'utf-8');
	}
}

// アダプター：外部 CLI のラップ
export class PahcerAdapter {
	async run(configFile?: PahcerConfig): Promise<number | undefined> {
		let command = 'pahcer run';
		if (configFile) {
			command += ` --setting-file "${configFile.path}"`;  // path は domain model から取得
		}
		return this.executeTask('Pahcer Run', command);
	}
}
```

### 3. アプリケーション層（Application Layer）

**責務**: ユースケース・ワークフロー全体を調整（インフラとドメインの組み合わせ）

**✅ すべき事（SHOULD DO）**:
- ユースケースクラス（例：`RunPahcerUseCase`）でワークフロー全体を記述
- インフラ層（リポジトリ・アダプター）からデータ取得
- ドメインサービスでビジネスロジック実行
- 複数のステップを try/finally で安全に実行
- システム仕様（「テンポラリ設定ファイルを作成→実行→削除」など）を担当

**❌ してはいけない事（SHOULD NOT DO）**:
- 純粋なビジネスロジックを実装（ドメインに移す）
- ファイル I/O を直接実行（リポジトリ経由）
- UI に依存（プレゼンテーションはアプリケーションを呼ぶ側）
- ドメインに属すべき検証ロジックを実装

**ファイル命名規則**: camelCase（例: `runPahcerUseCase.ts`）

**例**:
```typescript
// ユースケース：ワークフロー全体を調整
export class RunPahcerUseCase {
	async run(options?: PahcerRunOptions): Promise<void> {
		// Step 1: ドメイン状態取得
		let commitHash: string | null;
		try {
			commitHash = await this.gitAdapter.commitSourceBeforeExecution();
		} catch (error) {
			throw new Error(`git operation failed: ${error}`);
		}

		// Step 2: テンポラリ設定管理（システム仕様）
		let tempConfig: PahcerConfig | undefined;
		if (options?.startSeed !== undefined) {
			tempConfig = await this.pahcerConfigRepository.get('temporary');
			tempConfig.startSeed = options.startSeed;  // domain model を直接更新
			await this.pahcerConfigRepository.save(tempConfig);
		}

		try {
			// Step 3: ドメインモデルを渡す（string path ではなく）
			await this.pahcerAdapter.run(options, tempConfig);
			// Step 4: 結果を処理
			const allExecutions = await this.executionRepository.getAll();
			// ... rest of workflow
		} finally {
			// Step 5: テンポラリファイル削除（システム仕様）
			if (tempConfig) {
				await this.pahcerConfigRepository.delete('temporary');
			}
		}
	}
}
```

### 4. プレゼンテーション層（Presentation Layer）

**責座**: ユーザー入力を受け取り、アプリケーション層を呼び出し、結果をUIに反映

**✅ すべき事（SHOULD DO）**:
- コマンドハンドラでユーザー操作（クリック、入力）を捕捉
- アプリケーション層（ユースケース）を呼び出し
- インフラ層からデータ取得し、UI に反映
- TreeItem や React コンポーネントを生成・更新
- VSCode API（ウィンドウ、メッセージボックス）とのやり取り

**❌ してはいけない事（SHOULD NOT DO）**:
- ビジネスロジックを実装（ドメインに移す）
- ファイル I/O を直接実行（インフラ経由）
- ドメイン値オブジェクトを作成・変更（ドメイン層に任せる）
- アプリケーション層をスキップしてインフラ直呼び出し（重要な制御フローをスキップする）

**ファイル命名規則**:
- TypeScript: camelCase（例: `pahcerTreeViewController.ts`, `runCommand.ts`）
- React: PascalCase（例: `ComparisonView.tsx`）

**例**:
```typescript
// コマンドハンドラ
export function runCommand(
	runPahcerUseCase: RunPahcerUseCase,
): () => Promise<void> {
	return async () => {
		try {
			// アプリケーション層を呼び出し
			await runPahcerUseCase.run();
			vscode.window.showInformationMessage('Pahcer execution completed');
		} catch (error) {
			vscode.window.showErrorMessage(`Pahcer run failed: ${error}`);
		}
	};
}

// TreeViewController
export class PahcerTreeViewController {
	async getChildren(): Promise<PahcerTreeItem[]> {
		// インフラ層からデータ取得
		const results = await this.executionRepository.getAll();

		// ドメインサービス（純粋関数）で処理
		const sorted = sortExecutions(results, this.sortOrder);

		// ビュー層で UI 構築
		return sorted.map(r => this.treeItemBuilder.build(r));
	}
}

// ビュー層（UI構築のみ）
export class TreeItemBuilder {
	build(execution: Execution): vscode.TreeItem {
		const item = new vscode.TreeItem(
			`[${execution.caseCount}] Score: ${execution.totalScore}`,
		);
		item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
		return item;
	}
}
```

### 依存関係のルール（４層モデル）

```
Presentation → Application → Infrastructure + Domain
                               ↓
                        Domain Models (type-safe)
```

- ✅ **Presentation → Application**: OK
- ✅ **Application → Infrastructure**: OK（リポジトリ・アダプター経由）
- ✅ **Application → Domain**: OK（ドメインサービス、モデル）
- ✅ **Infrastructure → Domain**: OK（ドメインモデルを返す）
- ✅ **Presentation → Infrastructure**: OK（データ表示のため）
- ❌ **Domain → 他の層**: NG（ドメインは純粋に保つ）
- ❌ **Infrastructure → Presentation**: NG
- ❌ **Application を経由せず直接 Infrastructure を呼び出す**: NG（ワークフローが分散）

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
- **フォーマッター**: Biome（`npm run format`）
- **Linter**: ESLint（`npm run lint`）
- **型チェック**: `npm run check-types`

### テスト

現時点では自動テストは実装されていませんが、以下を手動で確認：

1. 型チェック: `npm run check-types`
2. ビルド: `npm run build`
3. 動作確認: VS CodeでF5を押して拡張機能を起動

詳細は [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) を参照。

---

## トラブルシューティング

### ビルドエラー

```bash
# 型チェック
npm run check-types

# クリーンビルド
rm -rf dist node_modules
npm install
npm run build
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
