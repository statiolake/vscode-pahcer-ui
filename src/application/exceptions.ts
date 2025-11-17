/**
 * Application layer exceptions
 *
 * Exceptions thrown during use case execution representing business logic
 * and workflow failures. Converted to user-facing error messages in the
 * presentation layer.
 *
 * Convention: UI messages are in Japanese; exception class names are in English
 */

/**
 * Base class for application layer exceptions
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
 * Thrown when a workflow precondition is not met
 */
export class PreconditionFailedError extends ApplicationException {}

/**
 * Base class for use case execution errors
 *
 * Only create subclasses when error handling differs based on the exception type.
 * Simple message wrapping without semantic meaning should be avoided.
 */
export class UseCaseExecutionError extends ApplicationException {
  constructor(cause: string) {
    super(`ユースケース実行に失敗しました: ${cause}`);
  }
}
