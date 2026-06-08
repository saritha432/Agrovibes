import { Asset } from "expo-asset";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import {
  APP_BLACK,
  APP_LIME,
  APP_TEXT_ON_LIME
} from "../../../../theme/appColors";
import { moduleToUri } from "../../shared/marketAssetUtils";

const FARM_ILLUSTRATION = require("../../../../../assets/market/farm-illustration.svg");

export function WelcomeKisanBanner({ onPress }: { onPress: () => void }) {
  const { width } = useWindowDimensions();
  const artW = Math.round(width * 0.42);
  const artH = Math.round(artW * 0.72);
  const [uri, setUri] = useState<string | null>(() => moduleToUri(FARM_ILLUSTRATION));

  useEffect(() => {
    const direct = moduleToUri(FARM_ILLUSTRATION);
    if (direct) {
      setUri(direct);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const asset = Asset.fromModule(FARM_ILLUSTRATION as number);
        await asset.downloadAsync();
        const nextUri = asset.localUri ?? asset.uri;
        if (!cancelled && nextUri) setUri(nextUri);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={["#d4f56a", "#eef9c8", "#f8fce8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.textCol}>
          <Text style={styles.welcome}>
            Welcome <Text style={styles.brand}>Kisan Bazaar</Text>
          </Text>
          <Text style={styles.subtitle}>The Farmer&apos;s Marketplace</Text>
          <Pressable style={styles.btn} onPress={onPress}>
            <Text style={styles.btnText}>Shop Now!</Text>
          </Pressable>
        </View>
        {uri && Platform.OS === "web" ? (
          React.createElement("img", {
            src: uri,
            alt: "",
            style: { width: artW, height: artH, objectFit: "contain", alignSelf: "flex-end" }
          })
        ) : uri ? (
          (() => {
            try {
              const { SvgUri } = require("react-native-svg") as typeof import("react-native-svg");
              return (
                <View style={styles.artWrap}>
                  <SvgUri uri={uri} width={artW} height={artH} preserveAspectRatio="xMaxYMax meet" />
                </View>
              );
            } catch {
              return null;
            }
          })()
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 20,
    marginHorizontal: 16
  },
  card: {
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    overflow: "hidden",
    minHeight: 148,
    paddingLeft: 18,
    paddingTop: 18,
    paddingBottom: 12
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 8
  },
  welcome: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    color: APP_BLACK
  },
  brand: {
    color: "#3d6b12"
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "#3a3a3a"
  },
  btn: {
    alignSelf: "flex-start",
    marginTop: 12,
    backgroundColor: APP_LIME,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8
  },
  btnText: {
    fontSize: 13,
    fontWeight: "700",
    color: APP_TEXT_ON_LIME
  },
  artWrap: {
    alignSelf: "flex-end"
  }
});
