// Pure TypeScript synchronous SHA-256 + HMAC envelope so profileStore loads
// synchronously without async race conditions while preventing casual DevTools tampering.

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const H0 = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const APP_PEPPER = 'PAWS-ARCADE-CABIN-INTEGRITY-2026-V2';
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export type UnwrapStatus = 'empty' | 'legacy_v1' | 'valid_v2' | 'tampered';

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Bytes(msg: Uint8Array): Uint8Array {
  const len = msg.length;
  const bitLen = len * 8;
  const paddedLen = Math.ceil((len + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(msg);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const h = new Uint32Array(H0);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i], false);
  return out;
}

export function computeHmacSha256Hex(message: string): string {
  const enc = new TextEncoder();
  let keyBytes: Uint8Array = enc.encode(APP_PEPPER);
  if (keyBytes.length > 64) keyBytes = sha256Bytes(keyBytes);

  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  ipad.fill(0x36);
  opad.fill(0x5c);
  for (let i = 0; i < keyBytes.length; i++) {
    ipad[i] ^= keyBytes[i];
    opad[i] ^= keyBytes[i];
  }

  const msgBytes = enc.encode(message);
  const inner = new Uint8Array(64 + msgBytes.length);
  inner.set(ipad);
  inner.set(msgBytes, 64);
  const innerHash = sha256Bytes(inner);

  const outer = new Uint8Array(64 + 32);
  outer.set(opad);
  outer.set(innerHash, 64);
  const digest = sha256Bytes(outer);

  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function stripUnsafeKeys(val: unknown): unknown {
  if (Array.isArray(val)) return val.map(stripUnsafeKeys);
  if (val && typeof val === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      if (UNSAFE_KEYS.has(k)) continue;
      Object.defineProperty(clean, k, {
        value: stripUnsafeKeys(v),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return clean;
  }
  return val;
}

export function safeJsonParse(raw: string): unknown {
  const parsed = JSON.parse(raw) as unknown;
  return stripUnsafeKeys(parsed);
}

function isJsonOmittedValue(val: unknown): boolean {
  return val === undefined || typeof val === 'function' || typeof val === 'symbol';
}

function canonicalStringify(val: unknown): string {
  if (val === null || isJsonOmittedValue(val)) return 'null';
  if (typeof val === 'number') return Number.isFinite(val) ? JSON.stringify(val) : 'null';
  if (typeof val === 'boolean' || typeof val === 'string') return JSON.stringify(val);
  if (Array.isArray(val)) {
    return `[${val.map((item) => (isJsonOmittedValue(item) ? 'null' : canonicalStringify(item))).join(',')}]`;
  }
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj)
    .sort()
    .filter((k) => !isJsonOmittedValue(obj[k]));
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`).join(',')}}`;
}

function generateNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

export function wrapSignedProfile(data: unknown): string {
  const cleanData = stripUnsafeKeys(data);
  const nonce = generateNonce();
  const savedAt = Date.now();
  const body = `${nonce}|${savedAt}|${canonicalStringify(cleanData)}`;
  const sig = computeHmacSha256Hex(body);
  return JSON.stringify({ v: 2, data: cleanData, nonce, savedAt, sig });
}

export function unwrapSignedProfile(raw: string | null | undefined): {
  status: UnwrapStatus;
  data?: Record<string, unknown>;
} {
  if (!raw || raw.trim().length === 0) return { status: 'empty' };
  try {
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { status: 'tampered' };
    }
    const obj = parsed as Record<string, unknown>;

    if (obj.v === 2) {
      if (
        !obj.data ||
        typeof obj.data !== 'object' ||
        Array.isArray(obj.data) ||
        typeof obj.nonce !== 'string' ||
        obj.nonce.length === 0 ||
        typeof obj.savedAt !== 'number' ||
        !Number.isFinite(obj.savedAt) ||
        typeof obj.sig !== 'string'
      ) {
        return { status: 'tampered' };
      }
      const body = `${obj.nonce}|${obj.savedAt}|${canonicalStringify(obj.data)}`;
      const expected = computeHmacSha256Hex(body);
      if (!timingSafeEqualHex(expected, obj.sig)) {
        return { status: 'tampered' };
      }
      return { status: 'valid_v2', data: obj.data as Record<string, unknown> };
    }

    // Legacy v1 cannot legitimately carry v2+ Block Blast or envelope fields; reject downgrade spoofing
    if ('blockBlastBestScore' in obj || 'settledMatchIds' in obj || 'sig' in obj || 'v' in obj) {
      return { status: 'tampered' };
    }
    return { status: 'legacy_v1', data: obj };
  } catch {
    return { status: 'tampered' };
  }
}
