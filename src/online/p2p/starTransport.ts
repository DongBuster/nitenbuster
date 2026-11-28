import {
  computeFallbackIntervalMs,
  computeGuestFallbackInputIntervalMs,
} from './adaptiveRate.ts';
import { getWebRtcConfig } from './iceConfig.ts';
import {
  WEBRTC_DATACHANNEL_LABEL,
  WEBRTC_SIGNAL_EVENT,
  decodeP2PFrame,
  encodeP2PFrame,
  isValidWebRtcSignal,
  type WebRtcSignalPayload,
} from './signaling.ts';

export interface RealtimeBroadcastChannel {
  on(
    type: 'broadcast',
    filter: { event: string },
    callback: (message: { payload: unknown }) => void,
  ): unknown;
  send(args: {
    type: 'broadcast';
    event: string;
    payload: unknown;
  }): Promise<unknown> | unknown;
}

export interface DataChannelLike {
  readonly label: string;
  readonly readyState: RTCDataChannelState;
  readonly bufferedAmount: number;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface PeerConnectionLike {
  readonly iceConnectionState: RTCIceConnectionState;
  readonly connectionState?: RTCPeerConnectionState;
  onicecandidate: ((ev: { candidate: RTCIceCandidateInit | null }) => void) | null;
  oniceconnectionstatechange: (() => void) | null;
  onconnectionstatechange?: (() => void) | null;
  ondatachannel: ((ev: { channel: DataChannelLike }) => void) | null;
  createDataChannel(label: string, init?: RTCDataChannelInit): DataChannelLike;
  createOffer(): Promise<RTCSessionDescriptionInit>;
  createAnswer(): Promise<RTCSessionDescriptionInit>;
  setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void>;
  setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void>;
  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
  close(): void;
}

export type TransportMode = 'p2p' | 'hybrid' | 'relay';

export interface StarTransportStats {
  mode: TransportMode;
  p2pPeers: number;
  totalPeers: number;
}

export type TransportMessageMeta = {
  fromPeerId: string;
  via: 'p2p' | 'fallback';
};

export type TransportMessageHandler = (
  payload: unknown,
  meta: TransportMessageMeta,
) => void;

export interface HostStarTransportOptions {
  channel: RealtimeBroadcastChannel;
  myPeerId: string;
  fallbackBaseSnapshotIntervalMs?: number;
  fallbackBaseInputIntervalMs?: number;
  maxBufferedBytes?: number;
  maxReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
  now?: () => number;
  iceConfig?: RTCConfiguration;
  createPeerConnection?: (config: RTCConfiguration) => PeerConnectionLike | null;
}

interface PeerEntry {
  peerId: string;
  sessionId: string;
  pc: PeerConnectionLike | null;
  dc: DataChannelLike | null;
  remoteDescSet: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  lastHelloSessionId: string;
}

const DEFAULT_MAX_BUFFERED_BYTES = 65536;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 2;
const DEFAULT_RECONNECT_BASE_DELAY_MS = 2000;
const MAX_PENDING_CANDIDATES = 40;

let sessionCounter = 0;
function nextSessionId(): string {
  sessionCounter += 1;
  return `s${sessionCounter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultCreatePeerConnection(
  config: RTCConfiguration,
): PeerConnectionLike | null {
  if (typeof RTCPeerConnection !== 'function') {
    return null;
  }
  try {
    return new RTCPeerConnection(config) as unknown as PeerConnectionLike;
  } catch {
    return null;
  }
}

/**
 * Star-topology WebRTC DataChannel transport (Host <-> each Guest) with
 * automatic per-peer fallback to Supabase Realtime Broadcast.
 *
 * - Steady-state P2P: high-frequency snapshots/inputs consume 0 Supabase messages.
 * - Hybrid/NAT fallback: only peers without an open DataChannel receive paced
 *   Supabase Broadcast frames; P2P-connected Guests drop duplicate fallback frames.
 */
export class HostStarTransport {
  private readonly channel: RealtimeBroadcastChannel;
  private readonly myPeerId: string;
  private readonly fallbackBaseSnapshotIntervalMs: number;
  private readonly fallbackBaseInputIntervalMs: number;
  private readonly maxBufferedBytes: number;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectBaseDelayMs: number;
  private readonly now: () => number;
  private readonly iceConfig: RTCConfiguration;
  private readonly createPeerConnection: (
    config: RTCConfiguration,
  ) => PeerConnectionLike | null;

  private isHost = false;
  private hostPeerId = '';
  private knownPeerIds = new Set<string>();
  private peers = new Map<string, PeerEntry>();
  private handlers = new Map<string, Set<TransportMessageHandler>>();
  private boundFallbackEvents = new Set<string>();
  private lastFallbackSnapshotMs = -Infinity;
  private lastFallbackInputMs = -Infinity;
  private guestHelloSessionId = '';
  private disposed = false;

  constructor(options: HostStarTransportOptions) {
    this.channel = options.channel;
    this.myPeerId = options.myPeerId;
    this.fallbackBaseSnapshotIntervalMs =
      options.fallbackBaseSnapshotIntervalMs ?? 67;
    this.fallbackBaseInputIntervalMs =
      options.fallbackBaseInputIntervalMs ?? 67;
    this.maxBufferedBytes = options.maxBufferedBytes ?? DEFAULT_MAX_BUFFERED_BYTES;
    this.maxReconnectAttempts =
      options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
    this.reconnectBaseDelayMs =
      options.reconnectBaseDelayMs ?? DEFAULT_RECONNECT_BASE_DELAY_MS;
    this.now = options.now ?? (() => performance.now());
    this.iceConfig = options.iceConfig ?? getWebRtcConfig();
    this.createPeerConnection =
      options.createPeerConnection ?? defaultCreatePeerConnection;

    this.channel.on('broadcast', { event: WEBRTC_SIGNAL_EVENT }, ({ payload }) => {
      if (this.disposed) return;
      if (!isValidWebRtcSignal(payload)) return;
      if (payload.toPeerId !== this.myPeerId) return;
      if (payload.fromPeerId === this.myPeerId) return;
      void this.handleSignal(payload);
    });
  }

  syncPeers(params: {
    isHost: boolean;
    hostPeerId: string;
    peerIds: readonly string[];
  }): void {
    if (this.disposed) return;

    const roleOrHostChanged =
      this.isHost !== params.isHost || this.hostPeerId !== params.hostPeerId;

    this.knownPeerIds = new Set(params.peerIds.filter((id) => id.length > 0));
    this.knownPeerIds.add(this.myPeerId);

    if (roleOrHostChanged) {
      this.closeAllPeers();
      this.isHost = params.isHost;
      this.hostPeerId = params.hostPeerId;
      this.guestHelloSessionId = '';
      this.lastFallbackSnapshotMs = -Infinity;
      this.lastFallbackInputMs = -Infinity;
    }

    if (this.isHost) {
      const desiredGuests = new Set<string>();
      for (const peerId of this.knownPeerIds) {
        if (peerId !== this.myPeerId) {
          desiredGuests.add(peerId);
        }
      }

      for (const existingPeerId of Array.from(this.peers.keys())) {
        if (!desiredGuests.has(existingPeerId)) {
          this.removePeer(existingPeerId);
        }
      }

      for (const guestId of desiredGuests) {
        if (!this.peers.has(guestId)) {
          this.initiateOfferToGuest(guestId);
        }
      }
      return;
    }

    // Guest role: maintain a single star link to hostPeerId
    if (!this.hostPeerId || this.hostPeerId === this.myPeerId) {
      this.closeAllPeers();
      return;
    }

    for (const existingPeerId of Array.from(this.peers.keys())) {
      if (existingPeerId !== this.hostPeerId) {
        this.removePeer(existingPeerId);
      }
    }

    const hostEntry = this.peers.get(this.hostPeerId);
    if (!hostEntry && !this.guestHelloSessionId) {
      this.guestHelloSessionId = nextSessionId();
      this.emitSignal({
        v: 1,
        sessionId: this.guestHelloSessionId,
        fromPeerId: this.myPeerId,
        toPeerId: this.hostPeerId,
        kind: 'hello',
      });
    }
  }

  onMessage(event: string, handler: TransportMessageHandler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);

    if (!this.boundFallbackEvents.has(event)) {
      this.boundFallbackEvents.add(event);
      this.channel.on('broadcast', { event }, ({ payload }) => {
        if (this.disposed) return;
        // Guest with an active P2P link ignores duplicate Supabase fallback frames
        if (!this.isHost && this.hasOpenHostChannel()) {
          return;
        }
        this.dispatchMessage(event, payload, '', 'fallback');
      });
    }

    return () => {
      set?.delete(handler);
    };
  }

  sendFromHost(
    event: string,
    payload: unknown,
    opts?: { forceFallback?: boolean },
  ): { p2pSent: number; usedFallback: boolean } {
    if (this.disposed || !this.isHost) {
      return { p2pSent: 0, usedFallback: false };
    }

    const encoded = encodeP2PFrame(event, payload);
    let p2pSent = 0;
    let fallbackPeers = 0;

    const remoteGuests = new Set<string>();
    for (const id of this.knownPeerIds) {
      if (id !== this.myPeerId) remoteGuests.add(id);
    }
    for (const id of this.peers.keys()) {
      remoteGuests.add(id);
    }

    for (const guestId of remoteGuests) {
      const entry = this.peers.get(guestId);
      const dc = entry?.dc;
      if (dc && dc.readyState === 'open') {
        if (dc.bufferedAmount <= this.maxBufferedBytes) {
          try {
            dc.send(encoded);
            p2pSent += 1;
          } catch {
            // DataChannel closed mid-send; peer counts toward fallback on next tick
            fallbackPeers += 1;
          }
        }
        // When bufferedAmount exceeds limit, drop this stale frame for that peer
      } else {
        fallbackPeers += 1;
      }
    }

    let usedFallback = false;
    const totalRoomPeers = Math.max(remoteGuests.size + 1, this.knownPeerIds.size);
    if (opts?.forceFallback || fallbackPeers > 0) {
      const nowMs = this.now();
      const intervalMs = computeFallbackIntervalMs(
        this.fallbackBaseSnapshotIntervalMs,
        Math.max(1, fallbackPeers),
        totalRoomPeers,
      );
      const elapsed = Number.isFinite(this.lastFallbackSnapshotMs)
        ? Math.max(0, nowMs - this.lastFallbackSnapshotMs)
        : Infinity;

      if (opts?.forceFallback || elapsed >= intervalMs) {
        this.lastFallbackSnapshotMs = nowMs;
        usedFallback = true;
        void this.channel.send({
          type: 'broadcast',
          event,
          payload,
        });
      }
    }

    return { p2pSent, usedFallback };
  }

  sendToHost(
    event: string,
    payload: unknown,
    opts?: { forceFallback?: boolean },
  ): 'p2p' | 'fallback' | 'throttled' | 'dropped' {
    if (this.disposed || this.isHost) {
      return 'dropped';
    }

    const hostEntry = this.hostPeerId ? this.peers.get(this.hostPeerId) : undefined;
    const dc = hostEntry?.dc;
    if (!opts?.forceFallback && dc && dc.readyState === 'open') {
      if (dc.bufferedAmount > this.maxBufferedBytes) {
        return 'dropped';
      }
      try {
        dc.send(encodeP2PFrame(event, payload));
        return 'p2p';
      } catch {
        // Fall through to Supabase fallback if DataChannel errored
      }
    }

    const nowMs = this.now();
    const totalRoomPeers = Math.max(2, this.knownPeerIds.size);
    const intervalMs = computeGuestFallbackInputIntervalMs(
      this.fallbackBaseInputIntervalMs,
      totalRoomPeers,
    );
    const elapsed = Number.isFinite(this.lastFallbackInputMs)
      ? Math.max(0, nowMs - this.lastFallbackInputMs)
      : Infinity;

    if (!opts?.forceFallback && elapsed < intervalMs) {
      return 'throttled';
    }

    this.lastFallbackInputMs = nowMs;
    void this.channel.send({
      type: 'broadcast',
      event,
      payload,
    });
    return 'fallback';
  }

  getStats(): StarTransportStats {
    if (this.isHost) {
      const remoteIds = new Set<string>();
      for (const id of this.knownPeerIds) {
        if (id !== this.myPeerId) remoteIds.add(id);
      }
      for (const id of this.peers.keys()) {
        remoteIds.add(id);
      }
      const totalPeers = remoteIds.size;
      let p2pPeers = 0;
      for (const id of remoteIds) {
        if (this.peers.get(id)?.dc?.readyState === 'open') {
          p2pPeers += 1;
        }
      }
      const mode: TransportMode =
        totalPeers === 0 || p2pPeers === 0
          ? 'relay'
          : p2pPeers === totalPeers
            ? 'p2p'
            : 'hybrid';
      return { mode, p2pPeers, totalPeers };
    }

    const open = this.hasOpenHostChannel();
    return {
      mode: open ? 'p2p' : 'relay',
      p2pPeers: open ? 1 : 0,
      totalPeers: this.hostPeerId && this.hostPeerId !== this.myPeerId ? 1 : 0,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.closeAllPeers();
    this.handlers.clear();
    this.knownPeerIds.clear();
  }

  private hasOpenHostChannel(): boolean {
    if (!this.hostPeerId) return false;
    return this.peers.get(this.hostPeerId)?.dc?.readyState === 'open';
  }

  private dispatchMessage(
    event: string,
    payload: unknown,
    fromPeerId: string,
    via: 'p2p' | 'fallback',
  ): void {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) return;
    for (const handler of set) {
      handler(payload, { fromPeerId, via });
    }
  }

  private emitSignal(signal: WebRtcSignalPayload): void {
    if (this.disposed) return;
    void this.channel.send({
      type: 'broadcast',
      event: WEBRTC_SIGNAL_EVENT,
      payload: signal,
    });
  }

  private initiateOfferToGuest(guestId: string, prevReconnectAttempts = 0): void {
    if (this.disposed || !this.isHost) return;

    const existing = this.peers.get(guestId);
    const lastHelloSessionId = existing?.lastHelloSessionId ?? '';
    this.closePeerResources(existing);

    const sessionId = nextSessionId();
    const pc = this.createPeerConnection(this.iceConfig);
    const entry: PeerEntry = {
      peerId: guestId,
      sessionId,
      pc,
      dc: null,
      remoteDescSet: false,
      pendingCandidates: [],
      reconnectAttempts: prevReconnectAttempts,
      reconnectTimer: null,
      lastHelloSessionId,
    };
    this.peers.set(guestId, entry);

    if (!pc) return;

    const dc = pc.createDataChannel(WEBRTC_DATACHANNEL_LABEL, {
      ordered: false,
      maxRetransmits: 0,
    });
    entry.dc = dc;
    this.bindDataChannel(entry, dc);
    this.bindPeerConnection(entry, pc);

    void (async () => {
      try {
        const offer = await pc.createOffer();
        if (this.disposed || this.peers.get(guestId) !== entry) return;
        await pc.setLocalDescription(offer);
        if (this.disposed || this.peers.get(guestId) !== entry) return;
        if (offer.sdp) {
          this.emitSignal({
            v: 1,
            sessionId: entry.sessionId,
            fromPeerId: this.myPeerId,
            toPeerId: guestId,
            kind: 'offer',
            sdp: offer.sdp,
          });
        }
      } catch {
        this.handlePeerFailure(entry);
      }
    })();
  }

  private async handleSignal(signal: WebRtcSignalPayload): Promise<void> {
    if (signal.kind === 'hello') {
      if (!this.isHost) return;
      const guestId = signal.fromPeerId;
      this.knownPeerIds.add(guestId);
      const existing = this.peers.get(guestId);
      if (existing?.dc?.readyState === 'open') return;
      if (existing && existing.lastHelloSessionId === signal.sessionId) return;
      this.initiateOfferToGuest(guestId, existing?.reconnectAttempts ?? 0);
      const created = this.peers.get(guestId);
      if (created) {
        created.lastHelloSessionId = signal.sessionId;
      }
      return;
    }

    if (signal.kind === 'offer') {
      if (this.isHost) return;
      if (this.hostPeerId && signal.fromPeerId !== this.hostPeerId) return;
      const hostId = signal.fromPeerId;
      this.hostPeerId = hostId;
      this.knownPeerIds.add(hostId);

      const existing = this.peers.get(hostId);
      if (existing && existing.sessionId === signal.sessionId) {
        return;
      }
      this.closePeerResources(existing);

      const pc = this.createPeerConnection(this.iceConfig);
      const entry: PeerEntry = {
        peerId: hostId,
        sessionId: signal.sessionId,
        pc,
        dc: null,
        remoteDescSet: false,
        pendingCandidates: [],
        reconnectAttempts: 0,
        reconnectTimer: null,
        lastHelloSessionId: '',
      };
      this.peers.set(hostId, entry);

      if (!pc || !signal.sdp) return;

      this.bindPeerConnection(entry, pc);
      pc.ondatachannel = ({ channel }) => {
        if (this.disposed || this.peers.get(hostId) !== entry) {
          channel.close();
          return;
        }
        entry.dc = channel;
        this.bindDataChannel(entry, channel);
      };

      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        if (this.disposed || this.peers.get(hostId) !== entry) return;
        entry.remoteDescSet = true;
        await this.drainPendingCandidates(entry);

        const answer = await pc.createAnswer();
        if (this.disposed || this.peers.get(hostId) !== entry) return;
        await pc.setLocalDescription(answer);
        if (this.disposed || this.peers.get(hostId) !== entry) return;
        if (answer.sdp) {
          this.emitSignal({
            v: 1,
            sessionId: entry.sessionId,
            fromPeerId: this.myPeerId,
            toPeerId: hostId,
            kind: 'answer',
            sdp: answer.sdp,
          });
        }
      } catch {
        this.handlePeerFailure(entry);
      }
      return;
    }

    if (signal.kind === 'answer') {
      if (!this.isHost || !signal.sdp) return;
      const entry = this.peers.get(signal.fromPeerId);
      if (!entry || !entry.pc || entry.sessionId !== signal.sessionId) return;
      try {
        await entry.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        if (this.disposed || this.peers.get(signal.fromPeerId) !== entry) return;
        entry.remoteDescSet = true;
        await this.drainPendingCandidates(entry);
      } catch {
        this.handlePeerFailure(entry);
      }
      return;
    }

    if (signal.kind === 'ice' && signal.candidate) {
      const entry = this.peers.get(signal.fromPeerId);
      if (!entry || !entry.pc || entry.sessionId !== signal.sessionId) return;
      if (!entry.remoteDescSet) {
        if (entry.pendingCandidates.length < MAX_PENDING_CANDIDATES) {
          entry.pendingCandidates.push(signal.candidate);
        }
        return;
      }
      try {
        await entry.pc.addIceCandidate(signal.candidate);
      } catch {
        // Ignore stale or unsupported ICE candidates safely
      }
    }
  }

  private async drainPendingCandidates(entry: PeerEntry): Promise<void> {
    if (!entry.pc || !entry.remoteDescSet) return;
    const queued = entry.pendingCandidates.splice(0, entry.pendingCandidates.length);
    for (const candidate of queued) {
      if (this.disposed || this.peers.get(entry.peerId) !== entry || !entry.pc) {
        return;
      }
      try {
        await entry.pc.addIceCandidate(candidate);
      } catch {
        // Ignore individual candidate failures
      }
    }
  }

  private bindPeerConnection(entry: PeerEntry, pc: PeerConnectionLike): void {
    pc.onicecandidate = ({ candidate }) => {
      if (this.disposed || this.peers.get(entry.peerId) !== entry || !candidate) {
        return;
      }
      const init: RTCIceCandidateInit =
        typeof (candidate as RTCIceCandidate).toJSON === 'function'
          ? (candidate as RTCIceCandidate).toJSON()
          : candidate;
      this.emitSignal({
        v: 1,
        sessionId: entry.sessionId,
        fromPeerId: this.myPeerId,
        toPeerId: entry.peerId,
        kind: 'ice',
        candidate: init,
      });
    };

    const onStateChange = () => {
      if (this.disposed || this.peers.get(entry.peerId) !== entry) return;
      const iceState = pc.iceConnectionState;
      const connState = pc.connectionState;
      if (iceState === 'failed' || connState === 'failed') {
        this.handlePeerFailure(entry);
      } else if (iceState === 'connected' || iceState === 'completed') {
        entry.reconnectAttempts = 0;
      }
    };

    pc.oniceconnectionstatechange = onStateChange;
    if ('onconnectionstatechange' in pc) {
      pc.onconnectionstatechange = onStateChange;
    }
  }

  private bindDataChannel(entry: PeerEntry, dc: DataChannelLike): void {
    dc.onopen = () => {
      if (this.disposed || this.peers.get(entry.peerId) !== entry) return;
      entry.reconnectAttempts = 0;
    };

    dc.onmessage = ({ data }) => {
      if (this.disposed || this.peers.get(entry.peerId) !== entry) return;
      const frame = decodeP2PFrame(data);
      if (!frame) return;
      this.dispatchMessage(frame.event, frame.payload, entry.peerId, 'p2p');
    };

    dc.onclose = () => {
      if (this.disposed || this.peers.get(entry.peerId) !== entry) return;
      if (entry.dc === dc) {
        entry.dc = null;
      }
    };
  }

  private handlePeerFailure(entry: PeerEntry): void {
    if (this.disposed || this.peers.get(entry.peerId) !== entry) return;
    this.closePeerResources(entry);

    if (!this.isHost) {
      return;
    }

    if (entry.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    const nextAttempt = entry.reconnectAttempts + 1;
    entry.reconnectAttempts = nextAttempt;
    const delayMs = this.reconnectBaseDelayMs * Math.pow(3, nextAttempt - 1);
    entry.reconnectTimer = setTimeout(() => {
      entry.reconnectTimer = null;
      if (this.disposed || !this.isHost || !this.knownPeerIds.has(entry.peerId)) {
        return;
      }
      if (this.peers.get(entry.peerId) !== entry) return;
      this.initiateOfferToGuest(entry.peerId, nextAttempt);
    }, delayMs);
  }

  private closePeerResources(entry: PeerEntry | undefined): void {
    if (!entry) return;
    if (entry.reconnectTimer !== null) {
      clearTimeout(entry.reconnectTimer);
      entry.reconnectTimer = null;
    }
    if (entry.dc) {
      entry.dc.onopen = null;
      entry.dc.onclose = null;
      entry.dc.onerror = null;
      entry.dc.onmessage = null;
      try {
        entry.dc.close();
      } catch {
        // ignore close errors
      }
      entry.dc = null;
    }
    if (entry.pc) {
      entry.pc.onicecandidate = null;
      entry.pc.oniceconnectionstatechange = null;
      if ('onconnectionstatechange' in entry.pc) {
        entry.pc.onconnectionstatechange = null;
      }
      entry.pc.ondatachannel = null;
      try {
        entry.pc.close();
      } catch {
        // ignore close errors
      }
      entry.pc = null;
    }
    entry.remoteDescSet = false;
    entry.pendingCandidates = [];
  }

  private removePeer(peerId: string): void {
    const entry = this.peers.get(peerId);
    this.closePeerResources(entry);
    this.peers.delete(peerId);
  }

  private closeAllPeers(): void {
    for (const peerId of Array.from(this.peers.keys())) {
      this.removePeer(peerId);
    }
  }
}
