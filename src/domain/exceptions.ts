/**
 * Domain layer exceptions
 *
 * Exceptions representing invariant violations during business logic execution.
 * Used for domain model validation errors.
 *
 * Convention: UI messages are in Japanese; exception class names are in English
 */

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
