export type AppPlaybackStatusLoaded = {
  isLoaded: true;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  didJustFinish: boolean;
  naturalSize?: { width: number; height: number };
};

export type AppPlaybackStatusUnloaded = {
  isLoaded: false;
  error?: string;
};

export type AppPlaybackStatus = AppPlaybackStatusLoaded | AppPlaybackStatusUnloaded;
