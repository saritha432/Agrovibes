import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { uploadImageFile } from "../services/api";

const TEXT = "#0f0f0f";
const MUTED = "#7a7a7a";
const BORDER = "#e5e5e5";
const INPUT_BG = "#fafafa";
const TEAL = "#0f9b8e";

function safeHandle(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_.]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [username, setUsername] = useState(() => safeHandle((user?.email || "").split("@")[0] || ""));
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState(user?.locationLabel || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [isUploadingPhoto, setUploadingPhoto] = useState(false);

  const initials = useMemo(() => {
    return String(fullName || user?.fullName || "U")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("");
  }, [fullName, user?.fullName]);

  const save = async () => {
    const name = fullName.trim();
    if (!name) {
      Alert.alert("Name required", "Please enter your name.");
      return;
    }
    await updateUser({ fullName: name, locationLabel: location.trim() || undefined, avatarUrl: avatarUrl || undefined });
    Alert.alert("Saved", "Profile updated.");
    navigation.goBack();
  };

  const pickProfilePhoto = async () => {
    if (isUploadingPhoto) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo library access.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
      aspect: [1, 1]
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;

    const localUri = picked.assets[0].uri;
    setUploadingPhoto(true);
    try {
      const uploaded = await uploadImageFile(localUri);
      setAvatarUrl(uploaded.url);
      await updateUser({ avatarUrl: uploaded.url });
      Alert.alert("Updated", "Profile picture uploaded.");
    } catch (error: any) {
      // Keep local uri so user sees immediate change in development even if cloud upload is unavailable.
      setAvatarUrl(localUri);
      await updateUser({ avatarUrl: localUri });
      Alert.alert("Photo saved locally", error?.message ? String(error.message) : "Could not upload to server, using local preview.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(24, insets.bottom + 10) }]}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" /> : <Text style={styles.avatarText}>{initials || "U"}</Text>}
          </View>
          <Pressable onPress={pickProfilePhoto} disabled={isUploadingPhoto}>
            <Text style={styles.changePhotoText}>{isUploadingPhoto ? "Uploading..." : "Change profile photo"}</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput value={fullName} onChangeText={setFullName} style={styles.input} placeholder="Name" placeholderTextColor={MUTED} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              value={username}
              onChangeText={(t) => setUsername(safeHandle(t))}
              style={styles.input}
              autoCapitalize="none"
              placeholder="username"
              placeholderTextColor={MUTED}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Website</Text>
            <TextInput
              value={website}
              onChangeText={setWebsite}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="Website"
              placeholderTextColor={MUTED}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              style={[styles.input, styles.bioInput]}
              multiline
              maxLength={150}
              placeholder="Bio"
              placeholderTextColor={MUTED}
            />
            <Text style={styles.helper}>{bio.length}/150</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              style={styles.input}
              placeholder="Location"
              placeholderTextColor={MUTED}
            />
          </View>
        </View>

        <Pressable style={styles.saveBtn} onPress={save}>
          <Ionicons name="checkmark" size={18} color="#fff" />
          <Text style={styles.saveText}>Done</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  avatarWrap: { alignItems: "center", paddingTop: 6, paddingBottom: 18 },
  avatar: {
    width: 94,
    height: 94,
    borderRadius: 47,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ececec"
  },
  avatarText: { fontSize: 34, fontWeight: "800", color: TEXT },
  avatarImage: { width: "100%", height: "100%", borderRadius: 47 },
  changePhotoText: { marginTop: 12, fontSize: 14, fontWeight: "700", color: "#3897f0" },
  form: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  field: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER
  },
  label: { fontSize: 13, color: MUTED, marginBottom: 6, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: INPUT_BG,
    fontSize: 15,
    color: TEXT
  },
  bioInput: { minHeight: 92, textAlignVertical: "top" },
  helper: { marginTop: 6, color: MUTED, fontSize: 12, textAlign: "right" },
  saveBtn: {
    marginTop: 18,
    backgroundColor: TEAL,
    borderRadius: 12,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "800" }
});
