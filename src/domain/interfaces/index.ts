// Repository Interfaces

// Domain Models (exported for use throughout app)
export type { PahcerRunOptions } from '../models/pahcerStatus';
export { PahcerStatus } from '../models/pahcerStatus';
// Adapter Interfaces
export type { IContextAdapter } from './IContextAdapter';
export type { IExecutionRepository } from './IExecutionRepository';
export type { IFileAnalyzer } from './IFileAnalyzer';
export type { IGitAdapter } from './IGitAdapter';
export type { IGitignoreAdapter } from './IGitignoreAdapter';
export type { FileType, IInOutFilesAdapter } from './IInOutFilesAdapter';
export type { IPahcerAdapter } from './IPahcerAdapter';
export type { IPahcerConfigRepository } from './IPahcerConfigRepository';
export type { ITestCaseRepository } from './ITestCaseRepository';
export type { DownloadedTester, ITesterDownloader } from './ITesterDownloader';
export type { IUIConfigRepository } from './IUIConfigRepository';
export type { IVisualizerCache } from './IVisualizerCache';
export type { IVisualizerDownloader } from './IVisualizerDownloader';
