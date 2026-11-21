import axios from "axios";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api";

// Remove /api to get the Laravel application URL.
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// Initialise Laravel Sanctum CSRF protection.
export const initializeCsrf = async () => {
  return axios.get(`${API_ORIGIN}/sanctum/csrf-cookie`, {
    withCredentials: true,
    withXSRFToken: true,
  });
};

export default api;