// Laborer Dashboard JavaScript

let currentTab = 'jobs';
let voiceStatus = 'idle'; // idle, listening, done
let voiceStep = 0;
let appliedJobs = [];
let baseApplied = 13;

const STEPS = [
    { key: 'name', prompt: 'आपका नाम क्या है? / What is your name?', heard: 'मेरा नाम रमेश कुमार है' },
    { key: 'age', prompt: 'आपकी उम्र? / Your age?', heard: 'बत्तीस साल' },
    { key: 'phone', prompt: 'मोबाइल नंबर? / Phone number?', heard: 'नौ आठ सात छह...' },
    { key: 'skills', prompt: 'आप क्या काम करते हैं? / What work do you do?', heard: 'वेल्डिंग और लोडिंग' },
];

const CAPTURED = {
    name: 'Ramesh Kumar',
    age: '32',
    phone: '98765 43210',
    skills: ['Welder / वेल्डर', 'Loader / लोडर'],
};

const BAR_DELAYS = [0, 0.15, 0.3, 0.45, 0.3, 0.15, 0, 0.2, 0.4];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadJobs();
    loadMyJobs();
    setupVoiceBars();
    lucide.createIcons();
});

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('tab-' + tab).classList.remove('hidden');
    
    // Update nav buttons
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('text-primary', 'text-manager', 'text-foreground');
        btn.classList.add('text-muted-foreground');
        const bar = btn.querySelector('span.absolute');
        if (bar) bar.remove();
    });
    
    const activeBtn = document.querySelector(`button[onclick="switchTab('${tab}')"]`);
    if (activeBtn) {
        activeBtn.classList.remove('text-muted-foreground');
        activeBtn.classList.add('text-primary');
        if (!activeBtn.querySelector('span.absolute')) {
            const bar = document.createElement('span');
            bar.className = 'absolute inset-x-6 top-0 h-1 rounded-b-full bg-primary';
            bar.setAttribute('aria-hidden', 'true');
            activeBtn.insertBefore(bar, activeBtn.firstChild);
        }
    }
    
    if (tab === 'my') loadMyJobs();
}

// Jobs Tab
async function loadJobs() {
    try {
        const res = await fetch('/api/laborer/jobs');
        const data = await res.json();
        renderJobs(data);
        updateApplyCounter(data.appliedToday, data.limitReached);
    } catch (e) {
        console.error('Failed to load jobs:', e);
    }
}

function renderJobs(data) {
    const list = document.getElementById('jobs-list');
    const filter = document.querySelector('.filter-pill.active')?.dataset.skill || 'all';
    
    if (data.jobs.length === 0) {
        list.innerHTML = '<li class="rounded-xl border border-dashed border-border bg-card p-6 text-center font-semibold text-muted-foreground">No jobs nearby right now / अभी कोई काम नहीं</li>';
        return;
    }
    
    list.innerHTML = data.jobs.map(job => `
        <li class="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div class="flex items-start gap-3">
                <span class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                    <i data-lucide="${getSkillIcon(job.skill)}" class="size-6"></i>
                </span>
                <div class="min-w-0 flex-1">
                    <h3 class="text-lg font-extrabold leading-tight text-foreground">${job.title} <span class="font-semibold text-muted-foreground">/ ${job.titleHi}</span></h3>
                    <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-muted-foreground">
                        ${job.factory}
                        ${job.verified ? '<span class="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground"><i data-lucide="badge-check" class="size-3.5"></i>Verified</span>' : ''}
                    </p>
                </div>
            </div>
            <div class="mt-3 flex items-end justify-between gap-2">
                <div class="flex flex-col gap-1 text-sm font-semibold text-muted-foreground">
                    <span class="inline-flex items-center gap-1"><i data-lucide="map-pin" class="size-4"></i>${job.distanceKm} km away</span>
                    <span class="inline-flex items-center gap-1"><i data-lucide="clock" class="size-4"></i>${job.shift}</span>
                </div>
                <p class="text-right">
                    <span class="text-2xl font-extrabold text-foreground">${formatINR(job.wage)}</span>
                    <span class="block text-xs font-bold text-muted-foreground">per day / रोज़</span>
                </p>
            </div>
            <button type="button" ${job.disabled ? 'disabled' : ''} onclick="applyJob('${job.id}')"
                    class="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-extrabold transition-colors ${getButtonClass(job)}">
                ${job.applied ? '<i data-lucide="check" class="size-5"></i> Applied / आवेदन हो गया' : 
                  job.limitReached ? '<i data-lucide="lock" class="size-5"></i> Limit Reached / सीमा पूरी' : 
                  'Apply Now / आवेदन करें'}
            </button>
        </li>
    `).join('');
    
    lucide.createIcons();
}

function getSkillIcon(skill) {
    const icons = { welder: 'flame', construction: 'hard-hat', loader: 'package', electrician: 'zap', painter: 'paint-roller', helper: 'hand' };
    return icons[skill] || 'help-circle';
}

function getButtonClass(job) {
    if (job.applied) return 'bg-accent text-accent-foreground';
    if (job.limitReached) return 'cursor-not-allowed bg-muted text-muted-foreground';
    return 'bg-primary text-primary-foreground hover:bg-emerald-700 active:bg-emerald-800';
}

function updateApplyCounter(appliedToday, limitReached) {
    document.getElementById('applied-today').textContent = appliedToday;
    const counter = document.getElementById('apply-counter');
    const alert = document.getElementById('limit-alert');
    
    if (limitReached) {
        counter.className = 'flex flex-col items-center rounded-xl px-3 py-2 text-center bg-destructive text-white';
        alert.classList.remove('hidden');
    } else if (appliedToday >= 13) {
        counter.className = 'flex flex-col items-center rounded-xl px-3 py-2 text-center bg-warning-soft text-warning';
        alert.classList.add('hidden');
    } else {
        counter.className = 'flex flex-col items-center rounded-xl px-3 py-2 text-center bg-primary-foreground text-primary';
        alert.classList.add('hidden');
    }
}

function filterJobs(skill) {
    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.skill === skill);
        btn.classList.toggle('border-primary', btn.dataset.skill === skill);
        btn.classList.toggle('bg-primary', btn.dataset.skill === skill);
        btn.classList.toggle('text-primary-foreground', btn.dataset.skill === skill);
        btn.classList.toggle('border-border', btn.dataset.skill !== skill);
        btn.classList.toggle('bg-card', btn.dataset.skill !== skill);
    });
    loadJobs();
}

async function applyJob(jobId) {
    try {
        const res = await fetch('/api/laborer/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_id: jobId })
        });
        const data = await res.json();
        if (data.success) {
            loadJobs();
        }
    } catch (e) {
        console.error('Failed to apply:', e);
    }
}

async function resetDemo() {
    try {
        await fetch('/api/laborer/reset', { method: 'POST' });
        loadJobs();
    } catch (e) {
        console.error('Failed to reset:', e);
    }
}

document.getElementById('reset-demo')?.addEventListener('click', resetDemo);

// Voice Register Tab
function setupVoiceBars() {
    const bars = document.querySelectorAll('.voice-bar');
    bars.forEach((bar, i) => {
        bar.style.animationDelay = `${BAR_DELAYS[i]}s`;
    });
}

function toggleMic() {
    const btn = document.getElementById('mic-btn');
    const icon = document.getElementById('mic-icon');
    const stopIcon = document.getElementById('mic-stop-icon');
    const doneIcon = document.getElementById('mic-done-icon');
    const ring1 = document.getElementById('mic-ring-1');
    const ring2 = document.getElementById('mic-ring-2');
    const idleRing = document.getElementById('mic-idle');
    const idleText = document.getElementById('mic-idle-text');
    const listeningText = document.getElementById('mic-listening-text');
    const doneText = document.getElementById('mic-done-text');
    const saveBtn = document.getElementById('save-profile');
    
    if (voiceStatus === 'listening') {
        voiceStatus = 'idle';
        clearTimeout(window.voiceTimer);
        updateVoiceUI();
    } else if (voiceStatus === 'idle') {
        voiceStatus = 'listening';
        voiceStep = 0;
        updateVoiceUI();
        startListening();
    }
}

function startListening() {
    if (voiceStatus !== 'listening') return;
    
    window.voiceTimer = setTimeout(() => {
        if (voiceStep + 1 >= STEPS.length) {
            voiceStep = STEPS.length;
            voiceStatus = 'done';
        } else {
            voiceStep++;
        }
        updateVoiceUI();
        if (voiceStatus === 'listening') startListening();
    }, 1600);
}

function updateVoiceUI() {
    const btn = document.getElementById('mic-btn');
    const icon = document.getElementById('mic-icon');
    const stopIcon = document.getElementById('mic-stop-icon');
    const doneIcon = document.getElementById('mic-done-icon');
    const ring1 = document.getElementById('mic-ring-1');
    const ring2 = document.getElementById('mic-ring-2');
    const idleRing = document.getElementById('mic-idle');
    const idleText = document.getElementById('mic-idle-text');
    const listeningText = document.getElementById('mic-listening-text');
    const doneText = document.getElementById('mic-done-text');
    const saveBtn = document.getElementById('save-profile');
    const currentPrompt = document.getElementById('current-prompt');
    const currentHeard = document.getElementById('current-heard');
    
    // Update fields
    STEPS.forEach((step, i) => {
        const filled = voiceStep > i;
        const active = voiceStatus === 'listening' && voiceStep === i;
        const field = document.getElementById('field-' + step.key);
        if (field) {
            field.classList.toggle('border-primary', active);
            field.classList.toggle('border-primary/40', filled && !active);
            field.classList.toggle('border-border', !filled && !active);
            const valueEl = field.querySelector('p:last-child');
            if (valueEl) {
                valueEl.textContent = filled ? CAPTURED[step.key] : (active ? 'Listening…' : '—');
                valueEl.classList.toggle('text-foreground', filled);
                valueEl.classList.toggle('text-muted-foreground/50', !filled);
            }
        }
    });
    
    // Skills field
    const skillsField = document.getElementById('field-skills');
    const skillsFilled = voiceStep > 3;
    if (skillsField) {
        skillsField.classList.toggle('border-primary', voiceStatus === 'listening' && voiceStep === 3);
        skillsField.classList.toggle('border-border', !(voiceStatus === 'listening' && voiceStep === 3));
        const skillsContainer = skillsField.querySelector('.flex');
        if (skillsContainer) {
            skillsContainer.innerHTML = skillsFilled 
                ? CAPTURED.skills.map(s => `<span class="rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">${s}</span>`).join('')
                : '<span class="text-sm font-semibold text-muted-foreground">Auto-tagged from voice…</span>';
        }
    }
    
    // Mic button state
    if (voiceStatus === 'done') {
        btn.className = 'relative flex size-32 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 bg-accent text-primary';
        icon.classList.add('hidden');
        stopIcon.classList.add('hidden');
        doneIcon.classList.remove('hidden');
        ring1.classList.add('hidden');
        ring2.classList.add('hidden');
        idleRing.classList.add('hidden');
        idleText.classList.add('hidden');
        listeningText.classList.add('hidden');
        doneText.classList.remove('hidden');
        saveBtn.disabled = false;
    } else if (voiceStatus === 'listening') {
        btn.className = 'relative flex size-32 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 bg-destructive text-white';
        icon.classList.add('hidden');
        stopIcon.classList.remove('hidden');
        doneIcon.classList.add('hidden');
        ring1.classList.remove('hidden');
        ring2.classList.remove('hidden');
        idleRing.classList.add('hidden');
        idleText.classList.add('hidden');
        listeningText.classList.remove('hidden');
        doneText.classList.add('hidden');
        saveBtn.disabled = true;
        
        const step = STEPS[Math.min(voiceStep, STEPS.length - 1)];
        currentPrompt.textContent = step.prompt;
        currentHeard.textContent = '"' + step.heard + '"';
    } else {
        btn.className = 'relative flex size-32 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 bg-primary text-primary-foreground';
        icon.classList.remove('hidden');
        stopIcon.classList.add('hidden');
        doneIcon.classList.add('hidden');
        ring1.classList.add('hidden');
        ring2.classList.add('hidden');
        idleRing.classList.remove('hidden');
        idleText.classList.remove('hidden');
        listeningText.classList.add('hidden');
        doneText.classList.add('hidden');
        saveBtn.disabled = true;
    }
    
    lucide.createIcons();
}

function resetVoice() {
    voiceStatus = 'idle';
    voiceStep = 0;
    clearTimeout(window.voiceTimer);
    updateVoiceUI();
}

// My Jobs Tab
async function loadMyJobs() {
    try {
        const res = await fetch('/api/laborer/my-jobs');
        const data = await res.json();
        renderMyJobs(data);
    } catch (e) {
        console.error('Failed to load my jobs:', e);
    }
}

function renderMyJobs(data) {
    const container = document.getElementById('my-jobs-content');
    const groups = ['selected', 'applied', 'paid'];
    const statusMeta = {
        applied: { en: 'Applied', hi: 'आवेदन किया', icon: 'hourglass', tone: 'border-l-warning', chip: 'bg-warning-soft text-warning' },
        selected: { en: 'Selected for Work', hi: 'काम के लिए चुने गए', icon: 'user-check', tone: 'border-l-manager', chip: 'bg-manager-soft text-manager' },
        paid: { en: 'Work Done & Paid', hi: 'काम पूरा, पैसा मिला', icon: 'circle-check', tone: 'border-l-primary', chip: 'bg-accent text-accent-foreground' },
    };
    
    container.innerHTML = `
        <section class="rounded-2xl bg-primary p-4 text-primary-foreground">
            <p class="text-sm font-bold opacity-90">This Week Earnings / इस हफ्ते की कमाई</p>
            <p class="mt-1 text-4xl font-extrabold">${data.format_inr}</p>
            <div class="mt-3 grid grid-cols-3 gap-2 text-center">
                ${groups.map(g => `
                    <div key="${g}" class="rounded-lg bg-primary-foreground/15 px-1 py-2">
                        <p class="text-xl font-extrabold">${data.groups[g]?.jobs?.length || 0}</p>
                        <p class="text-[11px] font-bold leading-tight">${statusMeta[g].en}</p>
                    </div>
                `).join('')}
            </div>
        </section>
        ${groups.map(g => {
            const group = data.groups[g];
            const meta = statusMeta[g];
            if (!group || group.jobs.length === 0) return '';
            return `
                <section aria-labelledby="h-${g}" class="flex flex-col gap-2">
                    <h2 id="h-${g}" class="flex items-center gap-2 text-base font-extrabold text-foreground">
                        <i data-lucide="${meta.icon}" class="size-5"></i>
                        ${meta.en} <span class="font-semibold text-muted-foreground">/ ${meta.hi}</span>
                    </h2>
                    <ul class="flex flex-col gap-2">
                        ${group.jobs.map(job => `
                            <li class="rounded-xl border border-l-4 border-border bg-card p-3 shadow-sm ${meta.tone}">
                                <div class="flex items-start justify-between gap-2">
                                    <div class="min-w-0">
                                        <p class="font-extrabold text-foreground">${job.title}</p>
                                        <p class="text-sm font-semibold text-muted-foreground">${job.factory}</p>
                                    </div>
                                    <p class="shrink-0 text-lg font-extrabold text-foreground">${formatINR(job.wage)}</p>
                                </div>
                                <div class="mt-2 flex flex-wrap items-center gap-2">
                                    <span class="rounded-full px-2 py-0.5 text-xs font-bold ${meta.chip}">${job.date}</span>
                                    ${job.payment === 'upi' ? `
                                        <span class="inline-flex items-center gap-1 rounded-full bg-manager-soft px-2 py-0.5 text-xs font-bold text-manager">
                                            <i data-lucide="smartphone" class="size-3.5"></i> Paid via UPI
                                        </span>
                                    ` : ''}
                                    ${job.payment === 'cash' ? `
                                        <span class="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">
                                            <i data-lucide="banknote" class="size-3.5"></i> Cash at Zone 4 Branch
                                        </span>
                                    ` : ''}
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </section>
            `;
        }).join('')}
    `;
    
    lucide.createIcons();
}

function formatINR(n) {
    return '₹' + n.toLocaleString('en-IN');
}