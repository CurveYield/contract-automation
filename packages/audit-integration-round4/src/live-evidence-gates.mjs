const RESOLVED = Object.freeze([
  "pr126-security-repair-acceptance",
  "stage0-direct-takeover-validator-repair-receipt",
  "round4-final-tree-attestation-v1"
]);

const UNRESOLVED = Object.freeze([]);

export const ROUND4_LIVE_GATES_SOURCE = Object.freeze({
  "schemaVersion": "round4-live-integration-gates-v1",
  "stageAInputsResolved": true,
  "disjointIntakePrepared": true,
  "subsystemProductionIntakeAuthorized": true,
  "pr126SecurityRepairAccepted": true,
  "stage0ValidatorRepairAccepted": true,
  "exactTreeAttestationPresent": true,
  "finalAssembledCandidateAuthorized": true,
  "resolved": RESOLVED,
  "unresolved": UNRESOLVED
});
