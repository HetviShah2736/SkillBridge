import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Target, Map, LogOut, Zap } from "lucide-react";

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, id: "nav-dashboard" },
    { to: "/wizard", label: "New Analysis", icon: Target, id: "nav-wizard" },
  ];

  return (
    <div className="min-h-screen flex bg-[#0B0F17]">
      <aside className="w-64 border-r border-slate-800/60 bg-[#0F1420] hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-slate-100 text-lg leading-none" style={{ fontFamily: "Outfit" }}>
                SkillBridge
              </div>
              <div className="text-[10px] uppercase tracking-widest text-indigo-400 mt-1 font-mono">
                Gap Engine
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => {
            const Active = location.pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                data-testid={n.id}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${
                  Active
                    ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent"
                }`}
              >
                <n.icon className="w-4 h-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800/60">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
              {user?.full_name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div data-testid="user-name" className="text-sm text-slate-200 truncate">{user?.full_name}</div>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
            </div>
          </div>
          <button
            data-testid="logout-btn"
            onClick={() => { logout(); navigate("/auth"); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
