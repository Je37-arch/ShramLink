from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user
from app.models import db, User, UserRole, Job, JobApplication, ApplicationStatus, EscrowRecord, EscrowStatus
from app.models import MassHireRequest, MassHireAssignment, VerificationRequest, WorkerRating, JobStatus
from sqlalchemy import func, or_
from datetime import date, datetime

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

def format_inr(n):
    return f'₹{n:,}'

STATUS_STYLE = {
    'held': 'bg-warning-soft text-warning',
    'work_done': 'bg-manager-soft text-manager',
    'paid_upi': 'bg-accent text-accent-foreground',
    'cash_zone': 'bg-accent text-accent-foreground',
    'refunded': 'bg-muted text-muted-foreground',
}

@admin_bp.route('/')
@login_required
def index():
    if current_user.role != UserRole.ADMIN:
        flash('Access denied.', 'error')
        return redirect(url_for('dashboard.index'))
    return render_template('admin/index.html', user=current_user)

# ============ VERIFICATION QUEUE ============

@admin_bp.route('/api/verification')
@login_required
def api_verification():
    if current_user.role != UserRole.ADMIN:
        return jsonify({'error': 'Unauthorized'}), 403
    
    kind = request.args.get('kind', 'factories')
    
    if kind == 'factories':
        requests = VerificationRequest.query.filter_by(entity_type='factory').order_by(
            VerificationRequest.submitted_at.desc()
        ).all()
    else:
        requests = VerificationRequest.query.filter_by(entity_type='laborer').order_by(
            VerificationRequest.submitted_at.desc()
        ).all()
    
    pending = [r for r in requests if r.status == 'pending']
    
    return jsonify({
        'kind': kind,
        'items': [{
            'id': r.id,
            'title': r.entity_name if kind == 'factories' else f'{r.entity_name}, {r.age or "N/A"}',
            'subtitle': f'{r.owner_name} · {r.city or "N/A"}' if kind == 'factories' else f'Skill: {r.skill or "N/A"}',
            'submitted': r.submitted_at.strftime('%d %b %Y %H:%M') if r.submitted_at else 'N/A',
            'rows': [
                ['GSTIN', r.gstin or 'N/A'],
                ['Documents', 'GST Cert, PAN, Address proof'],
            ] if kind == 'factories' else [
                ['e-Shram', r.eshram_number or 'N/A'],
                ['KYC Method', r.kyc_method or 'N/A'],
            ],
            'result': r.status if r.status != 'pending' else None,
        } for r in requests],
        'pendingCount': len(pending),
    })

@admin_bp.route('/api/verification/decide', methods=['POST'])
@login_required
def api_verification_decide():
    if current_user.role != UserRole.ADMIN:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    request_id = data.get('id')
    result = data.get('result')  # 'approved' or 'rejected'
    
    vr = VerificationRequest.query.get(request_id)
    if not vr:
        return jsonify({'success': False, 'error': 'Request not found'}), 404
    
    vr.status = 'approved' if result == 'approved' else 'rejected'
    vr.reviewed_by = current_user.id
    vr.reviewed_at = datetime.utcnow()
    vr.review_notes = data.get('notes', '')
    
    # If factory approved, update user
    if vr.entity_type == 'factory' and result == 'approved':
        user = User.query.filter_by(gstin=vr.gstin).first()
        if user:
            user.is_verified = True
    
    # If laborer approved, update user
    if vr.entity_type == 'laborer' and result == 'approved':
        user = User.query.filter_by(eshram_number=vr.eshram_number).first()
        if user:
            user.is_verified = True
            user.kyc_status = 'approved'
    
    db.session.commit()
    
    return jsonify({'success': True, 'message': f'Verification {result}.'})

@admin_bp.route('/api/verification/undo', methods=['POST'])
@login_required
def api_verification_undo():
    if current_user.role != UserRole.ADMIN:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    request_id = data.get('id')
    
    vr = VerificationRequest.query.get(request_id)
    if not vr:
        return jsonify({'success': False, 'error': 'Request not found'}), 404
    
    # Revert user verification if was approved
    if vr.status == 'approved':
        if vr.entity_type == 'factory':
            user = User.query.filter_by(gstin=vr.gstin).first()
            if user:
                user.is_verified = False
        elif vr.entity_type == 'laborer':
            user = User.query.filter_by(eshram_number=vr.eshram_number).first()
            if user:
                user.is_verified = False
                user.kyc_status = 'pending'
    
    vr.status = 'pending'
    vr.reviewed_by = None
    vr.reviewed_at = None
    vr.review_notes = None
    db.session.commit()
    
    return jsonify({'success': True})

# ============ ESCROW MANAGER ============

@admin_bp.route('/api/escrow')
@login_required
def api_escrow():
    if current_user.role != UserRole.ADMIN:
        return jsonify({'error': 'Unauthorized'}), 403
    
    rows = EscrowRecord.query.join(Job).order_by(EscrowRecord.created_at.desc()).all()
    
    held = sum(r.amount for r in rows if r.status in [EscrowStatus.HELD, EscrowStatus.WORK_DONE])
    ready_count = len([r for r in rows if r.status == EscrowStatus.WORK_DONE])
    
    return jsonify({
        'rows': [{
            'id': r.id,
            'job_code': r.job.job_code if r.job else 'N/A',
            'factory': r.job.manager.factory_name if r.job and r.job.manager else 'N/A',
            'escrow': r.amount,
            'workers': r.workers_count,
            'status': r.status.value,
        } for r in rows],
        'held': held,
        'readyCount': ready_count,
        'statusStyle': STATUS_STYLE,
    })

@admin_bp.route('/api/escrow/update', methods=['POST'])
@login_required
def api_escrow_update():
    if current_user.role != UserRole.ADMIN:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    escrow_id = data.get('id')
    status = data.get('status')
    
    escrow = EscrowRecord.query.get(escrow_id)
    if not escrow:
        return jsonify({'success': False, 'error': 'Escrow record not found'}), 404
    
    if escrow.status not in [EscrowStatus.HELD, EscrowStatus.WORK_DONE]:
        return jsonify({'success': False, 'error': 'Cannot update this escrow status'}), 400
    
    try:
        new_status = EscrowStatus(status)
    except ValueError:
        return jsonify({'success': False, 'error': 'Invalid status'}), 400
    
    escrow.status = new_status
    escrow.released_at = datetime.utcnow()
    
    messages = {
        EscrowStatus.PAID_UPI: f'{format_inr(escrow.amount)} sent to {escrow.workers_count} workers via UPI',
        EscrowStatus.CASH_ZONE: 'Assigned to Cash Zone Distributor',
        EscrowStatus.REFUNDED: f'{format_inr(escrow.amount)} refunded to factory',
    }
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': messages.get(new_status, 'Updated'),
    })

@admin_bp.route('/api/escrow/generate-bill', methods=['POST'])
@login_required
def api_escrow_generate_bill():
    if current_user.role != UserRole.ADMIN:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    escrow_id = data.get('id')
    
    escrow = EscrowRecord.query.get(escrow_id)
    if not escrow:
        return jsonify({'success': False, 'error': 'Escrow record not found'}), 404
    
    # In production, generate actual PDF
    return jsonify({
        'success': True, 
        'message': f'GST E-Bill PDF generated for {escrow.job.job_code if escrow.job else escrow_id}'
    })

# ============ MASS HIRE DISPATCHER ============

@admin_bp.route('/api/mass-hire')
@login_required
def api_mass_hire():
    if current_user.role != UserRole.ADMIN:
        return jsonify({'error': 'Unauthorized'}), 403
    
    requests = MassHireRequest.query.order_by(MassHireRequest.created_at.desc()).all()
    
    # Get verified laborers
    verified_laborers = User.query.filter(
        User.role == UserRole.LABORER,
        User.is_verified == True
    ).limit(20).all()
    
    return jsonify({
        'requests': [{
            'id': r.id,
            'request_code': r.request_code,
            'job': r.job.title if r.job else 'Unknown',
            'factory': r.job.manager.factory_name if r.job and r.job.manager else 'Unknown',
            'needed': r.workers_needed,
            'assigned': r.workers_assigned,
            'date': r.target_date.strftime('%d %b') if r.target_date else r.request_date.strftime('%d %b'),
            'status': r.status,
        } for r in requests],
        'verified_pool': [{
            'id': w.id,
            'name': w.name,
            'zone': 'Zone 1',
            'distanceKm': 1.5,
            'rating': round(w.avg_rating or 4.5, 1),
        } for w in verified_laborers],
    })

@admin_bp.route('/api/mass-hire/assign', methods=['POST'])
@login_required
def api_mass_hire_assign():
    if current_user.role != UserRole.ADMIN:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    request_id = data.get('request_id')
    worker_ids = data.get('worker_ids', [])
    
    mh_request = MassHireRequest.query.get(request_id)
    if not mh_request:
        return jsonify({'success': False, 'error': 'Request not found'}), 404
    
    remaining = mh_request.workers_needed - mh_request.workers_assigned
    count = min(len(worker_ids), remaining)
    
    if count <= 0:
        return jsonify({'success': False, 'error': 'No positions available'}), 400
    
    for worker_id in worker_ids[:count]:
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

# ============ ADMIN STATS ============

@admin_bp.route('/api/stats')
@login_required
def api_admin_stats():
    if current_user.role != UserRole.ADMIN:
        return jsonify({'error': 'Unauthorized'}), 403
    
    stats = {
        'total_users': User.query.count(),
        'total_laborers': User.query.filter_by(role=UserRole.LABORER).count(),
        'total_managers': User.query.filter_by(role=UserRole.MANAGER).count(),
        'verified_laborers': User.query.filter_by(role=UserRole.LABORER, is_verified=True).count(),
        'verified_factories': User.query.filter_by(role=UserRole.MANAGER, is_verified=True).count(),
        'total_jobs': Job.query.count(),
        'active_jobs': Job.query.filter_by(status=JobStatus.ACTIVE).count(),
        'total_applications': JobApplication.query.count(),
        'pending_verifications': VerificationRequest.query.filter_by(status='pending').count(),
        'escrow_held': db.session.query(func.sum(EscrowRecord.amount)).filter(
            EscrowRecord.status.in_([EscrowStatus.HELD, EscrowStatus.WORK_DONE])
        ).scalar() or 0,
        'escrow_paid': db.session.query(func.sum(EscrowRecord.amount)).filter(
            EscrowRecord.status.in_([EscrowStatus.PAID_UPI, EscrowStatus.CASH_ZONE])
        ).scalar() or 0,
    }
    
    return jsonify(stats)