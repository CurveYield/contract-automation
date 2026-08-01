const encoder = new TextEncoder();

export const AUDIT_UPLOAD_GRANT_KDF_SALT = 'curveyield-audit-edge-control-plane-v1';
export const AUDIT_UPLOAD_GRANT_KDF_INFO = 'curveyield-audit-upload-grant-v1';

export async function deriveUploadGrantSigningKey(edgeControlPlaneToken) {
  if (typeof edgeControlPlaneToken !== 'string' || edgeControlPlaneToken.length < 32 || edgeControlPlaneToken.length > 4096) {
    throw new TypeError('AUDIT_EDGE_CONTROL_PLANE_TOKEN must contain 32 to 4096 characters');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(edgeControlPlaneToken),
    'HKDF',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits({
    name: 'HKDF',
    hash: 'SHA-256',
    salt: encoder.encode(AUDIT_UPLOAD_GRANT_KDF_SALT),
    info: encoder.encode(AUDIT_UPLOAD_GRANT_KDF_INFO)
  }, key, 256);
  return new Uint8Array(bits);
}

export function encodeUploadGrantSigningKey(value) {
  if (!(value instanceof Uint8Array) || value.byteLength !== 32) throw new TypeError('Upload grant signing key must contain 32 bytes');
  return [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
