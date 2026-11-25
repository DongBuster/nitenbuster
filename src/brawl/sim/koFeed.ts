export const KO_FEED_TTL_SEC = 3.5;
export const MAX_KO_FEED_ITEMS = 4;

export interface TimedKoFeedItem {
  id: string;
  text: string;
  expiresAt: number;
}

export function pushKoFeedEntry(
  feed: readonly TimedKoFeedItem[],
  entry: { id: string; text: string; nowSec: number; ttlSec?: number },
  maxItems = MAX_KO_FEED_ITEMS,
): TimedKoFeedItem[] {
  const ttl = entry.ttlSec ?? KO_FEED_TTL_SEC;
  const next: TimedKoFeedItem = {
    id: entry.id,
    text: entry.text,
    expiresAt: entry.nowSec + ttl,
  };
  return [next, ...feed].slice(0, maxItems);
}

export function pruneExpiredKoFeed(
  feed: readonly TimedKoFeedItem[],
  nowSec: number,
): TimedKoFeedItem[] {
  return feed.filter((item) => nowSec < item.expiresAt);
}
