import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { AppTopBar } from "../components/AppTopBar";

const reels = [
  { id: "1", title: "Tomato Harvest", kind: "content", linked: false },
  { id: "2", title: "Organic Onion Lot", kind: "product", linked: true },
  { id: "3", title: "Soybean Sorting", kind: "content", linked: false }
];

export function HomeScreen() {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <View style={styles.screen}>
      <AppTopBar />
      <ScrollView stickyHeaderIndices={[0]} contentContainerStyle={styles.scrollBottom}>
        <View style={styles.stickySearchWrap}>
          <View style={styles.searchWrap}>
            <TextInput placeholder="Search crops, farmers, districts" style={styles.searchInput} />
            <Pressable style={styles.iconButton}><Ionicons name="mic-outline" size={18} color="#fff" /></Pressable>
            <Pressable style={styles.iconButton}><Ionicons name="search-outline" size={18} color="#fff" /></Pressable>
          </View>
        </View>

        {reels.map((reel) => (
          <View key={reel.id} style={[styles.reelCard, reel.linked ? styles.reelCardLinked : null]}>
            <Ionicons name="play-circle-outline" size={38} color="#fff" />
            <Text style={styles.reelTitle}>{reel.title}</Text>
            <Text style={styles.reelMeta}>{reel.kind === "product" ? "Reel linked product" : "Pure content reel"}</Text>
            {reel.linked ? (
              <Pressable style={styles.buyNow}><Text style={styles.buyNowText}>Buy Now</Text></Pressable>
            ) : null}
          </View>
        ))}

        <View style={styles.quickActions}>
          <Action icon="heart-outline" label="Like" />
          <Action icon="chatbubble-outline" label="Chat" />
          <Action icon="cart-outline" label="Add Cart" onPress={() => setCartOpen(true)} />
          <Action icon="add-circle-outline" label="Add Reel" />
        </View>
      </ScrollView>

      <Pressable style={styles.exploreBtn}><Text style={styles.exploreText}>Explore Marketplace</Text></Pressable>

      <Modal visible={cartOpen} transparent animationType="slide" onRequestClose={() => setCartOpen(false)}>
        <Pressable style={styles.drawerBackdrop} onPress={() => setCartOpen(false)}>
          <View style={styles.drawer}>
            <Text style={styles.drawerTitle}>Mini Drawer Cart</Text>
            <Text style={styles.drawerItem}>Tomato crate - Rs 980 - Escrow</Text>
            <Text style={styles.drawerItem}>Onion bag - Rs 740 - Escrow</Text>
            <Pressable style={styles.checkoutBtn}><Text style={styles.checkoutText}>Proceed to Checkout</Text></Pressable>
            <Pressable onPress={() => setCartOpen(false)}><Text style={styles.continueText}>Continue Browsing</Text></Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.actionBtn} onPress={onPress}>
      <Ionicons name={icon} size={18} color="#1f2b28" />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  scrollBottom: { paddingBottom: 110 },
  stickySearchWrap: { backgroundColor: "#f2f5f4", paddingTop: 8 },
  searchWrap: { marginHorizontal: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, backgroundColor: "#f2f0eb", borderRadius: 10, borderWidth: 1, borderColor: "#e4e6df", paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  iconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#0a9f46", alignItems: "center", justifyContent: "center" },
  reelCard: { marginHorizontal: 12, marginBottom: 10, borderRadius: 16, minHeight: 190, backgroundColor: "#07803a", alignItems: "center", justifyContent: "center" },
  reelCardLinked: { backgroundColor: "#c6425d" },
  reelTitle: { color: "#fff", fontSize: 24, fontWeight: "700", marginTop: 8 },
  reelMeta: { color: "#e2f4e8", marginTop: 4 },
  buyNow: { marginTop: 10, backgroundColor: "#f2ae00", paddingHorizontal: 13, paddingVertical: 6, borderRadius: 18 },
  buyNowText: { color: "#1f2524", fontWeight: "700", fontSize: 12 },
  quickActions: { marginHorizontal: 12, marginTop: 4, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#d9e2df", flexDirection: "row", justifyContent: "space-around", paddingVertical: 10 },
  actionBtn: { alignItems: "center", gap: 4 },
  actionText: { fontSize: 11, fontWeight: "600", color: "#31403d" },
  exploreBtn: { position: "absolute", right: 14, bottom: 96, backgroundColor: "#0a9f46", borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10 },
  exploreText: { color: "#fff", fontWeight: "700" },
  drawerBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.25)" },
  drawer: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 14, gap: 8 },
  drawerTitle: { fontSize: 16, fontWeight: "700", color: "#1f2b28" },
  drawerItem: { color: "#4a5b57" },
  checkoutBtn: { marginTop: 8, backgroundColor: "#0a9f46", borderRadius: 10, alignItems: "center", paddingVertical: 11 },
  checkoutText: { color: "#fff", fontWeight: "700" },
  continueText: { textAlign: "center", color: "#0a9f46", fontWeight: "600", marginTop: 2 }
});
