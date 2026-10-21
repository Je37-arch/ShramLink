from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, date
from enum import Enum
import json
from sqlalchemy import func

db = SQLAlchemy()
login_manager = LoginManager()
login_manager.login_view = 'auth.login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'info'

class UserRole(str, Enum):
    LABORER = 'laborer'
    MANAGER = 'manager'
    ADMIN = 'admin'

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(20), unique=True, nullable=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum(UserRole), nullable=False, default=UserRole.LABORER)
    name = db.Column(db.String(100), nullable=False)
    is_verified = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Laborer specific fields
    age = db.Column(db.Integer, nullable=True)
    skills = db.Column(db.Text, nullable=True)  # JSON array
    upi_id = db.Column(db.String(100), nullable=True)
    eshram_number = db.Column(db.String(50), nullable=True)
    kyc_status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    kyc_method = db.Column(db.String(20), nullable=True)
    
    # Manager specific fields
    factory_name = db.Column(db.String(200), nullable=True)
    factory_address = db.Column(db.Text, nullable=True)
    gstin = db.Column(db.String(30), nullable=True)
    gst_certificate = db.Column(db.String(200), nullable=True)
    pan_number = db.Column(db.String(20), nullable=True)
    
    # Relationships
    laborer_jobs = db.relationship('JobApplication', backref='laborer', lazy='dynamic', foreign_keys='JobApplication.laborer_id')
    manager_jobs = db.relationship('Job', backref='manager', lazy='dynamic', foreign_keys='Job.manager_id')
    ratings_given = db.relationship('WorkerRating', backref='rater', lazy='dynamic', foreign_keys='WorkerRating.rater_id')
    ratings_received = db.relationship('WorkerRating', backref='worker', lazy='dynamic', foreign_keys='WorkerRating.worker_id')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def get_skills_list(self):
        if self.skills:
            try:
                return json.loads(self.skills)
            except:
                return []
        return []
    
    def set_skills_list(self, skills_list):
        self.skills = json.dumps(skills_list)
    
    @property
    def avg_rating(self):
        avg = db.session.query(func.avg(WorkerRating.rating)).filter(
            WorkerRating.worker_id == self.id
        ).scalar()
        return round(avg, 1) if avg else None
    
    @property
    def completed_jobs_count(self):
        return JobApplication.query.filter(
            JobApplication.laborer_id == self.id,
            JobApplication.status == ApplicationStatus.SELECTED
        ).count()
    
    def __repr__(self):
        return f'<User {self.name} ({self.role.value})>'

class SkillType(str, Enum):
    WELDER = 'welder'
    CONSTRUCTION = 'construction'
    LOADER = 'loader'
    ELECTRICIAN = 'electrician'
    PAINTER = 'painter'
    HELPER = 'helper'

class JobStatus(str, Enum):
    DRAFT = 'draft'
    ACTIVE = 'active'
    FILLED = 'filled'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'

class Job(db.Model):
    __tablename__ = 'jobs'
    
    id = db.Column(db.Integer, primary_key=True)
    job_code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    title = db.Column(db.String(100), nullable=False)
    title_hi = db.Column(db.String(100), nullable=True)
    description = db.Column(db.Text, nullable=True)
    skill = db.Column(db.Enum(SkillType), nullable=False)
    wage_per_day = db.Column(db.Integer, nullable=False)
    workers_needed = db.Column(db.Integer, default=1)
    workers_hired = db.Column(db.Integer, default=0)
    shift_timing = db.Column(db.String(50), nullable=False)
    location = db.Column(db.String(200), nullable=False)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.Enum(JobStatus), default=JobStatus.ACTIVE, index=True)
    verified_only = db.Column(db.Boolean, default=True)
    mass_hire_enabled = db.Column(db.Boolean, default=False)
    mass_hire_fee = db.Column(db.Integer, default=0)
    platform_fee = db.Column(db.Integer, default=0)
    total_escrow = db.Column(db.Integer, default=0)
    escrow_paid = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    manager_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Relationships
    applications = db.relationship('JobApplication', backref='job', lazy='dynamic')
    escrow_records = db.relationship('EscrowRecord', backref='job', lazy='dynamic')
    mass_hire_requests = db.relationship('MassHireRequest', backref='job', lazy='dynamic')
    
    def __repr__(self):
        return f'<Job {self.job_code}: {self.title}>'

class ApplicationStatus(str, Enum):
    APPLIED = 'applied'
    SHORTLISTED = 'shortlisted'
    SELECTED = 'selected'
    REJECTED = 'rejected'
    WITHDRAWN = 'withdrawn'

class JobApplication(db.Model):
    __tablename__ = 'job_applications'
    
    id = db.Column(db.Integer, primary_key=True)
    status = db.Column(db.Enum(ApplicationStatus), default=ApplicationStatus.APPLIED, index=True)
    applied_at = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    selected_at = db.Column(db.DateTime, nullable=True)
    manager_notes = db.Column(db.Text, nullable=True)
    
    laborer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    
    # For tracking daily application limit
    application_date = db.Column(db.Date, default=date.today, index=True)
    
    __table_args__ = (
        db.UniqueConstraint('laborer_id', 'job_id', name='unique_laborer_job_application'),
        db.Index('idx_laborer_date', 'laborer_id', 'application_date'),
    )
    
    def __repr__(self):
        return f'<JobApplication {self.laborer_id} -> {self.job_id}>'

class EscrowStatus(str, Enum):
    HELD = 'held'
    WORK_DONE = 'work_done'
    PAID_UPI = 'paid_upi'
    CASH_ZONE = 'cash_zone'
    REFUNDED = 'refunded'

class EscrowRecord(db.Model):
    __tablename__ = 'escrow_records'
    
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Integer, nullable=False)
    workers_count = db.Column(db.Integer, default=1)
    status = db.Column(db.Enum(EscrowStatus), default=EscrowStatus.HELD, index=True)
    released_at = db.Column(db.DateTime, nullable=True)
    payment_method = db.Column(db.String(20), nullable=True)  # upi, cash
    transaction_id = db.Column(db.String(100), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    manager_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    def __repr__(self):
        return f'<EscrowRecord {self.id}: {self.amount} ({self.status.value})>'

class MassHireRequest(db.Model):
    __tablename__ = 'mass_hire_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    request_code = db.Column(db.String(20), unique=True, nullable=False)
    workers_needed = db.Column(db.Integer, nullable=False)
    workers_assigned = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='pending')  # pending, in_progress, completed, cancelled
    request_date = db.Column(db.Date, default=date.today)
    target_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    manager_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Relationships
    assignments = db.relationship('MassHireAssignment', backref='request', lazy='dynamic')
    
    def __repr__(self):
        return f'<MassHireRequest {self.request_code}: {self.workers_assigned}/{self.workers_needed}>'

class MassHireAssignment(db.Model):
    __tablename__ = 'mass_hire_assignments'
    
    id = db.Column(db.Integer, primary_key=True)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='assigned')  # assigned, confirmed, completed, cancelled
    
    request_id = db.Column(db.Integer, db.ForeignKey('mass_hire_requests.id'), nullable=False)
    laborer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    def __repr__(self):
        return f'<MassHireAssignment {self.id}: laborer {self.laborer_id}>'

class WorkerRating(db.Model):
    __tablename__ = 'worker_ratings'
    
    id = db.Column(db.Integer, primary_key=True)
    rating = db.Column(db.Integer, nullable=False)  # 1-5
    feedback_tags = db.Column(db.Text, nullable=True)  # JSON array
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    rater_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    worker_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=True)
    
    def get_tags_list(self):
        if self.feedback_tags:
            try:
                return json.loads(self.feedback_tags)
            except:
                return []
        return []
    
    def set_tags_list(self, tags_list):
        self.feedback_tags = json.dumps(tags_list)
    
    def __repr__(self):
        return f'<WorkerRating {self.rating}/5: {self.rater_id} -> {self.worker_id}>'

class VerificationRequest(db.Model):
    __tablename__ = 'verification_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    entity_type = db.Column(db.String(20), nullable=False)  # factory, laborer
    entity_name = db.Column(db.String(200), nullable=False)
    owner_name = db.Column(db.String(100), nullable=False)
    gstin = db.Column(db.String(30), nullable=True)
    eshram_number = db.Column(db.String(50), nullable=True)
    kyc_method = db.Column(db.String(20), nullable=True)
    skill = db.Column(db.String(50), nullable=True)
    age = db.Column(db.Integer, nullable=True)
    city = db.Column(db.String(100), nullable=True)
    documents = db.Column(db.Text, nullable=True)  # JSON array of document paths
    status = db.Column(db.String(20), default='pending', index=True)  # pending, approved, rejected
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    review_notes = db.Column(db.Text, nullable=True)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<VerificationRequest {self.entity_type}: {self.entity_name} ({self.status})>'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))