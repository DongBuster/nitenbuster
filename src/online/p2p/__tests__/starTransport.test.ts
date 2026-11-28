import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HostStarTransport,
  type DataChannelLike,
  type PeerConnectionLike,
  type RealtimeBroadcastChannel,
} from '../starTransport.ts';
import { WEBRTC_SIGNAL_EVENT } from '../signaling.ts';

class FakeSupabaseBus {
  private channels = new Map<string, FakeSupabaseChannel>();
  sentBroadcasts: Array<{ fromPeerId: string; event: string; payload: unknown }> = [];

  createChannel(peerId: string): FakeSupabaseChannel {
    const ch = new FakeSupabaseChannel(peerId, this);
    this.channels.set(peerId, ch);
    return ch;
  }

  dispatch(fromPeerId: string, event: string, payload: unknown): void {
    this.sentBroadcasts.push({ fromPeerId, event, payload });
    for (const [peerId, ch] of this.channels.entries()) {
      if (peerId === fromPeerId) continue;
      ch.deliver(event, payload);
    }
  }

  countEvents(event: string): number {
    return this.sentBroadcasts.filter((m) => m.event === event).length;
  }

  clearLog(): void {
    this.sentBroadcasts = [];
  }
}

class FakeSupabaseChannel implements RealtimeBroadcastChannel {
  private listeners = new Map<string, Set<(msg: { payload: unknown }) => void>>();
  private readonly peerId: string;
  private readonly bus: FakeSupabaseBus;

  constructor(peerId: string, bus: FakeSupabaseBus) {
    this.peerId = peerId;
    this.bus = bus;
  }

  on(
    _type: 'broadcast',
    filter: { event: string },
    callback: (message: { payload: unknown }) => void,
  ): this {
    let set = this.listeners.get(filter.event);
    if (!set) {
      set = new Set();
      this.listeners.set(filter.event, set);
    }
    set.add(callback);
    return this;
  }

  send(args: {
    type: 'broadcast';
    event: string;
    payload: unknown;
  }): Promise<'ok' | 'timed out' | 'error'> {
    this.bus.dispatch(this.peerId, args.event, args.payload);
    return Promise.resolve('ok');
  }

  deliver(event: string, payload: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      cb({ payload });
    }
  }
}

class FakeDataChannel implements DataChannelLike {
  label: string;
  readyState: RTCDataChannelState = 'connecting';
  bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  peerChannel: FakeDataChannel | null = null;
  sentFrames: string[] = [];

  constructor(label: string) {
    this.label = label;
  }

  send(data: string): void {
    if (this.readyState !== 'open') {
      throw new Error('DataChannel not open');
    }
    this.sentFrames.push(data);
    this.peerChannel?.onmessage?.({ data });
  }

  close(): void {
    if (this.readyState === 'closed') return;
    this.readyState = 'closed';
    this.onclose?.();
  }

  openPair(other: FakeDataChannel): void {
    this.peerChannel = other;
    other.peerChannel = this;
    this.readyState = 'open';
    other.readyState = 'open';
    this.onopen?.();
    other.onopen?.();
  }
}

class FakeWebRtcNetwork {
  private pcs: FakePeerConnection[] = [];
  blockedPeers = new Set<string>();

  createFactory(ownerPeerId: string) {
    return (): PeerConnectionLike => {
      const pc = new FakePeerConnection(ownerPeerId, this);
      this.pcs.push(pc);
      return pc;
    };
  }

  findOffererForOffer(sdp: string): FakePeerConnection | undefined {
    return this.pcs.find((pc) => pc.lastOfferSdp === sdp && !pc.closed);
  }

  getOpenConnections(ownerPeerId: string): FakePeerConnection[] {
    return this.pcs.filter((pc) => pc.ownerPeerId === ownerPeerId && !pc.closed);
  }
}

class FakePeerConnection implements PeerConnectionLike {
  iceConnectionState: RTCIceConnectionState = 'new';
  connectionState: RTCPeerConnectionState = 'new';
  onicecandidate: ((ev: { candidate: RTCIceCandidateInit | null }) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((ev: { channel: DataChannelLike }) => void) | null = null;

  readonly ownerPeerId: string;
  private readonly net: FakeWebRtcNetwork;
  lastOfferSdp = '';
  localChannel: FakeDataChannel | null = null;
  remoteDescSet = false;
  addedIceCandidates: RTCIceCandidateInit[] = [];
  closed = false;

  constructor(ownerPeerId: string, net: FakeWebRtcNetwork) {
    this.ownerPeerId = ownerPeerId;
    this.net = net;
  }

  createDataChannel(label: string): DataChannelLike {
    const dc = new FakeDataChannel(label);
    this.localChannel = dc;
    return dc;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.lastOfferSdp = `offer-from-${this.ownerPeerId}-${Math.random().toString(36).slice(2, 8)}`;
    return { type: 'offer', sdp: this.lastOfferSdp };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'answer', sdp: `answer-from-${this.ownerPeerId}` };
  }

  async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    if (desc.type === 'offer') {
      queueMicrotask(() => {
        if (!this.closed) {
          this.onicecandidate?.({
            candidate: { candidate: `cand-${this.ownerPeerId}`, sdpMid: '0' },
          });
        }
      });
    }
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescSet = true;
    if (desc.type === 'offer' && desc.sdp) {
      const offerer = this.net.findOffererForOffer(desc.sdp);
      if (
        offerer &&
        offerer.localChannel &&
        !this.net.blockedPeers.has(this.ownerPeerId)
      ) {
        const answerChannel = new FakeDataChannel(offerer.localChannel.label);
        this.localChannel = answerChannel;
        queueMicrotask(() => {
          if (this.closed || offerer.closed) return;
          this.iceConnectionState = 'connected';
          this.connectionState = 'connected';
          offerer.iceConnectionState = 'connected';
          offerer.connectionState = 'connected';
          this.ondatachannel?.({ channel: answerChannel });
          offerer.localChannel?.openPair(answerChannel);
          this.oniceconnectionstatechange?.();
          offerer.oniceconnectionstatechange?.();
        });
      }
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.remoteDescSet) {
      throw new Error('addIceCandidate called before setRemoteDescription');
    }
    this.addedIceCandidates.push(candidate);
  }

  simulateFailure(): void {
    this.iceConnectionState = 'failed';
    this.connectionState = 'failed';
    this.localChannel?.close();
    this.oniceconnectionstatechange?.();
    this.onconnectionstatechange?.();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.iceConnectionState = 'closed';
    this.connectionState = 'closed';
    this.localChannel?.close();
  }
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

describe('HostStarTransport (Hybrid WebRTC P2P + Adaptive Supabase Fallback)', () => {
  it('completes Host <-> Guest handshake and routes snapshots & inputs with 0 Supabase broadcasts once P2P is open', async () => {
    const bus = new FakeSupabaseBus();
    const net = new FakeWebRtcNetwork();
    let nowMs = 1000;

    const host = new HostStarTransport({
      channel: bus.createChannel('host'),
      myPeerId: 'host',
      now: () => nowMs,
      createPeerConnection: net.createFactory('host'),
    });
    const g1 = new HostStarTransport({
      channel: bus.createChannel('g1'),
      myPeerId: 'g1',
      now: () => nowMs,
      createPeerConnection: net.createFactory('g1'),
    });
    const g2 = new HostStarTransport({
      channel: bus.createChannel('g2'),
      myPeerId: 'g2',
      now: () => nowMs,
      createPeerConnection: net.createFactory('g2'),
    });

    const hostInputs: Array<{ payload: unknown; via: string; fromPeerId: string }> = [];
    const g1Snaps: Array<{ payload: unknown; via: string }> = [];
    const g2Snaps: Array<{ payload: unknown; via: string }> = [];

    host.onMessage('brawl_input', (payload, meta) => {
      hostInputs.push({ payload, via: meta.via, fromPeerId: meta.fromPeerId });
    });
    g1.onMessage('brawl_snapshot', (payload, meta) => {
      g1Snaps.push({ payload, via: meta.via });
    });
    g2.onMessage('brawl_snapshot', (payload, meta) => {
      g2Snaps.push({ payload, via: meta.via });
    });

    const peers = ['host', 'g1', 'g2'];
    host.syncPeers({ isHost: true, hostPeerId: 'host', peerIds: peers });
    g1.syncPeers({ isHost: false, hostPeerId: 'host', peerIds: peers });
    g2.syncPeers({ isHost: false, hostPeerId: 'host', peerIds: peers });

    await flushMicrotasks();

    assert.equal(host.getStats().mode, 'p2p');
    assert.equal(host.getStats().p2pPeers, 2);
    assert.equal(g1.getStats().mode, 'p2p');
    assert.equal(g2.getStats().mode, 'p2p');

    // Clear signaling log, then send real-time snapshots & inputs
    bus.clearLog();
    nowMs = 1100;
    const snapRes = host.sendFromHost('brawl_snapshot', { tick: 10 });
    assert.deepEqual(snapRes, { p2pSent: 2, usedFallback: false });
    assert.equal(g1Snaps.length, 1);
    assert.equal(g1Snaps[0].via, 'p2p');
    assert.equal(g2Snaps.length, 1);
    assert.equal(g2Snaps[0].via, 'p2p');

    const in1 = g1.sendToHost('brawl_input', { seq: 1, peerId: 'g1' });
    const in2 = g2.sendToHost('brawl_input', { seq: 1, peerId: 'g2' });
    assert.equal(in1, 'p2p');
    assert.equal(in2, 'p2p');
    assert.equal(hostInputs.length, 2);
    assert.equal(hostInputs[0].via, 'p2p');
    assert.equal(hostInputs[0].fromPeerId, 'g1');

    // Zero Supabase broadcasts during steady-state P2P play!
    assert.equal(bus.sentBroadcasts.length, 0);

    host.dispose();
    g1.dispose();
    g2.dispose();
  });

  it('uses hybrid routing when 1 peer is NAT-blocked: P2P peers get direct frames without duplicate fallback, blocked peer uses paced fallback', async () => {
    const bus = new FakeSupabaseBus();
    const net = new FakeWebRtcNetwork();
    net.blockedPeers.add('g2');
    let nowMs = 2000;

    const host = new HostStarTransport({
      channel: bus.createChannel('host'),
      myPeerId: 'host',
      fallbackBaseSnapshotIntervalMs: 60,
      fallbackBaseInputIntervalMs: 60,
      now: () => nowMs,
      createPeerConnection: net.createFactory('host'),
    });
    const g1 = new HostStarTransport({
      channel: bus.createChannel('g1'),
      myPeerId: 'g1',
      fallbackBaseInputIntervalMs: 60,
      now: () => nowMs,
      createPeerConnection: net.createFactory('g1'),
    });
    const g2 = new HostStarTransport({
      channel: bus.createChannel('g2'),
      myPeerId: 'g2',
      fallbackBaseInputIntervalMs: 60,
      now: () => nowMs,
      createPeerConnection: net.createFactory('g2'),
    });

    const g1Snaps: Array<{ tick: number; via: string }> = [];
    const g2Snaps: Array<{ tick: number; via: string }> = [];
    const hostInputs: Array<{ seq: number; via: string }> = [];

    g1.onMessage('brawl_snapshot', (p, meta) => {
      g1Snaps.push({ tick: (p as { tick: number }).tick, via: meta.via });
    });
    g2.onMessage('brawl_snapshot', (p, meta) => {
      g2Snaps.push({ tick: (p as { tick: number }).tick, via: meta.via });
    });
    host.onMessage('brawl_input', (p, meta) => {
      hostInputs.push({ seq: (p as { seq: number }).seq, via: meta.via });
    });

    // 5-player room peers so adaptive fallback cadence widens to >= 165ms
    const peers = ['host', 'g1', 'g2', 'g3', 'g4'];
    host.syncPeers({ isHost: true, hostPeerId: 'host', peerIds: ['host', 'g1', 'g2'] });
    g1.syncPeers({ isHost: false, hostPeerId: 'host', peerIds: peers });
    g2.syncPeers({ isHost: false, hostPeerId: 'host', peerIds: peers });

    await flushMicrotasks();

    assert.equal(host.getStats().mode, 'hybrid');
    assert.equal(host.getStats().p2pPeers, 1);
    assert.equal(g1.getStats().mode, 'p2p');
    assert.equal(g2.getStats().mode, 'relay');

    bus.clearLog();

    // First snapshot at t=2000: g1 gets P2P ONLY (no duplicate from Supabase fallback), g2 gets fallback
    const r1 = host.sendFromHost('brawl_snapshot', { tick: 1 });
    assert.deepEqual(r1, { p2pSent: 1, usedFallback: true });
    assert.deepEqual(g1Snaps, [{ tick: 1, via: 'p2p' }]);
    assert.deepEqual(g2Snaps, [{ tick: 1, via: 'fallback' }]);

    // Second snapshot 50ms later: g1 still gets P2P immediately, fallback throttled for g2
    nowMs = 2050;
    const r2 = host.sendFromHost('brawl_snapshot', { tick: 2 });
    assert.deepEqual(r2, { p2pSent: 1, usedFallback: false });
    assert.equal(g1Snaps.length, 2);
    assert.equal(g2Snaps.length, 1);

    // Blocked g2 input uses adaptive fallback pacing (>= 160ms for 5 peers)
    assert.equal(g2.sendToHost('brawl_input', { seq: 1 }), 'fallback');
    nowMs = 2120;
    assert.equal(g2.sendToHost('brawl_input', { seq: 2 }), 'throttled');
    nowMs = 2220;
    assert.equal(g2.sendToHost('brawl_input', { seq: 3 }), 'fallback');
    assert.equal(hostInputs.length, 2);

    host.dispose();
    g1.dispose();
    g2.dispose();
  });

  it('skips congested P2P frames on high bufferedAmount and falls back cleanly when ICE fails or peer leaves', async () => {
    const bus = new FakeSupabaseBus();
    const net = new FakeWebRtcNetwork();
    let nowMs = 3000;

    const host = new HostStarTransport({
      channel: bus.createChannel('host'),
      myPeerId: 'host',
      maxBufferedBytes: 1024,
      maxReconnectAttempts: 0, // deterministic without timers
      now: () => nowMs,
      createPeerConnection: net.createFactory('host'),
    });
    const g1 = new HostStarTransport({
      channel: bus.createChannel('g1'),
      myPeerId: 'g1',
      maxBufferedBytes: 1024,
      now: () => nowMs,
      createPeerConnection: net.createFactory('g1'),
    });

    const g1Snaps: Array<{ tick: number; via: string }> = [];
    g1.onMessage('snap', (p, meta) => {
      g1Snaps.push({ tick: (p as { tick: number }).tick, via: meta.via });
    });

    host.syncPeers({ isHost: true, hostPeerId: 'host', peerIds: ['host', 'g1'] });
    g1.syncPeers({ isHost: false, hostPeerId: 'host', peerIds: ['host', 'g1'] });
    await flushMicrotasks();

    // Simulate congested DataChannel buffer -> frame dropped instead of queueing stale frames
    const hostPc = net.getOpenConnections('host')[0];
    assert.ok(hostPc?.localChannel);
    hostPc.localChannel.bufferedAmount = 4096;
    const congested = host.sendFromHost('snap', { tick: 1 });
    assert.deepEqual(congested, { p2pSent: 0, usedFallback: false });
    assert.equal(g1Snaps.length, 0);

    // Recover buffer -> normal P2P resumes
    hostPc.localChannel.bufferedAmount = 0;
    assert.deepEqual(host.sendFromHost('snap', { tick: 2 }), {
      p2pSent: 1,
      usedFallback: false,
    });
    assert.equal(g1Snaps.length, 1);

    // Simulate ICE failure -> immediately falls back to Supabase without freezing guest
    hostPc.simulateFailure();
    const g1Pc = net.getOpenConnections('g1')[0];
    g1Pc?.simulateFailure();

    assert.equal(host.getStats().mode, 'relay');
    nowMs = 3200;
    const afterFail = host.sendFromHost('snap', { tick: 3 });
    assert.deepEqual(afterFail, { p2pSent: 0, usedFallback: true });
    assert.deepEqual(g1Snaps[1], { tick: 3, via: 'fallback' });

    // Stale signaling from wrong session is ignored cleanly
    bus.dispatch('other-peer', WEBRTC_SIGNAL_EVENT, {
      v: 1,
      sessionId: 'stale-session',
      fromPeerId: 'other-peer',
      toPeerId: 'g1',
      kind: 'offer',
      sdp: 'bad-sdp',
    });
    await flushMicrotasks();

    // Disposing closes all connections cleanly
    host.dispose();
    g1.dispose();
    assert.equal(net.getOpenConnections('host').length, 0);
    assert.equal(net.getOpenConnections('g1').length, 0);
  });
});
