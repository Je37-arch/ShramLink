from flask import Blueprint, render_template, request
from app.models.data import (
    JOBS, SKILLS, FEEDBACK_TAGS, format_inr, SkillId,
    PLATFORM_FEE, MASS_HIRE_PER_WORKER, detect_skills
)

main_bp = Blueprint('main', __name__)

FEATURES = [
    {
        'icon': 'mic',
        'title': 'Register by voice',
        'hi': 'आवाज़ से पंजीकरण',
        'body': 'Workers say their name, age and skills in Hindi. No typing, no forms, and it works on a basic smartphone.',
    },
    {
        'icon': 'shield-check',
        'title': 'Verified on both sides',
        'hi': 'दोनों तरफ सत्यापन',
        'body': 'Workers are checked with Aadhaar OTP and e-Shram. Factories are checked with GSTIN before they can post a job.',
    },
    {
        'icon': 'wallet',
        'title': 'Wages held upfront',
        'hi': 'मज़दूरी पहले से सुरक्षित',
        'body': 'The factory pays into escrow when it posts the job. When the shift is done, the worker is paid by UPI.',
    },
]

STEPS_WORKER = [
    'Register with your voice and phone number',
    'Browse verified jobs near you, up to 15 applications a day',
    'Get selected, do the shift, receive your wage on UPI',
]

STEPS_FACTORY = [
    'Register your factory and get verified',
    'Post a job with the skill, shift and daily wage',
    'Pick from rated, verified applicants or request a mass hire',
]

@main_bp.route('/')
def index():
    return render_template('index.html',
        features=FEATURES,
        steps_worker=STEPS_WORKER,
        steps_factory=STEPS_FACTORY,
        jobs=JOBS[:3],
        skills=SKILLS,
        format_inr=format_inr,
    )

@main_bp.route('/login')
def login():
    role = request.args.get('as', 'laborer')
    return render_template('login.html', role=role)

@main_bp.route('/about')
def about():
    return render_template('about.html')

@main_bp.route('/laborer')
def laborer_standalone():
    """Standalone laborer dashboard page (full HTML, not extending base)"""
    return render_template('laborer_standalone.html')