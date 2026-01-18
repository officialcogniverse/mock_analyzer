import os
from typing import Any, Dict, List, Literal, Optional
import json
import math
from datetime import datetime
from fastapi import FastAPI
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from datetime import timedelta

from openai import OpenAI

load_dotenv()

app = FastAPI()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

Exam = Literal["CAT", "NEET", "JEE"]


class Intake(BaseModel):
    goal: Optional[str] = None
    hardest: Optional[str] = None
    weekly_hours: Optional[str] = None


class AnalyzeInput(BaseModel):
    exam: Exam
    intake: Intake = Field(default_factory=Intake)
    text: str


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
    # optional: meta field for versioning
    meta: Dict[str, Any] = Field(default_factory=dict)


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
    return """JEE EXAM CONTEXT:
- Focus on multi-step reasoning, approach quality, and topic mastery.
- Avoid guessing section-level weaknesses unless stated.
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



@app.get("/health")
def health():
    return {"ok": True}


from fastapi import HTTPException
import traceback

@app.post("/analyze")
def analyze(inp: AnalyzeInput):
    try:
        prompt = build_prompt(inp.exam, inp.intake.model_dump(), inp.text)
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

        def call_llm(p: str, temp: float = 0.2) -> str:
            r = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "Return ONLY valid JSON. No markdown, no extra text."},
                    {"role": "user", "content": p},
                ],
                temperature=temp,
            )
            return (r.choices[0].message.content or "").strip()

        def extract_json(raw: str) -> str:
            raw = raw.strip()
            if raw.startswith("{") and raw.endswith("}"):
                return raw
            s = raw.find("{")
            e = raw.rfind("}")
            if s != -1 and e != -1 and e > s:
                return raw[s:e+1]
            return raw

        raw = extract_json(call_llm(prompt, temp=0.2))

        # First parse attempt (might still be wrong shape)
        obj = json.loads(raw)  # will throw if not JSON

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

            raw2 = extract_json(call_llm(repair_prompt, temp=0.0))
            report = Report.model_validate_json(raw2)
        else:
            report = Report.model_validate(obj)

        # enforce meta
        report.meta["prompt_version"] = os.getenv("PROMPT_VERSION", "py-v1.0.0")
        report.meta["engine"] = "python"

        return {"report": report.model_dump()}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
class InsightsInput(BaseModel):
    userId: str
    exam: str  # "CAT" | "NEET" | "JEE" | "ALL"
    attempts: List[Dict[str, Any]]


def _clamp(x, a, b):
    return max(a, min(b, x))


def _safe_num(x, default=0.0):
    try:
        return float(x)
    except:
        return float(default)


def _lin_slope(xs: List[float]) -> float:
    # slope over index 0..n-1 (simple regression)
    n = len(xs)
    if n < 2:
        return 0.0
    x = list(range(n))
    x_mean = sum(x)/n
    y_mean = sum(xs)/n
    num = sum((x[i]-x_mean)*(xs[i]-y_mean) for i in range(n))
    den = sum((x[i]-x_mean)**2 for i in range(n)) or 1e-9
    return num/den


def _std(xs: List[float]) -> float:
    if len(xs) < 2:
        return 0.0
    m = sum(xs)/len(xs)
    v = sum((a-m)**2 for a in xs)/(len(xs)-1)
    return math.sqrt(v)


def persona_rules(attempts_reports: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    # use last 5 reports
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
        xp = _safe_num(r.get("meta", {}).get("focus_xp", r.get("focusXP", 0)), 0)
        xps.append(xp)

        ws = r.get("weaknesses") or []
        if isinstance(ws, list):
            for w in ws[:2]:
                t = (w or {}).get("topic")
                if t:
                    weak_topics.append(str(t).strip())

    vol = _std(xps)
    high_vol = vol >= 12  # tune later
    careless_count = sum(1 for d in doms if d == "careless")
    time_count = sum(1 for d in doms if d == "time")

    personas = []

    if careless_count >= 2 and high_vol:
        personas.append({
            "label": "Fast-but-Careless",
            "confidence": "high" if careless_count >= 3 else "medium",
            "evidence": [f"careless dominates {careless_count}/{len(doms)} recent mocks", "high XP volatility"]
        })

    if time_count >= 2:
        personas.append({
            "label": "Conceptually-OK-but-Panics-on-Time",
            "confidence": "high" if time_count >= 3 else "medium",
            "evidence": [f"time dominates {time_count}/{len(doms)} recent mocks"]
        })

    # stuck loop: repeated topics
    if weak_topics:
        top = max(set(weak_topics), key=lambda t: weak_topics.count(t))
        if weak_topics.count(top) >= 3:
            personas.append({
                "label": "Stuck-in-Repeat-Loop",
                "confidence": "medium",
                "evidence": [f"'{top}' repeats across multiple mocks"]
            })

    return personas[:2]


from datetime import datetime, timezone

def _day_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}-{dt.day:02d}"

def _parse_dt(x) -> Optional[datetime]:
    if isinstance(x, datetime):
        return x
    if isinstance(x, str):
        try:
            # handles "2026-01-18T12:34:56.789Z" or without Z
            s = x.replace("Z", "+00:00")
            return datetime.fromisoformat(s)
        except:
            return None
    return None

def _streak_days(dates: List[datetime]) -> int:
    if not dates:
        return 0
    # unique days, sorted desc
    uniq = sorted(set(_day_key(d) for d in dates), reverse=True)
    if not uniq:
        return 0

    def _as_date(k: str) -> datetime:
        y, m, d = k.split("-")
        return datetime(int(y), int(m), int(d), tzinfo=timezone.utc)

    s = 1
    for i in range(1, len(uniq)):
        prev = _as_date(uniq[i-1])
        cur = _as_date(uniq[i])
        diff = (prev - cur).days
        if diff == 1:
            s += 1
        else:
            break
    return s

def _cadence(dates: List[datetime]) -> Dict[str, Any]:
    # cadence over last 14 days from most recent attempt date
    if not dates:
        return {"cadence": "unknown", "weekly_activity": 0, "streak_days": 0, "evidence": []}

    dates_sorted = sorted(dates)
    anchor = dates_sorted[-1]
    start14 = anchor - timedelta(days=13)
    last14 = [d for d in dates_sorted if d >= start14]
    unique_days14 = sorted(set(_day_key(d) for d in last14))
    weekly_activity = round(len(unique_days14) / 2, 1)  # active days per week (approx)

    # binge detection: 4+ attempts in <=2 days and then a >=5 day gap somewhere
    # (simple heuristic)
    counts_by_day = {}
    for d in last14:
        k = _day_key(d)
        counts_by_day[k] = counts_by_day.get(k, 0) + 1

    max_day_attempts = max(counts_by_day.values()) if counts_by_day else 0
    streak = _streak_days(last14)

    # gaps
    gaps = []
    for i in range(1, len(unique_days14)):
        a = _parse_dt(unique_days14[i-1] + "T00:00:00+00:00")
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

    return {
        "cadence": cadence,
        "weekly_activity": weekly_activity,
        "streak_days": streak,
        "evidence": evidence,
    }

def _responsiveness(xs_chrono: List[float]) -> Dict[str, Any]:
    # compare last 3 vs previous 3 on XP
    if len(xs_chrono) < 4:
        return {"responsiveness": "unknown", "evidence": ["not enough attempts to judge response trend"]}

    a = xs_chrono[-3:]
    b = xs_chrono[-6:-3] if len(xs_chrono) >= 6 else xs_chrono[:-3]
    if not b:
        return {"responsiveness": "unknown", "evidence": ["not enough baseline attempts"]}

    mean_a = sum(a)/len(a)
    mean_b = sum(b)/len(b)
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
    # look at weaknesses topics in last 6 reports
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

    # count topic frequency
    from collections import Counter
    c = Counter([t for t,_ in topics])
    top_topic, top_n = c.most_common(1)[0]

    # avg severity for this topic if available
    sevs = [s for t,s in topics if t == top_topic and isinstance(s, int)]
    avg_sev = round(sum(sevs)/len(sevs), 2) if sevs else None

    active = (top_n >= 3) and (avg_sev is None or avg_sev >= 3)

    return {
        "active": active,
        "topic": top_topic.title(),
        "repeats_in_last": top_n,
        "avg_severity": avg_sev,
        "evidence": [f"'{top_topic.title()}' repeats {top_n}x in last {len(rs)} mocks"],
    }

def _execution_style(dom_errors_recent: List[str], volatility: int) -> Dict[str, Any]:
    # very interpretable v1 rules
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

@app.post("/insights")
def insights(inp: InsightsInput):
    try:
        attempts = inp.attempts or []

        # keep original structures
        reports = []
        xps = []
        dom_errors = []
        dates = []

        for a in attempts:
            # createdAt can be Date or string depending on driver serialization
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

        # chronological lists (oldest -> newest)
        xs_chrono = list(reversed(xps))
        reports_chrono = list(reversed(reports))

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

        if dom_errors:
            dominant_error = max(set(dom_errors), key=lambda k: dom_errors.count(k))
        else:
            dominant_error = "unknown"

        risk_zone = "none"
        recent_dom = dom_errors[:3]
        if recent_dom.count("time") >= 2:
            risk_zone = "late_section_panic"
        elif recent_dom.count("careless") >= 2:
            risk_zone = "speed_over_control"
        elif dominant_error == "comprehension":
            risk_zone = "misread_trap"

        personas = persona_rules(reports)

        # ---- learning behavior signals (NEW)
        cadence_pack = _cadence(dates)
        resp_pack = _responsiveness(xs_chrono)
        loop_pack = _stuck_loop(reports_chrono)
        exec_pack = _execution_style(dom_errors, volatility)

        # confidence heuristic: more attempts => higher confidence
        n = len(xs_chrono)
        if n >= 8:
            conf = "high"
        elif n >= 4:
            conf = "medium"
        else:
            conf = "low"

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
            "evidence": evidence[:6],  # keep it short for UI
        }

        return {
            "trend": trend,
            "dominant_error": dominant_error,
            "consistency": consistency,
            "volatility": volatility,
            "risk_zone": risk_zone,
            "personas": personas,
            "learning_behavior": learning_behavior,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
