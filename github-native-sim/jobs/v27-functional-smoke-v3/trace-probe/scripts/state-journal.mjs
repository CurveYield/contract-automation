import crypto from "node:crypto";

function lowerObjectKeys(object = {}) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key.toLowerCase(), value]));
}

function clone(value) { return structuredClone(value); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export class StateJournal {
  constructor(initial = {}) { this.overrides = clone(initial); }
  toOverrides() { return clone(this.overrides); }
  hash() {
    return `0x${crypto.createHash("sha256").update(JSON.stringify(canonical(this.overrides))).digest("hex")}`;
  }
  mergePrestateDiff(result) {
    if (!result || typeof result !== "object" || !result.pre || !result.post) {
      throw new Error("prestateTracer diffMode result must contain pre and post");
    }
    const pre = lowerObjectKeys(result.pre);
    const post = lowerObjectKeys(result.post);
    const addresses = new Set([...Object.keys(pre), ...Object.keys(post)]);
    for (const address of addresses) {
      const before = pre[address];
      const after = post[address];
      if (!after) throw new Error(`account deletion/selfdestruct is unsupported by the journal: ${address}`);
      const target = this.overrides[address] ?? {};
      for (const field of ["balance", "nonce", "code"]) if (after[field] !== undefined) target[field] = after[field];
      const beforeStorage = lowerObjectKeys(before?.storage ?? {});
      const afterStorage = lowerObjectKeys(after.storage ?? {});
      const changedSlots = new Set([...Object.keys(beforeStorage), ...Object.keys(afterStorage)]);
      if (changedSlots.size) target.stateDiff = { ...(target.stateDiff ?? {}) };
      for (const slot of changedSlots) target.stateDiff[slot] = afterStorage[slot] ?? "0x0";
      this.overrides[address] = target;
    }
    return this.hash();
  }
}
