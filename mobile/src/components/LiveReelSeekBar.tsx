import React, { useEffect, useState } from "react";
import { getReelProgress, setReelProgress, subscribeReelProgress } from "../utils/reelProgressStore";
import { ReelSeekBar } from "./ReelSeekBar";

type LiveReelSeekBarProps = {
  postId: number;
  onSeekVideo?: (ratio: number) => void;
};

/** Own-state seek bar so playback ticks do not re-render the reel page. */
export function LiveReelSeekBar({ postId, onSeekVideo }: LiveReelSeekBarProps) {
  const [progress, setProgress] = useState(() => getReelProgress(postId));

  useEffect(() => {
    setProgress(getReelProgress(postId));
    return subscribeReelProgress((id) => {
      if (id === postId) setProgress(getReelProgress(postId));
    });
  }, [postId]);

  const ratio = progress?.duration ? progress.position / progress.duration : 0;

  return (
    <ReelSeekBar
      progressRatio={ratio}
      onSeek={(nextRatio) => {
        const duration = getReelProgress(postId)?.duration;
        if (duration) setReelProgress(postId, nextRatio * duration, duration);
        onSeekVideo?.(nextRatio);
      }}
    />
  );
}
