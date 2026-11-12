export class ValidationError extends Error {
  constructor(errors) {
    super(Object.values(errors).join(' '));
    this.errors = errors;
  }
}

export class ConflictError extends Error {}
