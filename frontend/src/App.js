import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useAnalytics } from "@/lib/analytics";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import Wizard from "@/pages/Wizard";
import Results from "@/pages/Results";
import Roadmap from "@/pages/Roadmap";
import AdminDashboard from "@/pages/AdminDashboard";
import AppShell from "@/components/AppShell";
import "@/App.css";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F17]">
        <div className="text-slate-400 font-mono text-sm">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <AppShell>{children}</AppShell>;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.is_admin) return <Navigate to="/dashboard" replace />;
  return <AppShell>{children}</AppShell>;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function AnalyticsBridge() {
  useAnalytics();
  return null;
}

function App() {
  return (
    <div className="App min-h-screen bg-[#0B0F17]">
      <AuthProvider>
        <BrowserRouter>
          <AnalyticsBridge />
          <Toaster theme="dark" position="top-right" richColors />
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<PublicOnly><AuthPage /></PublicOnly>} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/wizard" element={<Protected><Wizard /></Protected>} />
            <Route path="/results/:analysisId" element={<Protected><Results /></Protected>} />
            <Route path="/roadmap/:analysisId" element={<Protected><Roadmap /></Protected>} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
