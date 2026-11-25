import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  KO_FEED_TTL_SEC,
  pruneExpiredKoFeed,
  pushKoFeedEntry,
  type TimedKoFeedItem,
} from '../koFeed.ts';

describe('brawl KO feed expiry & capacity', () => {
  it('prepends newest elimination entries and caps at maxItems', () => {
    let feed: TimedKoFeedItem[] = [];
    feed = pushKoFeedEntry(feed, { id: 'k1', text: 'A rơi khỏi sàn!', nowSec: 1.0 }, 3);
    feed = pushKoFeedEntry(feed, { id: 'k2', text: 'B rơi khỏi sàn!', nowSec: 1.5 }, 3);
    feed = pushKoFeedEntry(feed, { id: 'k3', text: 'C rơi khỏi sàn!', nowSec: 2.0 }, 3);
    feed = pushKoFeedEntry(feed, { id: 'k4', text: 'D rơi khỏi sàn!', nowSec: 2.5 }, 3);

    assert.deepEqual(
      feed.map((e) => e.id),
      ['k4', 'k3', 'k2'],
    );
    assert.equal(feed[0].expiresAt, 2.5 + KO_FEED_TTL_SEC);
  });

  it('prunes expired KO entries once their lifetime elapses so notifications do not stick on screen', () => {
    let feed: TimedKoFeedItem[] = [];
    feed = pushKoFeedEntry(feed, { id: 'k1', text: 'A rơi khỏi sàn!', nowSec: 10.0 });
    feed = pushKoFeedEntry(feed, { id: 'k2', text: 'B rơi khỏi sàn!', nowSec: 12.0 });

    const beforeFirstExpiry = pruneExpiredKoFeed(feed, 10.0 + KO_FEED_TTL_SEC - 0.1);
    assert.deepEqual(
      beforeFirstExpiry.map((e) => e.id),
      ['k2', 'k1'],
    );

    const afterFirstExpiry = pruneExpiredKoFeed(feed, 10.0 + KO_FEED_TTL_SEC);
    assert.deepEqual(
      afterFirstExpiry.map((e) => e.id),
      ['k2'],
    );

    const afterAllExpired = pruneExpiredKoFeed(feed, 12.0 + KO_FEED_TTL_SEC + 0.01);
    assert.deepEqual(afterAllExpired, []);
  });
});
