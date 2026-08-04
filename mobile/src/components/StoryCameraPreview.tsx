import React, { forwardRef } from "react";
import { View } from "react-native";
import type { StoryCameraPreviewHandle, StoryCameraZoomLevel } from "./storyCameraTypes";

type Props = {
  facing?: "front" | "back";
  active?: boolean;
  flashOn?: boolean;
  zoomLevel?: StoryCameraZoomLevel;
  zoom?: number;
  mode?: "picture" | "video";
  onPress?: () => void;
  onRecordingChange?: (recording: boolean) => void;
  onAutoRecordFinished?: (payload: { uri: string }) => void;
  onZoomChange?: (zoom: number) => void;
  enableInternalPinch?: boolean;
  filterOverlayColor?: string | null;
};

/** Fallback when platform-specific preview is unavailable. */
export const StoryCameraPreview = forwardRef<StoryCameraPreviewHandle, Props>(function StoryCameraPreview(_props, _ref) {
  return <View style={{ flex: 1, backgroundColor: "#000" }} />;
});
