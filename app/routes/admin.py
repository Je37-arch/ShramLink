"""Read-only operational overview. Verification and payment actions are deferred."""

from flask import Blueprint, render_template

from app.models import Job, JobApplication, User, UserRole
from app.security import role_required

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")


@admin_bp.route("/")
@role_required(UserRole.ADMIN)
def index():
    return render_template(
        "admin/index.html",
        users=User.query.count(),
        jobs=Job.query.count(),
        applications=JobApplication.query.count(),
    )
