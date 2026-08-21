"""EmailGeneration agent (System.txt sections 15-16, 40).

Personalizes the master template using ONLY verified facts already stored
on the lead/job/company (never invents company facts or pain points). The
AI's job is to write ONE natural personalization sentence/paragraph that
weaves in real facts — the surrounding template structure stays fixed so
tone/compliance stays consistent.
"""
from app.integrations.openai_client import structured_completion
from app.prompts.email_master_template import (
    MASTER_SUBJECT, MASTER_PLAIN_TEMPLATE, MASTER_HTML_TEMPLATE,
    DEFAULT_FOLLOW_UP_1_SUBJECT, DEFAULT_FOLLOW_UP_1_BODY,
)

PERSONALIZATION_SCHEMA = {
    "type": "object",
    "properties": {
        "personalization_line": {"type": "string"},
        "personalization_points": {"type": "array", "items": {"type": "string"}},
        "facts_used": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "number"},
    },
    "required": ["personalization_line", "personalization_points", "facts_used", "confidence"],
    "additionalProperties": False,
}

PERSONALIZATION_SYSTEM_PROMPT = """You write ONE short, natural personalization paragraph (2-3 sentences) for a
cold outreach email, to be inserted into a fixed template. You MUST use
ONLY the verified facts provided below (job title, city, responsibilities,
automation_signals, pain_points). Never invent details about the company
that are not in the provided facts. Reference at most 2-3 concrete facts so
it reads specific, not generic. facts_used must list exactly which provided
facts you referenced, verbatim or closely paraphrased — this is used for an
audit trail, so be precise."""

FOLLOWUP_SCHEMA = {
    "type": "object",
    "properties": {
        "body": {"type": "string"},
        "confidence": {"type": "number"},
    },
    "required": ["body", "confidence"],
    "additionalProperties": False,
}

FOLLOWUP_SYSTEM_PROMPT = """You write a short, polite follow-up email (shorter than the original cold
email, 3-5 sentences max) referencing that a previous email was already
sent about a specific job/automation opportunity. Use only the verified
facts provided. Do not repeat the entire pitch — just a brief nudge. Do not
fabricate any prior conversation content beyond what is given."""


def _render(template: str, **kwargs) -> str:
    out = template
    for k, v in kwargs.items():
        out = out.replace("{{" + k + "}}", v or "")
    return out


def generate_initial_email(*, company_name: str, job_title: str, city: str | None,
                            contact_name: str | None, automation_signals: list[str],
                            pain_points: list[str], sender_name: str, botivate_website: str) -> dict:
    facts = {
        "job_title": job_title,
        "company_name": company_name,
        "city": city,
        "automation_signals": automation_signals,
        "pain_points": pain_points,
    }
    user_prompt = f"Verified facts (JSON): {facts}\n\nWrite the personalization paragraph."
    result = structured_completion(
        system_prompt=PERSONALIZATION_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        schema=PERSONALIZATION_SCHEMA,
        schema_name="email_personalization",
    )
    if result is None:
        # Deterministic, fact-only fallback when OpenAI is unavailable — never fabricated.
        signal_txt = f" particularly around {automation_signals[0]}" if automation_signals else ""
        result = {
            "personalization_line": (
                f"Roles like this at {company_name} often involve recurring manual reporting"
                f"{signal_txt}, which is exactly the kind of work AutoRocket is built to automate."
            ),
            "personalization_points": automation_signals[:3],
            "facts_used": [f"job_title={job_title}", f"company_name={company_name}"],
            "confidence": 0.4,
        }

    contact_name_or_team = contact_name or "there"
    location_suffix = f" in {city}" if city else ""
    render_kwargs = dict(
        contact_name_or_team=contact_name_or_team,
        company_name=company_name,
        job_title=job_title,
        location_suffix=location_suffix,
        personalization_line=result["personalization_line"],
        sender_name=sender_name,
        botivate_website=botivate_website,
    )
    plain_body = _render(MASTER_PLAIN_TEMPLATE, **render_kwargs)
    html_body = _render(MASTER_HTML_TEMPLATE, **render_kwargs)
    return {
        "subject": MASTER_SUBJECT,
        "plain_text_body": plain_body,
        "html_body": html_body,
        "personalization_points": result["personalization_points"],
        "facts_used": result["facts_used"],
        "confidence": result["confidence"],
    }


def generate_follow_up_email(*, company_name: str, job_title: str, contact_name: str | None,
                              sequence_number: int, previous_subject: str, sender_name: str) -> dict:
    user_prompt = (
        f"Company: {company_name}\nJob title: {job_title}\n"
        f"This is follow-up #{sequence_number}. Previous email subject: {previous_subject}\n\n"
        "Write the follow-up body."
    )
    result = structured_completion(
        system_prompt=FOLLOWUP_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        schema=FOLLOWUP_SCHEMA,
        schema_name="follow_up_generation",
    )
    contact_name_or_team = contact_name or "there"
    if result is None:
        body = _render(DEFAULT_FOLLOW_UP_1_BODY, contact_name_or_team=contact_name_or_team,
                        company_name=company_name, job_title=job_title, sender_name=sender_name)
        confidence = 0.4
    else:
        body = result["body"]
        confidence = result["confidence"]
    subject = f"Re: {previous_subject}" if not previous_subject.startswith("Re:") else previous_subject
    return {"subject": subject, "body": body, "confidence": confidence}
