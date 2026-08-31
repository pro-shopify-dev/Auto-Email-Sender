/** Throwable domain error carrying an HTTP status, so services can surface user-facing
 * messages without importing any framework code (safe for the standalone worker). */
export class DomainError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "DomainError";
    this.status = status;
  }
}
