export const SERVICE_OPERATIONS=Object.freeze([
'campaign.create','campaign.read','fork.action','fork.checkpoint','fork.create','fork.delete','fork.export','fork.restore','fork.read','merge.create','merge.read','provenance.read','report.publish','report.read','share.create','share.revoke']);
export const SERVICE_STATUSES=Object.freeze(['accepted','succeeded','awaiting_executor','hidden','failed','cancelled']);
export const ALL_SCOPES=Object.freeze(['audit:read','audit:submit','campaign:merge','campaign:read','campaign:share-base','campaign:write']);
export const TERMINAL_STATES=Object.freeze(['deleted','failed','cancelled','completed','policy_rejected']);
export const OPERATION_SCOPE=Object.freeze({
 'fork.create':'audit:submit','fork.read':'audit:read','fork.action':'audit:submit','fork.checkpoint':'audit:submit','fork.export':'audit:submit','fork.restore':'audit:submit','fork.delete':'audit:submit',
 'campaign.create':'campaign:write','campaign.read':'campaign:read','share.create':'campaign:share-base','share.revoke':'campaign:share-base','merge.create':'campaign:merge','merge.read':'campaign:read','provenance.read':'campaign:read','report.read':'campaign:read','report.publish':'campaign:write'});
