import { Asset } from "expo-asset";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import {
  APP_BLACK,
  APP_LIME,
  APP_TEXT,
  APP_TEXT_MUTED,
  APP_TEXT_ON_LIME
} from "../../../../theme/appColors";
import { moduleToUri } from "../../shared/marketAssetUtils";

const FARM_ILLUSTRATION = require("../../../../../assets/market/farm-illustration.svg");

function FarmIllustration({ width }: { width: number }) {
  const artHeight = Math.round(width * (210 / 429));
  const [uri, setUri] = useState<string | null>(() => moduleToUri(FARM_ILLUSTRATION));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const direct = moduleToUri(FARM_ILLUSTRATION);
    setUri(direct);
    setFailed(false);
    if (direct) return;

    let cancelled = false;
    void (async () => {
      try {
        const asset = Asset.fromModule(FARM_ILLUSTRATION as number);
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
  }, []);

  if (failed || !uri) return null;

  if (Platform.OS === "web") {
    return React.createElement("img", {
      src: uri,
      alt: "",
      style: {
        width,
        height: artHeight,
        display: "block",
        objectFit: "cover",
        objectPosition: "center bottom",
        pointerEvents: "none"
      },
      onError: () => setFailed(true)
    });
  }

  try {
    const { SvgUri } = require("react-native-svg") as typeof import("react-native-svg");
    return (
      <View style={[styles.heroArtWrap, { width, height: artHeight }]} pointerEvents="none">
        <SvgUri uri={uri} width={width} height={artHeight} preserveAspectRatio="xMidYMax meet" />
      </View>
    );
  } catch {
    return null;
  }
}

export function MarketHeroSection({ onPress }: { onPress: () => void }) {
  const { width: windowWidth } = useWindowDimensions();
  const heroArtWidth = windowWidth - 32;

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroHeader}>
        <View style={styles.heroTextBlock}>
          <Text style={styles.heroTitle}>
            Khet Se{"\n"}
            <Text style={styles.heroTitleAccent}>Ghar Tak</Text>
          </Text>
          <Text style={styles.heroSubtitle}>Bhoomi. Bazaar. Barakath.</Text>
        </View>
        <Pressable style={styles.shopBtn} onPress={onPress}>
          <Text style={styles.shopBtnText}>Shop Now</Text>
        </Pressable>
      </View>
      <FarmIllustration width={heroArtWidth} />
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: APP_BLACK,
    overflow: "hidden"
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 12
  },
  heroTextBlock: {
    flex: 1,
    minWidth: 0
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    color: APP_TEXT
  },
  heroTitleAccent: {
    color: APP_LIME
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: APP_TEXT_MUTED
  },
  shopBtn: {
    marginTop: 4,
    backgroundColor: APP_LIME,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 10
  },
  shopBtnText: {
    color: APP_TEXT_ON_LIME,
    fontWeight: "700",
    fontSize: 14
  },
  heroArtWrap: {
    alignSelf: "center",
    marginTop: 4
  }
});
