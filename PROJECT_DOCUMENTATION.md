# SkillBridge — Complete Project Documentation

> **The Skill Gap Engine that bridges the skills you have with the skills you need.**

Version: 1.1 · Last updated: Feb 2026

---

## Table of Contents
1. [Overview](#1-overview)
2. [Feature List](#2-feature-list)
3. [Tech Stack](#3-tech-stack)
4. [System Architecture](#4-system-architecture)
5. [Project Structure](#5-project-structure)
6. [Environment Variables](#6-environment-variables)
7. [Backend API Reference](#7-backend-api-reference)
8. [Data Models (MongoDB)](#8-data-models-mongodb)
9. [Gap Analysis Algorithm](#9-gap-analysis-algorithm)
10. [Third-Party Integrations](#10-third-party-integrations)
11. [Frontend Application Flow](#11-frontend-application-flow)
12. [End-to-End Workflow](#12-end-to-end-workflow)
13. [Design System](#13-design-system)
14. [Local Development](#14-local-development)
15. [Deployment Notes](#15-deployment-notes)
16. [Publishing to GitHub](#16-publishing-to-github)

---

## 1. Overview

**SkillBridge** is a full-stack web app that helps professionals plan their next career step. A user pastes (or uploads) their resume, picks a target job role, and instantly gets:

- An **AI-extracted skill inventory** (via Gemini 3 Flash)
- A **gap analysis** comparing their skills to the role's requirements
- A visual **radar chart** and 3-bucket categorization: **Strong / Partial / Gap**
- A **personalized 6-week roadmap** with tasks, milestones, and curated learning resources
- **Progress tracking** with checkbox toggles that update a readiness score
- An option to **email themselves this week's tasks** and to **print/save the roadmap as PDF**

The app is designed as a "Precision Tactical Command Center" — dark UI, indigo/cyan accents, monospace tactical typography, data-dense but clean layout.

---

## 2. Feature List

| Area | Feature |
|---|---|
| **Auth** | Email/password registration, JWT login, instant demo account button |
| **Profile** | Persistent user profile with resume text, current role, years of experience, skill list |
| **Skill extraction** | LLM-powered parser (Gemini 3 Flash) that reads resume text and returns categorized skills with proficiency scores |
| **Resume upload** | Drop-zone accepting PDF, DOCX, or TXT (up to 5MB). Server-side parsing via `pypdf` and `python-docx` |
| **Target role** | 8 curated roles pre-loaded (FE, BE, Fullstack, Data Scientist, ML Engineer, DevOps, Product Manager, UI/UX). Custom roles trigger LLM-generated requirement list |
| **Gap analysis** | Token-overlap skill matcher + readiness score calculation. 3-bucket classification: Strong / Partial / Gap |
| **Results view** | Recharts radar (current vs required), readiness gauge, per-skill progress bars, bucket cards |
| **Roadmap** | 6-week AI-generated plan with tasks, milestones, and 2–4 curated resource links per week (articles, courses, projects, videos) |
| **Progress tracking** | Optimistic task toggle with persistence; overall progress % updates live in dashboard |
| **Weekly nudge email** | Per-week "Email me this week" button sends a styled HTML email via Resend |
| **PDF export** | Client-side `window.print()` with a dedicated print stylesheet — clean one-pager suitable for save-as-PDF |
| **Honesty guardrails** | Warning banners on resume input and skill verification steps to encourage truthful self-assessment |
| **Analysis history** | Unlimited past analyses stored per user with quick-open history list on the dashboard |

---

## 3. Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19.0 | UI framework |
| React Router | 7.15 | Client-side routing |
| Tailwind CSS | 3.4 | Utility-first styling |
| Shadcn/UI + Radix | Latest | Accessible primitives (dialog, tooltip, etc.) |
| Recharts | 3.6 | Radar chart & gauge visualization |
| Sonner | 2.0 | Toast notifications |
| Lucide React | 0.516 | Icon library |
| Framer Motion | 11.18 | Micro-animations |
| axios | 1.18 | HTTP client with JWT interceptor |
| React Query | 5.56 | (Available, currently used lightly) |

**Fonts**: Outfit (headings) · Inter (body) · JetBrains Mono (tactical accents)

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.11 | Runtime |
| FastAPI | 0.110 | Async web framework |
| Uvicorn | 0.25 | ASGI server |
| Motor | 3.3 | Async MongoDB driver |
| Pydantic v2 | 2.6+ | Request/response validation |
| pyjwt | 2.10+ | JWT signing |
| bcrypt | 4.1 | Password hashing |
| emergentintegrations | 0.2 | Unified LLM client (Gemini/OpenAI/Anthropic) |
| resend | 2.44+ | Transactional email |
| pypdf | 6.18+ | PDF text extraction |
| python-docx | 1.2+ | DOCX text extraction |

### Database
- **MongoDB** (Motor async driver). Two collections: `users` and `analyses`.

### Infrastructure
- Backend on port `8001` (internally). All routes prefixed with `/api`.
- Frontend on port `3000`.
- Kubernetes ingress routes `/api/*` → backend, everything else → frontend.
- Supervisor manages both processes with hot-reload.

---

## 4. System Architecture

```
┌──────────────────────────────┐        HTTPS         ┌────────────────────────┐
│      Browser (React 19)      │ ────────────────────>│  K8s Ingress           │
│  Tailwind · Shadcn · Recharts│                       │  /api/* → backend      │
│  Axios + JWT in localStorage │ <──────────────────── │  else   → frontend     │
└──────────────────────────────┘                       └────────┬───────────────┘
                                                                │
                          ┌─────────────────────────────────────┼─────────────────────────┐
                          │                                     │                         │
                          ▼                                     ▼                         ▼
                 ┌────────────────────┐              ┌─────────────────────┐    ┌──────────────────┐
                 │ FastAPI · Uvicorn  │ ── Motor ──> │      MongoDB        │    │  Emergent LLM    │
                 │  :8001 · /api      │              │  users · analyses   │    │  Gemini 3 Flash  │
                 └────────┬───────────┘              └─────────────────────┘    └──────────────────┘
                          │
                          ├──> pypdf / python-docx (resume parsing)
                          └──> Resend API (email)
```

**Request flow**:
1. Browser sends request to `<HOST>/api/<endpoint>` with `Authorization: Bearer <JWT>` header.
2. Ingress forwards to FastAPI on port 8001.
3. FastAPI validates JWT via `get_current_user` dependency → loads user from MongoDB.
4. Business logic runs — may call MongoDB, Gemini (via emergentintegrations), or Resend.
5. Response returned as JSON.

---

## 5. Project Structure

```
/app
├── backend/
│   ├── server.py              # Entire FastAPI app (~640 lines)
│   ├── requirements.txt       # Python deps
│   └── .env                   # MONGO_URL, JWT_SECRET, EMERGENT_LLM_KEY, RESEND_API_KEY
│
├── frontend/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── .env                   # REACT_APP_BACKEND_URL
│   ├── public/
│   └── src/
│       ├── index.js           # React entry + QueryClient
│       ├── App.js             # Routes + Auth guards
│       ├── App.css
│       ├── index.css          # Tailwind + custom theme + print styles
│       ├── lib/
│       │   └── api.js         # axios instance + JWT interceptor
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── components/
│       │   ├── AppShell.jsx   # Sidebar layout
│       │   └── ui/            # Shadcn primitives (~35 files)
│       └── pages/
│           ├── AuthPage.jsx
│           ├── Dashboard.jsx
│           ├── Wizard.jsx
│           ├── Results.jsx
│           └── Roadmap.jsx
│
├── memory/
│   ├── PRD.md                 # Product requirements + backlog
│   └── test_credentials.md    # Test account details
│
└── design_guidelines.json     # Design system spec
```

---

## 6. Environment Variables

### `/app/backend/.env`
| Variable | Purpose |
|---|---|
| `MONGO_URL` | MongoDB connection string (default `mongodb://localhost:27017`) |
| `DB_NAME` | Mongo database name |
| `CORS_ORIGINS` | Comma-separated allowed origins (`*` in dev) |
| `JWT_SECRET` | HMAC secret for signing tokens |
| `EMERGENT_LLM_KEY` | Universal key for Gemini/OpenAI/Anthropic via `emergentintegrations` |
| `RESEND_API_KEY` | Resend API key (empty by default → email endpoint returns 503) |
| `SENDER_EMAIL` | From address (`onboarding@resend.dev` works in Resend test mode) |

### `/app/frontend/.env`
| Variable | Purpose |
|---|---|
| `REACT_APP_BACKEND_URL` | Public URL of the backend (used by axios base) |
| `WDS_SOCKET_PORT` | webpack-dev-server socket port for HMR (443 behind ingress) |

---

## 7. Backend API Reference

All endpoints are prefixed with `/api`. Auth is done via `Authorization: Bearer <JWT>`.

### 7.1 Auth
| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/api/auth/register` | ❌ | `{email, password, full_name}` | `{token, user}` |
| POST | `/api/auth/login` | ❌ | `{email, password}` | `{token, user}` |
| GET | `/api/auth/me` | ✅ | — | `{id, email, full_name, created_at, profile}` |

**Password rules**: min 6 chars, bcrypt-hashed. **Token lifetime**: 7 days.

### 7.2 Profile
| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/api/profile` | ✅ | — | User profile object |
| PUT | `/api/profile` | ✅ | `{resume_text?, current_role?, years_experience?, skills?}` | Updated profile |

### 7.3 Roles
| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/api/roles/curated` | ❌ | Array of 8 roles: `[{title, skills: [{name, category, required_level}]}]` |

**Curated roles**: Frontend Engineer · Backend Engineer · Fullstack Engineer · Data Scientist · ML Engineer · DevOps Engineer · Product Manager · UI/UX Designer.

### 7.4 Skill Extraction
| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/api/skills/extract` | ✅ | `{resume_text}` (min 10 chars) | `{skills: [{name, category, proficiency}]}` |
| POST | `/api/resume/upload` | ✅ | multipart `file` (PDF/DOCX/TXT, ≤5MB) | `{text, chars, filename}` |

Skill extraction sends the resume text to Gemini 3 Flash with a strict-JSON system prompt; the response is parsed, sanitized, and clipped to 5–20 skills.

### 7.5 Analysis
| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/api/analysis/run` | ✅ | `{role_title, is_custom, user_skills: [{name, category, proficiency}]}` | Full analysis object |
| GET | `/api/analysis/latest` | ✅ | — | Most recent analysis or `null` |
| GET | `/api/analysis/list` | ✅ | — | Up to 50 past analyses (newest first) |
| GET | `/api/analysis/{id}` | ✅ | — | Single analysis |

**Analysis object shape**:
```json
{
  "id": "uuid",
  "role_title": "Fullstack Engineer",
  "is_custom": false,
  "readiness_score": 62,
  "strong":  [{"name":"React","category":"Framework","required_level":80,"current_level":85,"status":"strong"}],
  "partial": [{"name":"SQL","...":"...","status":"partial"}],
  "gap":     [{"name":"Docker","...":"...","status":"gap"}],
  "required_skills": [...],
  "user_skills": [...],
  "roadmap": null,
  "created_at": "ISO-8601"
}
```

### 7.6 Roadmap
| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/api/roadmap/generate/{analysis_id}` | ✅ | — | Roadmap object |
| PATCH | `/api/roadmap/{analysis_id}/toggle` | ✅ | `{week_index, task_index, completed}` | Updated roadmap |
| POST | `/api/roadmap/{analysis_id}/email-week` | ✅ | `{week_index}` | `{status, email_id, to}` — requires `RESEND_API_KEY` |

**Roadmap shape**:
```json
{
  "weeks": [
    {
      "week": 1,
      "theme": "Docker fundamentals",
      "skills": ["Docker"],
      "milestone": "Containerize your first app",
      "tasks":     [{"title":"...","description":"...","hours":2,"completed":false}],
      "resources": [{"title":"...","type":"course|article|video|project","url":"..."}]
    }
  ],
  "generated_at": "ISO-8601"
}
```

### 7.7 Dashboard
| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/api/dashboard` | ✅ | `{latest_analysis, total_analyses, completed_tasks, total_tasks, progress_pct}` |

---

## 8. Data Models (MongoDB)

### `users` collection
```json
{
  "id": "uuid-string",
  "email": "you@example.com",
  "full_name": "Jane Doe",
  "password_hash": "$2b$...",
  "created_at": "2026-02-11T10:00:00+00:00",
  "profile": {
    "resume_text": "",
    "current_role": "",
    "years_experience": 0,
    "skills": []
  }
}
```

### `analyses` collection
```json
{
  "id": "uuid-string",
  "user_id": "uuid-of-user",
  "role_title": "Fullstack Engineer",
  "is_custom": false,
  "readiness_score": 62,
  "strong":  [...],
  "partial": [...],
  "gap":     [...],
  "required_skills": [...],
  "user_skills":     [...],
  "roadmap": {...} | null,
  "created_at": "ISO-8601"
}
```

**Conventions**:
- All IDs are UUIDv4 strings — Mongo's `_id` is always excluded via `{"_id": 0}` projection.
- Timestamps are ISO-8601 strings (UTC) — timezone-aware via `datetime.now(timezone.utc)`.
- No secondary indexes are created explicitly; add `{email: 1}` unique index for scale.

---

## 9. Gap Analysis Algorithm

### 9.1 Matching a user skill to a required skill
Located in `server.py::match_skill(user_skills, required_name)`:
1. Case-insensitive exact match.
2. Substring match either direction (e.g., "React" matches "React.js").
3. Token overlap after splitting on whitespace and `/` — matches if the smaller set is fully contained.

### 9.2 Status buckets
For each required skill, compute `diff = current_level − required_level`:
- `diff ≥ −5` → **Strong** (you meet or exceed the bar)
- `−25 ≤ diff < −5` → **Partial** (nearly there)
- `diff < −25` → **Gap** (significant work needed)

Missing user skills default to `current_level = 0` → almost always Gap.

### 9.3 Readiness score
```
sum( min(required_level, current_level) for each required skill )
──────────────────────────────────────────────────────────────── × 100
             sum( required_level for each required skill )
```
The `min(...)` caps over-achievement so being a React expert doesn't compensate for missing Docker.

### 9.4 Roadmap generation prompt
Prompt sent to Gemini 3 Flash:
> "You are a senior career mentor. Output a 6-week weekly plan focused on closing the given skill gaps. Return strict JSON: `weeks[{week, theme, skills, milestone, tasks[{title, description, hours}], resources[{title, type, url}]}]`. Provide 6 weeks, 3–4 tasks per week, 2–3 real URLs per week."

The output is validated and clipped to safe sizes; each task auto-adds `completed: false`.

---

## 10. Third-Party Integrations

### 10.1 emergentintegrations (Gemini 3 Flash)
- Installed via `pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/`
- Auth via `EMERGENT_LLM_KEY` (Emergent Universal Key).
- Used inside async helper `llm_json(system, prompt, session_id)` which calls `LlmChat(...).with_model("gemini", "gemini-3-flash-preview").send_message(UserMessage(text=prompt))` and parses the returned JSON (with code-fence stripping fallback).
- Called from three endpoints: `POST /api/skills/extract`, `POST /api/analysis/run` (only for custom roles), and `POST /api/roadmap/generate/{id}`.

### 10.2 Resend
- Optional. Enabled only when `RESEND_API_KEY` is present.
- Non-blocking via `asyncio.to_thread(resend.Emails.send, params)` — keeps FastAPI's event loop free.
- Sends an inline-CSS HTML email (table-based layout for maximum email-client compatibility) with the week's theme, tasks, milestone, and resource links.
- Sender defaults to Resend's shared `onboarding@resend.dev`; production users should verify a domain.

### 10.3 Resume parsers
- `pypdf.PdfReader` extracts text from PDF pages.
- `python-docx` walks paragraphs of a DOCX file.
- Plain `.txt` is decoded as UTF-8.
- All uploads capped at 5MB and must yield ≥30 characters of extracted text.

---

## 11. Frontend Application Flow

### 11.1 Routes
| Path | Component | Guard |
|---|---|---|
| `/` | Redirect | → `/dashboard` |
| `/auth` | `AuthPage` | Public-only (redirects to `/dashboard` if logged in) |
| `/dashboard` | `Dashboard` | Protected |
| `/wizard` | `Wizard` | Protected |
| `/results/:analysisId` | `Results` | Protected |
| `/roadmap/:analysisId` | `Roadmap` | Protected |

Protected routes wrap children in `<AppShell>` (sidebar + main content). The auth state lives in `AuthContext` and JWT is persisted in `localStorage` under key `sb_token`.

### 11.2 AuthPage
Split screen: left panel with ambient glow + brand messaging; right panel with a toggleable login/register form and a **"Try instantly with demo account"** button that generates a random `demo_<timestamp>@skillbridge.dev` account for one-click evaluation.

### 11.3 Dashboard
- **Empty state** if no analysis yet — big CTA to start.
- **Populated state**:
  - Readiness gauge (Recharts half-pie) showing the latest analysis %.
  - 4 stat cards: Strong count, Partial count, Gap count, Progress %.
  - Active roadmap progress bar with a link to the full roadmap.
  - Analysis history list (all past analyses linked).

### 11.4 Wizard (4 steps)
1. **Target Role** — pick from an 8-card grid or check the "Use a custom role" box and type any title.
2. **Your Experience** — tabs to switch between paste-text and upload-file. Upload supports drag-and-drop and click-to-browse (PDF/DOCX/TXT). Amber "Be honest with your skills" banner is always visible. Three demo persona buttons pre-fill both role and resume.
3. **Verify Skills** — editable list of AI-extracted skills. Slider per skill (0–100), remove button, add-skill input. Second honesty banner explains the proficiency scale.
4. **Run** — big call-to-action button. Shows a summary of skill count and role name.

Progress is tracked with a 4-dot stepper at the top of the page.

### 11.5 Results
- Back button + role title + readiness percentage (gradient text).
- **Recharts RadarChart** overlaying "Required" (indigo) vs "Your Level" (cyan) across up to 8 skills.
- Three **BucketCards** — border-color-coded (emerald / amber / rose) — each listing the skills in that category with per-skill progress bars.
- CTA to either **Generate Roadmap** (POST) or **View Roadmap** (if already generated).

### 11.6 Roadmap
- Overall progress card at top (percentage + progress bar + fraction of tasks done).
- Print / Save PDF button in header (calls `window.print()`).
- 6 week cards. Each card shows theme, skill chips, milestone text, tasks with checkboxes, and resource list (open in a new tab).
- Toggling a task is **optimistic** — UI updates first, then PATCH is sent; failure triggers a re-fetch.
- Per-week **"Email me this week"** button — sends a styled email via Resend when the key is configured.

### 11.7 AppShell
Fixed-width sidebar with nav (Dashboard, New Analysis), user avatar with initials, and Sign Out.

### 11.8 Design System (in code)
- Color CSS variables in `index.css`: `--bg`, `--surface`, `--card`, `--border`, `--primary`, `--cyan`, `--strong`, `--partial`, `--gap`.
- Utility classes: `.glass` (backdrop-blur card), `.ambient-glow` (radial gradients), `.grid-bg` (subtle grid).
- Print styles: `.no-print` hides UI chrome (sidebar, buttons, links); everything switches to a light background with dark text for readability on paper.

---

## 12. End-to-End Workflow

Here's the exact user journey when someone lands on the app for the first time:

1. **Landing / Auth** — `/auth`
   - Register with email + password, or click "Try instantly with demo account".
   - Backend returns `{token, user}`. Token is stored in `localStorage`. `AuthContext.user` populated.
   - Navigate to `/dashboard`.

2. **Empty Dashboard**
   - Shows an empty state with a big "Start Analysis" CTA.
   - Click → `/wizard`.

3. **Wizard Step 1: Target Role**
   - `GET /api/roles/curated` fetches the 8 preset roles.
   - User selects "Fullstack Engineer" (or writes a custom title).
   - Click **Continue**.

4. **Wizard Step 2: Experience**
   - User either pastes their resume/experience text or uploads a PDF/DOCX (which hits `POST /api/resume/upload` and gets populated back into the text area).
   - Click **Extract Skills** → `POST /api/skills/extract` → Gemini returns categorized skills → advance to step 3.

5. **Wizard Step 3: Verify Skills**
   - User adjusts proficiency sliders, removes any wrongly-extracted skills, or adds missing ones (e.g., "Kubernetes: 30").
   - Click **Continue**.

6. **Wizard Step 4: Run**
   - Click **Run Gap Analysis** → `POST /api/analysis/run`:
     - Backend resolves required skills (from curated map or LLM if custom).
     - Runs `match_skill` for each requirement.
     - Computes readiness score and bucket assignments.
     - Persists to Mongo and returns full analysis.
   - Navigate to `/results/{analysisId}`.

7. **Results**
   - Radar chart, readiness gauge, 3 bucket cards.
   - Click **Generate Roadmap** → `POST /api/roadmap/generate/{id}` → Gemini creates the 6-week plan → navigate to `/roadmap/{id}`.

8. **Roadmap**
   - Review the 6 week cards.
   - Click checkboxes to complete tasks → `PATCH /api/roadmap/{id}/toggle`. UI updates instantly; progress bar climbs.
   - Click **Email me this week** to receive the plan in the inbox (Resend).
   - Click **Print / Save PDF** to export a clean one-pager.

9. **Return Visit / Dashboard**
   - `GET /api/dashboard` gives the latest analysis + progress stats. Users can jump into any past analysis from the history list.

---

## 13. Design System

**Archetype**: Precision Tactical Command Center — futuristic, data-dense, empowering.

**Color palette** (dark mode default):
| Token | Hex |
|---|---|
| background | `#0B0F17` |
| surface | `#111827` |
| card | `#1F2937` |
| border | `#374151` |
| primary (indigo) | `#6366F1` |
| accent cyan | `#06B6D4` |
| strong | `#10B981` |
| partial | `#F59E0B` |
| gap | `#EF4444` |

**Typography**:
- Headings: **Outfit** 500/600/700
- Body: **Inter** 400/500/600
- Tactical labels & mono ("// SKILL ENGINE"): **JetBrains Mono**

**Visual language**:
- Glassmorphic cards (backdrop-blur + translucent slate).
- Ambient radial glows in hero areas.
- Subtle grid background pattern.
- Left-accent border-colored cards for bucket status.
- Framer Motion micro-animations (fade-up on step change, pulse dots).

---

## 14. Local Development

### Prerequisites
- Python 3.11+
- Node 18+ with Yarn
- MongoDB running locally on `mongodb://localhost:27017`

### Backend
```bash
cd /app/backend
pip install -r requirements.txt
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
# Ensure .env has MONGO_URL, DB_NAME, JWT_SECRET, EMERGENT_LLM_KEY
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

### Frontend
```bash
cd /app/frontend
yarn install
# Ensure .env has REACT_APP_BACKEND_URL=http://localhost:8001
yarn start
```

Open `http://localhost:3000`.

### Running managed by supervisor (this environment)
```bash
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
sudo supervisorctl status
```

Hot-reload is on by default — code changes reflect without restarting (except `.env` and requirements/package changes).

---

## 15. Deployment Notes

- **Backend must bind `0.0.0.0:8001`**; the ingress maps `/api/*` here.
- **Frontend must use `REACT_APP_BACKEND_URL`** for all axios calls — never `localhost`.
- All secrets (JWT_SECRET, RESEND_API_KEY, etc.) must be provided via environment variables. **Never hardcode them.**
- The `EMERGENT_LLM_KEY` is the Emergent Universal Key. Budget can be topped up from **Profile → Manage plan → Universal Key**.
- If you swap MongoDB for Atlas, set `MONGO_URL` accordingly and add an index on `users.email` unique.
- For Resend production sending, verify a custom domain in Resend and change `SENDER_EMAIL`.

---

## 16. Publishing to GitHub

You can absolutely publish this code to GitHub. Before pushing:

1. **Never commit `.env` files.** Add this `.gitignore`:
```
# env
.env
backend/.env
frontend/.env

# python
__pycache__/
*.pyc
.venv/

# node
node_modules/
build/
.yarn/
.pnp.*
yarn-error.log

# ide
.vscode/
.idea/
.DS_Store
```

2. **Provide `.env.example` files** so contributors know which variables to set:

**backend/.env.example**
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=skillbridge
CORS_ORIGINS=*
JWT_SECRET=change-me
EMERGENT_LLM_KEY=your-emergent-universal-key
RESEND_API_KEY=
SENDER_EMAIL=onboarding@resend.dev
```

**frontend/.env.example**
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

3. **License**: pick one (MIT is a friendly default) and add a `LICENSE` file at the repo root.

4. **A short README.md at the root** — you can use the "Overview + Feature List + Local Development" sections of this document verbatim.

5. **Emergent-specific note**: `emergentintegrations` is installed from a custom index (`https://d33sy5i8bnduwe.cloudfront.net/simple/`). Contributors installing outside the Emergent platform will need to add that `--extra-index-url` in their pip command.

> **How to actually push from this Emergent workspace** — the platform provides a built-in "Push to GitHub" feature and manages OAuth for you. I'll ask the Emergent support agent to explain exactly how to do that in the next message.
