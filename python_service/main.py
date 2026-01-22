import os
from typing import Any, Dict, List, Literal, Optional
import json
import math
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import traceback
from collections import Counter

from openai import OpenAI

load_dotenv()

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

Exam = Literal["CAT", "NEET", "JEE"]


# -----------------------------
# Input Models
# -----------------------------
class Intake(BaseModel):
    goal: Optional[str] = None
    hardest: Optional[str] = None
    weekly_hours: Optional[str] = None
    # NOTE: you can add boosters here later (next_mock_days, tukka_level etc.)
    # without breaking: Optional[str] = None


class AnalyzeInput(BaseModel):
    exam: Exam
    intake: Intake = Field(default_factory=Intake)
    text: str


# -----------------------------
# Report Models (existing)
# -----------------------------
class Weakness(BaseModel):
    topic: str
    severity: int = Field(ge=1, le=5)
    reason: str


class DayPlan(BaseModel):
    day: int
    focus: str
    time_minutes: int
    tasks: List[str]


class Report(BaseModel):
    summary: str
    estimated_score: Dict[str, Any]
    strengths: List[str]
    weaknesses: List[Weakness]
    error_types: Dict[str, int]
    top_actions: List[str]
    fourteen_day_plan: List[DayPlan]
    next_mock_strategy: List[str]
    meta: Dict[str, Any] = Field(default_factory=dict)


# =========================
# Strategy Plan V2 (single source of truth)
# =========================
class StrategyConfidence(BaseModel):
    # ✅ defaults prevent crashes if model outputs null/missing
    score: int = Field(default=50, ge=0, le=100)
    band: Literal["high", "medium", "low"] = "medium"
    missing_signals: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)


class StrategyLever(BaseModel):
    title: str
    do: List[str] = Field(min_length=1)
    stop: List[str] = Field(min_length=1)
    why: str
    metric: str
    next_mock_rule: str


class StrategyQuestion(BaseModel):
    id: str
    question: str
    type: Literal["single_select", "boolean", "text"]
    options: Optional[List[str]] = None
    unlocks: List[str] = Field(default_factory=list)


class StrategyDay(BaseModel):
    day: int = Field(ge=1)
    title: str
    minutes: int = Field(ge=10, le=240)
    tasks: List[str] = Field(min_length=2, max_length=8)


class StrategyPlan(BaseModel):
    title: str
    confidence: StrategyConfidence
    top_levers: List[StrategyLever] = Field(min_length=1, max_length=3)
    if_then_rules: List[str] = Field(min_length=3, max_length=10)
    plan_days: List[StrategyDay] = Field(min_length=3, max_length=14)
    next_questions: List[StrategyQuestion] = Field(default_factory=list, max_length=2)


# ===== Master Prompt (keep as-is) =====
STRATEGY_MASTER_SYSTEM_PROMPT = """
SYSTEM ROLE:
You are an elite exam performance coach for standardized, high-stakes tests.
You optimize for measurable score uplift in the student's NEXT attempt, not long-term theory coverage.

You outperform human faculties by:
- Diagnosing execution failures, not syllabus gaps
- Acting decisively on limited, noisy, or incomplete data
- Issuing constraint-based, exam-time enforceable actions

PRIMARY OBJECTIVE:
Maximize expected score improvement in the student's NEXT attempt under realistic constraints.

OPERATING RULES:
1. Do NOT repeat scorecard or report facts.
   - Use them only internally to justify decisions.
2. Infer latent traits from available signals:
   - Risk appetite (under / over / calibrated)
   - Confidence calibration (inflated / suppressed / accurate)
   - Execution mode (systematic / reactive / impulsive)
   - Stability under pressure (stable / volatile / collapsing)
3. If data is missing or ambiguous:
   - Explicitly state assumptions
   - Proceed with robust, execution-safe fallback tactics
4. Use AT MOST THREE improvement levers.
   - Each lever must be constraint-based, measurable, and enforceable
5. Every recommendation must:
   - Change a decision the student makes DURING the exam
   - Be verifiable in the very next mock
6. Avoid generic advice entirely.
7. Prefer decision quality over content mastery.
8. Optimize for damage reduction before upside maximization.

DECISION QUALITY ENFORCEMENT:
- Think strictly in terms of decisions, not topics.
- Every action must map to an exam-time decision:
  (attempt / skip / delay / reorder / abandon).
- If an action cannot be verified in the NEXT attempt, it is invalid.

EXECUTION PRIORITY RULE:
- Prefer actions that REDUCE damage before actions that INCREASE upside maximization.
- Assume most score loss comes from poor decisions, not lack of knowledge.

DATA ROBUSTNESS MODE:
- When scorecards, PDFs, or inputs are incomplete or noisy:
  - Default to execution-safe heuristics that historically improve outcomes
  - Do NOT ask for more data unless absolutely necessary
  - State assumptions clearly and proceed

FACULTY OVERRIDE:
- Ignore conventional coaching wisdom if it conflicts with data-backed execution logic.

PLAN STRUCTURE RULES:
- Provide a 7-day execution plan by default

IF–THEN EXECUTION RULES:
- Provide clear conditional rules the student must follow during the mock

CLARIFICATION LIMIT:
- Ask no more than TWO clarifying questions

OUTPUT REQUIREMENTS:
- Output VALID JSON only
- Must strictly match the provided schema
- No markdown, no commentary, no extra keys
""".strip()


# -----------------------------
# Report prompt builder (existing)
# -----------------------------
def rubric_by_exam(exam: str) -> str:
    if exam == "CAT":
        return """CAT EXAM CONTEXT:
- Sections: VARC, DILR, Quant
- Focus on accuracy, question selection, and time allocation.
- Do NOT assume section mapping unless explicitly stated in the report.
- If weak areas are listed without section mapping, treat them as global.
"""
    if exam == "NEET":
        return """NEET EXAM CONTEXT:
- Focus on concept clarity, NCERT alignment, and negative marking.
- Be conservative with assumptions unless the report states specifics.
"""
    if exam == "JEE":
        return """JEE EXAM CONTEXT:
- Focus on multi-step reasoning, approach quality, and topic mastery.
- Avoid guessing section-level weaknesses unless stated.
"""
    if exam == "UPSC":
        return """UPSC EXAM CONTEXT:
- Focus on breadth + retention, revision cycles, and answer structuring.
- Be conservative with assumptions unless the report states specifics.
"""
    return """GENERAL EXAM CONTEXT:
- Stay conservative and evidence-based.
"""


def build_prompt(exam: str, intake: dict, text: str) -> str:
    schema_template = """
{
  "summary": "string",
  "estimated_score": {
    "value": number|null,
    "max": number|null,
    "range": [number, number]|null,
    "confidence": "low"|"medium"|"high",
    "assumptions": ["string", "..."]
  },
  "strengths": ["string", "..."],
  "weaknesses": [{"topic":"string","severity":1-5,"reason":"string"}, "..."],
  "error_types": {"conceptual":0-100,"careless":0-100,"time":0-100,"comprehension":0-100},
  "top_actions": ["string", "..."],
  "fourteen_day_plan": [
    {"day":1,"focus":"string","time_minutes":number,"tasks":["string","string","string"]},
    "... (14 total, day 1..14)"
  ],
  "next_mock_strategy": ["string", "..."],
  "meta": {"engine":"python","prompt_version":"py-v1.0.0"}
}
""".strip()

    return f"""
You are Cogniverse Mock Analyzer.

CRITICAL RULES:
- Use ONLY information present in the provided report text.
- Do NOT assign weaknesses to sections unless explicitly stated.
- Prefer conservative, evidence-backed language.
- Do NOT invent scores, sections, or metrics.

INSIGHT QUALITY RULES:
- Summary must mention 1–2 strongest signals and 1–2 bottlenecks from the text.
- Weaknesses must be actionable topics; each needs a reason grounded in the text.
- Top actions must be specific and time-bound (include numbers like “20 mins”, “30 questions”, “daily”, etc.)
- 14-day plan must be day-wise, each day has: focus + time_minutes + 3+ tasks.

{rubric_by_exam(exam)}

STUDENT CONTEXT (may be partial):
{intake}

MOCK REPORT TEXT (source of truth):
\"\"\"
{text}
\"\"\"

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON.
- Return EXACTLY the following top-level keys:
  summary, estimated_score, strengths, weaknesses, error_types, top_actions, fourteen_day_plan, next_mock_strategy, meta
- error_types must sum to 100.
- fourteen_day_plan must have exactly 14 items (day 1..14).
- Do NOT wrap the output in any extra object.

JSON TEMPLATE (follow this shape):
{schema_template}
""".strip()


# -----------------------------
# Shared LLM helpers
# -----------------------------
def _extract_json(raw: str) -> str:
    raw = (raw or "").strip()
    if raw.startswith("{") and raw.endswith("}"):
        return raw
    s = raw.find("{")
    e = raw.rfind("}")
    if s != -1 and e != -1 and e > s:
        return raw[s : e + 1]
    return raw


def _call_llm(p: str, model: str, temp: float = 0.2) -> str:
    r = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "Return ONLY valid JSON. No markdown, no extra text."},
            {"role": "user", "content": p},
        ],
        temperature=temp,
    )
    return (r.choices[0].message.content or "").strip()


def _safe_text(x: Any, max_len: int = 2400) -> str:
    try:
        s = x if isinstance(x, str) else json.dumps(x, ensure_ascii=False)
    except Exception:
        s = str(x)
    return s[:max_len] if len(s) > max_len else s


# -----------------------------
# Strategy Engine (NEW)
# -----------------------------
def _looks_generic(s: str) -> bool:
    x = (s or "").lower()
    bad = [
        "practice more",
        "revise",
        "revision",
        "study more",
        "be confident",
        "focus more",
        "work harder",
        "improve concepts",
        "do more questions",
        "keep practicing",
    ]
    return any(p in x for p in bad)


def _has_generic_advice(plan: StrategyPlan) -> bool:
    blobs: List[str] = []
    blobs.append(plan.title)
    for l in plan.top_levers:
        blobs.extend([l.title, l.why, l.metric, l.next_mock_rule])
        blobs.extend(l.do)
        blobs.extend(l.stop)
    blobs.extend(plan.if_then_rules)
    for d in plan.plan_days:
        blobs.append(d.title)
        blobs.extend(d.tasks)
    for q in plan.next_questions:
        blobs.append(q.question)
        blobs.extend(q.options or [])
        blobs.extend(q.unlocks)
    return any(_looks_generic(b) for b in blobs)


def _build_strategy_user_content(exam: str, intake: Dict[str, Any], report_dict: Dict[str, Any]) -> str:
    meta = (report_dict.get("meta") or {})
    strategy_meta = meta.get("strategy") or {}

    payload = {
        "exam": exam,
        "intake": intake,
        "strategy_meta": {
            "confidence_score": strategy_meta.get("confidence_score"),
            "confidence_band": strategy_meta.get("confidence_band"),
            "missing_signals": strategy_meta.get("missing_signals"),
            "assumptions": strategy_meta.get("assumptions"),
            "next_questions_hint": strategy_meta.get("next_questions"),
        },
        "report_compact": {
            "summary": report_dict.get("summary"),
            "strengths": report_dict.get("strengths"),
            "weaknesses": report_dict.get("weaknesses"),
            "remarks": report_dict.get("remarks") or report_dict.get("facultyRemarks"),
            "error_types": report_dict.get("error_types"),
        },
    }

    payload_txt = _safe_text(payload, 2400)

    schema_block = """
Return STRICT JSON that matches this schema EXACTLY (no extra keys, no markdown):

{
  "title": "string",
  "confidence": {
    "score": 0-100 integer,
    "band": "high"|"medium"|"low",
    "missing_signals": ["string"],
    "assumptions": ["string"]
  },
  "top_levers": [
    {
      "title": "string",
      "do": ["string"],
      "stop": ["string"],
      "why": "string",
      "metric": "string",
      "next_mock_rule": "string"
    }
  ],
  "if_then_rules": ["string"],
  "plan_days": [
    {
      "day": 1,
      "title": "string",
      "minutes": 10-240 integer,
      "tasks": ["string","string"]
    }
  ],
  "next_questions": [
    {
      "id": "string",
      "question": "string",
      "type": "single_select"|"boolean"|"text",
      "options": ["string"],
      "unlocks": ["string"]
    }
  ]
}

Hard rules:
- top_levers must be 1..3
- The 1..3 levers must be NON-OVERLAPPING.
- Do NOT output two levers about the same theme (e.g., time management twice).
- Themes to choose from: (1) question selection, (2) time cap rules, (3) accuracy/negatives control.
- Levers must be mutually exclusive: each lever must target a different failure mode.
- Pick from exactly these themes (no repeats):
  (1) Damage control (negatives/accuracy)
  (2) Selection bias (attempt/skip/reorder rules)
  (3) End-game collapse (time + last-20-min rules)
- If signals are weak, output ONLY 2 levers.
- if_then_rules must be 3..10
- plan_days must be 3..14
- next_questions must be 0..2
- DO NOT invent subjects like Physics/Chem/Math unless they appear in report text.
- Prefer "confidence buckets" and "time-to-approach" rules over subject ordering.
- If you must prioritize, prioritize by: (a) quick-to-start questions, (b) low-negative-risk questions.
- Each lever must be decision-level + measurable in NEXT mock (attempt/skip/reorder/abandon rules).
""".strip()

    return f"INPUTS:\n{payload_txt}\n\n{schema_block}"

def _normalize_strategy_obj(obj: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(obj, dict):
        return {}

    # ---------- confidence ----------
    conf = obj.get("confidence") or {}
    if not isinstance(conf, dict):
        conf = {}

    raw_score = conf.get("score", None)

    # hard sanitize score -> int 0..100, fallback 50
    try:
        if raw_score is None:
            score = 50
        elif isinstance(raw_score, bool):
            score = 50
        elif isinstance(raw_score, (int, float)):
            score = int(raw_score)
        elif isinstance(raw_score, str):
            s = raw_score.strip().lower()
            if s in ("", "none", "null", "nan"):
                score = 50
            else:
                score = int(float(s))
        else:
            score = 50
    except Exception:
        score = 50

    # clamp
    if score < 0:
        score = 0
    if score > 100:
        score = 100

    conf["score"] = score
    conf["band"] = conf.get("band") or "medium"

    def _to_list(x):
        if x is None:
            return []
        if isinstance(x, list):
            return [str(v) for v in x]
        return [str(x)]
    
    def _theme_of(lv: Dict[str, Any]) -> str:
        text = " ".join([
            str(lv.get("title", "")),
            str(lv.get("why", "")),
            str(lv.get("metric", "")),
            str(lv.get("next_mock_rule", "")),
            " ".join(_to_list(lv.get("do"))),
            " ".join(_to_list(lv.get("stop"))),
        ]).lower()

        if any(k in text for k in ["negative", "accuracy", "mistake", "guess", "tukka", "careless"]):
            return "damage_control"
        if any(k in text for k in ["order", "reorder", "selection", "skip", "attempt", "confidence bucket"]):
            return "selection_bias"
        if any(k in text for k in ["time", "minutes", "timer", "section end", "last", "end-game", "deadline"]):
            return "end_game"
        return "unknown"


    conf["assumptions"] = _to_list(conf.get("assumptions"))
    conf["missing_signals"] = _to_list(conf.get("missing_signals"))

    obj["confidence"] = conf


    # ---------- top_levers ----------
    levers = obj.get("top_levers") or []
    if not isinstance(levers, list):
        levers = []

    fixed_levers = []
    fallback_used = False
    seen_themes = set()

    for lv in levers:
        if not isinstance(lv, dict):
            continue

        theme = _theme_of(lv)

        # skip duplicate failure modes
        if theme in seen_themes:
            continue

        seen_themes.add(theme)

        fixed_levers.append({
            "title": lv.get("title") or lv.get("action") or "Primary execution lever",
            "do": _to_list(lv.get("do") or lv.get("steps") or "Apply this rule in the next mock"),
            "stop": _to_list(lv.get("stop") or lv.get("avoid") or "Avoid repeating this mistake"),
            "why": lv.get("why") or "Improves decision quality",
            "metric": lv.get("metric") or "Negative marks and accuracy in next mock",
            "next_mock_rule": lv.get("next_mock_rule") or "Follow this rule strictly in next mock",
        })

        # hard cap: max 3 strong levers
        if len(fixed_levers) >= 3:
            break

    # fallback if model was trash
    if not fixed_levers:
        fixed_levers = [
            {
                "title": "Damage-control first",
                "do": ["Skip questions if no clear approach in 60 seconds"],
                "stop": ["Blind guessing under pressure"],
                "why": "When signals are weak, negative marks dominate score loss",
                "metric": "Negative marks count",
                "next_mock_rule": "No guess without elimination",
            },
            {
                "title": "Protect end-game time",
                "do": ["Hard stop each question at 90 seconds"],
                "stop": ["Carrying one question too long"],
                "why": "Late-section collapse is a common silent score killer",
                "metric": "Unattempted easy questions in last 20%",
                "next_mock_rule": "Timer > ego in final stretch",
            },
        ]
        fallback_used = True

    # mark fallback explicitly
    obj["_is_fallback"] = fallback_used
    obj["top_levers"] = fixed_levers


    # ---------- if_then_rules ----------
    rules = _to_list(obj.get("if_then_rules"))
    while len(rules) < 3:
        rules.append("IF stuck > 60s THEN skip and move on")
    obj["if_then_rules"] = rules[:10]

    # ---------- plan_days ----------
    days = obj.get("plan_days") or []
    if not isinstance(days, list):
        days = []

    fixed_days = []
    for i, d in enumerate(days[:14]):
        if not isinstance(d, dict):
            continue
        fixed_days.append({
            "day": d.get("day") or (i + 1),
            "title": d.get("title") or "Execution drill",
            "minutes": d.get("minutes") or 60,
            "tasks": _to_list(d.get("tasks") or ["Timed drill", "Error review"])[:8],
        })

    if len(fixed_days) < 3:
        fixed_days = [
            {"day": 1, "title": "Rules setup", "minutes": 60, "tasks": ["Set skip rules", "Light drill"]},
            {"day": 2, "title": "Accuracy lock", "minutes": 60, "tasks": ["Timed set", "Review errors"]},
            {"day": 3, "title": "Mock execution", "minutes": 90, "tasks": ["Full mock", "Post-analysis"]},
        ]

    obj["plan_days"] = fixed_days[:14]


     # ---------- next_questions ----------
    nq = obj.get("next_questions")
    if nq is None:
        obj["next_questions"] = []
    elif isinstance(nq, list):
        obj["next_questions"] = [q for q in nq if isinstance(q, dict)][:2]
    else:
        obj["next_questions"] = []

    # ---------- title ----------
    obj["title"] = obj.get("title") or "Next Mock Strategy Plan"

    return obj


def generate_strategy_plan_best_effort(exam: str, intake: Dict[str, Any], report_dict: Dict[str, Any]) -> Dict[str, Any]:
    strategy_model = os.getenv("OPENAI_STRATEGY_MODEL") or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    strategy_debug = os.getenv("STRATEGY_DEBUG") == "1"

    base_user = _build_strategy_user_content(exam, intake, report_dict)

    def attempt(retry_note: Optional[str] = None) -> tuple[StrategyPlan, bool]:
        user_content = base_user if not retry_note else f"{base_user}\n\nRETRY_NOTE:\n{retry_note}"
        raw = client.chat.completions.create(
            model=strategy_model,
            messages=[
                {"role": "system", "content": STRATEGY_MASTER_SYSTEM_PROMPT + "\n\nReturn ONLY valid JSON. No markdown."},
                {"role": "user", "content": user_content},
            ],
            temperature=0.2 if not retry_note else 0.0,
        ).choices[0].message.content or ""

        obj = json.loads(_extract_json(raw))

        if strategy_debug:
            print("---- STRATEGY RAW JSON (parsed) ----")
            print(json.dumps(obj, ensure_ascii=False, indent=2)[:4000])
            print("-----------------------------------")

        normalized = _normalize_strategy_obj(obj)
        is_fallback = bool(normalized.get("_is_fallback"))

        if strategy_debug:
            print("---- STRATEGY NORMALIZED JSON ----")
            print(json.dumps(normalized, ensure_ascii=False, indent=2)[:4000])
            print("---------------------------------")
            print("DEBUG normalized confidence:", (normalized.get("confidence") or {}))

        plan = StrategyPlan.model_validate(normalized)
        return plan, is_fallback

    # 1st attempt
    plan, is_fallback = attempt()

    # retry only if generic advice (this is NOT fallback)
    if plan and _has_generic_advice(plan):
        plan2, is_fallback2 = attempt(
            "Your last output contained generic advice. Remove ALL generic phrases (practice more/revise/study more/be confident). "
            "Ensure every item is decision-level, measurable, and verifiable in the next mock. Keep <=3 levers."
        )
        if plan2:
            plan = plan2
            is_fallback = is_fallback2

    out = plan.model_dump()
    out["_is_fallback"] = is_fallback
    return out




# -----------------------------
# API
# -----------------------------
@app.get("/health")
def health():
    return {"ok": True}


@app.post("/analyze")
def analyze(inp: AnalyzeInput):
    try:
        report_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        prompt = build_prompt(inp.exam, inp.intake.model_dump(), inp.text)

        raw = _extract_json(_call_llm(prompt, model=report_model, temp=0.2))
        obj = json.loads(raw)  # throws if not JSON

        required = [
            "summary",
            "estimated_score",
            "strengths",
            "weaknesses",
            "error_types",
            "top_actions",
            "fourteen_day_plan",
            "next_mock_strategy",
        ]
        missing = [k for k in required if k not in obj]

        if missing:
            repair_prompt = f"""
You returned JSON but it is missing keys: {missing}.

Transform the INPUT JSON into EXACTLY this Report JSON shape (no wrapper, no extra keys):
summary, estimated_score, strengths, weaknesses, error_types, top_actions, fourteen_day_plan, next_mock_strategy, meta.

Rules:
- error_types must sum to 100
- fourteen_day_plan must have exactly 14 items (day 1..14)
Return ONLY JSON.

INPUT JSON:
{json.dumps(obj, ensure_ascii=False)}
""".strip()

            raw2 = _extract_json(_call_llm(repair_prompt, model=report_model, temp=0.0))
            report = Report.model_validate_json(raw2)
        else:
            report = Report.model_validate(obj)

        # enforce meta
        report.meta["prompt_version"] = os.getenv("PROMPT_VERSION", "py-v1.0.0")
        report.meta["engine"] = "python"
        report.meta["report_model"] = report_model

        # -------------------------
        # Strategy Plan V2 (NEW)
        # Best-effort: never blocks report
        # -------------------------
        try:
            report_dict = report.model_dump()
            plan = generate_strategy_plan_best_effort(
                exam=inp.exam,
                intake=inp.intake.model_dump(),
                report_dict=report_dict,  # ✅ matches function signature
            )
            report.meta["strategy_plan"] = plan
            report.meta["strategy_model"] = os.getenv("OPENAI_STRATEGY_MODEL") or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        except Exception as se:
            report.meta["strategy_plan_error"] = str(se)
            report.meta["strategy_plan"] = None  # ✅ helps UI detect missing plan cleanly
            report.meta["strategy_model"] = os.getenv("OPENAI_STRATEGY_MODEL") or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

        return {"report": report.model_dump()}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# Insights (existing)
# -----------------------------
class InsightsInput(BaseModel):
    userId: str
    exam: str  # "CAT" | "NEET" | "JEE" | "UPSC" | "ALL"
    attempts: List[Dict[str, Any]]


def _clamp(x, a, b):
    return max(a, min(b, x))


def _safe_num(x, default=0.0):
    try:
        return float(x)
    except:
        return float(default)


def _lin_slope(xs: List[float]) -> float:
    n = len(xs)
    if n < 2:
        return 0.0
    x = list(range(n))
    x_mean = sum(x) / n
    y_mean = sum(xs) / n
    num = sum((x[i] - x_mean) * (xs[i] - y_mean) for i in range(n))
    den = sum((x[i] - x_mean) ** 2 for i in range(n)) or 1e-9
    return num / den


def _std(xs: List[float]) -> float:
    if len(xs) < 2:
        return 0.0
    m = sum(xs) / len(xs)
    v = sum((a - m) ** 2 for a in xs) / (len(xs) - 1)
    return math.sqrt(v)


def _day_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}-{dt.day:02d}"


def _parse_dt(x) -> Optional[datetime]:
    if isinstance(x, datetime):
        return x
    if isinstance(x, str):
        try:
            s = x.replace("Z", "+00:00")
            return datetime.fromisoformat(s)
        except:
            return None
    return None


def _streak_days(dates: List[datetime]) -> int:
    if not dates:
        return 0
    uniq = sorted(set(_day_key(d) for d in dates), reverse=True)
    if not uniq:
        return 0

    def _as_date(k: str) -> datetime:
        y, m, d = k.split("-")
        return datetime(int(y), int(m), int(d), tzinfo=timezone.utc)

    s = 1
    for i in range(1, len(uniq)):
        prev = _as_date(uniq[i - 1])
        cur = _as_date(uniq[i])
        diff = (prev - cur).days
        if diff == 1:
            s += 1
        else:
            break
    return s


def _cadence(dates: List[datetime]) -> Dict[str, Any]:
    if not dates:
        return {"cadence": "unknown", "weekly_activity": 0, "streak_days": 0, "evidence": []}

    dates_sorted = sorted(dates)
    anchor = dates_sorted[-1]
    start14 = anchor - timedelta(days=13)
    last14 = [d for d in dates_sorted if d >= start14]
    unique_days14 = sorted(set(_day_key(d) for d in last14))
    weekly_activity = round(len(unique_days14) / 2, 1)

    counts_by_day = {}
    for d in last14:
        k = _day_key(d)
        counts_by_day[k] = counts_by_day.get(k, 0) + 1

    max_day_attempts = max(counts_by_day.values()) if counts_by_day else 0
    streak = _streak_days(last14)

    gaps = []
    for i in range(1, len(unique_days14)):
        a = _parse_dt(unique_days14[i - 1] + "T00:00:00+00:00")
        b = _parse_dt(unique_days14[i] + "T00:00:00+00:00")
        if a and b:
            gaps.append((b - a).days)
    max_gap = max(gaps) if gaps else 0

    evidence = []
    if weekly_activity >= 3:
        cadence = "steady"
        evidence.append(f"active on ~{weekly_activity} days/week (last 14d)")
    elif max_day_attempts >= 3 and max_gap >= 5:
        cadence = "binge"
        evidence.append(f"{max_day_attempts} attempts in a day + long gaps")
    else:
        cadence = "sporadic"
        evidence.append(f"active on ~{weekly_activity} days/week (last 14d)")

    return {"cadence": cadence, "weekly_activity": weekly_activity, "streak_days": streak, "evidence": evidence}


def _responsiveness(xs_chrono: List[float]) -> Dict[str, Any]:
    if len(xs_chrono) < 4:
        return {"responsiveness": "unknown", "evidence": ["not enough attempts to judge response trend"]}

    a = xs_chrono[-3:]
    b = xs_chrono[-6:-3] if len(xs_chrono) >= 6 else xs_chrono[:-3]
    if not b:
        return {"responsiveness": "unknown", "evidence": ["not enough baseline attempts"]}

    mean_a = sum(a) / len(a)
    mean_b = sum(b) / len(b)
    delta = mean_a - mean_b

    if delta >= 5:
        resp = "improving"
    elif delta <= -5:
        resp = "declining"
    else:
        resp = "flat"

    return {
        "responsiveness": resp,
        "delta_xp": round(delta, 1),
        "evidence": [f"recent avg XP {round(mean_a,1)} vs prior {round(mean_b,1)} (Δ {round(delta,1)})"],
    }


def _stuck_loop(reports_chrono: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not reports_chrono:
        return {"active": False}

    rs = reports_chrono[-6:]
    topics = []
    for r in rs:
        ws = r.get("weaknesses") or []
        if isinstance(ws, list):
            for w in ws:
                t = (w or {}).get("topic")
                sev = (w or {}).get("severity")
                if t:
                    topics.append((str(t).strip().lower(), int(sev) if str(sev).isdigit() else None))

    if not topics:
        return {"active": False}

    c = Counter([t for t, _ in topics])
    top_topic, top_n = c.most_common(1)[0]

    sevs = [s for t, s in topics if t == top_topic and isinstance(s, int)]
    avg_sev = round(sum(sevs) / len(sevs), 2) if sevs else None

    active = (top_n >= 3) and (avg_sev is None or avg_sev >= 3)

    return {
        "active": active,
        "topic": top_topic.title(),
        "repeats_in_last": top_n,
        "avg_severity": avg_sev,
        "evidence": [f"'{top_topic.title()}' repeats {top_n}x in last {len(rs)} mocks"],
    }


def _execution_style(dom_errors_recent: List[str], volatility: int) -> Dict[str, Any]:
    if not dom_errors_recent:
        return {"execution_style": "unknown", "evidence": []}

    last5 = dom_errors_recent[:5]
    time_n = last5.count("time")
    careless_n = last5.count("careless")
    conceptual_n = last5.count("conceptual")

    if time_n >= 3:
        return {"execution_style": "panic_cycle", "evidence": [f"time dominates {time_n}/5 recent mocks"]}
    if careless_n >= 3 and volatility >= 50:
        return {"execution_style": "speed_over_control", "evidence": [f"careless dominates {careless_n}/5 + high volatility"]}
    if conceptual_n >= 3 and volatility < 35:
        return {"execution_style": "control_over_speed", "evidence": [f"conceptual dominates {conceptual_n}/5 + stable performance"]}
    return {"execution_style": "balanced", "evidence": ["no single failure mode dominates consistently"]}


def persona_rules(attempts_reports: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rs = attempts_reports[:5]
    if not rs:
        return []

    doms = []
    xps = []
    weak_topics = []

    for r in rs:
        et = (r.get("error_types") or {})
        if isinstance(et, dict) and et:
            dom = max(et.items(), key=lambda kv: _safe_num(kv[1], 0))[0]
            doms.append(dom)

        xp = r.get("focusXP")
        if xp is None:
            xp = 100 - _safe_num(et.get("time", 0), 0)
        xp = _clamp(_safe_num(xp, 0), 0, 100)
        xps.append(xp)

        ws = r.get("weaknesses") or []
        if isinstance(ws, list):
            for w in ws[:2]:
                t = (w or {}).get("topic")
                if t:
                    weak_topics.append(str(t).strip())

    vol = _std(xps)
    high_vol = vol >= 12
    careless_count = sum(1 for d in doms if d == "careless")
    time_count = sum(1 for d in doms if d == "time")

    personas = []

    if careless_count >= 2 and high_vol:
        personas.append(
            {
                "label": "Fast-but-Careless",
                "confidence": "high" if careless_count >= 3 else "medium",
                "evidence": [f"careless dominates {careless_count}/{len(doms)} recent mocks", "high XP volatility"],
            }
        )

    if time_count >= 2:
        personas.append(
            {
                "label": "Conceptually-OK-but-Panics-on-Time",
                "confidence": "high" if time_count >= 3 else "medium",
                "evidence": [f"time dominates {time_count}/{len(doms)} recent mocks"],
            }
        )

    if weak_topics:
        top = max(set(weak_topics), key=lambda t: weak_topics.count(t))
        if weak_topics.count(top) >= 3:
            personas.append(
                {"label": "Stuck-in-Repeat-Loop", "confidence": "medium", "evidence": [f"'{top}' repeats across multiple mocks"]}
            )

    return personas[:2]


@app.post("/insights")
def insights(inp: InsightsInput):
    try:
        attempts = inp.attempts or []

        reports = []
        xps = []
        dom_errors = []
        dates = []
        series = []

        for a in attempts:
            dt = _parse_dt(a.get("createdAt"))
            if dt:
                dates.append(dt)

            r = (a.get("report") or {})
            if not isinstance(r, dict):
                continue
            reports.append(r)

            xp = r.get("focusXP")
            if xp is None:
                et = r.get("error_types") or {}
                xp = 100 - _safe_num(et.get("time", 0), 0)
            xp = _clamp(_safe_num(xp, 0), 0, 100)
            xps.append(xp)
            series.append({"xp": xp, "date": dt.isoformat() if dt else None})

            et = r.get("error_types") or {}
            if isinstance(et, dict) and et:
                dom = max(et.items(), key=lambda kv: _safe_num(kv[1], 0))[0]
                dom_errors.append(dom)

        if not xps:
            return {
                "trend": "unknown",
                "dominant_error": "unknown",
                "consistency": "unknown",
                "volatility": 0,
                "risk_zone": "none",
                "personas": [],
                "learning_curve": [],
                "learning_behavior": {
                    "cadence": "unknown",
                    "streak_days": 0,
                    "weekly_activity": 0,
                    "responsiveness": "unknown",
                    "stuck_loop": {"active": False},
                    "execution_style": "unknown",
                    "confidence": "low",
                    "evidence": ["no usable reports found in attempts"],
                },
            }

        xs_chrono = list(reversed(xps))
        reports_chrono = list(reversed(reports))
        curve_chrono = list(reversed(series))

        slope = _lin_slope(xs_chrono)
        if slope > 1.2:
            trend = "improving"
        elif slope < -1.2:
            trend = "declining"
        else:
            trend = "plateau"

        vol = _std(xs_chrono)
        volatility = int(_clamp(vol * 6, 0, 100))

        if vol < 6:
            consistency = "high"
        elif vol < 12:
            consistency = "medium"
        else:
            consistency = "low"

        dominant_error = max(set(dom_errors), key=lambda k: dom_errors.count(k)) if dom_errors else "unknown"

        risk_zone = "none"
        recent_dom = dom_errors[:3]
        if recent_dom.count("time") >= 2:
            risk_zone = "late_section_panic"
        elif recent_dom.count("careless") >= 2:
            risk_zone = "speed_over_control"
        elif dominant_error == "comprehension":
            risk_zone = "misread_trap"

        personas = persona_rules(reports)

        cadence_pack = _cadence(dates)
        resp_pack = _responsiveness(xs_chrono)
        loop_pack = _stuck_loop(reports_chrono)
        exec_pack = _execution_style(dom_errors, volatility)

        n = len(xs_chrono)
        conf = "high" if n >= 8 else ("medium" if n >= 4 else "low")

        evidence = []
        evidence += cadence_pack.get("evidence", [])
        evidence += resp_pack.get("evidence", [])
        if loop_pack.get("evidence"):
            evidence += loop_pack["evidence"]
        evidence += exec_pack.get("evidence", [])

        learning_behavior = {
            "cadence": cadence_pack.get("cadence", "unknown"),
            "streak_days": cadence_pack.get("streak_days", 0),
            "weekly_activity": cadence_pack.get("weekly_activity", 0),
            "responsiveness": resp_pack.get("responsiveness", "unknown"),
            "delta_xp": resp_pack.get("delta_xp", 0),
            "stuck_loop": loop_pack,
            "execution_style": exec_pack.get("execution_style", "unknown"),
            "confidence": conf,
            "evidence": evidence[:6],
        }

        return {
            "trend": trend,
            "dominant_error": dominant_error,
            "consistency": consistency,
            "volatility": volatility,
            "risk_zone": risk_zone,
            "personas": personas,
            "learning_curve": [
                {"index": idx + 1, "xp": s.get("xp", 0), "date": s.get("date")}
                for idx, s in enumerate(curve_chrono)
            ],
            "learning_behavior": learning_behavior,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
