import {
  isUsableLatLng,
  loadOpenMeteoWeather,
  searchOpenMeteoPlaces,
  type WeatherDay,
  type WeatherIconName,
  type WeatherPlace,
  type WeatherReport
} from "../utils/openMeteoWeather";

export type { WeatherDay, WeatherIconName, WeatherPlace, WeatherReport };
export { isUsableLatLng };

export async function fetchWeatherReport(
  _token: string | null,
  params?: { q?: string; lat?: number; lng?: number }
) {
  const hasCoords = isUsableLatLng(params?.lat, params?.lng);
  return loadOpenMeteoWeather({
    q: params?.q,
    lat: hasCoords ? params?.lat : undefined,
    lng: hasCoords ? params?.lng : undefined
  });
}

export async function searchWeatherPlaces(_token: string | null, query: string) {
  return searchOpenMeteoPlaces(query);
}
