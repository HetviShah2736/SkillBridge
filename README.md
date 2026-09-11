# Here are your Instructions
# SkillBridge AI

### Know Your Gap. Build Your Future.

> **The AI-powered skill gap engine that bridges the skills you have with the skills you need.**

SkillBridge AI is a full-stack AI-powered career readiness platform that helps students and professionals understand exactly what skills they need for their target career.

Instead of simply recommending courses, SkillBridge analyzes your existing skills against the requirements of a target role, identifies your **Strong, Partial, and Gap** areas, calculates a readiness score, and generates a personalized learning roadmap to help you become job-ready.

---

## 🚀 Why SkillBridge AI?

Students and professionals often face a common problem:

> **"I want this job, but I don't know exactly what I'm missing."**

There are thousands of courses, tutorials, certifications, and resources available online. The real challenge is knowing:

- What skills do I already have?
- What skills does my target role require?
- Where is my actual skill gap?
- What should I learn first?
- Which resources should I use?
- How do I track my progress?

**SkillBridge AI turns these questions into an actionable plan.**

---

## ✨ Features

### 🤖 AI Skill Extraction

Upload or paste your resume and SkillBridge AI uses **Gemini 3 Flash** to extract and categorize your technical skills.

Supported resume formats:

- PDF
- DOCX
- TXT

Users can review and manually adjust extracted skills before analysis.

---

### 🎯 Target Role Analysis

Choose from curated career roles or enter a custom target role.

Currently supported curated roles include:

- Frontend Engineer
- Backend Engineer
- Fullstack Engineer
- Data Scientist
- ML Engineer
- DevOps Engineer
- Product Manager
- UI/UX Designer

Custom roles can also be analyzed using AI-generated skill requirements.

---

### 📊 Skill Gap Analysis

SkillBridge compares your current proficiency with the skills required for your target role.

Every skill is categorized into:

🟢 **Strong** — You meet or exceed the required level.

🟡 **Partial** — You are close but need improvement.

🔴 **Gap** — Significant learning is required.

---

### 📈 Job Readiness Score

The platform calculates an overall readiness score based on your current proficiency across the required skills.

The score provides a quick overview of how closely your current skill profile matches your target role.

---

### 🕸️ Skill Radar Visualization

Interactive radar charts visualize:

- Required skill level
- Your current skill level

This makes it easy to identify the areas where improvement is most important.

---

### 🗺️ Personalized 6-Week Roadmap

After the gap analysis, SkillBridge AI generates a personalized six-week learning roadmap.

Each week contains:

- Learning theme
- Skills to focus on
- Tasks
- Estimated effort
- Milestone
- Curated learning resources

The roadmap is generated specifically around the user's identified skill gaps.

---

### ✅ Progress Tracking

Users can mark roadmap tasks as completed.

The dashboard automatically tracks:

- Completed tasks
- Total tasks
- Overall progress
- Roadmap completion percentage

---

### 📧 Weekly Learning Emails

Users can send their weekly roadmap tasks directly to their email.

Emails include:

- Weekly theme
- Tasks
- Milestone
- Learning resources

Powered by **Resend**.

---

### 📄 PDF Export

The roadmap can be printed or saved as a PDF using the browser's print functionality.

A dedicated print stylesheet provides a clean document suitable for saving and sharing.

---

### 🕘 Analysis History

Previous skill-gap analyses are stored and accessible from the dashboard.

Users can revisit their previous:

- Target roles
- Readiness scores
- Skill gaps
- Roadmaps
- Progress

---

## 🧠 How SkillBridge AI Works

```text
                    ┌───────────────────┐
                    │   Upload Resume   │
                    │    or Paste CV    │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  AI Skill         │
                    │  Extraction       │
                    │  Gemini 3 Flash   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  Verify & Edit    │
                    │  Your Skills      │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   Select Target   │
                    │       Role        │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   Skill Gap       │
                    │     Analysis      │
                    └─────────┬─────────┘
                              │
                  ┌───────────┼───────────┐
                  ▼           ▼           ▼
               STRONG      PARTIAL       GAP
                  │           │           │
                  └───────────┼───────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Readiness Score   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ AI 6-Week         │
                    │ Learning Roadmap  │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Track Progress &  │
                    │ Become Job-Ready  │
                    └───────────────────┘

SYSTEM ARCHITECTURE:
┌──────────────────────────────────────┐
│             React Frontend           │
│                                      │
│ React 19 · Tailwind · Shadcn/UI      │
│ Recharts · Axios · Framer Motion     │
└──────────────────┬───────────────────┘
                   │
                   │ REST API + JWT
                   ▼
┌──────────────────────────────────────┐
│            FastAPI Backend            │
│                                      │
│ Authentication · Skill Analysis     │
│ Resume Processing · Roadmaps         │
└───────────────┬───────────┬──────────┘
                │           │
       ┌────────▼──────┐    │
       │   MongoDB     │    │
       │               │    │
       │ users         │    │
       │ analyses      │    │
       └───────────────┘    │
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
       Gemini 3 Flash     Resend     Resume Parsers
          (AI)            (Email)     PDF / DOCX / TXT


Tech Stack
Frontend
React 19
React Router
Tailwind CSS
Shadcn/UI
Radix UI
Recharts
Framer Motion
Axios
React Query
Sonner
Lucide React
Backend
Python 3.11
FastAPI
Uvicorn
Motor
Pydantic
PyJWT
bcrypt
AI
Gemini 3 Flash
emergentintegrations
Database
MongoDB
Email
Resend
Resume Processing
pypdf
python-docx
