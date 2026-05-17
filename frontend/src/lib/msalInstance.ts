import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "@/lib/msalConfig";

export const msalInstance = new PublicClientApplication(msalConfig);
