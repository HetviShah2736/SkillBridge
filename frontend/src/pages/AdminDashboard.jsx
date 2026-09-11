import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  Users, UserPlus, LogIn, Eye, Activity, Globe, TrendingUp, Shield, RefreshCw,
} from "lucide-react";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar,
} from "recharts";

const StatCard = ({ icon: Icon, label, value, sub, color = "text-indigo-400", testId }) => (
  <div data-testid={testId} className="glass rounded-xl p-5">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-lg bg-slate-800/60 flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <div className="text-3xl font-bold text-slate-50" style={{ fontFamily: "Outfit" }}>{value}</div>
    <div className="text-xs text-slate-400 uppercase tracking-wider mt-1 font-mono">{label}</div>
    {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
  </div>
);

const SectionCard = ({ title, subtitle, children, right, testId }) => (
  <div data-testid={testId} className="glass rounded-xl p-6">
    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
      <div>
        <div className="text-xs uppercase tracking-widest text-indigo-400 font-mono">// {title}</div>
        {subtitle && <div className="text-sm text-slate-400 mt-1">{subtitle}</div>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [topPages, setTopPages] = useState([]);
  const [sources, setSources] = useState([]);
  const [activity, setActivity] = useState([]);
  const [users, setUsers] = useState([]);
  const [rangeDays, setRangeDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = async (days = rangeDays) => {
    setRefreshing(true);
    try {
      const [o, ts, tp, src, act, us] = await Promise.all([
        api.get("/admin/overview"),
        api.get(`/admin/timeseries?days=${days}`),
        api.get("/admin/top-pages?days=30"),
        api.get("/admin/traffic-sources?days=30"),
        api.get("/admin/recent-activity?limit=50"),
        api.get("/admin/users"),
      ]);
      setOverview(o.data);
      setTimeseries(ts.data);
      setTopPages(tp.data);
      setSources(src.data);
      setActivity(act.data);
      setUsers(us.data);
    } catch (e) {
      // 403 handled by guard
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (!loading) loadAll(rangeDays); /* eslint-disable-next-line */ }, [rangeDays]);

  if (loading) return <div className="p-12 text-slate-400 font-mono text-sm">Loading admin analytics...</div>;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-indigo-400 font-mono mb-2 flex items-center gap-2">
            <Shield className="w-3 h-3" /> // Admin Analytics
          </div>
          <h1 className="text-4xl font-bold text-slate-50" style={{ fontFamily: "Outfit" }}>
            Site Intelligence
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Internal metrics · Do not share externally</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            data-testid="range-select"
            value={rangeDays}
            onChange={(e) => setRangeDays(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            data-testid="refresh-btn"
            onClick={() => loadAll()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:border-indigo-500/50 text-slate-300 text-sm transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Top row stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatCard testId="stat-total-users" icon={Users} label="Total Users" value={overview?.total_users ?? 0} />
        <StatCard testId="stat-dau" icon={Activity} label="DAU" value={overview?.dau ?? 0} sub="Active in last 24h" color="text-emerald-400" />
        <StatCard testId="stat-wau" icon={Activity} label="WAU" value={overview?.wau ?? 0} sub="Active in last 7d" color="text-cyan-400" />
        <StatCard testId="stat-mau" icon={Activity} label="MAU" value={overview?.mau ?? 0} sub="Active in last 30d" color="text-indigo-400" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard testId="stat-unique" icon={Eye} label="Unique Visitors 24h" value={overview?.unique_visitors_24h ?? 0} color="text-amber-400" />
        <StatCard testId="stat-pageviews" icon={TrendingUp} label="Page views 24h" value={overview?.pageviews_24h ?? 0} sub={`${overview?.pageviews_7d ?? 0} last 7d`} color="text-cyan-400" />
        <StatCard testId="stat-signups" icon={UserPlus} label="New signups 24h" value={overview?.signups_24h ?? 0} sub={`${overview?.signups_7d ?? 0} last 7d`} color="text-emerald-400" />
        <StatCard testId="stat-logins" icon={LogIn} label="Logins 24h" value={overview?.logins_24h ?? 0} sub={`${overview?.logins_7d ?? 0} last 7d`} color="text-rose-400" />
      </div>

      {/* Timeseries chart */}
      <div className="mb-6">
        <SectionCard title="Activity Timeline" subtitle={`Last ${rangeDays} days`} testId="section-timeline">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeseries} margin={{ top: 5, right: 15, left: -5, bottom: 5 }}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, color: "#e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                <Line type="monotone" dataKey="pageviews" stroke="#06b6d4" strokeWidth={2} dot={false} name="Page views" />
                <Line type="monotone" dataKey="active_users" stroke="#6366f1" strokeWidth={2} dot={false} name="Active users" />
                <Line type="monotone" dataKey="signups" stroke="#10b981" strokeWidth={2} dot={false} name="Signups" />
                <Line type="monotone" dataKey="logins" stroke="#f59e0b" strokeWidth={2} dot={false} name="Logins" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Two-column: Top pages + Traffic sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <SectionCard title="Top Pages" subtitle="By page views (last 30d)" testId="section-top-pages">
          {topPages.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center">No page views yet</div>
          ) : (
            <div className="space-y-2">
              {topPages.map((p, i) => {
                const max = topPages[0]?.views || 1;
                const pct = (p.views / max) * 100;
                return (
                  <div key={i} data-testid={`top-page-${i}`} className="text-sm">
                    <div className="flex justify-between items-baseline mb-1">
                      <div className="font-mono text-slate-200 truncate mr-2">{p.path || "/"}</div>
                      <div className="text-xs text-slate-500 shrink-0">
                        <span className="text-slate-300">{p.views}</span> views · {p.unique_sessions} sessions
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Traffic Sources" subtitle="Where visitors come from (last 30d)" testId="section-sources">
          {sources.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center">No traffic data yet</div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sources.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 15, left: 60, bottom: 5 }}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="source" tick={{ fill: "#cbd5e1", fontSize: 11 }} width={110} />
                  <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, color: "#e2e8f0" }} />
                  <Bar dataKey="views" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Two-column: Users + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Registered Users" subtitle={`${users.length} total`} testId="section-users">
          <div className="max-h-[420px] overflow-y-auto -mx-2">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500 font-mono">
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-2">Email</th>
                  <th className="text-right py-2 px-2">Signed up</th>
                  <th className="text-right py-2 px-2">Last active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} data-testid={`user-row-${u.email}`} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                    <td className="py-2 px-2">
                      <div className="text-slate-100 truncate max-w-[220px]" title={u.email}>
                        {u.email}
                        {u.is_admin && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase">Admin</span>}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{u.full_name}</div>
                    </td>
                    <td className="py-2 px-2 text-right text-xs text-slate-400 font-mono">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 px-2 text-right text-xs text-slate-400 font-mono">
                      {u.last_active ? new Date(u.last_active).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-6 text-slate-500">No users yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Recent Activity" subtitle="Latest 50 events" testId="section-activity">
          <div className="max-h-[420px] overflow-y-auto space-y-1.5">
            {activity.map((e) => (
              <div key={e.id} data-testid={`activity-${e.id}`} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-800/40">
                <div className={`shrink-0 mt-1 w-2 h-2 rounded-full ${
                  e.type === "signup" ? "bg-emerald-400" :
                  e.type === "login" ? "bg-amber-400" :
                  e.type === "pageview" ? "bg-cyan-400" : "bg-slate-500"
                }`} />
                <div className="flex-1 min-w-0 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-slate-200 font-medium capitalize">{e.type}</span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {e.created_at ? new Date(e.created_at).toLocaleTimeString() : ""}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {e.user_email || "anonymous"}
                    {e.type === "pageview" && e.path ? <span className="ml-2 text-slate-500 font-mono">{e.path}</span> : null}
                  </div>
                </div>
              </div>
            ))}
            {activity.length === 0 && (
              <div className="text-center py-6 text-slate-500">No activity yet</div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
