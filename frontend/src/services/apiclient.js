import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:5000",
});

// Set token from localStorage immediately on module load
// (so it's available before any useEffect runs)
try {
  const stored = localStorage.getItem("auth");
  if (stored) {
    const { token } = JSON.parse(stored);
    if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }
} catch { /* ignore parse errors */ }

export const setAuthToken = (token) => {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
};
