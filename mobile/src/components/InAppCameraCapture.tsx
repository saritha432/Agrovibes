import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";

export type InAppCameraCaptureMode = "photo" | "video" | "any";
export type CameraFacing = "front" | "back";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCapture: (asset: ImagePickerAsset) => void;
  onUnavailable?: () => void;
  initialFacing?: CameraFacing;
  mode?: InAppCameraCaptureMode;
};

/** In-app expo-camera is native-only; web uses WebCameraCapture instead. */
export function isInAppCameraSupported() {
  return Platform.OS !== "web";
}

export function InAppCameraCapture(_props: Props) {
  return null;
}
