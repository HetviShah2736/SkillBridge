import os
import json
import logging
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Literal

import asyncio
import io

import bcrypt
import jwt
import resend
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get('ADMIN_EMAILS', '').split(',') if e.strip()}
JWT_ALG = "HS256"
JWT_EXPIRES_HOURS = 24 * 7

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="SkillBridge API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ============ Models ============
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=1)


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    created_at: str
    is_admin: bool = False


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class ProfileInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    resume_text: Optional[str] = ""
    current_role: Optional[str] = ""
    years_experience: Optional[float] = 0
    skills: Optional[List[str]] = []


class SkillExtractInput(BaseModel):
    resume_text: str = Field(min_length=10)


class SkillItem(BaseModel):
    name: str
    category: str = "General"
    proficiency: int = 50  # 0-100


class RoleAnalyzeInput(BaseModel):
    role_title: str
    is_custom: bool = False
    user_skills: List[SkillItem]


class GapItem(BaseModel):
    name: str
    category: str
    required_level: int
    current_level: int
    status: Literal["strong", "partial", "gap"]


class AnalysisResult(BaseModel):
    id: str
    role_title: str
    readiness_score: int
    strong: List[GapItem]
    partial: List[GapItem]
    gap: List[GapItem]
    required_skills: List[dict]
    created_at: str


class MilestoneToggle(BaseModel):
    week_index: int
    task_index: int
    completed: bool


# ============ Auth Helpers ============
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRES_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not cred:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload["user_id"]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["is_admin"] = user["email"].lower() in ADMIN_EMAILS
    return user


async def get_current_user_optional(cred: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not cred:
        return None
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
        if user:
            user["is_admin"] = user["email"].lower() in ADMIN_EMAILS
        return user
    except Exception:
        return None


async def require_admin(user=Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def log_event(event_type: str, user: Optional[dict] = None, meta: Optional[dict] = None):
    doc = {
        "id": str(uuid.uuid4()),
        "type": event_type,
        "user_id": user.get("id") if user else None,
        "user_email": user.get("email") if user else None,
        "created_at": now_iso(),
        "meta": meta or {},
    }
    try:
        await db.events.insert_one(doc)
    except Exception as e:
        logger.error(f"log_event failed: {e}")


# ============ LLM Helper ============
async def llm_json(system: str, user_prompt: str, session_id: str) -> dict:
    """Call Gemini and parse JSON from the response."""
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system,
    ).with_model("gemini", "gemini-3-flash-preview")
    resp = await chat.send_message(UserMessage(text=user_prompt))
    text = resp if isinstance(resp, str) else str(resp)
    # strip code fences
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1]
        if t.startswith("json"):
            t = t[4:]
        t = t.strip()
        if t.endswith("```"):
            t = t[:-3].strip()
    # extract first JSON object
    try:
        return json.loads(t)
    except Exception:
        # try to find JSON block
        start = t.find("{")
        end = t.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(t[start:end + 1])
            except Exception as e:
                logger.error(f"JSON parse fail: {e}\nRaw: {text[:500]}")
                raise HTTPException(status_code=502, detail="LLM returned invalid JSON")
        raise HTTPException(status_code=502, detail="LLM returned invalid JSON")


# ============ Curated Roles ============
CURATED_ROLES = {
    "Frontend Engineer": [
        {"name": "JavaScript", "category": "Language", "required_level": 85},
        {"name": "TypeScript", "category": "Language", "required_level": 80},
        {"name": "React", "category": "Framework", "required_level": 90},
        {"name": "HTML/CSS", "category": "Web", "required_level": 85},
        {"name": "Tailwind CSS", "category": "Styling", "required_level": 70},
        {"name": "Git", "category": "Tools", "required_level": 75},
        {"name": "Testing (Jest)", "category": "Testing", "required_level": 65},
        {"name": "REST APIs", "category": "Web", "required_level": 75},
        {"name": "Accessibility", "category": "Web", "required_level": 60},
        {"name": "Performance Optimization", "category": "Web", "required_level": 65},
    ],
    "Backend Engineer": [
        {"name": "Python", "category": "Language", "required_level": 85},
        {"name": "FastAPI", "category": "Framework", "required_level": 75},
        {"name": "SQL", "category": "Database", "required_level": 80},
        {"name": "MongoDB", "category": "Database", "required_level": 70},
        {"name": "REST APIs", "category": "Web", "required_level": 85},
        {"name": "Docker", "category": "DevOps", "required_level": 70},
        {"name": "Git", "category": "Tools", "required_level": 75},
        {"name": "System Design", "category": "Architecture", "required_level": 70},
        {"name": "Authentication/JWT", "category": "Security", "required_level": 70},
        {"name": "Caching (Redis)", "category": "Database", "required_level": 60},
    ],
    "Fullstack Engineer": [
        {"name": "JavaScript", "category": "Language", "required_level": 80},
        {"name": "React", "category": "Framework", "required_level": 80},
        {"name": "Node.js", "category": "Runtime", "required_level": 75},
        {"name": "Python", "category": "Language", "required_level": 70},
        {"name": "SQL", "category": "Database", "required_level": 75},
        {"name": "REST APIs", "category": "Web", "required_level": 80},
        {"name": "Docker", "category": "DevOps", "required_level": 65},
        {"name": "Git", "category": "Tools", "required_level": 75},
        {"name": "System Design", "category": "Architecture", "required_level": 65},
        {"name": "CI/CD", "category": "DevOps", "required_level": 60},
    ],
    "Data Scientist": [
        {"name": "Python", "category": "Language", "required_level": 85},
        {"name": "Pandas", "category": "Data", "required_level": 85},
        {"name": "NumPy", "category": "Data", "required_level": 80},
        {"name": "SQL", "category": "Database", "required_level": 80},
        {"name": "Statistics", "category": "Math", "required_level": 80},
        {"name": "Machine Learning", "category": "ML", "required_level": 80},
        {"name": "Scikit-learn", "category": "ML", "required_level": 75},
        {"name": "Data Visualization", "category": "Data", "required_level": 75},
        {"name": "Deep Learning", "category": "ML", "required_level": 60},
        {"name": "A/B Testing", "category": "Math", "required_level": 65},
    ],
    "ML Engineer": [
        {"name": "Python", "category": "Language", "required_level": 85},
        {"name": "PyTorch", "category": "ML", "required_level": 80},
        {"name": "TensorFlow", "category": "ML", "required_level": 70},
        {"name": "MLOps", "category": "DevOps", "required_level": 75},
        {"name": "Docker", "category": "DevOps", "required_level": 75},
        {"name": "Kubernetes", "category": "DevOps", "required_level": 65},
        {"name": "SQL", "category": "Database", "required_level": 70},
        {"name": "Machine Learning", "category": "ML", "required_level": 85},
        {"name": "Deep Learning", "category": "ML", "required_level": 80},
        {"name": "Model Deployment", "category": "MLOps", "required_level": 80},
    ],
    "DevOps Engineer": [
        {"name": "Linux", "category": "OS", "required_level": 85},
        {"name": "Docker", "category": "DevOps", "required_level": 85},
        {"name": "Kubernetes", "category": "DevOps", "required_level": 80},
        {"name": "AWS", "category": "Cloud", "required_level": 80},
        {"name": "Terraform", "category": "IaC", "required_level": 75},
        {"name": "CI/CD", "category": "DevOps", "required_level": 85},
        {"name": "Bash Scripting", "category": "Language", "required_level": 75},
        {"name": "Monitoring (Prometheus)", "category": "Observability", "required_level": 70},
        {"name": "Python", "category": "Language", "required_level": 65},
        {"name": "Networking", "category": "Infra", "required_level": 70},
    ],
    "Product Manager": [
        {"name": "Product Strategy", "category": "Strategy", "required_level": 85},
        {"name": "User Research", "category": "Research", "required_level": 80},
        {"name": "Data Analysis", "category": "Analytics", "required_level": 75},
        {"name": "SQL", "category": "Data", "required_level": 65},
        {"name": "Roadmapping", "category": "Planning", "required_level": 80},
        {"name": "Stakeholder Management", "category": "Communication", "required_level": 85},
        {"name": "A/B Testing", "category": "Analytics", "required_level": 70},
        {"name": "UX Principles", "category": "Design", "required_level": 70},
        {"name": "Agile/Scrum", "category": "Process", "required_level": 75},
        {"name": "Technical Communication", "category": "Communication", "required_level": 75},
    ],
    "UI/UX Designer": [
        {"name": "Figma", "category": "Tools", "required_level": 90},
        {"name": "User Research", "category": "Research", "required_level": 80},
        {"name": "Wireframing", "category": "Design", "required_level": 85},
        {"name": "Prototyping", "category": "Design", "required_level": 85},
        {"name": "Design Systems", "category": "Design", "required_level": 75},
        {"name": "Typography", "category": "Design", "required_level": 75},
        {"name": "Interaction Design", "category": "Design", "required_level": 80},
        {"name": "Accessibility", "category": "Design", "required_level": 70},
        {"name": "Usability Testing", "category": "Research", "required_level": 70},
        {"name": "HTML/CSS Basics", "category": "Web", "required_level": 55},
    ],
}


# ============ Auth Routes ============
@api.get("/")
async def root():
    return {"message": "SkillBridge API", "status": "ok"}


@api.post("/auth/register", response_model=AuthResponse)
async def register(input: RegisterInput):
    existing = await db.users.find_one({"email": input.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": input.email.lower(),
        "full_name": input.full_name,
        "password_hash": hash_password(input.password),
        "created_at": now_iso(),
        "profile": {
            "resume_text": "",
            "current_role": "",
            "years_experience": 0,
            "skills": [],
        },
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id)
    is_admin = user_doc["email"] in ADMIN_EMAILS
    await log_event("signup", {"id": user_id, "email": user_doc["email"]})
    return AuthResponse(
        token=token,
        user=UserOut(id=user_id, email=user_doc["email"], full_name=user_doc["full_name"], created_at=user_doc["created_at"], is_admin=is_admin),
    )


@api.post("/auth/login", response_model=AuthResponse)
async def login(input: LoginInput):
    user = await db.users.find_one({"email": input.email.lower()})
    if not user or not verify_password(input.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"])
    is_admin = user["email"] in ADMIN_EMAILS
    await log_event("login", {"id": user["id"], "email": user["email"]})
    return AuthResponse(
        token=token,
        user=UserOut(id=user["id"], email=user["email"], full_name=user["full_name"], created_at=user["created_at"], is_admin=is_admin),
    )


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ============ Profile Routes ============
@api.get("/profile")
async def get_profile(user=Depends(get_current_user)):
    return user.get("profile", {})


@api.put("/profile")
async def update_profile(input: ProfileInput, user=Depends(get_current_user)):
    profile = user.get("profile", {})
    upd = input.model_dump(exclude_none=True)
    profile.update(upd)
    await db.users.update_one({"id": user["id"]}, {"$set": {"profile": profile}})
    return profile


# ============ Role Routes ============
@api.get("/roles/curated")
async def curated_roles():
    return [{"title": t, "skills": s} for t, s in CURATED_ROLES.items()]


# ============ Skill Extraction ============
@api.post("/skills/extract")
async def extract_skills(input: SkillExtractInput, user=Depends(get_current_user)):
    system = (
        "You are a technical career coach and skill parser. "
        "Extract technical + soft skills from a resume/experience text. "
        "For each skill, infer proficiency (0-100) based on years/context/keywords. "
        "Return STRICT JSON with schema: "
        '{"skills":[{"name":"string","category":"Language|Framework|Database|Tools|Cloud|DevOps|ML|Design|Soft Skill|Web|Other","proficiency":0-100}]} '
        "Return between 5 and 20 skills. No commentary, JSON only."
    )
    prompt = f"Resume / Experience text:\n---\n{input.resume_text}\n---\nExtract skills as JSON."
    data = await llm_json(system, prompt, f"extract-{user['id']}-{uuid.uuid4().hex[:6]}")
    skills = data.get("skills", [])
    # sanitize
    cleaned = []
    for s in skills:
        if not isinstance(s, dict) or "name" not in s:
            continue
        cleaned.append({
            "name": str(s["name"])[:60],
            "category": str(s.get("category", "Other"))[:30],
            "proficiency": max(0, min(100, int(s.get("proficiency", 50)))),
        })
    return {"skills": cleaned}


# ============ Custom Role Requirements (AI) ============
async def get_role_requirements(role_title: str, is_custom: bool, session_id: str) -> List[dict]:
    if not is_custom and role_title in CURATED_ROLES:
        return CURATED_ROLES[role_title]
    system = (
        "You are a technical hiring expert. Given a target job role, output the 10 most important skills "
        "required for that role, each with a required proficiency level (0-100). "
        "Return STRICT JSON: "
        '{"skills":[{"name":"string","category":"string","required_level":0-100}]} '
        "Exactly 10 skills. JSON only."
    )
    prompt = f"Target role: {role_title}. List the 10 most important skills and required proficiency."
    data = await llm_json(system, prompt, session_id)
    skills = data.get("skills", [])
    cleaned = []
    for s in skills[:10]:
        if not isinstance(s, dict) or "name" not in s:
            continue
        cleaned.append({
            "name": str(s["name"])[:60],
            "category": str(s.get("category", "General"))[:30],
            "required_level": max(0, min(100, int(s.get("required_level", 70)))),
        })
    return cleaned


# ============ Gap Analysis ============
def match_skill(user_skills: List[SkillItem], required_name: str) -> Optional[SkillItem]:
    n = required_name.lower().strip()
    for us in user_skills:
        un = us.name.lower().strip()
        if un == n or n in un or un in n:
            return us
        # token overlap for multi-word
        n_tokens = set(n.replace("/", " ").split())
        u_tokens = set(un.replace("/", " ").split())
        if n_tokens & u_tokens and len(n_tokens & u_tokens) >= min(len(n_tokens), len(u_tokens)):
            return us
    return None


def bucket_status(required_level: int, current_level: int) -> str:
    diff = current_level - required_level
    if diff >= -5:
        return "strong"
    if diff >= -25:
        return "partial"
    return "gap"


@api.post("/analysis/run")
async def run_analysis(input: RoleAnalyzeInput, user=Depends(get_current_user)):
    session_id = f"role-{user['id']}-{uuid.uuid4().hex[:6]}"
    required = await get_role_requirements(input.role_title, input.is_custom, session_id)
    if not required:
        raise HTTPException(status_code=400, detail="Could not resolve role requirements")

    strong, partial, gap_list = [], [], []
    for req in required:
        matched = match_skill(input.user_skills, req["name"])
        current_level = matched.proficiency if matched else 0
        status_ = bucket_status(req["required_level"], current_level)
        item = {
            "name": req["name"],
            "category": req["category"],
            "required_level": req["required_level"],
            "current_level": current_level,
            "status": status_,
        }
        if status_ == "strong":
            strong.append(item)
        elif status_ == "partial":
            partial.append(item)
        else:
            gap_list.append(item)

    # Readiness score
    total_required = sum(r["required_level"] for r in required) or 1
    total_current = sum(min(req["required_level"], match_skill(input.user_skills, req["name"]).proficiency if match_skill(input.user_skills, req["name"]) else 0) for req in required)
    readiness = int(round((total_current / total_required) * 100))

    analysis_id = str(uuid.uuid4())
    doc = {
        "id": analysis_id,
        "user_id": user["id"],
        "role_title": input.role_title,
        "is_custom": input.is_custom,
        "readiness_score": readiness,
        "strong": strong,
        "partial": partial,
        "gap": gap_list,
        "required_skills": required,
        "user_skills": [s.model_dump() for s in input.user_skills],
        "created_at": now_iso(),
        "roadmap": None,
    }
    await db.analyses.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("user_id", None)
    return doc


@api.get("/analysis/latest")
async def latest_analysis(user=Depends(get_current_user)):
    doc = await db.analyses.find_one(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}, sort=[("created_at", -1)]
    )
    if not doc:
        return None
    return doc


@api.get("/analysis/list")
async def list_analyses(user=Depends(get_current_user)):
    docs = await db.analyses.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("created_at", -1).to_list(50)
    return docs


@api.get("/analysis/{analysis_id}")
async def get_analysis(analysis_id: str, user=Depends(get_current_user)):
    doc = await db.analyses.find_one({"id": analysis_id, "user_id": user["id"]}, {"_id": 0, "user_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


# ============ Roadmap Generation ============
@api.post("/roadmap/generate/{analysis_id}")
async def generate_roadmap(analysis_id: str, user=Depends(get_current_user)):
    analysis = await db.analyses.find_one({"id": analysis_id, "user_id": user["id"]})
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    gaps_to_close = analysis["gap"] + analysis["partial"]
    if not gaps_to_close:
        # nothing to learn; produce short polish plan
        gaps_to_close = analysis["strong"][:3]

    gap_summary = ", ".join(f"{g['name']} (current {g['current_level']} → target {g['required_level']})" for g in gaps_to_close)

    system = (
        "You are a senior career mentor building a weekly upskilling roadmap. "
        "Output a 6-week weekly plan focused on closing the given skill gaps for a target role. "
        "Return STRICT JSON with schema:\n"
        '{"weeks":[{"week":1,"theme":"string","skills":["string"],"milestone":"string",'
        '"tasks":[{"title":"string","description":"string","hours":2}],'
        '"resources":[{"title":"string","type":"article|course|project|video","url":"https://..."}]}]} '
        "Provide 6 weeks. 3-4 tasks per week. 2-3 resources per week with real URLs (freeCodeCamp, MDN, YouTube, official docs). JSON only."
    )
    prompt = (
        f"Target role: {analysis['role_title']}\n"
        f"Skills to close: {gap_summary}\n"
        f"Current strengths: {', '.join(s['name'] for s in analysis['strong'])}\n"
        f"Generate a 6-week roadmap."
    )
    data = await llm_json(system, prompt, f"roadmap-{user['id']}-{uuid.uuid4().hex[:6]}")
    weeks = data.get("weeks", [])
    # sanitize + add completion tracking
    clean_weeks = []
    for i, w in enumerate(weeks[:6]):
        tasks = w.get("tasks", []) or []
        clean_tasks = [
            {
                "title": str(t.get("title", "Task"))[:120],
                "description": str(t.get("description", ""))[:400],
                "hours": int(t.get("hours", 2)),
                "completed": False,
            }
            for t in tasks[:5] if isinstance(t, dict)
        ]
        resources = w.get("resources", []) or []
        clean_res = [
            {
                "title": str(r.get("title", "Resource"))[:120],
                "type": str(r.get("type", "article"))[:20],
                "url": str(r.get("url", "#"))[:400],
            }
            for r in resources[:4] if isinstance(r, dict)
        ]
        clean_weeks.append({
            "week": i + 1,
            "theme": str(w.get("theme", f"Week {i + 1}"))[:120],
            "skills": [str(s)[:60] for s in w.get("skills", [])[:6]],
            "milestone": str(w.get("milestone", ""))[:200],
            "tasks": clean_tasks,
            "resources": clean_res,
        })

    roadmap = {
        "weeks": clean_weeks,
        "generated_at": now_iso(),
    }
    await db.analyses.update_one({"id": analysis_id}, {"$set": {"roadmap": roadmap}})
    return roadmap


@api.patch("/roadmap/{analysis_id}/toggle")
async def toggle_task(analysis_id: str, body: MilestoneToggle, user=Depends(get_current_user)):
    analysis = await db.analyses.find_one({"id": analysis_id, "user_id": user["id"]})
    if not analysis or not analysis.get("roadmap"):
        raise HTTPException(status_code=404, detail="Roadmap not found")
    roadmap = analysis["roadmap"]
    try:
        roadmap["weeks"][body.week_index]["tasks"][body.task_index]["completed"] = body.completed
    except (IndexError, KeyError):
        raise HTTPException(status_code=400, detail="Invalid indices")
    await db.analyses.update_one({"id": analysis_id}, {"$set": {"roadmap": roadmap}})
    return roadmap


# ============ Dashboard ============
@api.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    latest = await db.analyses.find_one(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}, sort=[("created_at", -1)]
    )
    total_analyses = await db.analyses.count_documents({"user_id": user["id"]})
    completed_tasks = 0
    total_tasks = 0
    if latest and latest.get("roadmap"):
        for w in latest["roadmap"]["weeks"]:
            for t in w["tasks"]:
                total_tasks += 1
                if t.get("completed"):
                    completed_tasks += 1
    progress_pct = int(round((completed_tasks / total_tasks) * 100)) if total_tasks else 0
    return {
        "latest_analysis": latest,
        "total_analyses": total_analyses,
        "completed_tasks": completed_tasks,
        "total_tasks": total_tasks,
        "progress_pct": progress_pct,
    }


# ============ Resume Upload ============
def _pdf_text(data: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    return "\n".join((p.extract_text() or "") for p in reader.pages)


def _docx_text(data: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


@api.post("/resume/upload")
async def upload_resume(file: UploadFile = File(...), user=Depends(get_current_user)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ("pdf", "docx", "txt"):
        raise HTTPException(status_code=400, detail="Only PDF, DOCX or TXT files are supported")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    try:
        if ext == "pdf":
            text = _pdf_text(data)
        elif ext == "docx":
            text = _docx_text(data)
        else:
            text = data.decode("utf-8", errors="ignore")
    except Exception as e:
        logger.error(f"Resume parse failed: {e}")
        raise HTTPException(status_code=400, detail="Could not parse the file")
    text = (text or "").strip()
    if len(text) < 30:
        raise HTTPException(status_code=400, detail="Not enough text found in the file")
    return {"text": text, "chars": len(text), "filename": file.filename}


# ============ Email Weekly Nudge ============
class EmailWeekRequest(BaseModel):
    week_index: int = 0


def build_week_email_html(user_name: str, role_title: str, week: dict) -> str:
    tasks_rows = "".join(
        f"""<tr><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">
        <div style="font-weight:600;color:#0f172a;">{t.get('title','')}</div>
        <div style="font-size:13px;color:#475569;margin-top:2px;">{t.get('description','')}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;font-family:monospace;">~{t.get('hours',2)}h</div>
        </td></tr>"""
        for t in week.get("tasks", [])
    )
    res_rows = "".join(
        f"""<tr><td style="padding:8px 14px;">
        <a href="{r.get('url','#')}" style="color:#4f46e5;text-decoration:none;font-weight:500;">{r.get('title','Resource')}</a>
        <span style="color:#94a3b8;font-size:11px;margin-left:6px;text-transform:uppercase;">{r.get('type','')}</span>
        </td></tr>"""
        for r in week.get("resources", [])
    )
    skills = ", ".join(week.get("skills", [])) or "—"
    return f"""
    <div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:linear-gradient(90deg,#4f46e5,#06b6d4);padding:24px 28px;color:#fff;">
            <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.85;">SkillBridge · Weekly Nudge</div>
            <div style="font-size:22px;font-weight:700;margin-top:6px;">Week {week.get('week', 1)} — {week.get('theme','This Week')}</div>
            <div style="font-size:13px;opacity:.9;margin-top:4px;">Target: {role_title}</div>
          </td>
        </tr>
        <tr><td style="padding:20px 28px;color:#0f172a;">
          <p style="margin:0 0 8px 0;">Hi {user_name},</p>
          <p style="margin:0 0 16px 0;color:#475569;">Here's your focus for the week. Small consistent steps → real progress.</p>
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;">Skills</div>
          <div style="color:#334155;margin-bottom:16px;">{skills}</div>
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;">Milestone</div>
          <div style="color:#334155;margin-bottom:20px;">{week.get('milestone','')}</div>
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;">Tasks</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;">
            {tasks_rows}
          </table>
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin:20px 0 6px;">Resources</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;">
            {res_rows}
          </table>
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;font-size:12px;color:#94a3b8;text-align:center;">
          Sent by SkillBridge · Bridge the gap.
        </td></tr>
      </table>
    </div>
    """


@api.post("/roadmap/{analysis_id}/email-week")
async def email_week(analysis_id: str, body: EmailWeekRequest, user=Depends(get_current_user)):
    if not RESEND_API_KEY:
        raise HTTPException(status_code=503, detail="Email service not configured. Add RESEND_API_KEY to backend .env to enable email.")
    analysis = await db.analyses.find_one({"id": analysis_id, "user_id": user["id"]})
    if not analysis or not analysis.get("roadmap"):
        raise HTTPException(status_code=404, detail="Roadmap not found")
    weeks = analysis["roadmap"]["weeks"]
    if body.week_index < 0 or body.week_index >= len(weeks):
        raise HTTPException(status_code=400, detail="Invalid week index")
    week = weeks[body.week_index]
    html = build_week_email_html(user["full_name"], analysis["role_title"], week)
    subject = f"Week {week.get('week', body.week_index + 1)}: {week.get('theme', 'Your SkillBridge nudge')}"
    params = {"from": SENDER_EMAIL, "to": [user["email"]], "subject": subject, "html": html}
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        return {"status": "sent", "email_id": result.get("id"), "to": user["email"]}
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        raise HTTPException(status_code=502, detail=f"Email send failed: {str(e)}")




# ============ Analytics: Event Tracking ============
class PageviewInput(BaseModel):
    path: str
    session_id: Optional[str] = None
    referrer: Optional[str] = ""
    utm_source: Optional[str] = ""
    utm_medium: Optional[str] = ""
    utm_campaign: Optional[str] = ""
    title: Optional[str] = ""


@api.post("/events/pageview")
async def track_pageview(input: PageviewInput, user: Optional[dict] = Depends(get_current_user_optional)):
    doc = {
        "id": str(uuid.uuid4()),
        "type": "pageview",
        "user_id": user.get("id") if user else None,
        "user_email": user.get("email") if user else None,
        "created_at": now_iso(),
        "path": input.path[:200],
        "title": (input.title or "")[:200],
        "session_id": (input.session_id or "")[:80],
        "referrer": (input.referrer or "")[:400],
        "utm_source": (input.utm_source or "")[:80],
        "utm_medium": (input.utm_medium or "")[:80],
        "utm_campaign": (input.utm_campaign or "")[:80],
    }
    try:
        await db.events.insert_one(doc)
    except Exception as e:
        logger.error(f"pageview insert failed: {e}")
    return {"ok": True}


# ============ Admin Analytics ============
def _iso_days_ago(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def _classify_source(ev: dict) -> str:
    if ev.get("utm_source"):
        return f"utm:{ev['utm_source']}"
    ref = (ev.get("referrer") or "").lower()
    if not ref:
        return "direct"
    for domain, label in [
        ("google.", "google"), ("bing.", "bing"), ("duckduckgo.", "duckduckgo"),
        ("facebook.", "facebook"), ("twitter.", "twitter"), ("x.com", "twitter"),
        ("linkedin.", "linkedin"), ("reddit.", "reddit"), ("youtube.", "youtube"),
        ("instagram.", "instagram"), ("github.", "github"),
    ]:
        if domain in ref:
            return label
    # fallback: bare domain
    try:
        host = ref.split("//", 1)[-1].split("/", 1)[0]
        return f"ref:{host}" if host else "direct"
    except Exception:
        return "direct"


@api.get("/admin/overview")
async def admin_overview(_admin=Depends(require_admin)):
    total_users = await db.users.count_documents({})
    d1 = _iso_days_ago(1)
    d7 = _iso_days_ago(7)
    d30 = _iso_days_ago(30)

    async def active_users(since_iso):
        # distinct authenticated users with any event in window
        vals = await db.events.distinct("user_id", {"user_id": {"$ne": None}, "created_at": {"$gte": since_iso}})
        return len(vals)

    dau = await active_users(d1)
    wau = await active_users(d7)
    mau = await active_users(d30)

    signups_24h = await db.events.count_documents({"type": "signup", "created_at": {"$gte": d1}})
    signups_7d = await db.events.count_documents({"type": "signup", "created_at": {"$gte": d7}})
    logins_24h = await db.events.count_documents({"type": "login", "created_at": {"$gte": d1}})
    logins_7d = await db.events.count_documents({"type": "login", "created_at": {"$gte": d7}})
    pageviews_24h = await db.events.count_documents({"type": "pageview", "created_at": {"$gte": d1}})
    pageviews_7d = await db.events.count_documents({"type": "pageview", "created_at": {"$gte": d7}})

    # unique visitors by session_id in 24h
    unique_24h = await db.events.distinct("session_id", {"type": "pageview", "session_id": {"$ne": ""}, "created_at": {"$gte": d1}})

    return {
        "total_users": total_users,
        "dau": dau, "wau": wau, "mau": mau,
        "signups_24h": signups_24h, "signups_7d": signups_7d,
        "logins_24h": logins_24h, "logins_7d": logins_7d,
        "pageviews_24h": pageviews_24h, "pageviews_7d": pageviews_7d,
        "unique_visitors_24h": len(unique_24h),
    }


@api.get("/admin/timeseries")
async def admin_timeseries(days: int = 14, _admin=Depends(require_admin)):
    days = max(1, min(90, days))
    since = _iso_days_ago(days)
    cursor = db.events.find(
        {"created_at": {"$gte": since}},
        {"_id": 0, "type": 1, "created_at": 1, "user_id": 1, "session_id": 1},
    )
    buckets = {}
    async for ev in cursor:
        try:
            day = ev["created_at"][:10]
        except Exception:
            continue
        b = buckets.setdefault(day, {"signups": 0, "logins": 0, "pageviews": 0, "sessions": set(), "users": set()})
        t = ev.get("type")
        if t == "signup":
            b["signups"] += 1
        elif t == "login":
            b["logins"] += 1
        elif t == "pageview":
            b["pageviews"] += 1
            if ev.get("session_id"):
                b["sessions"].add(ev["session_id"])
        if ev.get("user_id"):
            b["users"].add(ev["user_id"])

    series = []
    for i in range(days - 1, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=i)).date().isoformat()
        b = buckets.get(day, {"signups": 0, "logins": 0, "pageviews": 0, "sessions": set(), "users": set()})
        series.append({
            "date": day,
            "signups": b["signups"],
            "logins": b["logins"],
            "pageviews": b["pageviews"],
            "sessions": len(b["sessions"]),
            "active_users": len(b["users"]),
        })
    return series


@api.get("/admin/top-pages")
async def admin_top_pages(days: int = 30, _admin=Depends(require_admin)):
    since = _iso_days_ago(min(90, max(1, days)))
    pipeline = [
        {"$match": {"type": "pageview", "created_at": {"$gte": since}}},
        {"$group": {"_id": "$path", "views": {"$sum": 1}, "sessions": {"$addToSet": "$session_id"}}},
        {"$project": {"_id": 0, "path": "$_id", "views": 1, "unique_sessions": {"$size": "$sessions"}}},
        {"$sort": {"views": -1}},
        {"$limit": 20},
    ]
    return await db.events.aggregate(pipeline).to_list(20)


@api.get("/admin/traffic-sources")
async def admin_traffic_sources(days: int = 30, _admin=Depends(require_admin)):
    since = _iso_days_ago(min(90, max(1, days)))
    cursor = db.events.find(
        {"type": "pageview", "created_at": {"$gte": since}},
        {"_id": 0, "referrer": 1, "utm_source": 1, "session_id": 1},
    )
    counts = {}
    sessions_per_source = {}
    async for ev in cursor:
        src = _classify_source(ev)
        counts[src] = counts.get(src, 0) + 1
        sess = ev.get("session_id")
        if sess:
            sessions_per_source.setdefault(src, set()).add(sess)
    rows = [
        {"source": s, "views": counts[s], "unique_sessions": len(sessions_per_source.get(s, set()))}
        for s in counts
    ]
    rows.sort(key=lambda r: r["views"], reverse=True)
    return rows[:20]


@api.get("/admin/recent-activity")
async def admin_recent_activity(limit: int = 50, _admin=Depends(require_admin)):
    limit = max(1, min(200, limit))
    docs = await db.events.find(
        {}, {"_id": 0},
    ).sort("created_at", -1).to_list(limit)
    return docs


@api.get("/admin/users")
async def admin_users(_admin=Depends(require_admin)):
    users = await db.users.find(
        {}, {"_id": 0, "password_hash": 0, "profile": 0},
    ).sort("created_at", -1).to_list(500)
    # Enrich with last activity
    user_ids = [u["id"] for u in users]
    last_map = {}
    if user_ids:
        cursor = db.events.aggregate([
            {"$match": {"user_id": {"$in": user_ids}}},
            {"$group": {"_id": "$user_id", "last_at": {"$max": "$created_at"}, "event_count": {"$sum": 1}}},
        ])
        async for row in cursor:
            last_map[row["_id"]] = {"last_active": row["last_at"], "event_count": row["event_count"]}
    for u in users:
        info = last_map.get(u["id"], {})
        u["last_active"] = info.get("last_active")
        u["event_count"] = info.get("event_count", 0)
        u["is_admin"] = u["email"].lower() in ADMIN_EMAILS
    return users



app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
