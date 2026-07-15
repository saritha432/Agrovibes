import { StyleSheet } from "react-native";

/** Shared bottom-sheet styles for post options / report flows (Instagram-style dark sheets). */
export const postSheetStyles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end"
  },
  /** Backdrop above the sheet (do not use absoluteFill — it steals Submit taps). */
  dimFlex: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)"
  },
  dimTap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)"
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: "#262626",
    borderTopWidth: 1,
    borderColor: "#343b43",
    paddingHorizontal: 14,
    paddingTop: 8,
    zIndex: 2,
    elevation: 8
  },
  handle: {
    width: 52,
    height: 3,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
    backgroundColor: "#C9FF35"
  },
  title: { color: "#eef4f8", fontSize: 16, fontWeight: "900", paddingBottom: 4 },
  subtitle: { color: "#97a0a8", fontSize: 12, fontWeight: "600", marginBottom: 8, lineHeight: 17 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#303842"
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2a3139"
  },
  optionTextCol: { flex: 1, minWidth: 0 },
  optionTitle: { color: "#f8fafc", fontSize: 14, fontWeight: "900" },
  optionTitleDanger: { color: "#ff8f8f" },
  optionSub: { color: "#97a0a8", fontSize: 11, fontWeight: "700", marginTop: 3 },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#3a424c"
  },
  reasonLabel: { flex: 1, color: "#f8fafc", fontSize: 15, fontWeight: "600" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 6
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  doneIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(201, 255, 53, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginVertical: 16
  },
  doneTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8
  },
  doneMsg: {
    color: "#97a0a8",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 8
  },
  primaryBtn: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#C9FF35",
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryBtnText: { color: "#111", fontSize: 15, fontWeight: "900" },
  secondaryBtn: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ff6b6b",
    paddingVertical: 14,
    alignItems: "center"
  },
  secondaryBtnText: { color: "#ff8f8f", fontSize: 15, fontWeight: "800" },
  quoteInput: {
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3a424c",
    backgroundColor: "#1f2429",
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
    marginBottom: 12
  }
});
