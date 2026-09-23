import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_BLACK, APP_TEXT } from "../theme/appColors";

export type PickedMapLocation = {
  label: string;
  lat: number;
  lng: number;
};

type Props = {
  open: boolean;
  apiKey: string;
  label: string;
  lat?: number | null;
  lng?: number | null;
  onClose: () => void;
  onSelect: (value: PickedMapLocation) => void;
};

function buildPickerHtml(apiKey: string, label: string, lat?: number | null, lng?: number | null) {
  const startLat = Number.isFinite(Number(lat)) ? Number(lat) : 20.5937;
  const startLng = Number.isFinite(Number(lng)) ? Number(lng) : 78.9629;
  const startZoom = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? 16 : 5;
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
    #me{border:1px solid #3a3a3a;background:transparent;color:#fff;border-radius:10px;padding:10px;font-weight:700}
    #map{flex:1;min-height:240px}
    .bar{padding:10px 12px 16px}
    #addr{margin:0 0 10px;font-size:13px;color:#c4c4c4}
    #ok{width:100%;border:none;background:#c9ff35;color:#111;font-weight:800;border-radius:12px;padding:12px;font-size:15px}
    #ok:disabled{opacity:.45}
    .pac-container{z-index:10000}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="search">
      <input id="q" placeholder="Search Google Maps" value=${JSON.stringify(label)} autocomplete="off"/>
      <button id="me" type="button">My location</button>
    </div>
    <div id="map"></div>
    <div class="bar">
      <p id="addr">${label.replace(/[<>&]/g, "") || "Search, tap the map, or drag the pin."}</p>
      <button id="ok" type="button" disabled>Use this location</button>
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
    var picked = ${
      Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
        ? JSON.stringify({ label: label || `${startLat}, ${startLng}`, lat: startLat, lng: startLng })
        : "null"
    };
    function setPicked(next) {
      picked = next;
      var addr = document.getElementById("addr");
      var ok = document.getElementById("ok");
      addr.textContent = next ? next.label : "Search, tap the map, or drag the pin.";
      ok.disabled = !next;
    }
    function init() {
      var maps = window.google.maps;
      var start = { lat: ${startLat}, lng: ${startLng} };
      var map = new maps.Map(document.getElementById("map"), {
        center: start,
        zoom: ${startZoom},
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
      var marker = new maps.Marker({ map: map, position: start, draggable: true });
      var geocoder = new maps.Geocoder();
      function applyPoint(nextLat, nextLng, nextLabel) {
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
      map.addListener("click", function(e) {
        if (!e.latLng) return;
        applyPoint(e.latLng.lat(), e.latLng.lng());
      });
      marker.addListener("dragend", function() {
        var p = marker.getPosition();
        if (!p) return;
        applyPoint(p.lat(), p.lng());
      });
      var autocomplete = new maps.places.Autocomplete(document.getElementById("q"), {
        fields: ["formatted_address", "geometry", "name"]
      });
      autocomplete.addListener("place_changed", function() {
        var place = autocomplete.getPlace();
        if (!place || !place.geometry || !place.geometry.location) return;
        var loc = place.geometry.location;
        applyPoint(loc.lat(), loc.lng(), place.formatted_address || place.name);
      });
      document.getElementById("me").onclick = function() {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(function(pos) {
          applyPoint(pos.coords.latitude, pos.coords.longitude);
        });
      };
      document.getElementById("ok").onclick = function() {
        if (picked) send({ t: "ok", ...picked });
      };
      if (picked) setPicked(picked);
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=init" async></script>
</body>
</html>`;
}

export function LocationMapPicker({ open, apiKey, label, lat, lng, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const html = useMemo(() => buildPickerHtml(apiKey, label, lat, lng), [apiKey, label, lat, lng]);

  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const onMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.t === "ok" && typeof data.label === "string") {
          onSelect({ label: data.label, lat: Number(data.lat), lng: Number(data.lng) });
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, onSelect]);

  const onWebViewMessage = (raw: string) => {
    try {
      const data = JSON.parse(raw) as { t?: string; label?: string; lat?: number; lng?: number };
      if (data?.t === "ok" && data.label && Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lng))) {
        onSelect({ label: data.label, lat: Number(data.lat), lng: Number(data.lng) });
      }
    } catch {
      // ignore
    }
  };

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
        {Platform.OS === "web"
          ? React.createElement("iframe", {
              title: "Google Maps location picker",
              srcDoc: html,
              style: { flex: 1, width: "100%", border: "none", backgroundColor: APP_BLACK }
            })
          : (
          <WebView
            source={{ html, baseUrl: "https://www.cropvibe.com" }}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            geolocationEnabled
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
  title: { color: APP_TEXT, fontSize: 16, fontWeight: "800" }
});
