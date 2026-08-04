import React, { useMemo } from "react";
import { View, type ViewProps } from "react-native";
import {
  useSafeAreaInsets,
  type Edge,
  type EdgeMode,
  type Edges
} from "react-native-safe-area-context";
import { resolveTopChromeInset } from "../theme/topChromeInset";

type Props = ViewProps & {
  children?: React.ReactNode;
  edges?: Edges;
};

function edgeEnabled(edges: Edges | undefined, edge: Edge): boolean {
  if (edges == null) return true;
  if (Array.isArray(edges)) return edges.includes(edge);
  const mode = (edges as Partial<Record<Edge, EdgeMode>>)[edge];
  return mode != null && mode !== "off";
}

/**
 * Padding-based SafeAreaView. Prefer this over the native SafeAreaView on iOS,
 * where native top inset can briefly (or persistently) report 0 and draw under the status bar.
 */
export const AppSafeAreaView = React.forwardRef<View, Props>(function AppSafeAreaView(
  { edges, style, children, ...rest },
  ref
) {
  const insets = useSafeAreaInsets();
  const pad = useMemo(() => {
    const top = edgeEnabled(edges, "top") ? resolveTopChromeInset(insets.top) : 0;
    const bottom = edgeEnabled(edges, "bottom") ? Math.max(insets.bottom, 0) : 0;
    const left = edgeEnabled(edges, "left") ? Math.max(insets.left, 0) : 0;
    const right = edgeEnabled(edges, "right") ? Math.max(insets.right, 0) : 0;
    return { paddingTop: top, paddingBottom: bottom, paddingLeft: left, paddingRight: right };
  }, [edges, insets.bottom, insets.left, insets.right, insets.top]);

  return (
    <View ref={ref} style={[pad, style]} {...rest}>
      {children}
    </View>
  );
});
