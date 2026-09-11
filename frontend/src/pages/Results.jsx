import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from "recharts";
import { CheckCircle2, AlertTriangle, XCircle, ArrowLeft, Sparkles, Loader2, Calendar } from "lucide-react";

const BucketCard = ({ title, items, color, icon: Icon, testId }) => (
  <div data-testid={testId} className={`rounded-xl border-l-4 bg-slate-900/60 border border-slate-800 p-5 ${color.border}`}>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${color.text}`} />
        <h3 className="font-semibold text-slate-100" style={{ fontFamily: "Outfit" }}>{title}</h3>
      </div>
      <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>{items.length}</span>
    </div>
    {items.length === 0 ? (
      <div className="text-sm text-slate-500 py-4">No skills in this bucket</div>
    ) : (
      <div className="space-y-2">
        {items.map((s, i) => (
          <div key={i} data-testid={`skill-item-${title.toLowerCase()}-${i}`} className="text-sm">
            <div className="flex items-center justify-between mb-1">
              <div className="text-slate-200 font-medium">{s.name}</div>
              <div className="text-xs text-slate-500 font-mono">
                <span className={color.text}>{s.current_level}</span>
                <span className="mx-1">/</span>
                <span>{s.required_level}</span>
              </div>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={color.fill}
                style={{ width: `${Math.min(100, (s.current_level / s.required_level) * 100)}%`, height: "100%" }}
              />
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default function Results() {
  const { analysisId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/analysis/${analysisId}`)
      .then((r) => setData(r.data))
      .catch(() => toast.error("Analysis not found"))
      .finally(() => setLoading(false));
  }, [analysisId]);

  const generateRoadmap = async () => {
    setGenerating(true);
    try {
      const { data: rd } = await api.post(`/roadmap/generate/${analysisId}`);
      toast.success("Roadmap generated");
      navigate(`/roadmap/${analysisId}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="p-12 text-slate-400 font-mono text-sm">Loading analysis...</div>;
  if (!data) return <div className="p-12 text-slate-400">Not found</div>;

  // Build radar data
  const radarData = data.required_skills.slice(0, 8).map((req) => {
    const all = [...data.strong, ...data.partial, ...data.gap];
    const found = all.find((s) => s.name === req.name);
    return {
      skill: req.name.length > 14 ? req.name.slice(0, 12) + "..." : req.name,
      required: req.required_level,
      current: found ? found.current_level : 0,
    };
  });

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <Link data-testid="back-to-dashboard" to="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-indigo-400 font-mono mb-2">// Gap Analysis Report</div>
          <h1 className="text-4xl font-bold text-slate-50" style={{ fontFamily: "Outfit" }}>{data.role_title}</h1>
          <p className="text-slate-400 mt-1 font-mono text-xs">
            {new Date(data.created_at).toLocaleString()}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-mono">Readiness</div>
          <div data-testid="results-readiness-score" className="text-5xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent" style={{ fontFamily: "Outfit" }}>
            {data.readiness_score}%
          </div>
        </div>
      </div>

      {/* Radar chart */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="text-xs uppercase tracking-widest text-slate-400 font-mono mb-4">// Skill Radar — Current vs Target</div>
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="skill" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#475569", fontSize: 10 }} />
              <Radar name="Required" dataKey="required" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
              <Radar name="Your Level" dataKey="current" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.35} strokeWidth={2} />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <BucketCard
          testId="bucket-strong"
          title="Strong"
          items={data.strong}
          icon={CheckCircle2}
          color={{
            border: "border-l-emerald-500",
            text: "text-emerald-400",
            bg: "bg-emerald-500/15",
            fill: "bg-emerald-500 h-full",
          }}
        />
        <BucketCard
          testId="bucket-partial"
          title="Partial"
          items={data.partial}
          icon={AlertTriangle}
          color={{
            border: "border-l-amber-500",
            text: "text-amber-400",
            bg: "bg-amber-500/15",
            fill: "bg-amber-500 h-full",
          }}
        />
        <BucketCard
          testId="bucket-gap"
          title="Gap"
          items={data.gap}
          icon={XCircle}
          color={{
            border: "border-l-rose-500",
            text: "text-rose-400",
            bg: "bg-rose-500/15",
            fill: "bg-rose-500 h-full",
          }}
        />
      </div>

      {/* CTA */}
      <div className="glass rounded-xl p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100" style={{ fontFamily: "Outfit" }}>Ready for your roadmap?</h3>
          <p className="text-sm text-slate-400 mt-1">Get a personalized 6-week upskilling plan with curated resources.</p>
        </div>
        {data.roadmap ? (
          <Link
            data-testid="view-roadmap-btn"
            to={`/roadmap/${analysisId}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 hover:opacity-90 text-white font-medium transition-all"
          >
            <Calendar className="w-4 h-4" /> View Roadmap
          </Link>
        ) : (
          <button
            data-testid="generate-roadmap-btn"
            onClick={generateRoadmap}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 hover:opacity-90 text-white font-medium disabled:opacity-60 transition-all"
          >
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Roadmap</>}
          </button>
        )}
      </div>
    </div>
  );
}
