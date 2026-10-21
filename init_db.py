#!/usr/bin/env python3
"""
Database initialization script for ShramLink.
Run this after creating the database to seed with demo data.
"""

import os
import sys
from datetime import datetime, date, timedelta
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models import db, User, UserRole, Job, SkillType, JobStatus
from app.models import EscrowRecord, EscrowStatus, VerificationRequest, JobApplication, ApplicationStatus
from werkzeug.security import generate_password_hash

app = create_app()

with app.app_context():
    # Create all tables
    db.create_all()
    
    print("Creating demo users...")
    
    # Create admin user
    admin = User.query.filter_by(role=UserRole.ADMIN).first()
    if not admin:
        admin = User(
            email='admin@shramlink.com',
            phone='9999999999',
            role=UserRole.ADMIN,
            name='Administrator',
            is_verified=True
        )
        admin.set_password('shram-admin-2026')
        db.session.add(admin)
        print("Created admin user")
    
    # Create demo factory manager
    manager = User.query.filter_by(email='manager@factory.com').first()
    if not manager:
        manager = User(
            email='manager@factory.com',
            phone='8888888888',
            role=UserRole.MANAGER,
            name='Shree Ganesh Auto Parts',
            factory_name='Shree Ganesh Auto Parts',
            factory_address='Bawana Industrial Area, Delhi',
            gstin='07AABCS1429B1Z5',
            pan_number='AABCS1429B',
            is_verified=True
        )
        manager.set_password('factory123')
        db.session.add(manager)
        print("Created demo manager")
    
    # Create demo laborers
    laborers_data = [
        {
            'phone': '9876543210',
            'name': 'Ramesh Kumar',
            'age': 32,
            'skills': ['welder', 'fabrication'],
            'upi_id': 'ramesh@upi',
            'eshram_number': 'UAN 1012-4421-xxxx',
        },
        {
            'phone': '9876543211',
            'name': 'Suresh Yadav',
            'age': 28,
            'skills': ['welder', 'grinding'],
            'upi_id': 'suresh@upi',
            'eshram_number': 'UAN 1019-8873-xxxx',
        },
        {
            'phone': '9876543212',
            'name': 'Mohd. Arif',
            'age': 35,
            'skills': ['welder', 'cnc'],
            'upi_id': 'arif@upi',
            'eshram_number': 'UAN 1003-2210-xxxx',
        },
        {
            'phone': '9876543213',
            'name': 'Vikram Singh',
            'age': 24,
            'skills': ['helper', 'welder'],
            'upi_id': 'vikram@upi',
            'eshram_number': 'UAN 1005-1122-xxxx',
        },
        {
            'phone': '9876543214',
            'name': 'Sunita Devi',
            'age': 29,
            'skills': ['packaging', 'labelling'],
            'upi_id': 'sunita@upi',
            'eshram_number': 'UAN 1007-3344-xxxx',
        },
        {
            'phone': '9876543215',
            'name': 'Bablu Prasad',
            'age': 41,
            'skills': ['construction', 'masonry'],
            'upi_id': 'bablu@upi',
            'eshram_number': 'UAN 1009-5566-xxxx',
        },
    ]
    
    for ld in laborers_data:
        existing = User.query.filter_by(phone=ld['phone']).first()
        if not existing:
            laborer = User(
                phone=ld['phone'],
                email=f"{ld['phone']}@shramlink.local",
                role=UserRole.LABORER,
                name=ld['name'],
                age=ld['age'],
                upi_id=ld['upi_id'],
                eshram_number=ld['eshram_number'],
                is_verified=True,
                kyc_status='approved',
                kyc_method='Aadhaar OTP'
            )
            laborer.set_skills_list(ld['skills'])
            laborer.set_password('otp_login')
            db.session.add(laborer)
            print(f"Created laborer: {ld['name']}")
    
    db.session.commit()
    
    # Create demo jobs
    manager = User.query.filter_by(email='manager@factory.com').first()
    if manager:
        jobs_data = [
            {
                'title': 'Welder (Arc)',
                'skill': SkillType.WELDER,
                'wage': 750,
                'workers': 2,
                'days': 30,
                'shift': '8 AM – 6 PM',
            },
            {
                'title': 'Truck Loader',
                'skill': SkillType.LOADER,
                'wage': 600,
                'workers': 5,
                'days': 30,
                'shift': '7 AM – 3 PM',
            },
            {
                'title': 'Factory Electrician',
                'skill': SkillType.ELECTRICIAN,
                'wage': 900,
                'workers': 1,
                'days': 30,
                'shift': '10 AM – 7 PM',
            },
            {
                'title': 'Warehouse Helper',
                'skill': SkillType.HELPER,
                'wage': 550,
                'workers': 3,
                'days': 30,
                'shift': '8 AM – 5 PM',
            },
            {
                'title': 'Machine Operator',
                'skill': SkillType.CONSTRUCTION,
                'wage': 680,
                'workers': 5,
                'days': 30,
                'shift': '9 AM – 6 PM',
            },
            {
                'title': 'Packing Helper',
                'skill': SkillType.HELPER,
                'wage': 520,
                'workers': 3,
                'days': 30,
                'shift': '8 AM – 4 PM',
            },
        ]
        
        for jd in jobs_data:
            existing = Job.query.filter_by(manager_id=manager.id, title=jd['title']).first()
            if not existing:
                wages = jd['wage'] * jd['workers'] * jd['days']
                fee = round(wages * 0.05)
                total = wages + fee
                
                job = Job(
                    job_code=f'JB-{2041 + len(Job.query.all())}',
                    title=jd['title'],
                    skill=jd['skill'],
                    wage_per_day=jd['wage'],
                    workers_needed=jd['workers'],
                    shift_timing=jd['shift'],
                    location=manager.factory_address,
                    start_date=date.today() + timedelta(days=1),
                    end_date=date.today() + timedelta(days=jd['days']),
                    verified_only=True,
                    mass_hire_enabled=False,
                    platform_fee=fee,
                    total_escrow=total,
                    manager_id=manager.id,
                )
                db.session.add(job)
                db.session.flush()
                
                escrow = EscrowRecord(
                    amount=total,
                    workers_count=jd['workers'],
                    status=EscrowStatus.HELD,
                    job_id=job.id,
                    manager_id=manager.id,
                )
                db.session.add(escrow)
                print(f"Created job: {jd['title']}")
        
        db.session.commit()
        
        # Create some applications
        laborers = User.query.filter_by(role=UserRole.LABORER).all()
        jobs = Job.query.filter_by(manager_id=manager.id).all()
        
        from app.models import JobApplication, ApplicationStatus
        
        # Apply some laborers to jobs
        applications = [
            (laborers[0], jobs[0], ApplicationStatus.SELECTED),  # Ramesh -> Welder
            (laborers[1], jobs[0], ApplicationStatus.APPLIED),   # Suresh -> Welder
            (laborers[2], jobs[2], ApplicationStatus.SELECTED),  # Arif -> Electrician
            (laborers[3], jobs[3], ApplicationStatus.APPLIED),   # Vikram -> Helper
            (laborers[4], jobs[1], ApplicationStatus.SELECTED),  # Sunita -> Loader
            (laborers[5], jobs[4], ApplicationStatus.APPLIED),   # Bablu -> Machine Operator
        ]
        
        for laborer, job, status in applications:
            existing = JobApplication.query.filter_by(laborer_id=laborer.id, job_id=job.id).first()
            if not existing:
                app = JobApplication(
                    laborer_id=laborer.id,
                    job_id=job.id,
                    status=status,
                    application_date=date.today() - timedelta(days=2)
                )
                if status == ApplicationStatus.SELECTED:
                    app.selected_at = datetime.utcnow()
                    job.workers_hired += 1
                db.session.add(app)
                print(f"Created application: {laborer.name} -> {job.title} ({status.value})")
        
        db.session.commit()
    
    # Create verification requests
    vr_factory = VerificationRequest(
        entity_type='factory',
        entity_name='Sunrise Textiles Pvt Ltd',
        owner_name='Anita Mehra',
        gstin='07AABCS1429B1Z5',
        city='Okhla, Delhi',
        status='pending'
    )
    db.session.add(vr_factory)
    
    vr_laborer = VerificationRequest(
        entity_type='laborer',
        entity_name='Vikram Singh',
        owner_name='Vikram Singh',
        age=24,
        eshram_number='UAN 1012-4421-xxxx',
        kyc_method='Aadhaar OTP',
        skill='Helper',
        status='pending'
    )
    db.session.add(vr_laborer)
    
    db.session.commit()
    
    print("\n✅ Database initialized with demo data!")
    print("\nDemo credentials:")
    print("  Admin:      admin@shramlink.com / shram-admin-2026")
    print("  Manager:    manager@factory.com / factory123")
    print("  Laborer:    Any 10-digit phone / OTP: 1234")
    print("    Demo laborers: 9876543210 - 9876543215")

if __name__ == '__main__':
    from datetime import datetime
    pass  # Handled in with block