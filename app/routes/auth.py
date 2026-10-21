from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_user, logout_user, current_user, login_required
from app.models import db, User, UserRole
from sqlalchemy import or_

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.index'))
    
    if request.method == 'POST':
        role = request.form.get('role', 'laborer')
        
        if role == 'laborer':
            phone = request.form.get('phone', '').replace(' ', '').replace('-', '')
            otp = request.form.get('otp', '')
            
            if len(phone) != 10 or not phone.isdigit():
                flash('Mobile number needs 10 digits.', 'error')
                return render_template('login.html', role=role, phone=phone)
            
            # For demo: OTP is always 1234. In production, verify OTP sent via SMS
            if otp != '1234':
                flash('Invalid OTP. For demo, use 1234.', 'error')
                return render_template('login.html', role=role, phone=phone)
            
            # Find or create user
            user = User.query.filter_by(phone=phone).first()
            if not user:
                # Create new laborer user
                user = User(
                    phone=phone,
                    email=f'{phone}@shramlink.local',  # placeholder email
                    password_hash='',  # No password for OTP users
                    role=UserRole.LABORER,
                    name=f'Worker {phone[-4:]}',
                    is_verified=True
                )
                user.set_password('otp_login')  # dummy password
                db.session.add(user)
                db.session.commit()
            
            if user.role != UserRole.LABORER:
                flash('This account is not registered as a worker.', 'error')
                return render_template('login.html', role=role, phone=phone)
            
            login_user(user, remember=True)
            flash(f'Welcome back, {user.name}!', 'success')
            return redirect(url_for('dashboard.index'))
        
        else:  # manager
            email = request.form.get('email', '').strip().lower()
            password = request.form.get('password', '')
            
            if '@' not in email:
                flash('Enter your factory email address.', 'error')
                return render_template('login.html', role=role, email=email)
            
            user = User.query.filter_by(email=email).first()
            
            if not user or not user.check_password(password):
                flash('Invalid email or password.', 'error')
                return render_template('login.html', role=role, email=email)
            
            if user.role != UserRole.MANAGER:
                flash('This account is not registered as a factory manager.', 'error')
                return render_template('login.html', role=role, email=email)
            
            if not user.is_active:
                flash('Your account has been deactivated. Contact support.', 'error')
                return render_template('login.html', role=role, email=email)
            
            login_user(user, remember=True)
            flash(f'Welcome back, {user.factory_name or user.name}!', 'success')
            return redirect(url_for('dashboard.index'))
    
    role = request.args.get('as', 'laborer')
    return render_template('login.html', role=role)

@auth_bp.route('/register/laborer', methods=['GET', 'POST'])
def register_laborer():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.index'))
    
    if request.method == 'POST':
        phone = request.form.get('phone', '').replace(' ', '').replace('-', '')
        otp = request.form.get('otp', '')
        name = request.form.get('name', '').strip()
        age = request.form.get('age', '')
        skills = request.form.getlist('skills')
        upi_id = request.form.get('upi_id', '').strip()
        eshram = request.form.get('eshram', '').strip()
        
        if len(phone) != 10 or not phone.isdigit():
            flash('Mobile number needs 10 digits.', 'error')
            return render_template('register_laborer.html')
        
        if otp != '1234':
            flash('Invalid OTP. For demo, use 1234.', 'error')
            return render_template('register_laborer.html')
        
        if not name:
            flash('Name is required.', 'error')
            return render_template('register_laborer.html')
        
        if User.query.filter_by(phone=phone).first():
            flash('This phone number is already registered.', 'error')
            return render_template('register_laborer.html')
        
        user = User(
            phone=phone,
            email=f'{phone}@shramlink.local',
            role=UserRole.LABORER,
            name=name,
            age=int(age) if age.isdigit() else None,
            upi_id=upi_id,
            eshram_number=eshram,
            is_verified=True
        )
        user.set_skills_list(skills)
        user.set_password('otp_login')
        db.session.add(user)
        db.session.commit()
        
        login_user(user, remember=True)
        flash('Registration successful!', 'success')
        return redirect(url_for('dashboard.index'))
    
    return render_template('register_laborer.html')

@auth_bp.route('/register/manager', methods=['GET', 'POST'])
def register_manager():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.index'))
    
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        factory_name = request.form.get('factory_name', '').strip()
        factory_address = request.form.get('factory_address', '').strip()
        gstin = request.form.get('gstin', '').strip().upper()
        pan = request.form.get('pan', '').strip().upper()
        
        if '@' not in email:
            flash('Enter a valid email address.', 'error')
            return render_template('register_manager.html')
        
        if len(password) < 6:
            flash('Password must be at least 6 characters.', 'error')
            return render_template('register_manager.html')
        
        if password != confirm_password:
            flash('Passwords do not match.', 'error')
            return render_template('register_manager.html')
        
        if not factory_name:
            flash('Factory name is required.', 'error')
            return render_template('register_manager.html')
        
        if not gstin:
            flash('GSTIN is required for verification.', 'error')
            return render_template('register_manager.html')
        
        if User.query.filter_by(email=email).first():
            flash('This email is already registered.', 'error')
            return render_template('register_manager.html')
        
        if User.query.filter_by(gstin=gstin).first():
            flash('This GSTIN is already registered.', 'error')
            return render_template('register_manager.html')
        
        user = User(
            email=email,
            role=UserRole.MANAGER,
            name=factory_name,
            factory_name=factory_name,
            factory_address=factory_address,
            gstin=gstin,
            pan_number=pan,
            is_verified=False  # Requires admin approval
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        
        # Create verification request
        from app.models import VerificationRequest
        vr = VerificationRequest(
            entity_type='factory',
            entity_name=factory_name,
            owner_name=factory_name,  # Use factory name as owner name for now
            gstin=gstin,
            city=factory_address,
            documents=json.dumps([])
        )
        db.session.add(vr)
        db.session.commit()
        
        flash('Registration submitted! Your factory will be verified by admin.', 'success')
        return redirect(url_for('auth.login'))
    
    return render_template('register_manager.html')

@auth_bp.route('/admin-login', methods=['GET', 'POST'])
def admin_login():
    if current_user.is_authenticated:
        if current_user.role == UserRole.ADMIN:
            return redirect(url_for('admin.index'))
        return redirect(url_for('dashboard.index'))
    
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        
        user = User.query.filter(
            or_(User.email == username, User.phone == username),
            User.role == UserRole.ADMIN
        ).first()
        
        if user and user.check_password(password):
            login_user(user, remember=True)
            flash('Logged in as admin.', 'success')
            return redirect(url_for('admin.index'))
        
        flash('Invalid admin credentials.', 'error')
    
    return render_template('admin_login.html')

@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    flash('Logged out successfully.', 'success')
    return redirect(url_for('main.index'))

import json