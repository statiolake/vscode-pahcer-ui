import type { PahcerStatusView } from '@pahcer/core/application/dtos/pahcerUIState';

import type { CaseFileKind, Panel, SourcePreparation } from '../types';

export function panelLabel(panel: Panel): string {
  switch (panel) {
    case 'comparison':
      return 'グラフ';
    case 'case':
      return 'ケース';
    case 'diff':
      return '差分';
    case 'source':
      return 'ソース';
    case 'visualizer':
      return 'ビジュアライザ';
    case 'initialize':
      return '初期化';
  }
}

export function statusLabel(status: PahcerStatusView | undefined): string {
  switch (status) {
    case 'ready':
      return '準備完了';
    case 'notInitialized':
      return '未初期化';
    case 'notInstalled':
      return '未インストール';
    case 'unknown':
      return '状態不明';
    default:
      return '読み込み中';
  }
}

export function caseFileKindLabel(kind: CaseFileKind): string {
  switch (kind) {
    case 'input':
      return '入力';
    case 'output':
      return '出力';
    case 'error':
      return 'エラー';
  }
}

export function sourcePreparationStatusLabel(status: SourcePreparation['status']): string {
  switch (status) {
    case 'notFound':
      return '実行結果が見つかりません';
    case 'missingCommitHash':
      return 'コミット情報がありません';
    case 'noFiles':
      return '表示できるソースファイルがありません';
    case 'ready':
      return '読み込み可能です';
  }
}

export function diffStatusLabel(status: string): string {
  switch (status) {
    case 'invalidSelection':
      return '比較する実行を 2 件選択してください';
    case 'missingCommitHash':
      return 'コミット情報がないため差分を表示できません';
    case 'shown':
      return '表示済み';
    default:
      return status;
  }
}
