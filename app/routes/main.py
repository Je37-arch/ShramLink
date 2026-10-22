from flask import Blueprint, redirect, render_template, url_for

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def index():
    return render_template("index.html")


@main_bp.route("/about")
def about():
    return redirect(url_for("main.index", _anchor="how"))


@main_bp.route("/laborer")
def laborer_standalone():
    # Keep the old entry URL, but require the real account/dashboard flow.
    return redirect(url_for("dashboard.laborer_dashboard"))
