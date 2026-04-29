const axios = require("axios");

const GOOGLE_MAPS_BASE_URL = "https://maps.googleapis.com/maps/api";

const getGoogleMapsKey = () => {
  return (
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_KEY ||
    null
  );
};

const ensureGoogleMapsKey = () => {
  const key = getGoogleMapsKey();
  if (!key) {
    const err = new Error(
      "Google Maps API key missing. Set GOOGLE_MAPS_SERVER_API_KEY or GOOGLE_MAPS_API_KEY",
    );
    err.statusCode = 500;
    throw err;
  }
  return key;
};

const getDirections = async ({
  originLatitude,
  originLongitude,
  destinationLatitude,
  destinationLongitude,
  mode = "driving",
}) => {
  const key = ensureGoogleMapsKey();

  const response = await axios.get(
    `${GOOGLE_MAPS_BASE_URL}/directions/json`,
    {
      params: {
        origin: `${originLatitude},${originLongitude}`,
        destination: `${destinationLatitude},${destinationLongitude}`,
        mode,
        key,
      },
      timeout: 10000,
    },
  );

  const payload = response.data || {};
  const firstRoute = Array.isArray(payload.routes) ? payload.routes[0] : null;
  const firstLeg = Array.isArray(firstRoute?.legs) ? firstRoute.legs[0] : null;

  return {
    status: payload.status || "UNKNOWN",
    errorMessage: payload.error_message || null,
    route: firstRoute,
    leg: firstLeg,
    distanceMeters: firstLeg?.distance?.value ?? null,
    durationSeconds: firstLeg?.duration?.value ?? null,
    distanceText: firstLeg?.distance?.text || null,
    durationText: firstLeg?.duration?.text || null,
    polyline: firstRoute?.overview_polyline?.points || null,
  };
};

const geocodeAddress = async (address) => {
  const key = ensureGoogleMapsKey();
  const response = await axios.get(`${GOOGLE_MAPS_BASE_URL}/geocode/json`, {
    params: { address, key },
    timeout: 10000,
  });

  const payload = response.data || {};
  const first = Array.isArray(payload.results) ? payload.results[0] : null;

  return {
    status: payload.status || "UNKNOWN",
    errorMessage: payload.error_message || null,
    result: first,
  };
};

const reverseGeocode = async (latitude, longitude) => {
  const key = ensureGoogleMapsKey();
  const response = await axios.get(`${GOOGLE_MAPS_BASE_URL}/geocode/json`, {
    params: { latlng: `${latitude},${longitude}`, key },
    timeout: 10000,
  });

  const payload = response.data || {};
  const first = Array.isArray(payload.results) ? payload.results[0] : null;

  return {
    status: payload.status || "UNKNOWN",
    errorMessage: payload.error_message || null,
    result: first,
  };
};

module.exports = {
  getGoogleMapsKey,
  ensureGoogleMapsKey,
  getDirections,
  geocodeAddress,
  reverseGeocode,
};
