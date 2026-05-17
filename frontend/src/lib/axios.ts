import axios from "axios";
import { msalInstance } from "@/lib/msalInstance";
import { tokenRequest } from "@/lib/msalConfig";
import { getZohoToken, clearZohoSession } from "@/lib/zohoAuth";

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
      return config;
    }
  } catch {
    // Silent token acquisition failed
  }

  // Fall back to Zoho JWT if the user logged in via Zoho
  const zohoToken = getZohoToken();
  if (zohoToken) {
    config.headers.Authorization = `Bearer ${zohoToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const zohoToken = getZohoToken();
      if (zohoToken) {
        clearZohoSession();
        window.location.href = "/";
      } else {
        msalInstance.loginPopup().catch(console.error);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
