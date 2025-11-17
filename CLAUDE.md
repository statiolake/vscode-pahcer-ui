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
                      ↑
                      │
          Repository Interface (依存性逆転)
```

**依存関係の流れ**:
```
Presentation → Application → (Infrastructure + Domain)
                                    ↓
                             Domain Models
```

**依存性逆転の原則**:
- Repository のインターフェースはドメイン層に定義
- インフラ層は実装を提供
- アプリケーション層はインターフェースに依存
- Constructor DI で依存性を注入

**命名規則（Repository vs Adapter/Client）**:
- **Repository**: オブジェクトのコレクションとして CRUD 操作を提供（`findById()`, `findAll()`, `find()`, `upsert()`, `delete()`）
  - 例：`ExecutionRepository`, `TestCaseRepository`, `UIConfigRepository`
  - **統一仕様**: `find*()` メソッドで見つからない場合は例外をスローせず、以下を返す
    - `findById(id)` → `Promise<T | undefined>`（見つからない場合は `undefined`）
    - `findAll()` → `Promise<T[]>`（見つからない場合は空配列 `[]`）
    - `find()` → 要素が1つのみのリポジトリで使用。ファイルが見つからない場合はデフォルト値を返す
  - **エラーハンドリング**: ENOENT（ファイルが見つからない）のみを許容。その他の例外は投げ直す
- **Adapter/Client**: コレクション操作以外の外部インタラクション（コマンド実行、API 呼び出しなど）
  - 例：`GitAdapter`, `PahcerAdapter`, `VisualizerClient`

**日時型の統一**:
- `Date` を使わず、`Dayjs` に統一（値オブジェクトとして使用）
- 純粋で副作用がないため、ドメイン層で使用可能

---

## ディレクトリ構造

```
src/
├── domain/                         # ドメイン層（純粋なビジネスロジック）
│   ├── models/                     # ドメインモデル定義（クラス）
│   ├── interfaces/                 # リポジトリ・アダプターインターフェース（依存性逆転）
│   ├── valueObjects/               # 値オブジェクト
│   └── services/                   # ドメインサービス（純粋関数を持つクラス）
│
├── infrastructure/                 # インフラ層（ファイルI/O、外部API連携）
│   ├── *Repository.ts             # リポジトリ実装（各インターフェースを実装）
│   ├── *Adapter.ts                # アダプター実装（各インターフェースを実装）
│   ├── exceptions.ts              # インフラ層例外定義
│   └── （フラット構造）
│
├── application/                    # アプリケーション層（ユースケース・ワークフロー）
│   ├── *UseCase.ts                # ユースケースクラス（Constructor DI で依存性注入）
│   └── exceptions.ts              # アプリケーション層例外定義
│
├── presentation/                   # プレゼンテーション層（UI制御）
│   ├── controller/                 # コマンドハンドラ・UIコントローラ
│   │   ├── commands/               # コマンドハンドラ
│   │   └── *ViewController.ts      # ビューコントローラ
│   └── view/                       # UI構築（TreeItem、WebView）
│       ├── treeView/               # TreeView UI構築
│       └── webview/                # WebView内UI
│
└── extension.ts                    # エントリポイント（DI コンテナ）
```

---

## 各層の責務

### 1. ドメイン層（Domain Layer）

**責務**: ビジネスロジックとドメインモデルを定義し、エンティティとして存在

**✅ すべき事（SHOULD DO）**:
- ドメインモデルを **クラス** として定義（interface/type ではなく class を使用）
- ビジネス規則と検証ロジックを実装（コンストラクタで不変条件を検証）
- **プロパティの可変性をビジネスロジックで決定**
  - 識別子など変更されるべきでないプロパティ: `readonly id: string`
  - ビジネスロジック上変更が許可されているプロパティ: `private _value`、`get value()`, `set value(v)`
  - 例：`readonly id: string`（不変）、`private _comment`、`get comment()`, `set comment(value)`（可変）
- 値オブジェクトで型安全性を確保（例：Dayjs を日時型として使用）
- **リポジトリインターフェース**をドメイン層で定義（依存性逆転の原則）
  - 例：`IExecutionRepository`, `ITestCaseRepository`
- ドメインモデルで `id` など識別に必要な情報を持つ

**❌ してはいけない事（SHOULD NOT DO）**:
- `node:fs`、`node:http`、`vscode` など**副作用を持つ外部ライブラリ**をインポート
  - ただし、`dayjs`（日時値オブジェクト）など**純粋で副作用がない**値オブジェクトは OK
  - 判断基準：「副作用がないか」「値オブジェクトとして使えるか」
- ファイルI/O、ネットワーク通信、データベースアクセス
- インフラ層に依存（import すること自体が違反）
- プレゼンテーション層の詳細（TreeItem、UIコンポーネント）を知る
- `workspaceRoot: string` などインフラ固有の情報を保持

**ファイル命名規則**: camelCase（例: `pahcerConfig.ts`, `testCaseSorter.ts`）

**ドメインサービスの実装方法**:

ドメインサービスは**TypeScript namespace** を使用して組織化します。これにより以下を実現します：
- 関連する操作の論理的グループ化
- 明確な API 表面
- 名前空間の衝突を回避
- 純粋関数の集約

ファイル名と namespace 名は一致させ、"Service" 接尾辞は避けてください。

**namespace パターンの例**:
```typescript
// ファイル: src/domain/services/testCaseSorter.ts
export namespace TestCaseSorter {
	/**
	 * テストケースをソート順に従ってソートする
	 *
	 * @param cases ソート対象のテストケース配列
	 * @param order ソート順
	 * @param relativeScores seed => 相対スコア のマップ（オプション）
	 * @returns ソート済みテストケース配列
	 */
	export function sortByOrder(
		cases: TestCase[],
		order: ExecutionSortOrder,
		relativeScores?: Map<number, number>,
	): TestCase[] {
		const sorted = [...cases];
		// ソート実装...
		return sorted;
	}
}

// ファイル: src/domain/services/relativeScoreCalculator.ts
export namespace RelativeScoreCalculator {
	/**
	 * 実スコアとベストスコアから相対スコアを計算する
	 *
	 * @param score 実スコア
	 * @param bestScore ベストスコア
	 * @param objective 最適化の方向（'max' | 'min'）
	 * @returns 相対スコア（パーセンテージ、0-100+）
	 */
	export function calculate(
		score: number,
		bestScore: number | undefined,
		objective: 'max' | 'min',
	): number {
		if (score <= 0 || bestScore === undefined || bestScore <= 0) {
			return 0;
		}
		if (objective === 'max') {
			return (score / bestScore) * 100;
		} else {
			return (bestScore / score) * 100;
		}
	}
}
```

**プレゼンテーション層での使用**:
```typescript
import { TestCaseSorter } from '../../domain/services/testCaseSorter';
import { RelativeScoreCalculator } from '../../domain/services/relativeScoreCalculator';

// ドメインサービスを呼び出し
const sorted = TestCaseSorter.sortByOrder(cases, sortOrder);
const relScore = RelativeScoreCalculator.calculate(score, bestScore, objective);
```

**ドメインサービスファイル一覧**:
- `bestScoreCalculator.ts` - `BestScoreCalculator` namespace
- `seedStatsCalculator.ts` - `SeedStatsCalculator` namespace
- `executionStatsAggregator.ts` - `ExecutionStatsAggregator` namespace
- `testCaseGrouper.ts` - `TestCaseGrouper` namespace
- `testCaseSorter.ts` - `TestCaseSorter` namespace
- `seedExecutionSorter.ts` - `SeedExecutionSorter` namespace
- `executionSorter.ts` - `ExecutionSorter` namespace
- `seedStatsSorter.ts` - `SeedStatsSorter` namespace
- `relativeScoreCalculator.ts` - `RelativeScoreCalculator` namespace
- `stderrParser.ts` - `StderrParser` namespace

**例**
```typescript
// ドメインモデル（クラス、readonly デフォルト、必要に応じて setter）
export class PahcerConfig {
	readonly id: ConfigId;
	readonly path: string;
	private _startSeed: number;
	private _endSeed: number;
	readonly objective: 'max' | 'min';

	constructor(id: ConfigId, path: string, startSeed: number, endSeed: number, objective: 'max' | 'min') {
		if (startSeed < 0) throw new Error('startSeed must be non-negative');
		if (endSeed < startSeed) throw new Error('endSeed must be >= startSeed');
		this.id = id;
		this.path = path;
		this._startSeed = startSeed;
		this._endSeed = endSeed;
		this.objective = objective;
	}

	get startSeed(): number { return this._startSeed; }
	set startSeed(value: number) { this._startSeed = value; }
	get endSeed(): number { return this._endSeed; }
	set endSeed(value: number) { this._endSeed = value; }
}

// リポジトリインターフェース（ドメイン層で定義）
export interface IExecutionRepository {
	findById(id: string): Promise<Execution | undefined>;
	findAll(): Promise<Execution[]>;
	upsert(execution: Execution): Promise<void>;
}

```

### 2. インフラ層（Infrastructure Layer）

**責務**: ファイルI/O、外部API呼び出し、VSCode API の呼び出しなど、外部世界とのインタラクション全般を担当し、ドメインモデルに変換

**✅ すべき事（SHOULD DO）**:
- **ドメイン層で定義されたリポジトリインターフェースを実装**
  - 例：`ExecutionRepository implements IExecutionRepository`
- **`workspaceRoot` などのインフラ固有情報をカプセル化**（上位層に露出させない）
  - コンストラクタで受け取り、内部で使用
- ファイル読み書き、ネットワーク通信、外部コマンド実行などの副作用を処理
- VSCode API（Task、diff コマンド、ターミナルなど）の呼び出しをラップ
  - 重要：主な責務は「処理を実行する」こと。UI表示は副次的な効果
  - 例）`PahcerAdapter.run()` は「pahcer を実行する」が責務。ターミナルに表示されるのは副次効果
- 外部フォーマット（JSON、TOML、CSV）をドメインモデルに変換
- ドメインモデルの型でデータを返す（ドメインに型安全性を保証）
- エラーハンドリング（ファイルがない、フォーマットが不正など）
  - **`find*()` メソッドでファイルが見つからない場合（ENOENT）のみ `undefined` を返す**
  - **その他の例外（パーミッションエラー、フォーマット不正など）は必ず投げ直す**
  - 使用例：`asErrnoException(error).code !== 'ENOENT'` でチェック
- リポジトリで複数の関連ファイルをカプセル化（例：`PahcerConfigRepository` は TOML ファイルの読み書き両方を担当）
- アダプターで外部API（pahcer CLI、Git コマンド、VSCode Task など）をラップ

**❌ してはいけない事（SHOULD NOT DO）**:
- ビジネスロジック・ユースケースロジックを実装（ドメイン・アプリケーション層に任せる）
- 「UI の表示/非表示を切り替える」「設定値を変更するかユーザーに問い合わせる」などのユースケース判断
- ドメインロジックのない「ファイルの読み書き」だけの実装は避け、データの意味を解釈する
- コントローラ層での直接ファイル操作（全てリポジトリ経由）
- ドメインモデルを持たずに raw JSON/オブジェクトで返す
- コマンド実行や file I/O の詳細をコントローラに露出させる

**ファイル命名規則**: camelCase（例: `pahcerConfigRepository.ts`, `pahcerAdapter.ts`）

**例**:
```typescript
import { asErrnoException } from '../util/lang';

// リポジトリ実装：ドメインインターフェースを実装、workspaceRoot をカプセル化
export class ExecutionRepository implements IExecutionRepository {
	constructor(private workspaceRoot: string) {}  // インフラ固有情報を隠蔽

	async findById(executionId: string): Promise<Execution | undefined> {
		try {
			const content = await fs.readFile(this.resultPath(executionId), 'utf-8');
			const result = ResultJsonSchema.parse(JSON.parse(content));
			return new Execution(
				executionId,
				dayjs(result.start_time),  // Dayjs を使用
				result.comment,
				result.tag_name ?? null,
			);
		} catch (error) {
			// ファイルが見つからない場合のみ undefined を返す
			if (!(error instanceof Error) || asErrnoException(error).code !== 'ENOENT') {
				throw error;  // その他の例外は投げ直す
			}
			return undefined;
		}
	}

	async findAll(): Promise<Execution[]> {
		const files = await fs.readdir(path.join(this.workspaceRoot, 'pahcer', 'json'));
		// ...
	}

	async upsert(execution: Execution): Promise<void> {
		// ...
	}

	private resultPath(executionId: string): string {
		return path.join(this.workspaceRoot, 'pahcer', 'json', `result_${executionId}.json`);
	}
}

// アダプター：外部 CLI のラップ
export class PahcerAdapter implements IPahcerAdapter {
	constructor(
		private pahcerConfigRepository: IPahcerConfigRepository,
		private workspaceRoot: string,
	) {}

	async run(options?: PahcerRunOptions, configFile?: PahcerConfig): Promise<number | undefined> {
		let command = 'pahcer run';
		if (configFile) {
			command += ` --setting-file "${configFile.path}"`;  // path は domain model から取得
		}
		return this.executeTask('Pahcer Run', command);
	}
}

// コンテキストアダプター：VSCode API のラップ
export class ContextAdapter implements IContextAdapter {
	async setPahcerStatus(status: PahcerStatus): Promise<void> {
		const statusString = this.pahcerStatusToString(status);
		await vscode.commands.executeCommand('setContext', 'pahcer.status', statusString);
	}

	private pahcerStatusToString(status: PahcerStatus): string {
		// VSCode context に設定する値に変換
		// ...
	}
}
```

#### アダプターインターフェース実装ガイド

**アダプターの分類**:
1. **データアダプター** - ファイルI/O を行うもの
   - 例：`InOutFilesAdapter`、`PahcerConfigRepository`
   - 特徴：ファイルパスやストレージ操作をカプセル化

2. **外部ツールアダプター** - 外部コマンド実行をラップするもの
   - 例：`PahcerAdapter`（pahcer CLI）、`GitAdapter`（git コマンド）
   - 特徴：コマンド実行、プロセス管理をカプセル化

3. **フレームワークアダプター** - VSCode API などのフレームワークAPIをラップするもの
   - 例：`ContextAdapter`（VSCode Context API）、`GitignoreAdapter`（ファイル操作）
   - 特徴：フレームワーク固有のAPIを抽象化

**実装時のチェックリスト**:
- ✅ ドメイン層で定義されたインターフェースを `implements` で実装
- ✅ インフラ固有情報（`workspaceRoot` など）をコンストラクタで受け取り、内部に隠蔽
- ✅ メソッドの戻り値はドメインモデル（型安全）
- ✅ ファイルが見つからない場合（ENOENT）は適切に処理（undefined か空配列を返す）
- ✅ その他のエラーは投げ直す（呼び出し側で適切に処理）
- ✅ 副作用（ファイルI/O、コマンド実行）は async/await で適切に管理
- ✅ インターフェースのすべてのメソッドを実装

**例：新しいアダプターを追加する場合**:

```typescript
// ステップ 1: ドメイン層にインターフェースを定義
// src/domain/interfaces/IMyAdapter.ts
export interface IMyAdapter {
	doSomething(param: string): Promise<Result>;
	checkStatus(): Promise<boolean>;
}

// ステップ 2: インフラ層に実装を作成
// src/infrastructure/myAdapter.ts
import type { IMyAdapter } from '../domain/interfaces/IMyAdapter';

export class MyAdapter implements IMyAdapter {
	constructor(private workspaceRoot: string) {}

	async doSomething(param: string): Promise<Result> {
		// インフラ操作を実行、Result ドメインモデルで返す
		return new Result(/* ... */);
	}

	async checkStatus(): Promise<boolean> {
		// ...
	}
}

// ステップ 3: domain/interfaces/index.ts に追加
export type { IMyAdapter } from './IMyAdapter';

// ステップ 4: アプリケーション層や上位層で使用
// Constructor DI でインターフェースを注入
export class MyUseCase {
	constructor(private myAdapter: IMyAdapter) {}  // 実装ではなくインターフェースに依存

	async execute(): Promise<void> {
		const status = await this.myAdapter.checkStatus();
		// ...
	}
}
```

### 3. アプリケーション層（Application Layer）

**責務**: ユースケース・ワークフロー全体を調整（インフラとドメインの組み合わせ）

**✅ すべき事（SHOULD DO）**:
- **Constructor DI で依存性を注入**（リポジトリインターフェースに依存）
  - 例：`constructor(private executionRepository: IExecutionRepository)`
- ユースケースクラス（例：`RunPahcerUseCase`）でワークフロー全体を記述
- **リポジトリインターフェース経由**でデータ取得（具体的な実装に依存しない）
- ドメインサービスでビジネスロジック実行
- 複数のステップを try/finally で安全に実行
- **ユースケース判断**：「Git 統合を有効にするか」「設定を変更するか」などのユースケース分岐判定
  - 例）Git 統合が有効になっていない場合に、ユーザーに対話的に問い合わせるかどうかを決定
- システム仕様（「テンポラリ設定ファイルを作成→実行→削除」など）を担当

**❌ してはいけない事（SHOULD NOT DO）**:
- 純粋なビジネスロジックを実装（ドメインサービスに委譲する）
  - ❌ データの管理、集計、ソート、フィルタリングなどをユースケース内で実装
  - ✅ ドメインサービスを呼び出す
- ファイル I/O を直接実行（リポジトリ経由）
- UI に依存（プレゼンテーションはアプリケーションを呼ぶ側）
- ドメインに属すべき検証ロジックを実装
- `workspaceRoot` などインフラ固有情報に直接依存

**ファイル命名規則**: camelCase（例: `runPahcerUseCase.ts`）

**例**:
```typescript
// ユースケース：Constructor DI でリポジトリインターフェースを注入
export class RunPahcerUseCase {
	constructor(
		private executionRepository: IExecutionRepository,  // インターフェースに依存
		private pahcerConfigRepository: IPahcerConfigRepository,
		private gitAdapter: GitAdapter,
		private pahcerAdapter: PahcerAdapter,
	) {}

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
			tempConfig = await this.pahcerConfigRepository.findById('temporary');
			tempConfig.startSeed = options.startSeed;  // domain model を直接更新
			await this.pahcerConfigRepository.upsert(tempConfig);
		}

		try {
			// Step 3: ドメインモデルを渡す（string path ではなく）
			await this.pahcerAdapter.run(options, tempConfig);
			// Step 4: 結果を処理
			const allExecutions = await this.executionRepository.findAll();
			// Step 5: ドメインサービスに集計処理を委譲
			const stats = ExecutionStatistics.calculate(allExecutions);
			// ... rest of workflow
		} finally {
			// Step 6: テンポラリファイル削除（システム仕様）
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
- **Constructor DI でユースケースを注入**
- アプリケーション層（ユースケース）を呼び出し
- リポジトリインターフェース経由でデータ取得し、UI に反映
- TreeItem や React コンポーネントを生成・更新
- VSCode API（ウィンドウ、メッセージボックス）とのやり取り

**❌ してはいけない事（SHOULD NOT DO）**:
- ビジネスロジックを実装（ドメインサービスに委譲する）
  - ❌ ソート、フィルタリング、集計をコントローラ内で実装
  - ✅ ドメインサービスを呼び出す
- ファイル I/O を直接実行（リポジトリ経由）
- ドメイン値オブジェクトを作成・変更（ドメイン層に任せる）
- アプリケーション層をスキップしてインフラ直呼び出し（重要な制御フローをスキップする）
- `workspaceRoot` などインフラ固有情報に直接依存

**ファイル命名規則**:
- TypeScript: camelCase（例: `pahcerTreeViewController.ts`, `runCommand.ts`）
- React: PascalCase（例: `ComparisonView.tsx`）

**例**:
```typescript
// コマンドハンドラ：ユースケースを DI
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

// TreeViewController：リポジトリインターフェースを DI
export class PahcerTreeViewController {
	constructor(
		private executionRepository: IExecutionRepository,
		private treeItemBuilder: TreeItemBuilder,
	) {}

	async getChildren(): Promise<PahcerTreeItem[]> {
		// リポジトリインターフェース経由でデータ取得
		const results = await this.executionRepository.findAll();

		// ドメインサービス（純粋関数）で処理
		const sorted = ExecutionSorter.sortByOrder(results, this.sortOrder);

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

| コマンドID                       | タイトル               | 実装                                                                           |
|----------------------------------|------------------------|--------------------------------------------------------------------------------|
| `pahcer-ui.run`                  | テストを実行           | [runCommand.ts](src/controller/commands/runCommand.ts)                         |
| `pahcer-ui.refresh`              | 結果を更新             | [refreshCommand.ts](src/controller/commands/refreshCommand.ts)                 |
| `pahcer-ui.switchToSeed`         | Seedごとにグルーピング | [switchModeCommand.ts](src/controller/commands/switchModeCommand.ts)           |
| `pahcer-ui.switchToExecution`    | 実行ごとにグルーピング | [switchModeCommand.ts](src/controller/commands/switchModeCommand.ts)           |
| `pahcer-ui.toggleComparisonMode` | 比較モードを切り替え   | [extension.ts](src/extension.ts)                                               |
| `pahcer-ui.addComment`           | コメントを追加         | [addCommentCommand.ts](src/controller/commands/addCommentCommand.ts)           |
| `pahcer-ui.changeSortOrder`      | 並び順を変更           | [changeSortOrderCommand.ts](src/controller/commands/changeSortOrderCommand.ts) |
| `pahcer-ui.showVisualizer`       | ビジュアライザを表示   | [extension.ts](src/extension.ts)                                               |

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

## 例外設計

### 原則

- **汎用の `Error()` は投げない** - 具体的な例外クラスを定義して投げる
- **各レイヤーごとに例外を定義** - レイヤー固有のエラーハンドリング要件を反映
- **例外クラスは専用ファイルに定義** - `application/exceptions.ts`, `infrastructure/exceptions.ts` など

### 言語使い分け

**統一した規約:**
- **例外クラス名**: 英語 (PascalCase)
  - `ResourceNotFoundError`, `CommandExecutionError`, `DomainValidationError` など
  - コード側の型として使用されるため、国際的標準に統一

- **例外メッセージ（UI側）**: 日本語
  - `ファイルが見つかりません`, `コマンド実行に失敗しました` など
  - ユーザーに表示されるメッセージなので日本語で統一

- **コメント**: 英語
  - JSDoc コメント、コード内コメントは英語で統一
  - 開発チーム全体の可読性とメンテナンス性を確保

**例**:
```typescript
/**
 * Thrown when external command execution fails
 */
export class CommandExecutionError extends InfrastructureException {
  constructor(command: string, message: string) {
    super(`コマンド実行に失敗しました: ${command} - ${message}`);
    // ↑ UI メッセージは日本語
  }
}
```

### レイヤーごとの例外定義

#### アプリケーション層（`src/application/exceptions.ts`）

ユースケース実行時に発生するエラー。主にビジネスロジックやワークフロー上の障害を表現。

```typescript
// src/application/exceptions.ts

/**
 * Base class for application layer exceptions
 * UI messages are in Japanese; exception class names are in English
 */
export abstract class ApplicationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Thrown when a required resource is not found
 */
export class ResourceNotFoundError extends ApplicationException {
  constructor(resourceType: string, resourceId?: string) {
    const message = resourceId
      ? `${resourceType} '${resourceId}' が見つかりませんでした`
      : `${resourceType} が見つかりませんでした`;
    super(message);
  }
}

/**
 * Thrown when workflow precondition is not met
 */
export class PreconditionFailedError extends ApplicationException {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Base class for use case execution errors
 * Create subclasses only when there is semantic meaning to the error handling
 */
export class UseCaseExecutionError extends ApplicationException {
  constructor(cause: string) {
    super(`ユースケース実行に失敗しました: ${cause}`);
  }
}
```

#### エラーハンドリングのベストプラクティス

**原則**: エラーは以下のいずれかでのみ catch する。それ以外は try-catch を使わない：

1. **セマンティックに異なる例外型への変換が必要**：アプリケーション層で処理分岐が変わる場合のみ
   - 例：`ResourceNotFoundError` を throw → プレゼンテーション層で「リソースが見つかりません」と表示するか、別の動作をするか判定
   - エラーの型ごとに異なるハンドリングが存在する場合のみ有効

2. **エラーから重要な情報を抽出する必要がある**：エラーオブジェクトの詳細を加工する場合
   - 例：スタックトレースから特定の情報だけを取得するなど

```typescript
// ❌ 悪い例1: エラー型を詰め替えるだけ（ハンドリングの余地がない）
try {
  await this.pahcerAdapter.run(options, tempConfig);
} catch (error) {
  // CommandExecutionError を別の型に詰め替えるだけ
  // → プレゼンテーション層でもどちらを catch してもハンドリングは同じ
  // → エラー型を変換する意味がない
  throw new Error(
    error instanceof Error ? error.message : String(error)
  );
}

// ❌ 悪い例2: メッセージを変換するだけ
try {
  await this.pahcerAdapter.run();
} catch (error) {
  throw new Error(`git operation failed: ${error.message}`);
}

// ✅ 良い例1: セマンティックに異なる例外型に変換（ハンドリングの意味がある）
try {
  const config = await this.pahcerConfigRepository.findById('temporary');
  if (!config) {
    throw new ResourceNotFoundError('テンポラリ設定ファイル');
  }
} catch (error) {
  // ResourceNotFoundError は特別な意味がある
  // プレゼンテーション層で「リソースが見つかりません」と表示したり、
  // リトライロジックを実装したりできる
  throw error;
}

// ✅ 良い例2: try-catch を使わずにエラーをそのまま上に上げる
// インフラ層のエラーがアプリケーション層を通り、
// プレゼンテーション層でハンドリングされる
await this.pahcerAdapter.run(options, tempConfig);

// ✅ 良い例3: エラーから重要な情報を抽出して加工する場合
try {
  await this.pahcerAdapter.run(options, tempConfig);
} catch (error) {
  // エラーオブジェクトから詳細情報を抽出し、ログに記録
  const details = this.extractErrorDetails(error);
  logger.error('Pahcer execution failed', details);
  throw error; // 元のエラーを上に上げる
}
```

**判断基準**:
- **try-catch が必要**: その例外型に対して異なるハンドリングロジックが存在する場合のみ
  - 例：`ResourceNotFoundError` →「見つかりません」と表示
  - 例：`PreconditionFailedError` → ワークフロー再開のための別の動作
- **try-catch が不要**: 単にエラーを別の型で包み直すだけ、またはメッセージを変換するだけの場合
  - エラーをそのまま上に上げ、呼び出し元（プレゼンテーション層）でハンドリング
  - プレゼンテーション層で `error instanceof CommandExecutionError` でハンドリング可能

#### インフラ層（`src/infrastructure/exceptions.ts`）

ファイルI/O、外部API呼び出しなどで発生するエラー。

```typescript
// src/infrastructure/exceptions.ts

/**
 * Base class for infrastructure layer exceptions
 * UI messages are in Japanese; exception class names are in English
 */
export abstract class InfrastructureException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Thrown when a required file is not found
 */
export class FileNotFoundError extends InfrastructureException {
  constructor(filePath: string) {
    super(`ファイルが見つかりません: ${filePath}`);
  }
}

/**
 * Thrown when file read/write operation fails
 */
export class FileOperationError extends InfrastructureException {
  constructor(operation: string, filePath: string, cause: string) {
    super(`${operation}に失敗しました (${filePath}): ${cause}`);
  }
}

/**
 * Thrown when external command execution fails
 */
export class CommandExecutionError extends InfrastructureException {
  constructor(command: string, message: string) {
    super(`コマンド実行に失敗しました: ${command} - ${message}`);
  }
}
```

#### ドメイン層（`src/domain/exceptions.ts`）

ビジネスロジックの検証エラー。コンストラクタのバリデーション失敗など。

```typescript
// src/domain/exceptions.ts

/**
 * Base class for domain layer exceptions
 */
export abstract class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Thrown when domain model invariant is violated
 */
export class DomainValidationError extends DomainException {
  constructor(message: string) {
    super(`ドメイン検証エラー: ${message}`);
  }
}
```

### 使用例

```typescript
// アプリケーション層
import {
  ResourceNotFoundError,
  PreconditionFailedError,
  UseCaseExecutionError,
} from './exceptions';

export class RunPahcerUseCase {
  async run(options?: PahcerRunOptions): Promise<void> {
    // リソースが見つからない場合
    const config = await this.pahcerConfigRepository.findById('normal');
    if (!config) {
      throw new ResourceNotFoundError('pahcer設定');
    }

    // ワークフロー上の前提条件が満たされていない
    const allExecutions = await this.executionRepository.findAll();
    if (allExecutions.length === 0) {
      throw new PreconditionFailedError('実行結果が取得できませんでした');
    }

    // 外部操作が失敗した
    try {
      await this.gitAdapter.commitSourceBeforeExecution();
    } catch (error) {
      throw new UseCaseExecutionError('runPahcer', error instanceof Error ? error.message : String(error));
    }
  }
}
```

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
- **ドメインサービス**: TypeScript namespace パターンを使用
- **フォーマッター**: Biome（`npm run format`）
- **Linter**: ESLint（`npm run lint`）
- **型チェック**: `npm run check-types`

**フォーマットとリント実行**:
```bash
# インポート順序やフォーマットの自動修正
npm run format

# コンパイル（型チェック + リント + ビルド）
npm run compile
```

注：形式的な問題（インポート順序、行の長さ、スペーシングなど）は `npm run format` で自動修正することが推奨されます。手作業での修正は避け、Biome に任せることで一貫性を保ちます。

### テスト

現時点では自動テストは実装されていませんが、以下を手動で確認：

1. 型チェック: `npm run check-types`
2. ビルド: `npm run build`
3. 動作確認: VS CodeでF5を押して拡張機能を起動

詳細は [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) を参照。

### コミット

**重要**: コミットはユーザーが行います。Claude Code は修正を実装しますが、コミット作成（`git commit`）は実行しません。
- 修正が完了したら、ユーザーが `git add` と `git commit` を実行してください
- コミットメッセージはユーザーが作成してください

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
