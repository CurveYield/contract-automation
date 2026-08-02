import { createDirectService as createDirectServiceV1 } from './service.mjs';
import {
  validateServiceCommand,
  validateServiceError
} from './contracts.mjs';
import {
  createServiceResult,
  validateServiceResult
} from './result-contracts-v2.mjs';

export function createDirectService(input) {
  const inner = createDirectServiceV1(input);
  return Object.freeze({
    async execute(commandInput) {
      const command = validateServiceCommand(commandInput);
      const raw = await inner.execute(command);
      if (raw?.schemaVersion === 'github-direct-service-error-v1') {
        return validateServiceError(raw);
      }
      if (raw?.schemaVersion === 'github-direct-service-result-v2') {
        return validateServiceResult(raw);
      }
      return createServiceResult({
        command,
        state: raw.state,
        data: raw.data,
        completedAt: raw.completedAt
      });
    }
  });
}
