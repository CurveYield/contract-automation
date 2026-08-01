export function safeDisplayText(value, maxLength = 2000) {
  return String(value ?? '').slice(0, maxLength);
}

export function createCapabilityViewModel(value = {}) {
  const enabled = value.executionEnabled === true;
  return Object.freeze({
    phaseLabel: `Phase ${Number.isSafeInteger(value.phase) ? value.phase : 1}`,
    executionLabel: enabled ? 'Submitted execution enabled' : 'Submitted execution disabled',
    stateLabel: enabled ? safeDisplayText(value.executionState || 'Available') : 'Awaiting separately approved hardened executor',
    enabled
  });
}
