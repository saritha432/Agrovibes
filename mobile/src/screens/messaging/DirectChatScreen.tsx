import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { fetchMessageThread, sendDirectMessage, type DirectMessageItem } from "../../services/api";

const BG = "#ffffff";
const TEXT = "#0f0f0f";
const MUTED = "#8e8e8e";
const BORDER = "#dbdbdb";
const TEAL = "#0f9b8e";
const BUBBLE_PEER = "#efefef";
const INPUT_BG = "#fafafa";

function formatMsgTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function DirectChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "DirectChat">>();
  const { peerUserId, peerName } = route.params;
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<DirectMessageItem>>(null);

  const reload = useCallback(async () => {
    if (!token) {
      setMessages([]);
      return;
    }
    const list = await fetchMessageThread(token, peerUserId);
    setMessages(list.messages || []);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  }, [token, peerUserId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const timer = setInterval(() => {
      void reload();
    }, 2500);
    return () => clearInterval(timer);
  }, [reload]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !token) return;
    setDraft("");
    await sendDirectMessage(token, peerUserId, text);
    await reload();
  };

  const bottomPad = Platform.OS === "ios" ? Math.max(insets.bottom, 8) : 8;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable hitSlop={12} style={styles.headerIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={TEXT} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{peerName.trim().charAt(0).toUpperCase() || "?"}</Text>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {peerName}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable hitSlop={8} onPress={() => {}}>
            <Ionicons name="call-outline" size={22} color={TEXT} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => {}}>
            <Ionicons name="videocam-outline" size={24} color={TEXT} />
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubbleRow,
              Number(item.senderId) === Number(user?.id) ? styles.bubbleRowSelf : styles.bubbleRowPeer
            ]}
          >
            <View style={[styles.bubble, Number(item.senderId) === Number(user?.id) ? styles.bubbleSelf : styles.bubblePeer]}>
              <Text style={[styles.bubbleText, Number(item.senderId) === Number(user?.id) ? styles.bubbleTextSelf : styles.bubbleTextPeer]}>
                {item.body}
              </Text>
              <Text
                style={[styles.bubbleMeta, Number(item.senderId) === Number(user?.id) ? styles.bubbleMetaSelf : styles.bubbleMetaPeer]}
              >
                {formatMsgTime(new Date(item.createdAt).getTime())}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.threadEmpty}>
            <Text style={styles.threadEmptyText}>
              Say hi to <Text style={styles.threadEmptyBold}>{peerName}</Text>
            </Text>
          </View>
        }
      />

      <View style={[styles.composer, { paddingBottom: bottomPad }]}>
        <Pressable style={styles.composerIcon} onPress={() => {}}>
          <Ionicons name="camera-outline" size={26} color={TEXT} />
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message..."
          placeholderTextColor={MUTED}
          style={styles.input}
          multiline
          maxLength={2000}
          onSubmitEditing={send}
        />
        <Pressable
          style={[styles.sendBtn, draft.trim() ? styles.sendBtnActive : null]}
          onPress={send}
          disabled={!draft.trim()}
        >
          <Ionicons name="send" size={18} color={draft.trim() ? "#fff" : MUTED} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER
  },
  headerIcon: { width: 40, alignItems: "flex-start" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e8f4f1",
    alignItems: "center",
    justifyContent: "center"
  },
  headerAvatarText: { fontSize: 14, fontWeight: "800", color: TEAL },
  headerTitle: { fontSize: 16, fontWeight: "800", color: TEXT, maxWidth: 180 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 14, width: 80, justifyContent: "flex-end" },
  listContent: { paddingHorizontal: 12, paddingVertical: 16, flexGrow: 1 },
  bubbleRow: { marginBottom: 10, flexDirection: "row" },
  bubbleRowSelf: { justifyContent: "flex-end" },
  bubbleRowPeer: { justifyContent: "flex-start" },
  bubble: { maxWidth: "78%", borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleSelf: { backgroundColor: TEAL },
  bubblePeer: { backgroundColor: BUBBLE_PEER },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextSelf: { color: "#fff" },
  bubbleTextPeer: { color: TEXT },
  bubbleMeta: { marginTop: 4, fontSize: 11, alignSelf: "flex-end" },
  bubbleMetaSelf: { color: "rgba(255,255,255,0.8)" },
  bubbleMetaPeer: { color: MUTED },
  threadEmpty: { paddingVertical: 48, alignItems: "center" },
  threadEmptyText: { fontSize: 15, color: MUTED },
  threadEmptyBold: { fontWeight: "800", color: TEXT },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    backgroundColor: BG,
    gap: 8
  },
  composerIcon: { paddingBottom: 10 },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: INPUT_BG,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
    color: TEXT
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e8e8e8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2
  },
  sendBtnActive: { backgroundColor: TEAL }
});
