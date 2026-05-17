const ZOHO_TOKEN_KEY = "zoho_access_token";
const ZOHO_USER_KEY = "zoho_user";

export function getZohoToken(): string | null {
  return localStorage.getItem(ZOHO_TOKEN_KEY);
}

export function setZohoSession(token: string, user: object): void {
  localStorage.setItem(ZOHO_TOKEN_KEY, token);
  localStorage.setItem(ZOHO_USER_KEY, JSON.stringify(user));
}

export function clearZohoSession(): void {
  localStorage.removeItem(ZOHO_TOKEN_KEY);
  localStorage.removeItem(ZOHO_USER_KEY);
}

export function getZohoUser(): Record<string, string> | null {
  const raw = localStorage.getItem(ZOHO_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function isZohoAuthenticated(): boolean {
  return Boolean(getZohoToken());
}
