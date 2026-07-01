import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { ensureMediaLibraryAccess } from "../utils/mediaLibraryPermission";
import * as ImagePicker from "expo-image-picker";
import type { ImagePickerAsset } from "expo-image-picker";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { InAppCameraCapture } from "../components/InAppCameraCapture";
import { ProfilePhotoAdjustModal } from "../components/ProfilePhotoAdjustModal";
import { ProfilePhotoCaptureReview } from "../components/ProfilePhotoCaptureReview";
import { WebCameraCapture } from "../components/WebCameraCapture";
import { useAuth } from "../auth/AuthContext";
import { updateMyProfile, uploadImageFile } from "../services/api";
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";
import { useLanguage } from "../localization/LanguageContext";
const BG = APP_BLACK;
const CARD = APP_SURFACE;
const BORDER = "#3a3a3a";
const LABEL = APP_TEXT_MUTED;
const TEXT = APP_TEXT;
const ACCENT = APP_LIME;
const ACCENT_TEXT = APP_BLACK;

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"] as const;
type GenderOption = (typeof GENDER_OPTIONS)[number];

function genderStorageKey(userId?: number | null) {
  return `agrovibes.profile.gender.v1.uid.${userId ?? "guest"}`;
}

function safeHandle(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_.]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function genderLabel(option: GenderOption, t: (key: string) => string) {
  if (option === "Male") return t("genderMale");
  if (option === "Female") return t("genderFemale");
  if (option === "Other") return t("genderOther");
  return t("genderPreferNotToSay");
}

type FieldRowProps = {
  label: string;
  children: React.ReactNode;
  last?: boolean;
};

function FieldRow({ label, children, last }: FieldRowProps) {
  return (
    <View style={[styles.fieldRow, last ? styles.fieldRowLast : null]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function NativeBannerGrid() {
  const cells = 8;
  const step = 22;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: cells + 1 }).map((_, index) => (
        <React.Fragment key={`grid-${index}`}>
          <View style={[styles.gridLineH, { top: index * step }]} />
          <View style={[styles.gridLineV, { left: index * step }]} />
        </React.Fragment>
      ))}
    </View>
  );
}

function ProfileBannerBackground() {
  const gridWeb =
    Platform.OS === "web"
      ? ({
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.035) 1px, transparent 1px)",
          backgroundSize: "22px 22px"
        } as object)
      : null;

  return (
    <View style={styles.banner}>
      <View style={[styles.bannerBase, gridWeb]} />
      {Platform.OS !== "web" ? <NativeBannerGrid /> : null}
      <LinearGradient
        colors={["rgba(201, 255, 53, 0.45)", "rgba(255, 255, 255, 0)"]}
        style={styles.bannerGlowTopLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <LinearGradient
        colors={["rgba(255, 255, 255, 0)", "rgba(201, 255, 53, 0.45)"]}
        style={styles.bannerGlowBottomRight}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
    </View>
  );
}

export function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { user, token, signIn, updateUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [username, setUsername] = useState(() => safeHandle(user?.username || (user?.email || "").split("@")[0] || ""));
  const [bio, setBio] = useState(user?.bio || "");
  const [website, setWebsite] = useState(user?.website || "");
  const [location, setLocation] = useState(user?.locationLabel || "");
  const [gender, setGender] = useState<GenderOption>("Male");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [removeAvatarPending, setRemoveAvatarPending] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [photoOptionsOpen, setPhotoOptionsOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [reviewUri, setReviewUri] = useState<string | null>(null);
  const [adjustUri, setAdjustUri] = useState<string | null>(null);
  const [genderPickerOpen, setGenderPickerOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(genderStorageKey(user?.id));
        if (!active || !stored) return;
        if (GENDER_OPTIONS.includes(stored as GenderOption)) {
          setGender(stored as GenderOption);
        }
      } catch {
        // ignore local preference read errors
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  type payloadFallback = {
    fullName?: string;
    username?: string;
    bio?: string;
    website?: string;
    locationLabel?: string;
    avatarUrl?: string;
  };

  const buildPersistedUser = (serverUser: any, patch: payloadFallback) => {
    const baseUser = user || ({} as any);
    return {
      ...baseUser,
      ...(serverUser || {}),
      ...patch
    };
  };

  const initials = useMemo(() => {
    return String(fullName || user?.fullName || "U")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("");
  }, [fullName, user?.fullName]);

  const displayAvatarUri = removeAvatarPending ? "" : pendingAvatarUri || avatarUrl;

  const save = async () => {
    const name = fullName.trim();
    if (!name) {
      Alert.alert(t("nameRequired"), t("nameRequiredMessage"));
      return;
    }

    let finalAvatarUrl: string | undefined = avatarUrl || undefined;
    if (removeAvatarPending) {
      finalAvatarUrl = undefined;
    } else if (pendingAvatarUri) {
      try {
        const uploaded = await uploadImageFile(pendingAvatarUri, { profile: true });
        finalAvatarUrl = uploaded.url;
      } catch {
        finalAvatarUrl = pendingAvatarUri;
      }
    }

    const payload = {
      fullName: name,
      username: safeHandle(username) || undefined,
      bio: bio.trim() || undefined,
      website: website.trim() || undefined,
      locationLabel: location.trim() || undefined,
      avatarUrl: finalAvatarUrl
    };
    setSaving(true);
    try {
      if (token) {
        const updated = await updateMyProfile(token, payload);
        const nextToken = updated.token || token;
        const mergedUser = buildPersistedUser(updated.user, payload);
        await signIn({ token: nextToken, user: mergedUser });
      } else {
        await updateUser(payload);
      }
      await AsyncStorage.setItem(genderStorageKey(user?.id), gender);
      Alert.alert(t("profileSaved"), t("profileUpdated"));
      navigation.goBack();
    } catch (error: any) {
      Alert.alert(t("saveFailed"), error?.message ? String(error.message) : t("saveFailedProfile"));
    } finally {
      setSaving(false);
    }
  };

  const pickProfilePhoto = async () => {
    const access = await ensureMediaLibraryAccess();
    if (!access.granted) {
      Alert.alert(t("permissionNeeded"), t("photoLibraryPermission"));
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: false
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;
    setAdjustUri(picked.assets[0].uri);
  };

  const openCameraCapture = () => {
    setPhotoOptionsOpen(false);
    setCameraOpen(true);
  };

  const onCameraCapture = (asset: ImagePickerAsset) => {
    setCameraOpen(false);
    setReviewUri(asset.uri);
  };

  const onReviewCancel = () => {
    setReviewUri(null);
  };

  const onReviewConfirm = () => {
    if (!reviewUri) return;
    setAdjustUri(reviewUri);
    setReviewUri(null);
  };

  const onAdjustDone = (croppedUri: string) => {
    setPendingAvatarUri(croppedUri);
    setRemoveAvatarPending(false);
    setAdjustUri(null);
  };

  const onAdjustCancel = () => {
    setAdjustUri(null);
  };

  const removeProfilePhoto = () => {
    setPendingAvatarUri(null);
    setRemoveAvatarPending(true);
    setPhotoOptionsOpen(false);
  };

  const openPhotoOptions = () => {
    if (isSaving) return;
    setPhotoOptionsOpen(true);
  };

  const inputProps = Platform.OS === "web" ? ({ outlineStyle: "none" } as const) : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet}>
          <View style={styles.grabBar} />

          <View style={styles.headerRow}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.headerBackBtn}>
              <Ionicons name="chevron-back" size={24} color={TEXT} />
            </Pressable>
            <Text style={styles.headerTitle}>{t("editProfileTitle")}</Text>
            <Pressable onPress={save} disabled={isSaving} hitSlop={8} style={styles.headerBackBtn}>
              <Text style={[styles.headerSave, isSaving ? styles.headerSaveDisabled : null]}>
                {isSaving ? t("saving") : t("saveProfile")}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(24, insets.bottom + 16) }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroWrap}>
              <ProfileBannerBackground />

              <Pressable
                onPress={openPhotoOptions}
                disabled={isSaving}
                style={({ pressed }) => [styles.avatarWrap, pressed ? styles.avatarWrapPressed : null]}
                accessibilityRole="button"
                accessibilityLabel={t("changeProfilePhoto")}
              >
                <View style={styles.avatar}>
                  {displayAvatarUri ? (
                    <Image source={{ uri: displayAvatarUri }} style={styles.avatarImage} resizeMode="cover" />
                  ) : (
                    <Text style={styles.avatarText}>{initials || "U"}</Text>
                  )}
                </View>
                <View style={styles.avatarBadge}>
                  <Ionicons name="camera" size={14} color={ACCENT_TEXT} />
                </View>
              </Pressable>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>{t("basicInfo")}</Text>

              <FieldRow label={t("name")}>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  style={[styles.fieldInput, inputProps]}
                  placeholder={t("name")}
                  placeholderTextColor={LABEL}
                />
              </FieldRow>

              <FieldRow label={t("username")}>
                <TextInput
                  value={username}
                  onChangeText={(text) => setUsername(safeHandle(text))}
                  style={[styles.fieldInput, inputProps]}
                  autoCapitalize="none"
                  placeholder={t("usernamePlaceholder")}
                  placeholderTextColor={LABEL}
                />
              </FieldRow>

              <FieldRow label={t("gender")}>
                <Pressable
                  style={styles.genderRow}
                  onPress={() => setGenderPickerOpen(true)}
                  accessibilityRole="button"
                >
                  <Text style={styles.fieldValue}>{genderLabel(gender, t)}</Text>
                  <Ionicons name="chevron-down" size={18} color={LABEL} />
                </Pressable>
              </FieldRow>

              <FieldRow label={t("bio")} last>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  style={[styles.fieldInput, styles.bioInput, inputProps]}
                  multiline
                  maxLength={300}
                  placeholder={t("bioPlaceholder")}
                  placeholderTextColor={LABEL}
                />
              </FieldRow>
            </View>

            <View style={[styles.infoCard, styles.infoCardSpaced]}>
              <Text style={styles.sectionTitle}>{t("additionalInfo")}</Text>

              <FieldRow label={t("website")}>
                <TextInput
                  value={website}
                  onChangeText={setWebsite}
                  style={[styles.fieldInput, inputProps]}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholder={t("websitePlaceholder")}
                  placeholderTextColor={LABEL}
                />
              </FieldRow>

              <FieldRow label={t("location")} last>
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  style={[styles.fieldInput, inputProps]}
                  placeholder={t("locationPlaceholder")}
                  placeholderTextColor={LABEL}
                />
              </FieldRow>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={genderPickerOpen} transparent animationType="fade" onRequestClose={() => setGenderPickerOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setGenderPickerOpen(false)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>{t("gender")}</Text>
            {GENDER_OPTIONS.map((option) => {
              const active = gender === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.pickerOption, active ? styles.pickerOptionActive : null]}
                  onPress={() => {
                    setGender(option);
                    setGenderPickerOpen(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, active ? styles.pickerOptionTextActive : null]}>
                    {genderLabel(option, t)}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={18} color={ACCENT} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={photoOptionsOpen} transparent animationType="fade" onRequestClose={() => setPhotoOptionsOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPhotoOptionsOpen(false)}>
          <Pressable style={styles.photoSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.photoSheetTitle}>{t("changeProfilePhoto")}</Text>
            <Pressable
              style={({ pressed }) => [styles.photoSheetAction, pressed ? styles.pickerOptionPressed : null]}
              onPress={openCameraCapture}
            >
              <Ionicons name="camera-outline" size={20} color={TEXT} />
              <Text style={styles.photoSheetActionText}>Take photo</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.photoSheetAction, pressed ? styles.pickerOptionPressed : null]}
              onPress={() => {
                setPhotoOptionsOpen(false);
                void pickProfilePhoto();
              }}
            >
              <Ionicons name="images-outline" size={20} color={TEXT} />
              <Text style={styles.photoSheetActionText}>Gallery</Text>
            </Pressable>
            {displayAvatarUri ? (
              <Pressable
                style={({ pressed }) => [styles.photoSheetAction, pressed ? styles.pickerOptionPressed : null]}
                onPress={removeProfilePhoto}
              >
                <Ionicons name="trash-outline" size={20} color="#f87171" />
                <Text style={styles.pickerOptionDanger}>Remove profile photo</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.photoSheetCancel} onPress={() => setPhotoOptionsOpen(false)}>
              <Text style={styles.photoSheetCancelText}>{t("cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {Platform.OS === "web" ? (
        <WebCameraCapture
          visible={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onCapture={onCameraCapture}
          initialFacing="front"
          allowVideo={false}
        />
      ) : (
        <InAppCameraCapture
          visible={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onCapture={onCameraCapture}
          initialFacing="front"
          mode="photo"
        />
      )}

      <ProfilePhotoCaptureReview
        visible={Boolean(reviewUri)}
        sourceUri={reviewUri}
        onCancel={onReviewCancel}
        onConfirm={onReviewConfirm}
      />

      <ProfilePhotoAdjustModal
        visible={Boolean(adjustUri)}
        sourceUri={adjustUri}
        onCancel={onAdjustCancel}
        onDone={onAdjustDone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  sheet: {
    flex: 1,
    backgroundColor: BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden"
  },
  grabBar: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: ACCENT,
    marginTop: 10,
    marginBottom: 8
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 12
  },
  headerBackBtn: {
    width: 36,
    alignItems: "flex-start",
    justifyContent: "center"
  },
  headerTitle: { flex: 1, color: TEXT, fontSize: 18, fontWeight: "800", textAlign: "center" },
  headerSave: { color: ACCENT, fontSize: 16, fontWeight: "800" },
  headerSaveDisabled: { opacity: 0.55 },
  scrollContent: { paddingHorizontal: 16 },
  heroWrap: {
    height: 148,
    marginBottom: 56,
    position: "relative"
  },
  banner: {
    height: 148,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#ffffff"
  },
  bannerBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffffff"
  },
  bannerGlowTopLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "72%",
    height: "78%"
  },
  bannerGlowBottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: "72%",
    height: "78%"
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.06)"
  },
  gridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.06)"
  },
  avatarWrap: {
    position: "absolute",
    left: 14,
    bottom: -48,
    width: 96,
    height: 96
  },
  avatarWrapPressed: { opacity: 0.92 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: APP_BLACK,
    borderWidth: 3,
    borderColor: BG,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  avatarText: { fontSize: 34, fontWeight: "800", color: TEXT },
  avatarImage: { width: "100%", height: "100%" },
  avatarBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: BG
  },
  infoCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4
  },
  infoCardSpaced: { marginTop: 14 },
  sectionTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4
  },
  fieldRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER
  },
  fieldRowLast: { borderBottomWidth: 0 },
  fieldLabel: {
    color: LABEL,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6
  },
  fieldInput: {
    padding: 0,
    margin: 0,
    fontSize: 16,
    fontWeight: "600",
    color: TEXT,
    backgroundColor: "transparent"
  },
  fieldValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: TEXT
  },
  bioInput: {
    minHeight: 96,
    textAlignVertical: "top",
    lineHeight: 22
  },
  genderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
    padding: 14
  },
  pickerSheet: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 14,
    gap: 8
  },
  pickerTitle: { color: TEXT, fontSize: 15, fontWeight: "800", marginBottom: 4 },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  pickerOptionActive: { backgroundColor: "rgba(201, 255, 53, 0.12)" },
  pickerOptionPressed: { opacity: 0.85 },
  pickerOptionText: { color: TEXT, fontSize: 15, fontWeight: "600", flex: 1 },
  pickerOptionTextActive: { color: ACCENT, fontWeight: "800" },
  pickerOptionDanger: { color: "#f87171", fontSize: 15, fontWeight: "700", flex: 1 },
  pickerCancel: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 12,
    marginTop: 4
  },
  pickerCancelText: { color: LABEL, fontSize: 14, fontWeight: "700" },
  photoSheet: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12
  },
  photoSheetTitle: { color: TEXT, fontSize: 16, fontWeight: "800", marginBottom: 10 },
  photoSheetAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14
  },
  photoSheetActionText: { color: TEXT, fontSize: 16, fontWeight: "600" },
  photoSheetCancel: {
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.03)"
  },
  photoSheetCancelText: { color: TEXT, fontSize: 15, fontWeight: "800" }
});
