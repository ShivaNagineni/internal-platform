import axios from "axios";
import { msalInstance } from "@/lib/msalInstance";
import { tokenRequest } from "@/lib/msalConfig";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  try {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      const result = await msalInstance.acquireTokenSilent({
        ...tokenRequest,
        account: accounts[0],
      });
      config.headers.Authorization = `Bearer ${result.accessToken}`;
    }
  } catch {
    // Silent token acquisition failed; request proceeds without auth header
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      msalInstance.loginPopup().catch(console.error);
    }
    return Promise.reject(error);
  },
);

export default api;
