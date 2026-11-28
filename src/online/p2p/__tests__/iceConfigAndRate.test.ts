import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STUN_SERVERS,
  getWebRtcConfig,
  parseIceServersEnv,
} from '../iceConfig.ts';
import {
  computeFallbackIntervalMs,
  computeGuestFallbackInputIntervalMs,
} from '../adaptiveRate.ts';
import {
  decodeP2PFrame,
  encodeP2PFrame,
  isValidWebRtcSignal,
  WEBRTC_SIGNAL_EVENT,
} from '../signaling.ts';

describe('WebRTC ICE config & adaptive fallback rate', () => {
  it('falls back to default STUN servers when env is missing or malformed', () => {
    assert.ok(DEFAULT_STUN_SERVERS.length >= 2);
    assert.deepEqual(parseIceServersEnv(undefined), DEFAULT_STUN_SERVERS);
    assert.deepEqual(parseIceServersEnv(''), DEFAULT_STUN_SERVERS);
    assert.deepEqual(parseIceServersEnv('not-json'), DEFAULT_STUN_SERVERS);
    assert.deepEqual(parseIceServersEnv('[{"bad":true}]'), DEFAULT_STUN_SERVERS);
  });

  it('parses valid custom STUN/TURN servers from VITE_WEBRTC_ICE_SERVERS JSON', () => {
    const raw = JSON.stringify([
      { urls: 'stun:stun.example.com:3478' },
      {
        urls: ['turn:turn.example.com:3478?transport=udp'],
        username: 'u1',
        credential: 'p1',
      },
      { urls: '' }, // invalid entry skipped
    ]);

    const parsed = parseIceServersEnv(raw);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].urls, 'stun:stun.example.com:3478');
    assert.deepEqual(parsed[1], {
      urls: ['turn:turn.example.com:3478?transport=udp'],
      username: 'u1',
      credential: 'p1',
    });

    const cfg = getWebRtcConfig(raw);
    assert.equal(cfg.iceServers?.length, 2);
  });

  it('scales Supabase fallback snapshot & input intervals by room size and returns Infinity when 0 fallback guests', () => {
    assert.equal(computeFallbackIntervalMs(60, 0, 8), Number.POSITIVE_INFINITY);
    assert.equal(computeFallbackIntervalMs(67, 1, 2), 67);
    assert.ok(computeFallbackIntervalMs(60, 1, 4) >= 110);
    assert.ok(computeFallbackIntervalMs(60, 2, 8) >= 165);

    assert.equal(computeGuestFallbackInputIntervalMs(67, 2), 67);
    assert.ok(computeGuestFallbackInputIntervalMs(60, 4) >= 110);
    assert.ok(computeGuestFallbackInputIntervalMs(60, 8) >= 160);
  });

  it('validates signaling payloads strictly and round-trips compact P2P frames', () => {
    assert.equal(WEBRTC_SIGNAL_EVENT, 'paws_webrtc_signal');
    assert.equal(
      isValidWebRtcSignal({
        v: 1,
        sessionId: 'sess-1',
        fromPeerId: 'host',
        toPeerId: 'guest-1',
        kind: 'offer',
        sdp: 'v=0...',
      }),
      true,
    );
    assert.equal(isValidWebRtcSignal(null), false);
    assert.equal(
      isValidWebRtcSignal({
        v: 1,
        sessionId: '',
        fromPeerId: 'host',
        toPeerId: 'guest-1',
        kind: 'offer',
      }),
      false,
    );
    assert.equal(
      isValidWebRtcSignal({
        v: 1,
        sessionId: 'sess-1',
        fromPeerId: 'host',
        toPeerId: 'guest-1',
        kind: 'unknown',
      }),
      false,
    );

    const encoded = encodeP2PFrame('brawl_snapshot', { tick: 42, ok: true });
    const decoded = decodeP2PFrame(encoded);
    assert.deepEqual(decoded, {
      event: 'brawl_snapshot',
      payload: { tick: 42, ok: true },
    });
    assert.equal(decodeP2PFrame('not-json{'), null);
    assert.equal(decodeP2PFrame(JSON.stringify({ wrong: 1 })), null);
  });
});
