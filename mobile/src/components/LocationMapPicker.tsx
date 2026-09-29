import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { fetchMapsConfig } from "../services/api";
import { APP_BLACK, APP_TEXT } from "../theme/appColors";
const FALLBACK_LAT = 20.5937;
const FALLBACK_LNG = 78.9629;

export type PickedMapLocation = {
  label: string;
  lat: number;
  lng: number;
};

type Props = {
  open: boolean;
  apiKey?: string | null;
  label: string;
  lat?: number | null;
  lng?: number | null;
  onClose: () => void;
  onSelect: (value: PickedMapLocation) => void;
};

function hasSavedMapCoords(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return false;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  if (Math.abs(la) < 0.05 && Math.abs(ln) < 0.05) return false;
  return la >= -90 && la <= 90 && ln >= -180 && ln <= 180;
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildPickerHtml(apiKey: string, label: string, lat?: number | null, lng?: number | null) {
  const saved = hasSavedMapCoords(lat, lng);
  const startLat = saved ? Number(lat) : FALLBACK_LAT;
  const startLng = saved ? Number(lng) : FALLBACK_LNG;
  const startZoom = saved ? 16 : 5;
  const initialPicked = saved
    ? JSON.stringify({ label: label || `${startLat}, ${startLng}`, lat: startLat, lng: startLng })
    : "null";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
  <style>
    html,body{margin:0;height:100%;background:#111;color:#fff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}
    .wrap{display:flex;flex-direction:column;height:100%}
    .search{display:flex;gap:8px;padding:10px}
    #q{flex:1;min-width:0;border:1px solid #3a3a3a;background:#1d1d1d;color:#fff;border-radius:10px;padding:10px 12px;font-size:16px}
    #me,#go{border:1px solid #3a3a3a;background:transparent;color:#fff;border-radius:10px;padding:10px;font-weight:700}
    #map{flex:1;min-height:240px;background:#1a1a1a}
    .bar{padding:10px 12px 16px}
    #hint,#addr{margin:0 0 8px;font-size:13px;color:#c4c4c4}
    #ok{width:100%;border:none;background:#c9ff35;color:#111;font-weight:800;border-radius:12px;padding:12px;font-size:15px}
    #ok:disabled{opacity:.45}
    .pac-container{z-index:10000}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="search">
      <input id="q" placeholder="Search Google Maps" value=${JSON.stringify(label)} autocomplete="off"/>
      <button id="go" type="button">Search</button>
      <button id="me" type="button">My location</button>
    </div>
    <div id="map"></div>
    <div class="bar">
      <p id="hint"></p>
      <p id="addr">${escapeHtml(label) || "Search, tap the map, or drag the pin."}</p>
      <button id="ok" type="button" ${saved ? "" : "disabled"}>Use this location</button>
    </div>
  </div>
  <script>
    function send(payload) {
      var raw = JSON.stringify(payload);
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(raw);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(raw, "*");
      }
    }
    var picked = ${initialPicked};
    var hasSaved = ${saved ? "true" : "false"};
    function setHint(text) {
      document.getElementById("hint").textContent = text || "";
    }
    function setPicked(next) {
      picked = next;
      var addr = document.getElementById("addr");
      var ok = document.getElementById("ok");
      addr.textContent = next ? next.label : "Search, tap the map, or drag the pin.";
      ok.disabled = !next;
    }
    document.getElementById("ok").onclick = function() {
      if (picked) send({ t: "ok", label: picked.label, lat: picked.lat, lng: picked.lng });
    };
    window.gm_authFailure = function() {
      send({ t: "maps-error" });
    };
    setTimeout(function() {
      if (!window.google || !window.google.maps) send({ t: "maps-error" });
    }, 8000);
    function initGoogle() {
      try {
        var maps = window.google.maps;
        var start = { lat: ${startLat}, lng: ${startLng} };
        var map = new maps.Map(document.getElementById("map"), {
          center: start, zoom: ${startZoom}, mapTypeControl: false, streetViewControl: false, fullscreenControl: false
        });
        var marker = new maps.Marker({ map: map, position: start, draggable: true, visible: hasSaved });
        var geocoder = new maps.Geocoder();
        function applyPoint(nextLat, nextLng, nextLabel) {
          marker.setVisible(true);
          marker.setPosition({ lat: nextLat, lng: nextLng });
          map.setCenter({ lat: nextLat, lng: nextLng });
          map.setZoom(16);
          if (nextLabel) {
            setPicked({ label: nextLabel, lat: nextLat, lng: nextLng });
            document.getElementById("q").value = nextLabel;
            return;
          }
          geocoder.geocode({ location: { lat: nextLat, lng: nextLng } }, function(results, status) {
            var formatted = status === "OK" && results && results[0] && results[0].formatted_address
              ? results[0].formatted_address
              : nextLat.toFixed(5) + ", " + nextLng.toFixed(5);
            setPicked({ label: formatted, lat: nextLat, lng: nextLng });
            document.getElementById("q").value = formatted;
          });
        }
        function searchPlace() {
          var q = String(document.getElementById("q").value || "").trim();
          if (!q) return;
          geocoder.geocode({ address: q }, function(results, status) {
            if (status !== "OK" || !results || !results[0] || !results[0].geometry) return;
            var loc = results[0].geometry.location;
            setHint("");
            applyPoint(loc.lat(), loc.lng(), results[0].formatted_address);
          });
        }
        function onLocationDenied() {
          marker.setVisible(false);
          setPicked(null);
          setHint("Location permission denied. Search for your place.");
          try { document.getElementById("q").focus(); } catch (_e) {}
        }
        function requestDeviceLocation() {
          if (!navigator.geolocation) {
            onLocationDenied();
            return;
          }
          setHint("Finding your current location…");
          navigator.geolocation.getCurrentPosition(function(pos) {
            setHint("");
            applyPoint(pos.coords.latitude, pos.coords.longitude);
          }, function() {
            onLocationDenied();
          }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
        }
        map.addListener("click", function(e) { if (e.latLng) { setHint(""); applyPoint(e.latLng.lat(), e.latLng.lng()); } });
        marker.addListener("dragend", function() {
          var p = marker.getPosition();
          if (p) applyPoint(p.lat(), p.lng());
        });
        try {
          var autocomplete = new maps.places.Autocomplete(document.getElementById("q"), {
            fields: ["formatted_address", "geometry", "name"]
          });
          autocomplete.addListener("place_changed", function() {
            var place = autocomplete.getPlace();
            if (!place || !place.geometry || !place.geometry.location) return;
            var loc = place.geometry.location;
            setHint("");
            applyPoint(loc.lat(), loc.lng(), place.formatted_address || place.name);
          });
        } catch (_placesErr) {}
        document.getElementById("go").onclick = searchPlace;
        document.getElementById("q").addEventListener("keydown", function(e) {
          if (e.key === "Enter") { e.preventDefault(); searchPlace(); }
        });
        document.getElementById("me").onclick = requestDeviceLocation;
        if (hasSaved) {
          setPicked(picked);
        } else {
          requestDeviceLocation();
        }
      } catch (_err) {
        send({ t: "maps-error" });
      }
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=initGoogle&loading=async" async onerror="send({ t: 'maps-error' })"></script>
</body>
</html>`;
}

function embedSrc(lat: number, lng: number, zoom: number) {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`;
}

function buildEmbedPickerHtml(label: string, lat?: number | null, lng?: number | null) {
  const saved = hasSavedMapCoords(lat, lng);
  const startLat = saved ? Number(lat) : FALLBACK_LAT;
  const startLng = saved ? Number(lng) : FALLBACK_LNG;
  const startZoom = saved ? 16 : 5;
  const initialPicked = saved
    ? JSON.stringify({ label: label || `${startLat}, ${startLng}`, lat: startLat, lng: startLng })
    : "null";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
  <style>
    html,body{margin:0;height:100%;background:#111;color:#fff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}
    .wrap{display:flex;flex-direction:column;height:100%}
    .search{display:flex;gap:8px;padding:10px}
    #q{flex:1;min-width:0;border:1px solid #3a3a3a;background:#1d1d1d;color:#fff;border-radius:10px;padding:10px 12px;font-size:16px}
    #me,#go{border:1px solid #3a3a3a;background:transparent;color:#fff;border-radius:10px;padding:10px;font-weight:700}
    #map{flex:1;min-height:240px;border:0;background:#1a1a1a}
    .bar{padding:10px 12px 16px}
    #hint,#addr{margin:0 0 8px;font-size:13px;color:#c4c4c4}
    #ok{width:100%;border:none;background:#c9ff35;color:#111;font-weight:800;border-radius:12px;padding:12px;font-size:15px}
    #ok:disabled{opacity:.45}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="search">
      <input id="q" placeholder="Search Google Maps" value=${JSON.stringify(label)} autocomplete="off"/>
      <button id="go" type="button">Search</button>
      <button id="me" type="button">My location</button>
    </div>
    <iframe id="map" title="Google Map" src="${embedSrc(startLat, startLng, startZoom)}"></iframe>
    <div class="bar">
      <p id="hint"></p>
      <p id="addr">${escapeHtml(label) || "Search or use My location."}</p>
      <button id="ok" type="button" ${saved ? "" : "disabled"}>Use this location</button>
    </div>
  </div>
  <script>
    function send(payload) {
      var raw = JSON.stringify(payload);
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(raw);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(raw, "*");
      }
    }
    var picked = ${initialPicked};
    var hasSaved = ${saved ? "true" : "false"};
    function setHint(text) { document.getElementById("hint").textContent = text || ""; }
    function setPicked(next) {
      picked = next;
      document.getElementById("addr").textContent = next ? next.label : "Search or use My location.";
      document.getElementById("ok").disabled = !next;
    }
    function showPoint(nextLat, nextLng, nextLabel, zoom) {
      document.getElementById("map").src = "https://maps.google.com/maps?q=" + nextLat + "," + nextLng + "&z=" + (zoom || 16) + "&output=embed";
      if (nextLabel) {
        setPicked({ label: nextLabel, lat: nextLat, lng: nextLng });
        document.getElementById("q").value = nextLabel;
        return;
      }
      fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" + nextLat + "&lon=" + nextLng, {
        headers: { "Accept": "application/json" }
      }).then(function(r){ return r.json(); }).then(function(data) {
        var formatted = (data && data.display_name) ? data.display_name : nextLat.toFixed(5) + ", " + nextLng.toFixed(5);
        setPicked({ label: formatted, lat: nextLat, lng: nextLng });
        document.getElementById("q").value = formatted;
      }).catch(function() {
        setPicked({ label: nextLat.toFixed(5) + ", " + nextLng.toFixed(5), lat: nextLat, lng: nextLng });
      });
    }
    function onLocationDenied() {
      setPicked(null);
      setHint("Location permission denied. Search for your place.");
      document.getElementById("map").src = "${embedSrc(FALLBACK_LAT, FALLBACK_LNG, 5)}";
      try { document.getElementById("q").focus(); } catch (_e) {}
    }
    function requestDeviceLocation() {
      if (!navigator.geolocation) { onLocationDenied(); return; }
      setHint("Finding your current location…");
      navigator.geolocation.getCurrentPosition(function(pos) {
        setHint("");
        showPoint(pos.coords.latitude, pos.coords.longitude);
      }, function() { onLocationDenied(); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    }
    function searchPlace() {
      var q = String(document.getElementById("q").value || "").trim();
      if (!q) return;
      fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(q), {
        headers: { "Accept": "application/json" }
      }).then(function(r){ return r.json(); }).then(function(rows) {
        if (!rows || !rows[0]) { setHint("No matching place found."); return; }
        setHint("");
        showPoint(Number(rows[0].lat), Number(rows[0].lon), rows[0].display_name);
      }).catch(function() { setHint("Search failed. Try another place name."); });
    }
    document.getElementById("ok").onclick = function() {
      if (picked) send({ t: "ok", label: picked.label, lat: picked.lat, lng: picked.lng });
    };
    document.getElementById("go").onclick = searchPlace;
    document.getElementById("q").addEventListener("keydown", function(e) {
      if (e.key === "Enter") { e.preventDefault(); searchPlace(); }
    });
    document.getElementById("me").onclick = requestDeviceLocation;
    if (hasSaved) setPicked(picked);
    else requestDeviceLocation();
  </script>
</body>
</html>`;
}

const MAPS_WEBVIEW_ORIGINS = ["https://www.cropvibe.com/", "https://cropvibe.com/"];

export function LocationMapPicker({ open, apiKey, label, lat, lng, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const saved = hasSavedMapCoords(lat, lng);
  const [androidGeoReady, setAndroidGeoReady] = useState(saved || Platform.OS !== "android");
  const [configReady, setConfigReady] = useState(false);
  const [resolvedKey, setResolvedKey] = useState("");
  const [originIndex, setOriginIndex] = useState(0);
  const [useEmbed, setUseEmbed] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfigReady(false);
      setResolvedKey("");
      setOriginIndex(0);
      setUseEmbed(false);
      setAndroidGeoReady(hasSavedMapCoords(lat, lng) || Platform.OS !== "android");
      return;
    }
    let active = true;
    void fetchMapsConfig(token)
      .then((config) => {
        if (!active) return;
        const key = String(config.key || apiKey || "").trim();
        setResolvedKey(key);
        setUseEmbed(!key);
        setConfigReady(true);
      })
      .catch(() => {
        if (!active) return;
        const key = String(apiKey || "").trim();
        setResolvedKey(key);
        setUseEmbed(!key);
        setConfigReady(true);
      });
    if (hasSavedMapCoords(lat, lng) || Platform.OS !== "android") {
      setAndroidGeoReady(true);
    } else {
      setAndroidGeoReady(false);
      void PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).finally(() => {
        if (active) setAndroidGeoReady(true);
      });
    }
    return () => {
      active = false;
    };
  }, [open, token, apiKey, lat, lng]);

  const html = useMemo(() => {
    if (useEmbed || !resolvedKey) return buildEmbedPickerHtml(label, lat, lng);
    return buildPickerHtml(resolvedKey, label, lat, lng);
  }, [useEmbed, resolvedKey, label, lat, lng]);

  const baseUrl = MAPS_WEBVIEW_ORIGINS[Math.min(originIndex, MAPS_WEBVIEW_ORIGINS.length - 1)];

  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const onMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.t === "maps-error") {
          if (originIndex < MAPS_WEBVIEW_ORIGINS.length - 1) {
            setOriginIndex((i) => i + 1);
            return;
          }
          setUseEmbed(true);
          return;
        }
        if (data?.t === "ok" && typeof data.label === "string") {
          onSelect({ label: data.label, lat: Number(data.lat), lng: Number(data.lng) });
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, onSelect, originIndex]);

  const onWebViewMessage = (raw: string) => {
    try {
      const data = JSON.parse(raw) as { t?: string; label?: string; lat?: number; lng?: number };
      if (data?.t === "maps-error") {
        if (originIndex < MAPS_WEBVIEW_ORIGINS.length - 1) {
          setOriginIndex((i) => i + 1);
          return;
        }
        setUseEmbed(true);
        return;
      }
      if (data?.t === "ok" && data.label && Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lng))) {
        onSelect({ label: data.label, lat: Number(data.lat), lng: Number(data.lng) });
      }
    } catch {
      // ignore
    }
  };

  const showMap = configReady && androidGeoReady;

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.head}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.headBtn}>
            <Ionicons name="close" size={24} color={APP_TEXT} />
          </Pressable>
          <Text style={styles.title}>Select location</Text>
          <View style={styles.headBtn} />
        </View>
        {!showMap ? (
          <View style={styles.fallback}>
            <Text style={styles.fallbackBody}>Loading Google Maps…</Text>
          </View>
        ) : Platform.OS === "web" ? (
          React.createElement("iframe", {
            title: "Map location picker",
            srcDoc: html,
            style: { flex: 1, width: "100%", border: "none", backgroundColor: APP_BLACK }
          })
        ) : (
          <WebView
            key={`${useEmbed ? "embed" : "js"}-${originIndex}-${resolvedKey ? "k" : "n"}`}
            source={{ html, baseUrl }}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            geolocationEnabled
            mixedContentMode="always"
            thirdPartyCookiesEnabled
            cacheEnabled={false}
            setSupportMultipleWindows={false}
            userAgent="Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36"
            onMessage={(e) => onWebViewMessage(e.nativeEvent.data)}
            style={styles.flex}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: APP_BLACK },
  flex: { flex: 1, backgroundColor: APP_BLACK },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  headBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: APP_TEXT, fontSize: 16, fontWeight: "800" },
  fallback: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  fallbackBody: { color: "#c4c4c4", fontSize: 14, lineHeight: 20, textAlign: "center" }
});
