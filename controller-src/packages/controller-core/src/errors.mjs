export class ControllerError extends Error {
  constructor(message, code = 'CONTROLLER_ERROR') {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class ValidationError extends ControllerError {
  constructor(message) { super(message, 'VALIDATION_ERROR'); }
}

export class InvalidTransitionError extends ControllerError {
  constructor(message) { super(message, 'INVALID_TRANSITION'); }
}

export class CommandConflictError extends ControllerError {
  constructor(message) { super(message, 'COMMAND_CONFLICT'); }
}

export class NotFoundError extends ControllerError {
  constructor(message) { super(message, 'NOT_FOUND'); }
}
