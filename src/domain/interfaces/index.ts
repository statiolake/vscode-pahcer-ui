// Repository Interfaces

export type { PahcerRunOptions } from '../models/pahcerStatus';
// Domain Models (exported for use throughout app)
export { PahcerStatus } from '../models/pahcerStatus';
export type { IExecutionRepository } from './IExecutionRepository';
export type { IFileAnalyzer } from './IFileAnalyzer';
export type { IGitAdapter } from './IGitAdapter';
export type { IGitignoreAdapter } from './IGitignoreAdapter';
export type { FileType, IInOutFilesAdapter } from './IInOutFilesAdapter';
// Adapter Interfaces
export type { IPahcerAdapter } from './IPahcerAdapter';
export type { IPahcerConfigRepository } from './IPahcerConfigRepository';
export type { ITestCaseRepository } from './ITestCaseRepository';
export type { DownloadedTester, ITesterDownloader } from './ITesterDownloader';
export type { IUIConfigRepository } from './IUIConfigRepository';
export type { IVisualizerCache } from './IVisualizerCache';
export type { IVisualizerDownloader } from './IVisualizerDownloader';
