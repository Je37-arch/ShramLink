"""Validate every writable field; never accept role/verification flags from clients."""

import re
from datetime import date

from app.catalog import DOMAINS, LOCATIONS, SKILLS
from app.timeutils import localdate


def text(data, key, maximum, errors, required=True, minimum=1):
    value = data.get(key, "")
    if not isinstance(value, str):
        errors[key] = "सही टेक्स्ट लिखें / Enter text."
        return ""
    value = value.strip()
    if (
        (required and len(value) < minimum)
        or len(value) > maximum
        or any(ord(c) < 32 and c not in "\n\t" for c in value)
    ):
        errors[key] = f"{minimum}–{maximum} अक्षर लिखें / characters required."
    return value


def integer(data, key, low, high, errors):
    value = data.get(key)
    if (
        isinstance(value, bool)
        or len(str(value)) > 10
        or not re.fullmatch(
            r"[0-9]+", str(value or "0") if value == 0 else str(value or "")
        )
    ):
        errors[key] = f"{low}–{high} के बीच पूरी संख्या लिखें / Enter a whole number."
        return None
    value = int(value)
    if not low <= value <= high:
        errors[key] = f"{low}–{high} के बीच संख्या लिखें / Outside allowed range."
    return value


def choice(data, key, options, errors):
    value = data.get(key)
    if not isinstance(value, str) or value not in options:
        errors[key] = "दिए गए विकल्पों में से चुनें / Choose an option."
        return None
    return value


def phone_number(data, errors):
    value = text(data, "phone", 20, errors)
    value = re.sub(r"[\s-]", "", value)
    if not re.fullmatch(r"[6-9][0-9]{9}", value):
        errors["phone"] = (
            "10 अंकों का भारतीय मोबाइल नंबर लिखें / Enter a 10-digit Indian mobile number."
        )
    return value


def password(data, errors):
    value = data.get("password", "")
    if not isinstance(value, str) or not 10 <= len(value) <= 128:
        errors["password"] = "पासवर्ड 10–128 अक्षरों का हो / Use 10–128 characters."
        return ""
    if value != data.get("confirm_password"):
        errors["confirm_password"] = "दोनों पासवर्ड एक जैसे हों / Passwords must match."
    return value


def profile(data):
    errors = {}
    clean = {
        "name": text(data, "name", 100, errors, minimum=2),
        "age": integer(data, "age", 18, 80, errors),
        "preferred_domain": choice(data, "preferred_domain", DOMAINS, errors),
        "location": choice(data, "location", LOCATIONS, errors),
        "experience_years": integer(data, "experience_years", 0, 62, errors),
        "eshram_number": text(data, "eshram_number", 24, errors, required=False),
    }
    skills = (
        data.getlist("skills") if hasattr(data, "getlist") else data.get("skills", [])
    )
    if (
        not isinstance(skills, list)
        or not skills
        or len(skills) > len(SKILLS)
        or any(not isinstance(s, str) or s not in SKILLS for s in skills)
    ):
        errors["skills"] = (
            "कम से कम एक दिया गया कौशल चुनें / Choose at least one listed skill."
        )
        skills = []
    clean["skills"] = list(dict.fromkeys(skills))
    if (
        clean["age"] is not None
        and clean["experience_years"] is not None
        and clean["experience_years"] > clean["age"] - 18
    ):
        errors["experience_years"] = (
            "18 वर्ष की उम्र के बाद का अनुभव लिखें / Enter experience after age 18."
        )
    clean["eshram_number"] = re.sub(r"[\s-]", "", clean["eshram_number"])
    if clean["eshram_number"] and not re.fullmatch(
        r"[0-9]{12}", clean["eshram_number"]
    ):
        errors["eshram_number"] = (
            "12 अंक लिखें या खाली छोड़ें / Use 12 digits or leave blank."
        )
    if data.get("confirmed") != "yes":
        errors["confirmed"] = (
            "जानकारी जाँचकर पुष्टि करें / Review and confirm before saving."
        )
    return clean, errors


def vacancy(data):
    errors = {}
    clean = {
        "title": text(data, "title", 100, errors, minimum=3),
        "description": text(data, "requirements", 2000, errors, minimum=5),
        "skill": choice(data, "skill", SKILLS, errors),
        "domain": choice(data, "domain", DOMAINS, errors),
        "location": choice(data, "location", LOCATIONS, errors),
        "worksite_address": text(data, "worksite_address", 200, errors, minimum=5),
        "wage_per_day": integer(data, "wage", 1, 100000, errors),
        "workers_needed": integer(data, "workers", 1, 1000, errors),
        "min_experience": integer(data, "min_experience", 0, 62, errors),
        "shift_timing": text(data, "shift", 50, errors, minimum=3),
    }
    try:
        clean["start_date"] = date.fromisoformat(data.get("start_date", ""))
        if clean["start_date"] < localdate():
            errors["start_date"] = (
                "आज या आगे की तारीख चुनें / Choose today or a future date."
            )
    except (TypeError, ValueError):
        errors["start_date"] = "सही तारीख चुनें / Enter a valid date."
    return clean, errors
