import { useEffect, useRef, useState } from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { loginRequest } from "@/lib/msalConfig";
import { setZohoSession, isZohoAuthenticated, clearZohoSession } from "@/lib/zohoAuth";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import LeavePage from "@/pages/Leave";
import IdeasPage from "@/pages/Ideas";
import ReleasesPage from "@/pages/Releases";
import UsersPage from "@/pages/Users";

// ─── Zoho OAuth callback page ─────────────────────────────────────────────────

function ZohoCallback() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    const code = searchParams.get("code");
    if (!code) {
      setError("No authorization code received from Zoho.");
      return;
    }

    fetch("/api/auth/zoho/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Exchange failed");
        return r.json();
      })
      .then((data) => {
        setZohoSession(data.access_token, data.user);
        window.location.href = "/";
      })
      .catch(() => setError("Failed to sign in with Zoho. Please try again."));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-rose-600 font-medium">{error}</p>
          <a href="/" className="text-indigo-600 text-sm underline">Back to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-500 text-sm animate-pulse">Signing you in…</p>
    </div>
  );
}

// ─── Login screen ─────────────────────────────────────────────────────────────

function LoginScreen() {
  const { instance } = useMsal();
  const [zohoLoading, setZohoLoading] = useState(false);

  async function handleZohoLogin() {
    setZohoLoading(true);
    try {
      const res = await fetch("/api/auth/zoho");
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setZohoLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center space-y-6">
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">IP</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Internal Platform</h1>
            <p className="text-slate-500 mt-1 text-sm">Sign in to continue</p>
          </div>

          <div className="space-y-3">
            {/* Microsoft / Azure AD */}
            <button
              onClick={() => instance.loginPopup(loginRequest).catch(console.error)}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl transition-colors duration-150 shadow-sm"
            >
              <svg viewBox="0 0 21 21" className="w-5 h-5 flex-shrink-0" fill="currentColor">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              Sign in with Microsoft
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs text-slate-400">or</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            {/* Zoho */}
            <button
              onClick={handleZohoLogin}
              disabled={zohoLoading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-xl transition-colors duration-150 shadow-sm border border-slate-200 disabled:opacity-60"
            >
              <svg viewBox="0 0 40 40" className="w-5 h-5 flex-shrink-0" fill="none">
                <rect width="40" height="40" rx="8" fill="#E42527"/>
                <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="sans-serif">Z</text>
              </svg>
              {zohoLoading ? "Redirecting…" : "Sign in with Zoho"}
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Internal Platform · TekYantra
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const isMsalAuthenticated = useIsAuthenticated();
  const [zohoAuth, setZohoAuth] = useState(isZohoAuthenticated());

  // Keep zoho auth state in sync (e.g. after logout)
  useEffect(() => {
    const check = () => setZohoAuth(isZohoAuthenticated());
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);

  const isAuthenticated = isMsalAuthenticated || zohoAuth;

  return (
    <Routes>
      {/* Zoho OAuth callback — accessible before auth */}
      <Route path="/auth/zoho/callback" element={<ZohoCallback />} />

      {!isAuthenticated ? (
        <Route path="*" element={<LoginScreen />} />
      ) : (
        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/leave" element={<LeavePage />} />
                <Route path="/ideas" element={<IdeasPage />} />
                <Route path="/releases" element={<ReleasesPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Layout>
          }
        />
      )}
    </Routes>
  );
}
