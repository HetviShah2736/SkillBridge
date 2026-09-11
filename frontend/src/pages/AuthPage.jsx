import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Zap, Target, TrendingUp, Sparkles } from "lucide-react";

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
        toast.success("Welcome back");
      } else {
        await register(form.email, form.password, form.full_name);
        toast.success("Account created");
      }
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const useDemo = async () => {
    setLoading(true);
    const demoEmail = `demo_${Date.now()}@skillbridge.dev`;
    const demoPass = "demo1234";
    try {
      await register(demoEmail, demoPass, "Demo Explorer");
      toast.success("Demo account ready");
      navigate("/dashboard");
    } catch (err) {
      toast.error("Demo failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden ambient-glow grid-bg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="font-bold text-slate-100 text-xl" style={{ fontFamily: "Outfit" }}>
            SkillBridge
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="text-xs uppercase tracking-[0.25em] text-indigo-400 mb-4 font-mono">
            // Skill Gap Engine
          </div>
          <h1 className="text-5xl font-bold text-slate-50 leading-tight mb-6" style={{ fontFamily: "Outfit" }}>
            Bridge the gap<br />
            between where you are<br />
            and <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">where you're going</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed mb-8">
            AI-powered analysis maps your current skills against your target role. Get a
            personalized weekly roadmap with curated resources to close every gap.
          </p>

          <div className="grid gap-3">
            {[
              { icon: Target, text: "Precise gap analysis across 3 buckets" },
              { icon: TrendingUp, text: "Weekly milestones with curated resources" },
              { icon: Sparkles, text: "Powered by Gemini 3 Flash" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-slate-300">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <f.icon className="w-4 h-4 text-indigo-400" />
                </div>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-600 font-mono">
          v1.0 · Tactical Career Intelligence
        </div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-[#0B0F17]">
        <div className="w-full max-w-md fade-up">
          <div className="mb-8">
            <div className="text-xs uppercase tracking-[0.2em] text-indigo-400 font-mono mb-2">
              {mode === "login" ? "// Authenticate" : "// New Operator"}
            </div>
            <h2 className="text-3xl font-bold text-slate-50" style={{ fontFamily: "Outfit" }}>
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-slate-400 text-sm mt-2">
              {mode === "login" ? "Sign in to continue your career analysis" : "Start mapping your skill gaps today"}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Full name</label>
                <input
                  data-testid="auth-name-input"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  placeholder="Jane Doe"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Email</label>
              <input
                data-testid="auth-email-input"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
              <input
                data-testid="auth-password-input"
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                placeholder="Min 6 characters"
              />
            </div>

            <button
              data-testid="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-medium transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
            >
              {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-500 uppercase tracking-wider font-mono">or</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <button
            data-testid="auth-demo-btn"
            onClick={useDemo}
            disabled={loading}
            className="w-full py-3 rounded-lg border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-slate-300 font-medium transition-all"
          >
            Try instantly with demo account
          </button>

          <div className="mt-6 text-center text-sm text-slate-400">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              data-testid="auth-mode-toggle"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-indigo-400 hover:text-indigo-300 font-medium"
            >
              {mode === "login" ? "Register" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
