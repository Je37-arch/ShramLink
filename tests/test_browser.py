"""Real Chromium UI tests. Speech APIs are explicitly mocked in voice tests.

Run: python -m playwright install chromium --only-shell
     python -m pytest -q tests/test_browser.py
"""

from datetime import date, timedelta
from pathlib import Path
from threading import Thread

import pytest
from conftest import TEST_PASSWORD, account
from playwright.sync_api import expect, sync_playwright
from werkzeug.serving import make_server

from app.models import UserRole

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "test-results"


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
        yield browser
        browser.close()


@pytest.fixture
def live(app):
    server = make_server("127.0.0.1", 0, app, threaded=True)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()
    thread.join(timeout=5)


def layout(page):
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), (
        page.url
    )


def fill_profile(page, name="परीक्षण श्रमिक"):
    page.locator("#name").fill(name)
    page.locator("#age").fill("26")
    page.locator("input[name=skills][value=welder]").check()
    page.locator("#preferred_domain").select_option("manufacturing")
    page.locator("#experience_years").fill("3")
    page.locator("#location").select_option("Delhi")
    page.locator("#confirmed").check()


def login_ui(page, url, email):
    page.goto(url + "/login")
    page.locator("#identifier").fill(email)
    page.locator("#password").fill(TEST_PASSWORD)
    page.locator("button[type=submit]").click()


def worker_page(app, browser, live, mock=False, **options):
    account(app, UserRole.LABORER, "voice-test@example.invalid")
    context = browser.new_context(viewport={"width": 390, "height": 844}, **options)
    if mock:
        context.add_init_script(path=str(ROOT / "tests/fixtures/mock_speech.js"))
    page = context.new_page()
    login_ui(page, live, "voice-test@example.invalid")
    expect(page).to_have_url(live + "/onboarding")
    return context, page


def say(page, text):
    page.locator("#listen").click()
    page.evaluate("(text)=>window.__speech.result(text)", text)


def test_mobile_typed_recruitment_journey(app, browser, live):
    errors = []
    bad_responses = []
    worker_context = browser.new_context(viewport={"width": 390, "height": 844})
    worker_context.add_init_script(
        "Object.defineProperty(window,'SpeechRecognition',{value:undefined});Object.defineProperty(window,'webkitSpeechRecognition',{value:undefined});"
    )
    worker = worker_context.new_page()
    worker.on("pageerror", lambda error: errors.append(str(error)))
    worker.on(
        "response",
        lambda response: (
            bad_responses.append(response.status) if response.status >= 400 else None
        ),
    )
    worker.goto(live + "/")
    layout(worker)
    RESULTS.mkdir(exist_ok=True)
    worker.screenshot(path=str(RESULTS / "home-mobile.png"), full_page=True)
    worker.goto(live + "/register/laborer")
    worker.locator("#phone").fill("6999999902")
    worker.locator("#password").fill(TEST_PASSWORD)
    worker.locator("#confirm_password").fill(TEST_PASSWORD)
    worker.locator("button[type=submit]").click()
    expect(worker.locator("#start-voice")).to_be_disabled()
    fill_profile(worker)
    worker.locator("#save-profile").click()
    expect(worker).to_have_url(live + "/dashboard/laborer")
    layout(worker)
    employer_context = browser.new_context(viewport={"width": 390, "height": 844})
    employer = employer_context.new_page()
    employer.on("pageerror", lambda error: errors.append(str(error)))
    employer.goto(live + "/register/manager")
    for field, value in dict(
        name="Demo hiring lead",
        factory_name="Demo Fabrication",
        factory_address="Demo Delhi worksite",
        email="ui-employer@example.invalid",
        password=TEST_PASSWORD,
        confirm_password=TEST_PASSWORD,
    ).items():
        employer.locator("#" + field).fill(value)
    employer.locator("button[type=submit]").click()
    layout(employer)
    employer.get_by_role("link", name="+ Post a vacancy").click()
    layout(employer)
    for field, value in dict(
        title="Arc welder — demo shift",
        worksite_address="Demo industrial area, Delhi",
        wage="850",
        workers="1",
        min_experience="1",
        start_date=(date.today() + timedelta(days=1)).isoformat(),
        shift="09:00–17:00",
        requirements="Arc welding; safety equipment provided.",
    ).items():
        employer.locator("#" + field).fill(value)
    for field, value in dict(
        skill="welder", domain="manufacturing", location="Delhi"
    ).items():
        employer.locator("#" + field).select_option(value)
    employer.get_by_role("button", name="Publish vacancy").click()
    layout(employer)
    expect(employer.get_by_text("No applicants in this view yet.")).to_be_visible()
    worker.reload()
    worker.get_by_role("button", name="इस काम के लिए आवेदन करें").click()
    expect(worker.locator("#applications .status")).to_contain_text("Applied")
    employer.reload()
    employer.get_by_role("button", name="Select worker").click()
    expect(employer.locator(".applicant-card .status")).to_have_text("Selected")
    layout(employer)
    worker.reload()
    expect(worker.locator("#applications .status")).to_contain_text("Selected")
    layout(worker)
    worker.screenshot(path=str(RESULTS / "worker-selected-mobile.png"), full_page=True)
    employer.screenshot(
        path=str(RESULTS / "employer-selected-mobile.png"), full_page=True
    )
    worker.get_by_role("button", name="लॉग आउट").click()
    login_ui(worker, live, "6999999902")
    expect(worker.locator("#applications .status")).to_contain_text("Selected")
    assert not errors and not bad_responses
    employer_context.close()
    worker_context.close()


def test_mocked_hindi_voice_all_questions_correction_repeat_skip_save(
    app, browser, live
):
    context, page = worker_page(app, browser, live, mock=True)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.locator("#start-voice").click()
    say(page, "मेरा नाम गलत नाम है")
    say(page, "मेरा नाम परीक्षण श्रमिक है")
    expect(page.locator("#name")).to_have_value("परीक्षण श्रमिक")
    say(page, "दोहराएँ")
    say(page, "हाँ")
    expect(page.locator("#age")).to_be_visible()
    say(page, "पच्चीस")
    say(page, "हाँ")
    say(page, "वेल्डर और हेल्पर")
    say(page, "हाँ")
    say(page, "कारखाना")
    say(page, "हाँ")
    say(page, "तीन साल")
    say(page, "हाँ")
    say(page, "दिल्ली")
    say(page, "हाँ")
    say(page, "नहीं है")
    expect(page.locator("#confirmation")).to_be_visible()
    expect(page.locator("#eshram_number")).to_have_value("")
    # Review remains directly editable, including recognition mistakes.
    page.locator("#name").fill("सही किया गया नाम")
    spoken = page.evaluate("window.__speech.spoken")
    assert len(spoken) > 10 and all(item["lang"] == "hi-IN" for item in spoken)
    page.screenshot(path=str(RESULTS / "voice-review-mobile.png"), full_page=True)
    layout(page)
    say(page, "सेव करें")
    expect(page).to_have_url(live + "/dashboard/laborer")
    page.reload()
    expect(page.get_by_role("heading", name="नमस्ते, सही किया गया नाम।")).to_be_visible()
    assert not errors
    context.close()


@pytest.mark.parametrize(
    "error",
    [
        "not-allowed",
        "audio-capture",
        "no-speech",
        "network",
        "language-not-supported",
        "service-not-allowed",
        "aborted",
    ],
)
def test_mocked_recognition_errors_keep_typed_fallback(app, browser, live, error):
    context, page = worker_page(app, browser, live, mock=True)
    page.locator("#start-voice").click()
    say(page, "परीक्षण श्रमिक")
    page.locator("#listen").click()
    page.evaluate("(code)=>window.__speech.error(code)", error)
    expect(page.locator("#listen")).to_be_enabled()
    assert page.evaluate("window.__speech.starts") == 2
    expect(page.locator("#name")).to_have_value("परीक्षण श्रमिक")
    page.locator("#typed-mode").click()
    fill_profile(page)
    page.locator("#save-profile").click()
    expect(page).to_have_url(live + "/dashboard/laborer")
    context.close()


def test_mocked_silence_timeout_and_late_results_are_ignored(app, browser, live):
    context, page = worker_page(app, browser, live, mock=True)
    page.clock.install()
    page.locator("#start-voice").click()
    page.locator("#listen").click()
    page.clock.fast_forward(10001)
    expect(page.locator("#listen")).to_be_enabled()
    expect(page.locator("#voice-status")).to_contain_text("कोई आवाज़ नहीं मिली")
    page.evaluate("window.__speech.result('देर से आया जवाब')")
    expect(page.locator("#name")).to_have_value("")
    assert page.evaluate("window.__speech.starts") == 1
    context.close()


def test_mocked_tts_failure_missing_voices_and_start_exception(app, browser, live):
    context, page = worker_page(app, browser, live, mock=True)
    page.evaluate(
        "window.__speech.ttsError=true;window.__speech.noVoices=true;window.__speech.startError=true"
    )
    page.locator("#start-voice").click()
    expect(page.locator("#voice-status")).to_contain_text("हिंदी आवाज़ नहीं चल पाई")
    page.locator("#listen").click()
    expect(page.locator("#voice-status")).to_contain_text("माइक्रोफ़ोन नहीं मिला")
    expect(page.locator("#listen")).to_be_enabled()
    page.locator("#typed-mode").click()
    fill_profile(page)
    page.locator("#save-profile").click()
    expect(page).to_have_url(live + "/dashboard/laborer")
    context.close()


def test_without_javascript_full_typed_profile_works(app, browser, live):
    context, page = worker_page(app, browser, live, java_script_enabled=False)
    fill_profile(page)
    page.locator("#save-profile").click()
    expect(page).to_have_url(live + "/dashboard/laborer")
    expect(page.get_by_role("heading", name="नमस्ते, परीक्षण श्रमिक।")).to_be_visible()
    context.close()


def test_desktop_landing_and_narrow_layouts(browser, live):
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = context.new_page()
    page.goto(live + "/")
    page.evaluate("document.fonts.ready")
    layout(page)
    RESULTS.mkdir(exist_ok=True)
    page.screenshot(path=str(RESULTS / "home-desktop.png"), full_page=True)
    for width in [320, 360, 390, 768]:
        page.set_viewport_size({"width": width, "height": 844})
        for route in ["/", "/register/laborer", "/register/manager", "/login"]:
            page.goto(live + route)
            layout(page)
    context.close()
