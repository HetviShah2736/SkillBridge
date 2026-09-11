import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { ArrowLeft, ArrowRight, Sparkles, Plus, X, Loader2, Check } from "lucide-react";

const steps = [
  { key: "role", label: "Target Role" },
  { key: "resume", label: "Your Experience" },
  { key: "skills", label: "Verify Skills" },
  { key: "run", label: "Run Analysis" },
];

const DEMO_RESUMES = [
  {
    label: "Frontend Dev → Fullstack",
    text: "3 years as a Frontend Developer at a startup. Strong React and JavaScript experience, built dashboards with TypeScript, Tailwind CSS, Redux. Familiar with HTML/CSS, Git, basic Node.js and REST APIs. Little backend experience. Some Jest unit tests. Deployed via Netlify.",
    role: "Fullstack Engineer",
  },
  {
    label: "Data Analyst → ML Engineer",
    text: "4 years as Data Analyst. Advanced SQL, Python (Pandas, NumPy), Tableau, and Excel. Built dashboards, A/B tests, statistical models. Basic exposure to scikit-learn and Jupyter. No production deployment or Docker.",
    role: "ML Engineer",
  },
  {
    label: "Backend → DevOps",
    text: "5 years Backend Engineer using Python and Django. Strong SQL, REST APIs, Docker basics, some AWS EC2 and S3. Bash scripting. Git experience. No Kubernetes, Terraform, or advanced CI/CD.",
    role: "DevOps Engineer",
  },
];

export default function Wizard() {
  const [step, setStep] = useState(0);
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [resume, setResume] = useState("");
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [running, setRunning] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/roles/curated").then((r) => setRoles(r.data));
  }, []);

  const targetRoleTitle = useCustom ? customRole.trim() : selectedRole;

  const extract = async () => {
    if (resume.trim().length < 30) {
      toast.error("Please paste more of your resume/experience");
      return;
    }
    setExtracting(true);
    try {
      const { data } = await api.post("/skills/extract", { resume_text: resume });
      setSkills(data.skills);
      toast.success(`Extracted ${data.skills.length} skills`);
      setStep(2);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const addSkill = () => {
    const n = newSkill.trim();
    if (!n) return;
    setSkills([...skills, { name: n, category: "Manual", proficiency: 50 }]);
    setNewSkill("");
  };

  const removeSkill = (idx) => setSkills(skills.filter((_, i) => i !== idx));

  const updateSkill = (idx, patch) => {
    setSkills(skills.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const runAnalysis = async () => {
    if (!targetRoleTitle) {
      toast.error("Select a target role");
      return;
    }
    if (skills.length === 0) {
      toast.error("Add at least one skill");
      return;
    }
    setRunning(true);
    try {
      const { data } = await api.post("/analysis/run", {
        role_title: targetRoleTitle,
        is_custom: useCustom,
        user_skills: skills,
      });
      toast.success("Analysis complete");
      navigate(`/results/${data.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Analysis failed");
    } finally {
      setRunning(false);
    }
  };

  const applyDemo = (d) => {
    setResume(d.text);
    setSelectedRole(d.role);
    setUseCustom(false);
    toast.success(`Loaded: ${d.label}`);
  };

  const canNext = () => {
    if (step === 0) return !!targetRoleTitle;
    if (step === 1) return resume.trim().length >= 30;
    if (step === 2) return skills.length > 0;
    return true;
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-indigo-400 font-mono mb-2">
          // Skill Engine Wizard
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-50" style={{ fontFamily: "Outfit" }}>
          Configure your analysis
        </h1>
      </div>

      {/* Stepper */}
      <div className="glass rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto">
          {steps.map((s, i) => (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-2 shrink-0 ${i === step ? "text-indigo-300" : i < step ? "text-emerald-400" : "text-slate-500"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs font-mono
                  ${i === step ? "border-indigo-400 bg-indigo-500/10" : i < step ? "border-emerald-500 bg-emerald-500/10" : "border-slate-700"}`}>
                  {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className="text-sm hidden md:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-px min-w-[16px] ${i < step ? "bg-emerald-600" : "bg-slate-800"}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="glass rounded-xl p-6 md:p-8 fade-up min-h-[400px]" key={step}>
        {step === 0 && (
          <div>
            <h2 className="text-xl font-semibold text-slate-100 mb-2" style={{ fontFamily: "Outfit" }}>What role are you targeting?</h2>
            <p className="text-slate-400 text-sm mb-6">Pick a curated role or enter a custom one — AI will generate requirements.</p>

            <div data-testid="curated-roles" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {roles.map((r) => (
                <button
                  key={r.title}
                  data-testid={`role-${r.title.replace(/\s+/g, "-").toLowerCase()}`}
                  onClick={() => { setSelectedRole(r.title); setUseCustom(false); }}
                  className={`text-left p-4 rounded-xl border transition-all
                    ${!useCustom && selectedRole === r.title
                      ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                      : "border-slate-800 hover:border-slate-700 bg-slate-900/40"}`}
                >
                  <div className="text-slate-100 font-medium">{r.title}</div>
                  <div className="text-xs text-slate-500 mt-1">{r.skills.length} core skills</div>
                </button>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-6">
              <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
                <input
                  data-testid="custom-role-toggle"
                  type="checkbox"
                  checked={useCustom}
                  onChange={(e) => setUseCustom(e.target.checked)}
                  className="accent-indigo-500"
                />
                Or use a custom role
              </label>
              {useCustom && (
                <input
                  data-testid="custom-role-input"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="e.g. Senior AI Product Manager"
                  className="w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold text-slate-100 mb-2" style={{ fontFamily: "Outfit" }}>Tell us about your experience</h2>
            <p className="text-slate-400 text-sm mb-6">Paste your resume, LinkedIn summary, or a short career overview.</p>

            <div className="mb-4 flex flex-wrap gap-2">
              {DEMO_RESUMES.map((d, i) => (
                <button
                  key={i}
                  data-testid={`demo-persona-${i}`}
                  onClick={() => applyDemo(d)}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-700 hover:border-indigo-500/60 hover:text-indigo-300 text-slate-400 transition-all"
                >
                  <Sparkles className="w-3 h-3 inline mr-1" /> {d.label}
                </button>
              ))}
            </div>

            <textarea
              data-testid="resume-textarea"
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              rows={12}
              placeholder="e.g. I'm a Frontend Developer with 3 years of experience building React apps using TypeScript, Redux, and Tailwind..."
              className="w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 resize-none font-mono text-sm leading-relaxed"
            />
            <div className="mt-2 flex justify-between text-xs font-mono text-slate-500">
              <span>{resume.length} characters</span>
              <span>{resume.trim().split(/\s+/).filter(Boolean).length} words</span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold text-slate-100 mb-2" style={{ fontFamily: "Outfit" }}>Verify your skills</h2>
            <p className="text-slate-400 text-sm mb-6">Adjust proficiency (0–100), remove wrong ones, or add missing skills.</p>

            <div data-testid="skills-list" className="space-y-3 mb-6 max-h-[420px] overflow-y-auto pr-2">
              {skills.map((s, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span data-testid={`skill-name-${idx}`} className="text-slate-100 font-medium truncate">{s.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-wider">{s.category}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        data-testid={`skill-slider-${idx}`}
                        type="range"
                        min={0}
                        max={100}
                        value={s.proficiency}
                        onChange={(e) => updateSkill(idx, { proficiency: parseInt(e.target.value) })}
                        className="flex-1 accent-indigo-500"
                      />
                      <span className="text-xs font-mono text-indigo-300 w-10 text-right">{s.proficiency}%</span>
                    </div>
                  </div>
                  <button
                    data-testid={`skill-remove-${idx}`}
                    onClick={() => removeSkill(idx)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                    aria-label="Remove skill"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {skills.length === 0 && <div className="text-sm text-slate-500 text-center py-8">No skills yet — add one below</div>}
            </div>

            <div className="flex gap-2">
              <input
                data-testid="skill-add-input"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                placeholder="Add a skill (e.g. Kubernetes)"
                className="flex-1 px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <button
                data-testid="skill-add-btn"
                onClick={addSkill}
                className="px-4 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium inline-flex items-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-100 mb-3" style={{ fontFamily: "Outfit" }}>Ready to bridge the gap</h2>
            <p className="text-slate-400 max-w-md mx-auto mb-6">
              Analyzing <span className="text-indigo-300 font-medium">{skills.length} skills</span> against the requirements
              for <span className="text-indigo-300 font-medium">{targetRoleTitle}</span>.
            </p>
            <button
              data-testid="run-analysis-btn"
              onClick={runAnalysis}
              disabled={running}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-medium shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-60"
            >
              {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Running Analysis...</> : <>Run Gap Analysis <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="mt-6 flex justify-between">
        <button
          data-testid="wizard-back-btn"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-800 text-slate-300 hover:border-slate-700 disabled:opacity-40 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {step === 1 ? (
          <button
            data-testid="extract-skills-btn"
            onClick={extract}
            disabled={extracting || resume.trim().length < 30}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium disabled:opacity-50 transition-all"
          >
            {extracting ? <><Loader2 className="w-4 h-4 animate-spin" /> Extracting...</> : <>Extract Skills <Sparkles className="w-4 h-4" /></>}
          </button>
        ) : step < 3 ? (
          <button
            data-testid="wizard-next-btn"
            onClick={() => setStep(step + 1)}
            disabled={!canNext()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium disabled:opacity-50 transition-all"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        ) : <div />}
      </div>
    </div>
  );
}
