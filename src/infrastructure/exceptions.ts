/**
 * Infrastructure layer exceptions
 *
 * Exceptions thrown during file I/O and external API calls representing
 * integration failures with external systems.
 *
 * Convention: UI messages are in Japanese; exception class names are in English
 */

/**
 * Base class for infrastructure layer exceptions
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
 * Thrown when file operation fails
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
