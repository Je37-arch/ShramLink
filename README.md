# ShramLink — Hindi voice recruitment MVP

**काम से जुड़ें. आगे बढ़ें.** A Hindi-first employment platform connecting informal
industrial workers and factories in Delhi-NCR. Built with the original project's
Flask, SQLAlchemy and worker/employer data model, with Jinja templates and vanilla
JavaScript. No frontend framework or paid AI service is required.

Development branch: **`feature/hindi-voice-mvp`** in **Je37-arch/ShramLink**.
The original repository and `main` are outside this change.

## What works

- Worker account creation and password login; Hindi conversational profile setup
  with spoken questions, editable recognised answers and explicit confirmation.
- Complete typed onboarding, including when microphone access, speech APIs or
  JavaScript are unavailable.
- Name, adult age, supported skills, preferred domain, experience, preferred city
  and optional e-Shram ID, saved in the application's SQLite database.
- Employer registration, vacancy posting, worker discovery/application,
  shortlisting, selection/decline and persistent status visible in both accounts.
- Explainable ranking: skill **50**, preferred city **30**, preferred domain **15**,
  experience **5** points. Skill and minimum experience are required to apply.
- Profile editing and applicant status filtering.
- Hindi/English labels, responsive layouts, local fonts/assets and accessible
  native form controls. No external font, icon or CSS CDN is needed.

Profiles and factory details are **self-reported**, not government-verified.
There is no Aadhaar/e-Shram/GST validation, real SMS OTP, advanced AI matching,
attendance tracking, payment gateway, escrow or automatic payout integration.

## Install and run

Tested with Python **3.12** and SQLite. Use Python **3.10+** with `venv`.

```bash
git clone --branch feature/hindi-voice-mvp --single-branch https://github.com/Je37-arch/ShramLink.git
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

`init-db` is repeatable. It creates missing tables and adds the MVP columns to an
older compatible SQLite database. It does **not** delete data, create users or
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

## Hindi voice onboarding

1. Create a worker account using a mobile number and a private password. Account
   credentials are entered by typing; never dictate a password.
2. Choose **हिंदी में बोलकर शुरू करें**. The assistant asks seven bounded questions
   using `SpeechSynthesis` with `hi-IN`.
3. Tap **जवाब बोलें** for each response. Recognised text appears in an editable
   field and is read back. Tap the mic and say **हाँ**, or use the next button.
4. Use **दोहराएँ**, **पीछे**, **नाम बदलें** or the visible controls to correct an
   answer. On the optional ID question, say **छोड़ें / नहीं है** or press Skip.
5. Review every field. Save with the confirmation checkbox/button, or explicitly
   say **सेव करें** at the review step.

The recogniser handles the listed skills/domains/cities and common Hindi number
words; it is not an unrestricted chatbot. Answers outside that vocabulary need
correction or typed input. The adult profile range is 18–80; experience is whole
years since age 18. An e-Shram entry is format-checked only (12 digits).

### Compatibility and privacy

- Use **localhost** on a laptop, or **HTTPS** on a phone. An ordinary HTTP LAN URL
  is not sufficient for microphone access; the complete typed form still works.
- Speech support and Hindi voices vary by browser, OS, installed voices, network
  and microphone permissions. Chrome/Android and Safari/iOS **physical audio have
  not been verified** in this environment. Do a device preflight before presenting.
- Browser speech recognition may use its vendor's online service. This is not an
  offline speech claim. ShramLink does not record or store audio or transcript logs.
- Microphone access is explicit, time-bounded and never automatically restarted.
  Permission denial, silence, missing hardware, recognition/network/language and
  synthesis errors leave typing available. Late recognition results are ignored.
- Hindi voices may arrive asynchronously; onboarding never waits indefinitely for
  them. There is no paid-service fallback.
- Saved profiles persist in SQLite. Unsaved answers exist only on the current
  page. The optional full e-Shram ID is visible to its account owner, not employers;
  it is stored as ordinary database text, so restrict filesystem/backup access.

See the browser API's own compatibility notes:
[SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition),
[using Web Speech](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API).

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

Node 20+ is only needed for the three speech-normalisation tests, not to run the
application. Linux may need Playwright's documented browser system dependencies.
For backend-only checks, omit `tests/test_browser.py` explicitly:

```bash
python -m pytest -q tests/test_recruitment.py tests/test_security_and_setup.py
```

Tests create isolated temporary databases and use synthetic data. Browser tests
start a local HTTP server, perform real UI actions and save screenshots under
ignored `test-results/`. Voice tests inject a **test-only speech adapter**; they
validate the state machine and event handling, not physical speech accuracy.

- [Implementation report](docs/IMPLEMENTATION_REPORT.md)
- [Acceptance tests and limitations](docs/TEST_RESULTS.md)
- [Hackathon demo script](docs/DEMO_SCRIPT.md)
- [Truthful presentation feature inventory](docs/PRESENTATION_CLAIMS.md)

## Project structure

`app/models/` retains the original entities. `app/recruitment.py` owns the shared
HTML/API recruitment operations. `app/validation.py` validates writable fields.
`app/commands.py` owns explicit setup/demo/reset commands. `static/js/voice-assistant.js`
contains the bounded speech interaction. Templates and local CSS need no build step.
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
