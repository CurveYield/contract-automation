const MAX_ERROR_MESSAGE = 240;

export function fail(code, path, message = code) {
  const error = new Error(String(message).slice(0, MAX_ERROR_MESSAGE));
  error.name = 'Phase5ResultValidationError';
  error.code = code;
  error.path = path;
  throw error;
}
