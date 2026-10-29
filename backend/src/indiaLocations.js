const states = require("./data/indiaStatesDistricts.json");
const citiesByState = require("./data/indiaStateCities.json");

function cleanCity(value) {
  return String(value || "").replace(/\*+$/g, "").trim();
}

function listStates() {
  return states
    .map((state) => ({ code: state.code, name: state.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function findState(stateName) {
  const key = String(stateName || "").trim().toLowerCase();
  if (!key) return null;
  return states.find((state) => state.name.toLowerCase() === key || state.code.toLowerCase() === key) || null;
}

function listDistricts(stateName) {
  const state = findState(stateName);
  if (!state) return [];
  return state.districts.map((district) => district.name).sort((a, b) => a.localeCompare(b));
}

function listCities(stateName, districtName) {
  const state = findState(stateName);
  const stateLabel = state?.name || String(stateName || "").trim();
  const cityKey = Object.keys(citiesByState).find((name) => name.toLowerCase() === stateLabel.toLowerCase());
  const cities = cityKey ? citiesByState[cityKey].map(cleanCity).filter(Boolean) : [];
  const district = String(districtName || "").trim();
  const unique = [...new Set(cities)];
  if (district && !unique.some((city) => city.toLowerCase() === district.toLowerCase())) {
    unique.unshift(district);
  }
  return unique.sort((a, b) => a.localeCompare(b));
}

module.exports = { listStates, listDistricts, listCities };
