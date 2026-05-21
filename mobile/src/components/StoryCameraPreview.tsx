import React, { forwardRef } from "react";
import { View } from "react-native";
import type { StoryCameraPreviewHandle } from "./storyCameraTypes";

type Props = {
  facing?: "front" | "back";
  active?: boolean;
  mode?: "picture" | "video";
  onPress?: () => void;
  onRecordingChange?: (recording: boolean) => void;
  onAutoRecordFinished?: (payload: { uri: string }) => void;
};

/** Fallback when platform-specific preview is unavailable. */
export const StoryCameraPreview = forwardRef<StoryCameraPreviewHandle, Props>(function StoryCameraPreview(_props, _ref) {
  return <View style={{ flex: 1, backgroundColor: "#000" }} />;
});
