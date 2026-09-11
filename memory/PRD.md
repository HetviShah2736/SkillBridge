# SkillBridge — Skill Gap Engine

## Problem Statement
A skill gap engine that bridges the skills you have with the skills you need. Includes user login, profile setup, target role selection, AI skill extraction, role requirements, gap analysis engine, results with radar visualization, personalized roadmap, and progress dashboard. Analysis buckets: strong, partial, and gap.

## User Choices
- Auth: JWT email/password
- Skill extraction: AI-powered from resume text paste + manual add
- AI model: Gemini 3 Flash (via Emergent Universal Key)
- Role requirements: Curated preset roles + AI-generated for custom roles
- Roadmap: Weekly plan with milestones + curated resource links
- Analysis: Strong / Partial / Gap categorization

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB) + JWT (pyjwt) + bcrypt + emergentintegrations (Gemini 3 Flash)
- **Frontend**: React 19 + React Router 7 + Tailwind + Shadcn/UI + Recharts + Sonner + Lucide
- **Storage**: MongoDB (users + analyses collections)

## Implemented (Feb 2026)
- JWT auth (register, login, /me) with bcrypt hashing + demo account button
- Curated role catalog (8 roles: FE, BE, Fullstack, Data Scientist, ML Eng, DevOps, PM, UI/UX)
- AI skill extraction from resume text (Gemini 3 Flash returning structured JSON)
- Gap analysis with token-overlap skill matching + readiness score
- Strong/Partial/Gap buckets (thresholds: ≥−5 strong, ≥−25 partial, else gap)
- 4-step wizard (role → resume → verify skills → run)
- Results page: radar chart (Recharts) + 3 bucket cards + readiness gauge
- AI-generated 6-week roadmap with tasks, resources (real URLs), milestones
- Roadmap task toggle with optimistic updates + progress tracking
- Dashboard with readiness gauge, stat cards, history, roadmap progress
- Dark tactical theme (slate/indigo/cyan, Outfit + Inter + JetBrains Mono)

## API Endpoints
- POST /api/auth/register, /api/auth/login, GET /api/auth/me
- GET /api/profile, PUT /api/profile
- GET /api/roles/curated
- POST /api/skills/extract
- POST /api/analysis/run, GET /api/analysis/latest, /api/analysis/list, /api/analysis/{id}
- POST /api/roadmap/generate/{analysis_id}, PATCH /api/roadmap/{analysis_id}/toggle
- GET /api/dashboard

## Backlog / Next
- P1: Multi-user comparison (peer benchmarking)
- P1: Export roadmap as PDF / calendar (.ics)
- P2: Streak tracking, weekly reminders
- P2: LinkedIn resume import
- P2: Google social login option
