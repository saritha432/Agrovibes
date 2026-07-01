type FeedPlaybackListener = (suspended: boolean) => void;

let feedPlaybackSuspended = false;
const listeners = new Set<FeedPlaybackListener>();

/** Pause home-feed reel/video audio while create or other overlays are open. */
export function setFeedPlaybackSuspended(suspended: boolean) {
  if (feedPlaybackSuspended === suspended) return;
  feedPlaybackSuspended = suspended;
  listeners.forEach((listener) => listener(suspended));
}

export function isFeedPlaybackSuspended() {
  return feedPlaybackSuspended;
}

export function subscribeFeedPlaybackSuspended(listener: FeedPlaybackListener) {
  listeners.add(listener);
  listener(feedPlaybackSuspended);
  return () => {
    listeners.delete(listener);
  };
}
