/**
 * Adaptive Supabase Broadcast pacing when one or more peers fall back from
 * WebRTC P2P to Supabase Realtime (Free tier ceiling: 100 messages/sec across
 * the whole project, counting 1 send + N receivers per broadcast).
 */
export function computeFallbackIntervalMs(
  baseIntervalMs: number,
  fallbackGuestCount: number,
  totalRoomPeers: number,
): number {
  if (fallbackGuestCount <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  if (totalRoomPeers <= 2) {
    return baseIntervalMs;
  }
  if (totalRoomPeers <= 4) {
    return Math.max(baseIntervalMs, 110);
  }
  return Math.max(baseIntervalMs, 165);
}

/**
 * Adaptive guest input pacing when a Guest cannot establish a direct WebRTC
 * DataChannel to the Host and must relay inputs via Supabase Broadcast.
 */
export function computeGuestFallbackInputIntervalMs(
  baseIntervalMs: number,
  totalRoomPeers: number,
): number {
  if (totalRoomPeers <= 2) {
    return baseIntervalMs;
  }
  if (totalRoomPeers <= 4) {
    return Math.max(baseIntervalMs, 110);
  }
  return Math.max(baseIntervalMs, 160);
}
