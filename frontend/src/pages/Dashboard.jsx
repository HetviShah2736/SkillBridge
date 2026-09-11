import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, Target, CheckCircle2, AlertTriangle, XCircle, TrendingUp, Plus, Calendar } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const StatCard = ({ icon: Icon, label, value, accent, testId }) => (
  <div data-testid={testId} className="glass rounded-xl p-5 hover:border-indigo-500/40 transition-all">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <div className="text-3xl font-bold text-slate-50" style={{ fontFamily: "Outfit" }}>{value}</div>
    <div className="text-xs text-slate-400 uppercase tracking-wider mt-1 font-mono">{label}</div>
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyses, setAnalyses] = useState([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get("/dashboard"), api.get("/analysis/list")])
      .then(([d, l]) => {
        setData(d.data);
        setAnalyses(l.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-12 text-slate-400 font-mono text-sm">Loading dashboard...</div>;
  }

  const hasAnalysis = data?.latest_analysis;
  const readiness = hasAnalysis?.readiness_score ?? 0;
  const gaugeData = [
    { name: "score", value: readiness },
    { name: "rest", value: 100 - readiness },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-indigo-400 font-mono mb-2">
            // Command Center
          </div>
          <h1 className="text-4xl font-bold text-slate-50" style={{ fontFamily: "Outfit" }}>
            Hey {user?.full_name?.split(" ")[0]}
          </h1>
          <p className="text-slate-400 mt-2">Your skill intelligence dashboard</p>
        </div>
        <Link
          data-testid="new-analysis-btn"
          to="/wizard"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-medium shadow-lg shadow-indigo-500/20 transition-all"
        >
          <Plus className="w-4 h-4" /> New Analysis
        </Link>
      </div>

      {!hasAnalysis ? (
        <div data-testid="empty-state" className="glass rounded-2xl p-12 text-center border-dashed">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-6">
            <Target className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-3" style={{ fontFamily: "Outfit" }}>
            Run your first skill analysis
          </h2>
          <p className="text-slate-400 max-w-md mx-auto mb-8">
            Paste your resume, pick a target role, and get an AI-powered gap analysis with a personalized 6-week roadmap.
          </p>
          <Link
            data-testid="start-first-analysis-btn"
            to="/wizard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-all"
          >
            Start Analysis <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <>
          {/* Top row: Readiness gauge + stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            <div data-testid="readiness-card" className="glass rounded-xl p-6 lg:row-span-2 flex flex-col">
              <div className="text-xs uppercase tracking-widest text-slate-400 font-mono mb-4">Readiness Score</div>
              <div className="text-sm text-slate-300 mb-4">Target: <span className="text-indigo-300 font-medium">{hasAnalysis.role_title}</span></div>
              <div className="relative flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={gaugeData} startAngle={180} endAngle={0} innerRadius={70} outerRadius={100} paddingAngle={0} dataKey="value" cy="80%" stroke="none">
                      <Cell fill="url(#readGrad)" />
                      <Cell fill="#1f2937" />
                    </Pie>
                    <defs>
                      <linearGradient id="readGrad" x1="0" x2="1">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-6">
                  <div data-testid="readiness-score" className="text-5xl font-bold text-slate-50" style={{ fontFamily: "Outfit" }}>
                    {readiness}%
                  </div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest font-mono mt-1">match</div>
                </div>
              </div>
              <Link
                data-testid="view-latest-btn"
                to={`/results/${hasAnalysis.id}`}
                className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 transition-all text-sm"
              >
                View Full Analysis <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <StatCard icon={CheckCircle2} label="Strong Skills" value={hasAnalysis.strong.length}
              accent="bg-emerald-500/15 text-emerald-400" testId="stat-strong" />
            <StatCard icon={AlertTriangle} label="Partial Skills" value={hasAnalysis.partial.length}
              accent="bg-amber-500/15 text-amber-400" testId="stat-partial" />
            <StatCard icon={XCircle} label="Skill Gaps" value={hasAnalysis.gap.length}
              accent="bg-rose-500/15 text-rose-400" testId="stat-gap" />
            <StatCard icon={TrendingUp} label="Progress" value={`${data.progress_pct}%`}
              accent="bg-indigo-500/15 text-indigo-400" testId="stat-progress" />
          </div>

          {/* Roadmap link */}
          {hasAnalysis.roadmap && (
            <div className="glass rounded-xl p-6 mb-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-indigo-400 font-mono mb-1">// Active Roadmap</div>
                  <h3 className="text-xl font-bold text-slate-100" style={{ fontFamily: "Outfit" }}>
                    6-Week Upskilling Plan
                  </h3>
                </div>
                <Link
                  data-testid="open-roadmap-btn"
                  to={`/roadmap/${hasAnalysis.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-white text-sm transition-all"
                >
                  <Calendar className="w-4 h-4" /> Open Roadmap
                </Link>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all"
                  style={{ width: `${data.progress_pct}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-slate-400 font-mono">
                {data.completed_tasks} / {data.total_tasks} tasks completed
              </div>
            </div>
          )}

          {/* History */}
          {analyses.length > 0 && (
            <div className="glass rounded-xl p-6">
              <div className="text-xs uppercase tracking-widest text-slate-400 font-mono mb-4">// Analysis History</div>
              <div className="space-y-2">
                {analyses.map((a) => (
                  <Link
                    key={a.id}
                    data-testid={`history-item-${a.id}`}
                    to={`/results/${a.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/40 border border-transparent hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="text-sm text-slate-200 font-medium">{a.role_title}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {new Date(a.created_at).toLocaleDateString()} · {a.readiness_score}% match
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
