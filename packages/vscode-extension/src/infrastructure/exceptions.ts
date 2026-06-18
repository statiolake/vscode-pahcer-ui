abstract class VSCodeInfrastructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class VSCodeFileOperationError extends VSCodeInfrastructureError {
  constructor(operation: string, filePath: string, cause: string) {
    super(`${operation}に失敗しました (${filePath}): ${cause}`);
  }
}

export class VSCodeCommandExecutionError extends VSCodeInfrastructureError {
  constructor(command: string, message: string) {
    super(`コマンド実行に失敗しました: ${command} - ${message}`);
  }
}
