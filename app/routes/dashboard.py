from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user
from app.models import db, User, UserRole, Job, JobApplication, ApplicationStatus, SkillType, JobStatus
from app.models import EscrowRecord, EscrowStatus, MassHireRequest, MassHireAssignment, WorkerRating
from sqlalchemy import func, and_, or_
from datetime import date, datetime, timedelta
import json

dashboard_bp = Blueprint('dashboard', __name__)

DAILY_APPLY_LIMIT = 15

def format_inr(n):
    return f'₹{n:,}'

def detect_skills(title):
    lower = title.lower()
    tags = set()
    keywords = {
        'machine': ['#CNC', '#Packaging'],
        'operator': ['#MachineOperator'],
        'weld': ['#Welding', '#Fabrication'],
        'load': ['#Loading', '#Lifting'],
        'pack': ['#Packaging', '#Labelling'],
        'mason': ['#Masonry', '#Construction'],
        'construct': ['#Construction', '#Masonry'],
        'paint': ['#Painting', '#Finishing'],
        'electric': ['#Wiring', '#Electrical'],
        'helper': ['#Helper', '#GeneralLabour'],
        'driver': ['#Driving', '#Forklift'],
    }
    for kw, lst in keywords.items():
        if kw in lower:
            tags.update(lst)
    return list(tags)

def generate_job_code():
    """Generate unique job code like JB-2041"""
    last_job = Job.query.order_by(Job.id.desc()).first()
    num = (last_job.id + 1) if last_job else 2041
    return f'JB-{num}'

def generate_mass_hire_code():
    """Generate unique mass hire code like MH-118"""
    last = MassHireRequest.query.order_by(MassHireRequest.id.desc()).first()
    num = (last.id + 1) if last else 118
    return f'MH-{num}'

@dashboard_bp.route('/dashboard')
@login_required
def index():
    if current_user.role == UserRole.LABORER:
        return redirect(url_for('dashboard.laborer_dashboard'))
    elif current_user.role == UserRole.MANAGER:
        return redirect(url_for('dashboard.manager_dashboard'))
    elif current_user.role == UserRole.ADMIN:
        return redirect(url_for('admin.index'))
    return redirect(url_for('main.index'))

# ============ LABORER DASHBOARD ============

@dashboard_bp.route('/dashboard/laborer')
@login_required
def laborer_dashboard():
    if current_user.role != UserRole.LABORER:
        flash('Access denied.', 'error')
        return redirect(url_for('dashboard.index'))
    return render_template('dashboard/laborer.html', user=current_user)

@dashboard_bp.route('/api/laborer/jobs')
@login_required
def api_laborer_jobs():
    if current_user.role != UserRole.LABORER:
        return jsonify({'error': 'Unauthorized'}), 403
    
    filter_skill = request.args.get('skill', 'all')
    
    # Base query: active jobs
    query = Job.query.filter(Job.status == JobStatus.ACTIVE)
    
    if filter_skill != 'all':
        try:
            skill_enum = SkillType(filter_skill)
            query = query.filter(Job.skill == skill_enum)
        except ValueError:
            pass
    
    # Exclude jobs already applied to
    applied_job_ids = db.session.query(JobApplication.job_id).filter(
        JobApplication.laborer_id == current_user.id
    ).subquery()
    query = query.filter(~Job.id.in_(applied_job_ids))
    
    # Exclude jobs that are filled
    query = query.filter(Job.workers_hired < Job.workers_needed)
    
    jobs = query.order_by(Job.created_at.desc()).limit(50).all()
    
    # Count applications today
    today = date.today()
    applied_today = JobApplication.query.filter(
        JobApplication.laborer_id == current_user.id,
        JobApplication.application_date == today
    ).count()
    
    limit_reached = applied_today >= DAILY_APPLY_LIMIT
    
    # Get all skills for filter
    skills = [{'id': s.value, 'label': s.name.title(), 'hi': SKILL_HINDI.get(s.value, s.name)} for s in SkillType]
    
    return jsonify({
        'jobs': [{
            'id': j.id,
            'job_code': j.job_code,
            'title': j.title,
            'titleHi': j.title_hi or j.title,
            'factory': j.manager.factory_name,
            'verified': j.manager.is_verified,
            'distanceKm': round(j.distance_to_user(current_user) if hasattr(j, 'distance_to_user') else 2.5, 1),
            'wage': j.wage_per_day,
            'skill': j.skill.value,
            'shift': j.shift_timing,
            'applied': False,
            'disabled': limit_reached,
            'limitReached': limit_reached,
            'appliedToday': applied_today,
        } for j in jobs],
        'appliedToday': applied_today,
        'limitReached': limit_reached,
        'skills': skills,
    })

SKILL_HINDI = {
    'welder': 'वेल्डर',
    'construction': 'निर्माण',
    'loader': 'लोडर',
    'electrician': 'बिजली',
    'painter': 'पेंटर',
    'helper': 'हेल्पर',
}

@dashboard_bp.route('/api/laborer/apply', methods=['POST'])
@login_required
def api_laborer_apply():
    if current_user.role != UserRole.LABORER:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    job_id = data.get('job_id')
    
    if not job_id:
        return jsonify({'success': False, 'error': 'Job ID required'}), 400
    
    # Check daily limit
    today = date.today()
    applied_today = JobApplication.query.filter(
        JobApplication.laborer_id == current_user.id,
        JobApplication.application_date == today
    ).count()
    
    if applied_today >= DAILY_APPLY_LIMIT:
        return jsonify({'success': False, 'error': 'Daily application limit reached'}), 400
    
    # Check if job exists and is active
    job = Job.query.get(job_id)
    if not job:
        return jsonify({'success': False, 'error': 'Job not found'}), 404
    
    if job.status != JobStatus.ACTIVE:
        return jsonify({'success': False, 'error': 'Job is not accepting applications'}), 400
    
    if job.workers_hired >= job.workers_needed:
        return jsonify({'success': False, 'error': 'Job is already filled'}), 400
    
    # Check if already applied
    existing = JobApplication.query.filter_by(
        laborer_id=current_user.id, job_id=job_id
    ).first()
    if existing:
        return jsonify({'success': False, 'error': 'Already applied to this job'}), 400
    
    # Check verified_only requirement
    if job.verified_only and not current_user.is_verified:
        return jsonify({'success': False, 'error': 'This job requires verified workers only'}), 400
    
    # Create application
    application = JobApplication(
        laborer_id=current_user.id,
        job_id=job_id,
        application_date=today
    )
    db.session.add(application)
    db.session.commit()
    
    return jsonify({'success': True, 'applied': True, 'message': 'Application submitted successfully!'})

@dashboard_bp.route('/api/laborer/my-jobs')
@login_required
def api_laborer_my_jobs():
    if current_user.role != UserRole.LABORER:
        return jsonify({'error': 'Unauthorized'}), 403
    
    applications = JobApplication.query.filter_by(laborer_id=current_user.id).order_by(
        JobApplication.applied_at.desc()
    ).all()
    
    # Group by status
    status_groups = {
        'selected': {'en': 'Selected for Work', 'hi': 'काम के लिए चुने गए', 'icon': 'user-check', 'tone': 'border-l-manager', 'chip': 'bg-manager-soft text-manager'},
        'applied': {'en': 'Applied', 'hi': 'आवेदन किया', 'icon': 'hourglass', 'tone': 'border-l-warning', 'chip': 'bg-warning-soft text-warning'},
        'paid': {'en': 'Work Done & Paid', 'hi': 'काम पूरा, पैसा मिला', 'icon': 'circle-check', 'tone': 'border-l-primary', 'chip': 'bg-accent text-accent-foreground'},
    }
    
    result = {'earned': 0, 'format_inr': '₹0', 'groups': {}}
    total_earned = 0
    
    for status_key, meta in status_groups.items():
        if status_key == 'selected':
            apps = [a for a in applications if a.status == ApplicationStatus.SELECTED]
        elif status_key == 'applied':
            apps = [a for a in applications if a.status in [ApplicationStatus.APPLIED, ApplicationStatus.SHORTLISTED]]
        else:  # paid
            apps = [a for a in applications if a.status == ApplicationStatus.SELECTED and a.job and any(e.status == EscrowStatus.PAID_UPI for e in a.job.escrow_records)]
        
        jobs_data = []
        for app in apps:
            job = app.job
            payment_method = None
            if job:
                escrow = job.escrow_records.filter(EscrowRecord.status.in_([EscrowStatus.PAID_UPI, EscrowStatus.CASH_ZONE])).first()
                if escrow:
                    payment_method = escrow.payment_method
                    if escrow.status == EscrowStatus.PAID_UPI:
                        total_earned += escrow.amount
            
            jobs_data.append({
                'id': f'app-{app.id}',
                'title': job.title if job else 'Unknown Job',
                'factory': job.manager.factory_name if job and job.manager else 'Unknown Factory',
                'date': app.applied_at.strftime('%d %b') if app.status != ApplicationStatus.SELECTED else (app.selected_at.strftime('%d %b') if app.selected_at else 'Today'),
                'wage': job.wage_per_day if job else 0,
                'payment': payment_method,
            })
        
        result['groups'][status_key] = {
            'meta': meta,
            'jobs': jobs_data
        }
    
    result['earned'] = total_earned
    result['format_inr'] = format_inr(total_earned)
    
    return jsonify(result)

# ============ MANAGER DASHBOARD ============

@dashboard_bp.route('/dashboard/manager')
@login_required
def manager_dashboard():
    if current_user.role != UserRole.MANAGER:
        flash('Access denied.', 'error')
        return redirect(url_for('dashboard.index'))
    return render_template('dashboard/manager.html', user=current_user)

@dashboard_bp.route('/api/manager/dashboard')
@login_required
def api_manager_dashboard():
    if current_user.role != UserRole.MANAGER:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Get manager's jobs
    jobs = Job.query.filter_by(manager_id=current_user.id).order_by(Job.created_at.desc()).all()
    
    total_applicants = sum(j.applications.count() for j in jobs)
    
    # Calculate escrow held
    escrow_held = db.session.query(func.sum(EscrowRecord.amount)).join(Job).filter(
        Job.manager_id == current_user.id,
        EscrowRecord.status.in_([EscrowStatus.HELD, EscrowStatus.WORK_DONE])
    ).scalar() or 0
    
    jobs_data = []
    for job in jobs:
        jobs_data.append({
            'id': job.id,
            'job_code': job.job_code,
            'title': job.title,
            'applicants': job.applications.count(),
            'needed': job.workers_needed,
            'wage': job.wage_per_day,
            'status': job.status.value,
        })
    
    return jsonify({
        'factory_name': current_user.factory_name or current_user.name,
        'location': current_user.factory_address or 'Not specified',
        'verified': current_user.is_verified,
        'stats': {
            'active_jobs': len([j for j in jobs if j.status == JobStatus.ACTIVE]),
            'total_applicants': total_applicants,
            'in_escrow': format_inr(escrow_held),
        },
        'jobs': jobs_data,
    })

@dashboard_bp.route('/api/manager/post-job', methods=['POST'])
@login_required
def api_manager_post_job():
    if current_user.role != UserRole.MANAGER:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if not current_user.is_verified:
        return jsonify({'success': False, 'error': 'Your factory must be verified before posting jobs'}), 400
    
    data = request.get_json()
    title = data.get('title', '').strip()
    wage = int(data.get('wage', 0))
    workers = int(data.get('workers', 0))
    days = int(data.get('days', 0))
    verified_only = data.get('verifiedOnly', True)
    mass_hire = data.get('massHire', False)
    
    if not title or wage <= 0 or workers <= 0 or days <= 0:
        return jsonify({'success': False, 'error': 'All fields are required'}), 400
    
    # Calculate escrow
    wages = wage * workers * days
    fee = round(wages * 0.05)
    mass_charge = 50 * workers if mass_hire else 0
    total = wages + fee + mass_charge
    
    # Create job
    job = Job(
        job_code=generate_job_code(),
        title=title,
        title_hi='',  # Could add Hindi translation
        description=f'{workers} workers needed for {days} days',
        skill=SkillType(data.get('skill', 'helper')),
        wage_per_day=wage,
        workers_needed=workers,
        shift_timing=data.get('shift', '9 AM - 6 PM'),
        location=current_user.factory_address or 'Factory Location',
        start_date=date.today() + timedelta(days=1),
        end_date=date.today() + timedelta(days=days),
        verified_only=verified_only,
        mass_hire_enabled=mass_hire,
        mass_hire_fee=mass_charge,
        platform_fee=fee,
        total_escrow=total,
        manager_id=current_user.id,
    )
    db.session.add(job)
    db.session.flush()  # Get job ID
    
    # Create escrow record
    escrow = EscrowRecord(
        amount=total,
        workers_count=workers,
        status=EscrowStatus.HELD,
        job_id=job.id,
        manager_id=current_user.id,
    )
    db.session.add(escrow)
    db.session.commit()
    
    # If mass hire enabled, create mass hire request
    if mass_hire:
        mh = MassHireRequest(
            request_code=generate_mass_hire_code(),
            workers_needed=workers,
            job_id=job.id,
            manager_id=current_user.id,
        )
        db.session.add(mh)
        db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Job published! {format_inr(total)} held in escrow.',
        'job_code': job.job_code,
        'details': {
            'wages': format_inr(wages),
            'fee': format_inr(fee),
            'mass_charge': format_inr(mass_charge),
            'total': format_inr(total),
        }
    })

@dashboard_bp.route('/api/manager/workers')
@login_required
def api_manager_workers():
    if current_user.role != UserRole.MANAGER:
        return jsonify({'error': 'Unauthorized'}), 403
    
    view = request.args.get('view', 'applicants')
    job_id = request.args.get('job_id', type=int)
    
    if not job_id:
        job = Job.query.filter_by(manager_id=current_user.id, status=JobStatus.ACTIVE).first()
        if not job:
            return jsonify({'error': 'No active jobs found'}), 404
        job_id = job.id
    
    job = Job.query.filter_by(id=job_id, manager_id=current_user.id).first()
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    
    hired_count = job.applications.filter(JobApplication.status == ApplicationStatus.SELECTED).count()
    
    if view == 'applicants':
        applications = JobApplication.query.filter_by(job_id=job_id).order_by(
            JobApplication.applied_at.desc()
        ).all()
        
        applicants_data = []
        for app in applications:
            laborer = app.laborer
            applicants_data.append({
                'id': laborer.id,
                'name': laborer.name,
                'age': laborer.age,
                'rating': round(laborer.avg_rating or 0, 1),
                'verified': laborer.is_verified,
                'skills': laborer.get_skills_list(),
                'distanceKm': 2.5,  # Would calculate from location
                'jobsDone': laborer.completed_jobs_count or 0,
                'decision': app.status.value,
                'wage': job.wage_per_day,
            })
        
        return jsonify({
            'view': 'applicants',
            'job': {
                'id': job.id,
                'job_code': job.job_code,
                'title': job.title,
                'wage': job.wage_per_day,
                'needed': job.workers_needed,
            },
            'hiredCount': hired_count,
            'applicants': applicants_data,
        })
    else:
        # Review completed workers
        completed_apps = JobApplication.query.filter_by(
            job_id=job_id, status=ApplicationStatus.SELECTED
        ).all()
        
        completed = []
        for app in completed_apps:
            # Check if work is done (escrow released)
            escrow = job.escrow_records.filter(
                EscrowRecord.status.in_([EscrowStatus.PAID_UPI, EscrowStatus.CASH_ZONE])
            ).first()
            if escrow:
                completed.append({
                    'id': app.laborer.id,
                    'name': app.laborer.name,
                    'job': job.title,
                    'date': escrow.released_at.strftime('%d %b') if escrow.released_at else 'Recently',
                })
        
        return jsonify({
            'view': 'review',
            'completed': completed,
        })

@dashboard_bp.route('/api/manager/hire', methods=['POST'])
@login_required
def api_manager_hire():
    if current_user.role != UserRole.MANAGER:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    job_id = data.get('job_id')
    applicant_id = data.get('applicant_id')
    action = data.get('action')
    
    job = Job.query.filter_by(id=job_id, manager_id=current_user.id).first()
    if not job:
        return jsonify({'success': False, 'error': 'Job not found'}), 404
    
    application = JobApplication.query.filter_by(
        job_id=job_id, laborer_id=applicant_id
    ).first()
    if not application:
        return jsonify({'success': False, 'error': 'Application not found'}), 404
    
    if action == 'hire':
        if job.workers_hired >= job.workers_needed:
            return jsonify({'success': False, 'error': 'All positions filled'}), 400
        
        application.status = ApplicationStatus.SELECTED
        application.selected_at = datetime.utcnow()
        job.workers_hired += 1
        
        if job.workers_hired >= job.workers_needed:
            job.status = JobStatus.FILLED
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Worker hired! {format_inr(job.wage_per_day)} reserved from escrow.',
        })
    
    elif action == 'decline':
        application.status = ApplicationStatus.REJECTED
        application.reviewed_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Worker declined.',
        })
    
    return jsonify({'success': False, 'error': 'Invalid action'}), 400

@dashboard_bp.route('/api/manager/undo', methods=['POST'])
@login_required
def api_manager_undo():
    if current_user.role != UserRole.MANAGER:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    application_id = data.get('application_id')
    
    application = JobApplication.query.join(Job).filter(
        JobApplication.id == application_id,
        Job.manager_id == current_user.id
    ).first()
    
    if not application:
        return jsonify({'success': False, 'error': 'Application not found'}), 404
    
    if application.status == ApplicationStatus.SELECTED:
        application.job.workers_hired = max(0, application.job.workers_hired - 1)
        application.job.status = JobStatus.ACTIVE
    
    application.status = ApplicationStatus.APPLIED
    application.selected_at = None
    application.reviewed_at = None
    db.session.commit()
    
    return jsonify({'success': True})

@dashboard_bp.route('/api/manager/submit-rating', methods=['POST'])
@login_required
def api_manager_submit_rating():
    if current_user.role != UserRole.MANAGER:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    worker_id = data.get('worker_id')
    stars = data.get('stars')
    tags = data.get('tags', [])
    job_id = data.get('job_id')
    
    if not worker_id or not stars or stars < 1 or stars > 5:
        return jsonify({'success': False, 'error': 'Invalid rating data'}), 400
    
    worker = User.query.filter_by(id=worker_id, role=UserRole.LABORER).first()
    if not worker:
        return jsonify({'success': False, 'error': 'Worker not found'}), 404
    
    rating = WorkerRating(
        rater_id=current_user.id,
        worker_id=worker_id,
        job_id=job_id,
        rating=stars,
    )
    rating.set_tags_list(tags)
    db.session.add(rating)
    
    # Update worker's average rating
    avg = db.session.query(func.avg(WorkerRating.rating)).filter(
        WorkerRating.worker_id == worker_id
    ).scalar()
    # Could store cached avg_rating on User model
    
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Rating submitted successfully!'})

# ============ MASS HIRE API (for Manager) ============

@dashboard_bp.route('/api/manager/mass-hire')
@login_required
def api_manager_mass_hire():
    if current_user.role != UserRole.MANAGER:
        return jsonify({'error': 'Unauthorized'}), 403
    
    requests = MassHireRequest.query.filter_by(manager_id=current_user.id).order_by(
        MassHireRequest.created_at.desc()
    ).all()
    
    # Get verified laborers for assignment
    verified_laborers = User.query.filter(
        User.role == UserRole.LABORER,
        User.is_verified == True
    ).limit(20).all()
    
    return jsonify({
        'requests': [{
            'id': r.id,
            'request_code': r.request_code,
            'job': r.job.title if r.job else 'Unknown',
            'factory': current_user.factory_name,
            'needed': r.workers_needed,
            'assigned': r.workers_assigned,
            'date': r.target_date.strftime('%d %b') if r.target_date else r.request_date.strftime('%d %b'),
            'status': r.status,
        } for r in requests],
        'verified_pool': [{
            'id': w.id,
            'name': w.name,
            'zone': 'Zone 1',  # Would calculate from location
            'distanceKm': 1.5,
            'rating': round(w.avg_rating or 4.5, 1),
        } for w in verified_laborers],
    })

@dashboard_bp.route('/api/manager/mass-hire/assign', methods=['POST'])
@login_required
def api_manager_mass_hire_assign():
    if current_user.role != UserRole.MANAGER:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    request_id = data.get('request_id')
    worker_ids = data.get('worker_ids', [])
    
    mh_request = MassHireRequest.query.filter_by(
        id=request_id, manager_id=current_user.id
    ).first()
    
    if not mh_request:
        return jsonify({'success': False, 'error': 'Request not found'}), 404
    
    remaining = mh_request.workers_needed - mh_request.workers_assigned
    count = min(len(worker_ids), remaining)
    
    if count <= 0:
        return jsonify({'success': False, 'error': 'No positions available'}), 400
    
    for worker_id in worker_ids[:count]:
        # Check if already assigned
        existing = MassHireAssignment.query.filter_by(
            request_id=request_id, laborer_id=worker_id
        ).first()
        if not existing:
            assignment = MassHireAssignment(
                request_id=request_id,
                laborer_id=worker_id
            )
            db.session.add(assignment)
    
    mh_request.workers_assigned += count
    if mh_request.workers_assigned >= mh_request.workers_needed:
        mh_request.status = 'completed'
    else:
        mh_request.status = 'in_progress'
    
    db.session.commit()
    
    return jsonify({'success': True, 'message': f'{count} workers dispatched.'})

# Add avg_rating and completed_jobs_count properties to User
from sqlalchemy.orm import column_property

# This will be handled by the model or query