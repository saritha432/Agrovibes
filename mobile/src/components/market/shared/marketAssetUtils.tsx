import { Ionicons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import React, { useEffect, useState } from "react";
import { Image, ImageSourcePropType, Platform, View } from "react-native";
import { APP_LIME, APP_TEXT_MUTED } from "../../../theme/appColors";

export type SvgModule = number | string | { uri?: string; default?: string };

export function moduleToUri(module: SvgModule): string | null {
  if (typeof module === "string" && module.length > 0) return module;
  if (typeof module === "object" && module !== null) {
    if (typeof module.uri === "string" && module.uri.length > 0) return module.uri;
    if (typeof module.default === "string" && module.default.length > 0) return module.default;
  }
  if (typeof module === "number") {
    const resolver = (Image as unknown as { resolveAssetSource?: (asset: number) => { uri?: string } | undefined })
      .resolveAssetSource;
    if (typeof resolver !== "function") return null;
    return resolver(module)?.uri ?? null;
  }
  return null;
}

export function useAssetUri(module: SvgModule | ImageSourcePropType) {
  const [uri, setUri] = useState<string | null>(() => moduleToUri(module as SvgModule));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const direct = moduleToUri(module as SvgModule);
    setUri(direct);
    setFailed(false);
    if (direct) return;

    let cancelled = false;
    void (async () => {
      try {
        const asset = Asset.fromModule(module as number | string);
        await asset.downloadAsync();
        const nextUri = asset.localUri ?? asset.uri;
        if (!cancelled && nextUri) setUri(nextUri);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [module]);

  return { uri, failed, setFailed };
}

export function MarketSvgIcon({
  module,
  size,
  active,
  fallbackIcon = "ellipse-outline"
}: {
  module: SvgModule;
  size: number;
  active: boolean;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
}) {
  const [uri, setUri] = useState<string | null>(() => moduleToUri(module));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const direct = moduleToUri(module);
    setUri(direct);
    setFailed(false);
    if (direct) return;

    let cancelled = false;
    void (async () => {
      try {
        const asset = Asset.fromModule(module as number | string);
        await asset.downloadAsync();
        const nextUri = asset.localUri ?? asset.uri;
        if (!cancelled && nextUri) setUri(nextUri);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [module]);

  if (failed || !uri) {
    return <Ionicons name={fallbackIcon} size={size} color={active ? APP_LIME : APP_TEXT_MUTED} />;
  }

  if (Platform.OS === "web") {
    return React.createElement("img", {
      src: uri,
      alt: "",
      style: { width: size, height: size, display: "block", objectFit: "contain" },
      onError: () => setFailed(true)
    });
  }

  try {
    const { SvgUri } = require("react-native-svg") as typeof import("react-native-svg");
    return <SvgUri uri={uri} width={size} height={size} onError={() => setFailed(true)} />;
  } catch {
    return <Ionicons name={fallbackIcon} size={size} color={active ? APP_LIME : APP_TEXT_MUTED} />;
  }
}

export function MarketCardArt({
  image,
  kind,
  width,
  height,
  fit = "contain"
}: {
  image: SvgModule | ImageSourcePropType;
  kind: "svg" | "png";
  width: number;
  height: number;
  fit?: "contain" | "cover";
}) {
  const { uri, failed, setFailed } = useAssetUri(image);
  const resizeMode = fit === "cover" ? "cover" : "contain";
  const objectFit = fit === "cover" ? "cover" : "contain";
  const preserveAspectRatio = fit === "cover" ? "xMidYMid slice" : "xMidYMax meet";

  if (kind === "png") {
    return (
      <Image
        source={image as ImageSourcePropType}
        style={{ width, height }}
        resizeMode={resizeMode}
      />
    );
  }

  if (failed || !uri) {
    return <View style={{ width, height }} />;
  }

  if (Platform.OS === "web") {
    return React.createElement("img", {
      src: uri,
      alt: "",
      style: {
        width,
        height,
        display: "block",
        objectFit,
        objectPosition: fit === "cover" ? "center" : "center bottom"
      },
      onError: () => setFailed(true)
    });
  }

  try {
    const { SvgUri } = require("react-native-svg") as typeof import("react-native-svg");
    return <SvgUri uri={uri} width={width} height={height} preserveAspectRatio={preserveAspectRatio} />;
  } catch {
    return <View style={{ width, height }} />;
  }
}
