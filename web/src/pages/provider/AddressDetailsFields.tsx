import { useEffect, useState } from "react";
import { fetchLocationCities, fetchLocationDistricts, fetchLocationStates } from "../../api/providerKyc";

type Props = {
  address: string;
  stateName: string;
  district: string;
  city: string;
  pinCode: string;
  onChangeAddress: (value: string) => void;
  onChangeState: (value: string) => void;
  onChangeDistrict: (value: string) => void;
  onChangeCity: (value: string) => void;
  onChangePin: (value: string) => void;
};

export function AddressDetailsFields({
  address,
  stateName,
  district,
  city,
  pinCode,
  onChangeAddress,
  onChangeState,
  onChangeDistrict,
  onChangeCity,
  onChangePin
}: Props) {
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    fetchLocationStates()
      .then((result) => {
        if (active) setStates(result.states.map((item) => item.name));
      })
      .catch(() => {
        if (active) setLoadError("Could not load states.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!stateName) {
      setDistricts([]);
      return;
    }
    let active = true;
    fetchLocationDistricts(stateName)
      .then((result) => {
        if (active) setDistricts(result.districts);
      })
      .catch(() => {
        if (active) setLoadError("Could not load districts.");
      });
    return () => {
      active = false;
    };
  }, [stateName]);

  useEffect(() => {
    if (!stateName || !district) {
      setCities([]);
      return;
    }
    let active = true;
    fetchLocationCities(stateName, district)
      .then((result) => {
        if (active) setCities(result.cities);
      })
      .catch(() => {
        if (active) setLoadError("Could not load cities.");
      });
    return () => {
      active = false;
    };
  }, [stateName, district]);

  return (
    <div className="join-address">
      <h3 className="join-location">Address details</h3>
      <label className="join-label">
        Address
        <input className="join-input" placeholder="Enter address" value={address} onChange={(event) => onChangeAddress(event.target.value)} />
      </label>
      <label className="join-label">
        State
        <select
          className="join-input"
          value={stateName}
          onChange={(event) => {
            onChangeState(event.target.value);
            onChangeDistrict("");
            onChangeCity("");
          }}
        >
          <option value="">Select state</option>
          {states.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="join-label">
        District
        <select
          className="join-input"
          value={district}
          disabled={!stateName}
          onChange={(event) => {
            onChangeDistrict(event.target.value);
            onChangeCity("");
          }}
        >
          <option value="">Select district</option>
          {districts.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="join-label">
        City
        <select className="join-input" value={city} disabled={!district} onChange={(event) => onChangeCity(event.target.value)}>
          <option value="">Select city</option>
          {cities.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="join-label">
        PIN code
        <input
          className="join-input"
          placeholder="6-digit PIN code"
          inputMode="numeric"
          value={pinCode}
          onChange={(event) => onChangePin(event.target.value.replace(/\D/g, "").slice(0, 6))}
        />
      </label>
      {loadError ? <p className="join-error">{loadError}</p> : null}
    </div>
  );
}
