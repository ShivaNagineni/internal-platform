import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { Routes, Route, Navigate } from "react-router-dom";
import { loginRequest } from "@/lib/msalConfig";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import LeavePage from "@/pages/Leave";
import IdeasPage from "@/pages/Ideas";
import ReleasesPage from "@/pages/Releases";

function LoginScreen() {
  const { instance } = useMsal();

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
            <p className="text-slate-500 mt-1 text-sm">Sign in with your Microsoft account to continue</p>
          </div>
          <button
            onClick={() => instance.loginPopup(loginRequest).catch(console.error)}
            className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl transition-colors duration-150 shadow-sm"
          >
            <svg viewBox="0 0 21 21" className="w-5 h-5" fill="currentColor">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            Sign in with Microsoft
          </button>
          <p className="text-xs text-slate-400">
            Powered by Azure Active Directory
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const isAuthenticated = useIsAuthenticated();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/leave" element={<LeavePage />} />
        <Route path="/ideas" element={<IdeasPage />} />
        <Route path="/releases" element={<ReleasesPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}
