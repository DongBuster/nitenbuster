export const WEBRTC_SIGNAL_EVENT = 'paws_webrtc_signal';
export const WEBRTC_DATACHANNEL_LABEL = 'paws-rt-v1';

export type WebRtcSignalKind = 'hello' | 'offer' | 'answer' | 'ice';

export interface WebRtcSignalPayload {
  v: 1;
  sessionId: string;
  fromPeerId: string;
  toPeerId: string;
  kind: WebRtcSignalKind;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

const VALID_KINDS = new Set<string>(['hello', 'offer', 'answer', 'ice']);

function isNonEmptyString(val: unknown, maxLen = 128): val is string {
  return typeof val === 'string' && val.length > 0 && val.length <= maxLen;
}

export function isValidWebRtcSignal(raw: unknown): raw is WebRtcSignalPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;
  if (obj.v !== 1) return false;
  if (!isNonEmptyString(obj.sessionId, 64)) return false;
  if (!isNonEmptyString(obj.fromPeerId, 64)) return false;
  if (!isNonEmptyString(obj.toPeerId, 64)) return false;
  if (typeof obj.kind !== 'string' || !VALID_KINDS.has(obj.kind)) return false;

  if (obj.kind === 'offer' || obj.kind === 'answer') {
    return typeof obj.sdp === 'string' && obj.sdp.length > 0 && obj.sdp.length <= 65536;
  }
  if (obj.kind === 'ice') {
    return (
      Boolean(obj.candidate) &&
      typeof obj.candidate === 'object' &&
      !Array.isArray(obj.candidate)
    );
  }
  return true;
}

export function encodeP2PFrame(event: string, payload: unknown): string {
  return JSON.stringify({ e: event, p: payload });
}

export function decodeP2PFrame(
  raw: unknown,
): { event: string; payload: unknown } | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    if (!isNonEmptyString(obj.e, 64)) return null;
    if (!Object.prototype.hasOwnProperty.call(obj, 'p')) return null;
    return { event: obj.e, payload: obj.p };
  } catch {
    return null;
  }
}
