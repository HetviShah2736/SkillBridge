import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { ArrowLeft, CheckCircle2, Circle, ExternalLink, BookOpen, PlayCircle, FileText, Wrench, Calendar, Printer, Mail, Loader2 } from "lucide-react";

const typeIcon = (t) => {
  const key = (t || "").toLowerCase();
  if (key.includes("video")) return PlayCircle;
  if (key.includes("course")) return BookOpen;
  if (key.includes("project")) return Wrench;
  return FileText;
};

export default function Roadmap() {
  const { analysisId } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailingIdx, setEmailingIdx] = useState(null);

  const load = () => {
    api.get(`/analysis/${analysisId}`)
      .then((r) => setAnalysis(r.data))
      .catch(() => toast.error("Not found"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [analysisId]);

  const emailWeek = async (wi) => {
    setEmailingIdx(wi);
    try {
      const { data } = await api.post(`/roadmap/${analysisId}/email-week`, { week_index: wi });
      toast.success(`Email sent to ${data.to}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Email failed");
    } finally {
      setEmailingIdx(null);
    }
  };

  const printRoadmap = () => {
    window.print();
  };

  const toggleTask = async (wi, ti, current) => {
    // Optimistic
    setAnalysis((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy.roadmap.weeks[wi].tasks[ti].completed = !current;
      return copy;
    });
    try {
      await api.patch(`/roadmap/${analysisId}/toggle`, {
        week_index: wi,
        task_index: ti,
        completed: !current,
      });
    } catch (e) {
      toast.error("Update failed");
      load();
    }
  };

  if (loading) return <div className="p-12 text-slate-400 font-mono text-sm">Loading roadmap...</div>;
  if (!analysis?.roadmap) {
    return (
      <div className="p-12 text-center">
        <p className="text-slate-400 mb-4">No roadmap generated yet</p>
        <Link to={`/results/${analysisId}`} className="text-indigo-400 hover:text-indigo-300">Go generate it →</Link>
      </div>
    );
  }

  const weeks = analysis.roadmap.weeks;
  const totalTasks = weeks.reduce((a, w) => a + w.tasks.length, 0);
  const completed = weeks.reduce((a, w) => a + w.tasks.filter((t) => t.completed).length, 0);
  const pct = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto print-root">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 no-print">
        <Link data-testid="back-to-results" to={`/results/${analysisId}`} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
          <ArrowLeft className="w-4 h-4" /> Back to Results
        </Link>
        <div className="flex items-center gap-2">
          <button
            data-testid="print-roadmap-btn"
            onClick={printRoadmap}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-white text-sm transition-all"
          >
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
        </div>
      </div>

      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.25em] text-indigo-400 font-mono mb-2">// Personalized Roadmap</div>
        <h1 className="text-4xl font-bold text-slate-50" style={{ fontFamily: "Outfit" }}>
          6-Week Plan → {analysis.role_title}
        </h1>
      </div>

      {/* Progress overview */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-mono">Overall Progress</div>
            <div data-testid="roadmap-progress" className="text-3xl font-bold text-slate-50 mt-1" style={{ fontFamily: "Outfit" }}>
              {pct}%
            </div>
          </div>
          <div className="text-right text-sm text-slate-400 font-mono">
            {completed} / {totalTasks} tasks
          </div>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Weeks timeline */}
      <div className="space-y-4">
        {weeks.map((w, wi) => {
          const weekDone = w.tasks.filter((t) => t.completed).length;
          const weekPct = w.tasks.length ? Math.round((weekDone / w.tasks.length) * 100) : 0;
          return (
            <div key={wi} data-testid={`week-card-${wi}`} className="glass rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-800/60">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-indigo-400 font-mono">Week {w.week}</div>
                      <div className="text-lg font-semibold text-slate-100" style={{ fontFamily: "Outfit" }}>{w.theme}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 font-mono">{weekDone}/{w.tasks.length}</div>
                    <div className="w-24 h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${weekPct}%` }} />
                    </div>
                    <button
                      data-testid={`email-week-${wi}`}
                      onClick={() => emailWeek(wi)}
                      disabled={emailingIdx === wi}
                      className="mt-2 no-print inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border border-slate-700 hover:border-cyan-500/50 hover:text-cyan-300 text-slate-400 transition-all disabled:opacity-60"
                    >
                      {emailingIdx === wi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                      Email me this week
                    </button>
                  </div>
                </div>

                {w.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {w.skills.map((s, i) => (
                      <span key={i} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {w.milestone && (
                  <div className="mt-3 text-sm text-slate-400">
                    <span className="text-slate-500 font-mono text-xs uppercase tracking-wider mr-2">Milestone:</span>
                    {w.milestone}
                  </div>
                )}
              </div>

              <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tasks */}
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500 font-mono mb-3">Tasks</div>
                  <div className="space-y-2">
                    {w.tasks.map((t, ti) => (
                      <button
                        key={ti}
                        data-testid={`task-${wi}-${ti}`}
                        onClick={() => toggleTask(wi, ti, t.completed)}
                        className="w-full text-left flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800/40 border border-transparent hover:border-slate-700 transition-all"
                      >
                        {t.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${t.completed ? "text-slate-500 line-through" : "text-slate-200"}`}>
                            {t.title}
                          </div>
                          {t.description && (
                            <div className={`text-xs mt-1 ${t.completed ? "text-slate-600" : "text-slate-400"}`}>
                              {t.description}
                            </div>
                          )}
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono mt-1">
                            ~{t.hours}h
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resources */}
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500 font-mono mb-3">Resources</div>
                  <div className="space-y-2">
                    {w.resources.map((r, ri) => {
                      const Icon = typeIcon(r.type);
                      return (
                        <a
                          key={ri}
                          data-testid={`resource-${wi}-${ri}`}
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-800 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-cyan-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-200 group-hover:text-white font-medium">{r.title}</div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono mt-0.5">{r.type}</div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 shrink-0 mt-1" />
                        </a>
                      );
                    })}
                    {w.resources.length === 0 && <div className="text-sm text-slate-500">No resources</div>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
