export const DEFAULT_STUN_SERVERS: readonly RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

function readIceEnv(): string | undefined {
  const metaEnv = (import.meta as { env?: Record<string, string | undefined> })
    .env;
  const val = metaEnv?.VITE_WEBRTC_ICE_SERVERS;
  return typeof val === 'string' && val.trim().length > 0
    ? val.trim()
    : undefined;
}

function isValidUrls(val: unknown): val is string | string[] {
  if (typeof val === 'string') {
    return val.trim().length > 0;
  }
  if (Array.isArray(val) && val.length > 0) {
    return val.every((item) => typeof item === 'string' && item.trim().length > 0);
  }
  return false;
}

/**
 * Parses an optional JSON array of STUN/TURN `RTCIceServer` entries from
 * `VITE_WEBRTC_ICE_SERVERS`. Falls back to `DEFAULT_STUN_SERVERS` when empty
 * or malformed so invalid config never breaks multiplayer.
 */
export function parseIceServersEnv(raw: string | undefined): RTCIceServer[] {
  if (!raw || raw.trim().length === 0) {
    return DEFAULT_STUN_SERVERS.map((s) => ({ ...s }));
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return DEFAULT_STUN_SERVERS.map((s) => ({ ...s }));
    }

    const valid: RTCIceServer[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const rec = item as Record<string, unknown>;
      if (!isValidUrls(rec.urls)) continue;

      const server: RTCIceServer = {
        urls: Array.isArray(rec.urls)
          ? rec.urls.map((u) => u.trim())
          : rec.urls.trim(),
      };
      if (typeof rec.username === 'string' && rec.username.length > 0) {
        server.username = rec.username;
      }
      if (typeof rec.credential === 'string' && rec.credential.length > 0) {
        server.credential = rec.credential;
      }
      valid.push(server);
    }

    return valid.length > 0
      ? valid
      : DEFAULT_STUN_SERVERS.map((s) => ({ ...s }));
  } catch {
    return DEFAULT_STUN_SERVERS.map((s) => ({ ...s }));
  }
}

export function getWebRtcConfig(rawEnvOverride?: string): RTCConfiguration {
  const raw = rawEnvOverride !== undefined ? rawEnvOverride : readIceEnv();
  return {
    iceServers: parseIceServersEnv(raw),
    iceCandidatePoolSize: 2,
  };
}
