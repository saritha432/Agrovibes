import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { APP_LIME, APP_TEXT_ON_LIME } from "../theme/appColors";

const TEAL = "#0d9488";
const TEAL_STEPPER = "#0f766e";

type CartQtyControlProps = {
  quantity: number;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
  increaseDisabled?: boolean;
  variant: "teal" | "lime";
  addAppearance?: "icon" | "label";
  overlay?: boolean;
  style?: StyleProp<ViewStyle>;
};

function stop(event?: { stopPropagation?: () => void }) {
  event?.stopPropagation?.();
}

export function CartQtyControl({
  quantity,
  onAdd,
  onIncrease,
  onDecrease,
  increaseDisabled,
  variant,
  addAppearance = "icon",
  overlay,
  style
}: CartQtyControlProps) {
  const lime = variant === "lime";

  if (quantity <= 0) {
    if (addAppearance === "label") {
      return (
        <Pressable
          style={[lime ? styles.limeAddLabel : styles.tealAddLabel, overlay ? styles.overlay : null, style]}
          onPress={(event) => {
            stop(event);
            onAdd();
          }}
          accessibilityRole="button"
          accessibilityLabel="Add"
        >
          <Text allowFontScaling={false} style={lime ? styles.limeAddLabelText : styles.tealAddLabelText}>
            Add
          </Text>
        </Pressable>
      );
    }

    return (
      <Pressable
        style={[lime ? styles.limeAddIcon : styles.tealAddIcon, overlay ? styles.overlay : null, style]}
        onPress={(event) => {
          stop(event);
          onAdd();
        }}
        accessibilityRole="button"
        accessibilityLabel="Add"
        hitSlop={6}
      >
        <Ionicons name="add" size={lime ? 22 : 22} color={lime ? APP_TEXT_ON_LIME : "#fff"} />
      </Pressable>
    );
  }

  return (
    <View
      style={[lime ? styles.limeStepper : styles.tealStepper, overlay ? styles.overlay : null, style]}
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 0, now: quantity }}
    >
      <Pressable
        style={lime ? styles.limeSide : styles.tealSide}
        onPress={(event) => {
          stop(event);
          onDecrease();
        }}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        hitSlop={8}
      >
        <Text allowFontScaling={false} style={lime ? styles.limeGlyph : styles.tealGlyph}>
          −
        </Text>
      </Pressable>
      <Text allowFontScaling={false} style={lime ? styles.limeCount : styles.tealCount}>
        {quantity}
      </Text>
      <Pressable
        style={lime ? styles.limeSide : styles.tealSide}
        onPress={(event) => {
          stop(event);
          if (!increaseDisabled) onIncrease();
        }}
        disabled={increaseDisabled}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        hitSlop={8}
      >
        <Text
          allowFontScaling={false}
          style={[lime ? styles.limeGlyph : styles.tealGlyph, increaseDisabled ? styles.disabledGlyph : null]}
        >
          +
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    right: 6,
    bottom: 6,
    zIndex: 2
  },
  tealAddIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center"
  },
  limeAddIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  tealAddLabel: {
    minWidth: 86,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TEAL,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  tealAddLabelText: { color: TEAL, fontWeight: "900" },
  limeAddLabel: {
    backgroundColor: APP_LIME,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  limeAddLabelText: { color: APP_TEXT_ON_LIME, fontWeight: "800" },
  tealStepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TEAL_STEPPER,
    borderRadius: 999,
    minHeight: 40,
    paddingHorizontal: 2,
    minWidth: 108
  },
  limeStepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: APP_LIME,
    borderRadius: 8,
    minHeight: 32,
    paddingHorizontal: 2,
    minWidth: 92
  },
  tealSide: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6
  },
  limeSide: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4
  },
  tealGlyph: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 22
  },
  limeGlyph: {
    color: APP_TEXT_ON_LIME,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 20
  },
  tealCount: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    minWidth: 28,
    textAlign: "center"
  },
  limeCount: {
    color: APP_TEXT_ON_LIME,
    fontSize: 13,
    fontWeight: "800",
    minWidth: 22,
    textAlign: "center"
  },
  disabledGlyph: {
    opacity: 0.35
  }
});
