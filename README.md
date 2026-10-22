# ShramLink V2 — Hindi-first industrial recruitment

**काम से जुड़ें. आगे बढ़ें.** A Hindi-first employment platform connecting informal
industrial workers and factories in Delhi-NCR. Built with the original project's
Flask, SQLAlchemy and worker/employer data model, with Jinja templates and vanilla
JavaScript. No frontend framework or paid AI service is required.

Development branch: **`feature/hindi-voice-v2`** in **Je37-arch/ShramLink**.
Baseline: `feature/hindi-voice-mvp` at `92292c308f249efad593146fb8b635165445ed18`.
The MVP branch, original repository and `main` remain outside this change.

## Implemented journey

**Speak → create a profile → hear opportunities → swipe → apply → track the result.**

- One Start action opens a bounded Hindi conversation, including an audio check.
  Questions and listening alternate automatically. Corrections, repeat, back,
  optional-ID skip, pause/stop and explicit final review are supported.
- A deliberately selected Hindi voice, voice picker and pronunciation preflight.
  Missing voices, permission denial or service failures leave typing available.
- Deterministic Hindi/Hinglish extraction for the supported skills, domains,
  NCR cities and numbers. Exact experience months, including mixed years/months.
- One-job discovery with up/down navigation, skip/undo, application confirmation,
  spoken summaries, keyboard/buttons and an optional practice tutorial.
- Employer posting, shortlisting, selection/decline and persistent status in both
  accounts. Existing authorization, CSRF, duplicate and capacity checks remain.
- Fully typed onboarding and a no-JavaScript discovery/application fallback.
- Navy/turquoise branding, local Hindi fonts and mobile layouts.

Automated Chromium tests demonstrate the flow with **simulated speech**. Physical
Hindi recognition and pronunciation remain unverified; run the device preflight
before using voice mode at the hackathon. See [voice compatibility](docs/VOICE_COMPATIBILITY.md).

Profiles and factory details are **self-reported**, not government-verified.
There is no paid AI service, unrestricted chatbot, Aadhaar/e-Shram/GST verification,
real SMS OTP, advanced AI matching, attendance tracking or payment integration.
The deterministic ranking remains skill **50**, city **30**, domain **15** and
experience **5** points. Skill and exact minimum experience are required to apply.

## Install and run

Tested with Python **3.12** and SQLite. Use Python **3.10+** with `venv`.

```bash
git clone --branch feature/hindi-voice-v2 --single-branch https://github.com/Je37-arch/ShramLink.git
cd ShramLink
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python -m flask --app run.py init-db
python run.py
```

Open **http://127.0.0.1:5000**. On Windows, activate the environment with
`.venv\Scripts\activate` instead. `python init_db.py` is an equivalent initializer.

`init-db` is repeatable. It creates missing tables and adds the V1/V2 columns to an
older compatible SQLite database, then fills missing month values from legacy
years × 12. Existing precise month values are preserved. It does **not** delete data, create users or
seed fabricated recruitment activity. Application startup does not modify schema.

### Configuration

| Variable | Default / purpose |
| --- | --- |
| `SHRAMLINK_ENV` | `development`; set `production` for secure cookies and HSTS |
| `SECRET_KEY` | Development generates a persistent private key in `instance/.session-key`; production requires a fresh random value of at least 32 characters |
| `DATABASE_URL` | Absolute SQLite URL; default is private `instance/shramlink.sqlite3` |
| `HOST` | `127.0.0.1` for the local development server |
| `PORT` | `5000` |

Generate a fresh deployment secret locally with
`python -c "import secrets; print(secrets.token_hex(32))"`, then put it in the
private environment configuration. Never paste secrets into Git, screenshots or
presentation slides. Restart the deployment after changing the key.

For deployment, provision the database first, terminate HTTPS at a trusted
reverse proxy, set `SHRAMLINK_ENV=production` and use, for example:

```bash
python -m gunicorn --workers 2 --bind 127.0.0.1:8000 run:app
```

The Flask development server is not a production server. Production hosting,
load testing and databases other than SQLite have not been validated. No automatic
trust is placed in forwarded IP/host headers; configure trusted proxy handling
explicitly if deploying behind one. The default IP login limit will otherwise
apply to the proxy's address.

## Demo accounts

Accounts are never created automatically and there are no embedded passwords.
To populate an isolated demonstration database, run:

```bash
python -m flask --app run.py seed-demo
```

The command prompts privately for a password of at least 10 characters and creates:

| Login identifier | Account |
| --- | --- |
| `worker.demo@example.invalid` | Clearly labelled demo worker with a completed profile |
| `employer.demo@example.invalid` | Clearly labelled demo employer and an example welding vacancy |

Use the password **you chose**. Both identifiers work in the common login form.
Re-running the command preserves existing accounts, passwords and vacancy state.
The sample vacancy is dated tomorrow on its **first** creation; post a new vacancy
if that date has passed. To demonstrate onboarding, register a new worker instead
of using the already completed demo profile.

## Hindi conversation and job discovery

1. Register a worker account using a mobile number and private password. Credentials
   remain typed; never dictate a password.
2. Open **आवाज़ जाँचें** to select a Hindi voice and optionally hear the pronunciation
   samples. Or press **बातचीत शुरू करें** directly: the first spoken turn asks whether
   the Hindi audio is clear. Say **जी हाँ** if it is.
3. Answer each question after the **अब आप बोलें** indicator. No repeated microphone,
   Next or Confirm taps are needed in the successful supported flow. Examples:
   “मेरा नाम रमेश कुमार है”, “मैं पच्चीस साल का हूँ”, “मुझे वेल्डिंग आती है”,
   “कारखाना”, “ek saal paanch mahine”, “मैं नोएडा में काम करना चाहता हूँ”.
4. Say **दोबारा पूछो**, **पिछला सवाल**, **मेरा नाम बदलो**, or
   **नहीं, मेरा नाम सुरेश है**. For the optional ID, say **छोड़ दो**.
5. Listen to the full review. Say **हाँ** or **सेव कर दो** only if correct. Every
   field remains editable. Editing invalidates the previous voice confirmation.
6. Press **काम खोजें** on the worker dashboard. Practise on the optional tutorial,
   or skip it. Within the marked swipe strip: up = next, down = previous,
   left = skip, right = open application confirmation. Every action has a button.
7. Use **काम सुनें**, **शर्तें सुनें**, or explicitly enable automatic card reading.
   Confirm **हाँ, आवेदन भेजें** to submit. See the result in **मेरे आवेदन**.
8. In the employer account, review the applicant and select, shortlist or decline.
   Reload the worker's applications to see the same persisted decision.

Pause, Stop and Type remain available throughout voice mode. Stop/typing/tab
changes cancel audio and prevent automatic microphone restart. Unsaved profile
answers exist only on the page. No raw microphone recordings or transcript logs
are stored. Browser speech recognition may send audio to its vendor's online
service. Localhost or HTTPS is required; ordinary HTTP LAN access is insufficient.

### Experience units and upgrades

New forms use **total months** (`experience_months`, `min_experience_months`).
For example, one year five months = **17**, two years eight months = **32**.
Display uses months below 24 and completed years at 24 or above: 32 displays as
2 years; eligibility still compares **32**, never 24. Exact minimum months are
also shown when a rounded display could hide a requirement, and spoken job
requirements retain remaining months.

The server accepts legacy `experience_years` / `min_experience` when month fields
are absent. If both units are supplied, years must equal months // 12; conflicting
values are rejected. V2 writes both fields, with months authoritative. An explicit
legacy-only write describes a new whole-year value; integrations should migrate
to month fields to retain precision. Age is 18–80 and experience must fit the
completed years after age 18. Unsupported or approximate phrases ask for clarification.
Names retain their recognised script; there is no automatic name transliteration.

Before upgrading an existing V1 deployment: stop writers, make a private SQLite
backup, check out V2 and run `python -m flask --app run.py init-db`. It adds nullable
columns and backfills only missing months. Repeated runs preserve exact months and
old records. Roll back code only against a matching backup/copy; do not run V1 and
V2 writers concurrently because V1 does not maintain the new month fields.

Skipped job IDs survive reload in this browser tab, scoped to the worker account.
Undo and Restore bring them back. This is not a cross-device preference service.
The tutorial-complete flag is stored locally; neither store contains transcripts.

## Existing data and credential rotation

The previously tracked database is **untracked, not destroyed**. In the development
checkout its local copy was retained. New checkouts start with an empty private
database; historical data is never silently loaded as demonstration data.

To use your own existing SQLite database:

1. Stop writers and make a private backup (SQLite's backup API handles WAL safely).
2. Point `DATABASE_URL` at the chosen **copy**, for example
   `sqlite:////absolute/path/to/private/shramlink.sqlite3`.
3. Run `python -m flask --app run.py init-db` once; repeated runs are safe.
4. Existing accounts are assigned legacy credential version 1 and cannot log in
   until an operator verifies ownership outside the application and resets them:

```bash
python -m flask --app run.py reset-password --user-id USER_ID
```

This prompts for a password and invalidates existing sessions for that account.
Workers must review and complete the newly required profile fields before applying.
Legacy payment/verification/mass-hire tables and columns stay in the database for
record preservation, but recruitment does not read their payment status or trust
old verification flags. No new payment records are created.

**Rotation is still required on any old deployment.** The committed environment
file and cookie files were removed from the branch tip, old shared OTP/default
credential paths were removed, the new app uses a new session-cookie name, and
local setup generates a fresh secret. This does **not** erase earlier Git history
or rotate secrets on a separate running deployment. Rotate that deployment's
exposed session secret and affected passwords; invalidate its old sessions. The
original repository and `main` were intentionally not rewritten.

## Tests

```bash
python -m pip install -r requirements-dev.txt
python -m playwright install chromium --only-shell
python -m pytest -q
node --test tests/test_voice.js
```

Node 20+ is only needed for parser and gesture tests, not to run the
application. Linux may need Playwright's documented browser system dependencies.
For backend-only checks, omit `tests/test_browser.py` explicitly:

```bash
python -m pytest -q tests/test_recruitment.py tests/test_security_and_setup.py tests/test_v2_months.py
```

Tests create isolated temporary databases and use synthetic data. Browser tests
start a local HTTP server, perform real UI actions and save screenshots under
ignored `test-results/`. Voice tests inject a **test-only speech adapter**; they
validate the state machine and event handling, not physical speech accuracy.

- [V2 implementation report](docs/V2_IMPLEMENTATION_REPORT.md)
- [V2 test results and screenshot instructions](docs/V2_TEST_RESULTS.md)
- [Voice compatibility and physical test checklist](docs/VOICE_COMPATIBILITY.md)
- [V2 hackathon demo](docs/V2_DEMO_SCRIPT.md)
- [V2 presentation claims](docs/V2_PRESENTATION_CLAIMS.md)
- [Historical V1 results](docs/TEST_RESULTS.md)

## Project structure

`app/models/` retains the original entities. `app/recruitment.py` owns the shared
HTML/API recruitment operations. `app/validation.py` validates writable fields.
`app/commands.py` owns explicit setup/demo/reset commands. `static/js/voice-assistant.js`
owns conversation turns; `profile-language.js` extracts bounded answers,
`hindi-speech.js` owns synthesis and `discovery.js` owns the card/tutorial UI.
`app/experience.py` and `app/job_speech.py` share exact experience and vacancy
speech rules. Templates and local CSS need no build step.
All dates used for vacancy deadlines follow **Asia/Kolkata**; legacy timestamps
remain UTC in storage and are converted for worker-facing display.

Session-authenticated JSON writes require the page's CSRF token in `X-CSRFToken`.
For example, `/api/manager/hire` accepts `application_id` and an action of `select`,
`shortlist` or `reject`. Ownership is checked server-side. These repaired payloads
replace the old prototype contract. CSRF follows
[Flask-WTF's documented protection](https://flask-wtf.readthedocs.io/en/latest/csrf/).

Branding and concept remain ShramLink. Noto Sans Devanagari is bundled from
`@fontsource-variable/noto-sans-devanagari` 5.3.0 under the
[SIL Open Font License](static/fonts/OFL.txt). The presentation has not been edited.
