const TEST_ONLY_BINDINGS = new Set([
  'AUDIT_NOW',
  'AUDIT_UPLOAD_URL_SIGNER',
  'AUDIT_GITHUB_ARCHIVE_RESOLVER',
  'AUDIT_LAYER_BUNDLE_RESOLVER',
  'AUDIT_EVIDENCE_VALIDATOR',
  'AUDIT_EVIDENCE_ATTESTATION_SIGNER',
  'AUDIT_WORKSPACE_SERVICE',
  'AUDIT_PROFILE_REGISTRY',
  'AUDIT_CAMPAIGN_SERVICE',
  'AUDIT_EVIDENCE_SERVICE'
]);

const APPROVED_IDENTITY_ALIASES = Object.freeze({
  AUDIT_SUBMIT_API_KEY: 'AUDIT_GPT_API_KEY',
  AUDIT_ADMIN_API_KEY: 'AUDIT_CLIENT_API_KEY',
  AUDIT_INTERNAL_SERVICE_KEY: 'AUDIT_EDGE_CONTROL_PLANE_TOKEN'
});

function stringConfigured(value, minimum = 1) {
  return typeof value === 'string' && value.length >= minimum;
}
function storeConfigured(value) {
  return Boolean(value && typeof value.get === 'function' && typeof value.put === 'function');
}
export function isAuditTestMode(env) {
  return env?.AUDIT_TEST_MODE === 'true';
}
function testFunction(env, name) {
  return isAuditTestMode(env) && typeof env?.[name] === 'function';
}

export function sanitizeAuditRuntimeEnv(env) {
  if (isAuditTestMode(env)) return env;
  return new Proxy(env ?? {}, {
    get(target, property, receiver) {
      if (TEST_ONLY_BINDINGS.has(property)) return undefined;
      return Reflect.get(target, property, receiver);
    },
    has(target, property) {
      if (TEST_ONLY_BINDINGS.has(property)) return false;
      return Reflect.has(target, property);
    }
  });
}

export function mapApprovedAuditRuntimeEnv(env) {
  const sanitized = sanitizeAuditRuntimeEnv(env);
  return new Proxy(sanitized ?? {}, {
    get(target, property, receiver) {
      const approvedName = APPROVED_IDENTITY_ALIASES[property];
      if (approvedName && stringConfigured(Reflect.get(target, approvedName, receiver))) {
        return Reflect.get(target, approvedName, receiver);
      }
      return Reflect.get(target, property, receiver);
    },
    has(target, property) {
      const approvedName = APPROVED_IDENTITY_ALIASES[property];
      if (approvedName && stringConfigured(Reflect.get(target, approvedName))) return true;
      return Reflect.has(target, property);
    }
  });
}

export function auditRuntimeConfiguration(env) {
  const clientKey = stringConfigured(env?.AUDIT_CLIENT_API_KEY, 32) || stringConfigured(env?.AUDIT_ADMIN_API_KEY);
  const gptKey = stringConfigured(env?.AUDIT_GPT_API_KEY, 32) || stringConfigured(env?.AUDIT_SUBMIT_API_KEY);
  const edgeControlKey = stringConfigured(env?.AUDIT_EDGE_CONTROL_PLANE_TOKEN, 32) || stringConfigured(env?.AUDIT_INTERNAL_SERVICE_KEY);
  const configuration = {
    clientKey,
    gptKey,
    edgeControlKey,
    nonceStore: storeConfigured(env?.AUDIT_NONCE_STORE),
    controlStore: storeConfigured(env?.AUDIT_CONTROL_STORE),
    uploadGrantSigner: stringConfigured(env?.AUDIT_EDGE_CONTROL_PLANE_TOKEN, 32),
    directUploadSigner: testFunction(env, 'AUDIT_UPLOAD_URL_SIGNER'),
    githubArchiveResolver: testFunction(env, 'AUDIT_GITHUB_ARCHIVE_RESOLVER'),
    generatedLayerResolver: testFunction(env, 'AUDIT_LAYER_BUNDLE_RESOLVER'),
    evidenceValidator: testFunction(env, 'AUDIT_EVIDENCE_VALIDATOR'),
    attestationSigner: stringConfigured(env?.AUDIT_ATTESTATION_PRIVATE_KEY, 32) || testFunction(env, 'AUDIT_EVIDENCE_ATTESTATION_SIGNER'),
    trustedFixtureCallbacks: env?.AUDIT_TRUSTED_FIXTURE_ENABLED === 'true',
    freeDevelopmentRetention: true,
    extended90dRetention: false,
    archive365dRetention: false,
    executionEnabled: false
  };
  return Object.freeze(configuration);
}

export function auditRuntimeReadiness(env) {
  const configuration = auditRuntimeConfiguration(env);
  const coreReady = configuration.clientKey && configuration.gptKey && configuration.edgeControlKey && configuration.nonceStore;
  const ready = coreReady
    && configuration.controlStore
    && configuration.uploadGrantSigner
    && configuration.directUploadSigner
    && configuration.evidenceValidator
    && configuration.attestationSigner;
  return Object.freeze({ ready, coreReady, configuration });
}

export function auditPhase3Capabilities(env) {
  const configuration = auditRuntimeConfiguration(env);
  const control = configuration.controlStore || isAuditTestMode(env);
  return Object.freeze({
    service: 'curveyield-audit',
    apiVersion: 'audit-v1',
    phase: 3,
    workspaces: control,
    workspaceUploads: configuration.uploadGrantSigner && configuration.directUploadSigner,
    githubImports: configuration.githubArchiveResolver,
    generatedLayers: configuration.generatedLayerResolver,
    profileRegistry: control,
    campaigns: control,
    jobs: control,
    logs: control,
    evidence: control,
    evidenceAcceptance: configuration.trustedFixtureCallbacks && configuration.evidenceValidator && configuration.attestationSigner,
    reports: control,
    reportPublication: false,
    executionEnabled: false,
    storage: 'r2-standard',
    executionState: 'awaiting_executor',
    retention: Object.freeze({
      freeDevelopment: true,
      extended90d: false,
      archive365d: false
    })
  });
}

export function isUnsupportedRetentionPolicy(value) {
  return value === 'extended-90d' || value === 'archive-365d';
}
