// Manager Dashboard JavaScript

let currentTab = 'home';
let currentJobId = '';
let workerDecisions = {};

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    setupPostJobForm();
    lucide.createIcons();
});

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('tab-' + tab).classList.remove('hidden');
    
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('text-manager', 'text-foreground');
        btn.classList.add('text-muted-foreground');
        const bar = btn.querySelector('span.absolute');
        if (bar) bar.remove();
    });
    
    const activeBtn = document.querySelector(`button[onclick="switchTab('${tab}')"]`);
    if (activeBtn) {
        activeBtn.classList.remove('text-muted-foreground');
        activeBtn.classList.add('text-manager');
        if (!activeBtn.querySelector('span.absolute')) {
            const bar = document.createElement('span');
            bar.className = 'absolute inset-x-6 top-0 h-1 rounded-b-full bg-manager';
            bar.setAttribute('aria-hidden', 'true');
            activeBtn.insertBefore(bar, activeBtn.firstChild);
        }
    }
    
    if (tab === 'workers') loadWorkers();
}

async function loadDashboard() {
    try {
        const res = await fetch('/api/manager/dashboard');
        const data = await res.json();
        renderDashboard(data);
    } catch (e) {
        console.error('Failed to load dashboard:', e);
    }
}

function renderDashboard(data) {
    const container = document.getElementById('manager-dashboard-content');
    container.innerHTML = `
        <section class="bg-manager px-4 pb-5 pt-4 text-manager-foreground">
            <div class="flex items-start gap-3">
                <span class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-manager-foreground/15">
                    <i data-lucide="factory" class="size-6"></i>
                </span>
                <div class="min-w-0 flex-1">
                    <h1 class="text-xl font-extrabold leading-tight">${data.factory_name}</h1>
                    <p class="text-sm font-semibold opacity-90">${data.location}</p>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                        <span class="inline-flex items-center gap-1 rounded-full bg-white text-emerald-700 px-2 py-0.5 text-xs font-bold">
                            <i data-lucide="badge-check" class="size-3.5"></i> Verified Factory
                        </span>
                        <button type="button" onclick="toggleVerified()" class="text-xs font-bold underline underline-offset-2 opacity-90">
                            Preview pending state
                        </button>
                    </div>
                </div>
            </div>
            <button type="button" onclick="switchTab('post')" id="post-job-btn"
                    class="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-white text-lg font-extrabold text-manager shadow-sm active:scale-[0.99]">
                <i data-lucide="plus" class="size-6" stroke-width="3"></i> Post a New Job
            </button>
        </section>
        <div class="grid grid-cols-3 gap-2 px-4">
            <div class="rounded-xl border border-border bg-card p-3 text-center">
                <p class="text-2xl font-extrabold text-foreground">${data.stats.active_jobs}</p>
                <p class="text-xs font-bold text-muted-foreground">Active Jobs</p>
            </div>
            <div class="rounded-xl border border-border bg-card p-3 text-center">
                <p class="text-2xl font-extrabold text-foreground">${data.stats.total_applicants}</p>
                <p class="text-xs font-bold text-muted-foreground">Applicants</p>
            </div>
            <div class="rounded-xl border border-border bg-card p-3 text-center">
                <p class="text-lg font-extrabold text-foreground">${data.stats.in_escrow}</p>
                <p class="text-xs font-bold text-muted-foreground">In Escrow</p>
            </div>
        </div>
        <section class="flex flex-col gap-3 px-4" aria-label="Active job posts">
            <div class="flex items-center justify-between gap-2">
                <h2 class="text-base font-extrabold text-foreground">Active Jobs <span class="font-semibold text-muted-foreground">/ चालू काम</span></h2>
            </div>
            <ul class="flex flex-col gap-2" id="active-jobs-list">
                ${data.jobs.map(job => `
                    <li>
                        <button type="button" onclick="loadWorkers('${job.id}')" 
                                class="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm hover:border-manager/50">
                            <div class="min-w-0 flex-1">
                                <p class="text-xs font-bold text-muted-foreground">${job.id}</p>
                                <p class="font-extrabold text-foreground">${job.title}</p>
                                <p class="text-sm font-semibold text-muted-foreground">${formatINR(job.wage)}/day · Need ${job.needed}</p>
                            </div>
                            <span class="rounded-full bg-manager-soft px-2.5 py-1 text-sm font-extrabold text-manager">${job.applicants} applied</span>
                            <i data-lucide="chevron-right" class="size-5 text-muted-foreground"></i>
                        </button>
                    </li>
                `).join('')}
            </ul>
        </section>
    `;
    lucide.createIcons();
}

function toggleVerified() {
    // Demo toggle - just reload
    loadDashboard();
}

// Post Job Tab
function setupPostJobForm() {
    const titleInput = document.getElementById('job-title');
    const wageInput = document.getElementById('job-wage');
    const workersInput = document.getElementById('job-workers');
    const daysInput = document.getElementById('job-days');
    const massHireCheckbox = document.getElementById('mass-hire');
    const massHireHint = document.getElementById('mass-hire-hint');
    
    [titleInput, wageInput, workersInput, daysInput].forEach(input => {
        input.addEventListener('input', updateEscrowCalc);
    });
    
    massHireCheckbox.addEventListener('change', () => {
        massHireHint.textContent = massHireCheckbox.checked ? '₹50 per worker for batch dispatch' : '';
        updateEscrowCalc();
    });
    
    document.getElementById('post-job-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await publishJob();
    });
    
    updateEscrowCalc();
}

function updateEscrowCalc() {
    const title = document.getElementById('job-title').value;
    const wage = parseInt(document.getElementById('job-wage').value) || 0;
    const workers = parseInt(document.getElementById('job-workers').value) || 0;
    const days = parseInt(document.getElementById('job-days').value) || 0;
    const massHire = document.getElementById('mass-hire').checked;
    
    // Detect skills
    const tags = detectSkills(title);
    const skillsContainer = document.getElementById('detected-skills');
    skillsContainer.innerHTML = tags.length 
        ? tags.map(t => `<span class="rounded-full bg-manager px-3 py-1 text-sm font-bold text-manager-foreground">${t}</span>`).join('')
        : '<span class="text-sm font-semibold text-muted-foreground">Type a job title to detect skills…</span>';
    
    // Calculate escrow
    const wages = wage * workers * days;
    const fee = Math.round(wages * 0.05);
    const massCharge = massHire ? 50 * workers : 0;
    const total = wages + fee + massCharge;
    
    const canPublish = title.trim().length > 2 && wage > 0 && workers > 0 && days > 0;
    document.getElementById('publish-btn').disabled = !canPublish;
    
    document.getElementById('wages-row').textContent = `Wages (${formatINR(wage)} × ${workers} × ${days} days)`;
    document.getElementById('wages-value').textContent = formatINR(wages);
    document.getElementById('fee-value').textContent = formatINR(fee);
    
    const massRow = document.getElementById('mass-charge-row');
    if (massHire && massCharge > 0) {
        if (!massRow) {
            const dl = document.getElementById('escrow-calc');
            const row = document.createElement('div');
            row.id = 'mass-charge-row';
            row.className = 'flex items-center justify-between gap-2';
            row.innerHTML = `<dt class="text-muted-foreground">Mass hire team charge</dt><dd class="font-extrabold text-foreground" id="mass-value">${formatINR(massCharge)}</dd>`;
            dl.appendChild(row);
        } else {
            document.getElementById('mass-value').textContent = formatINR(massCharge);
        }
    } else if (massRow) {
        massRow.remove();
    }
    
    document.getElementById('total-value').textContent = formatINR(total);
}

function detectSkills(title) {
    const lower = title.toLowerCase();
    const tags = new Set();
    const keywords = {
        machine: ['#CNC', '#Packaging'],
        operator: ['#MachineOperator'],
        weld: ['#Welding', '#Fabrication'],
        load: ['#Loading', '#Lifting'],
        pack: ['#Packaging', '#Labelling'],
        mason: ['#Masonry', '#Construction'],
        construct: ['#Construction', '#Masonry'],
        paint: ['#Painting', '#Finishing'],
        electric: ['#Wiring', '#Electrical'],
        helper: ['#Helper', '#GeneralLabour'],
        driver: ['#Driving', '#Forklift'],
    };
    for (const [kw, list] of Object.entries(keywords)) {
        if (lower.includes(kw)) list.forEach(t => tags.add(t));
    }
    return [...tags];
}

async function publishJob() {
    const data = {
        title: document.getElementById('job-title').value,
        wage: parseInt(document.getElementById('job-wage').value),
        workers: parseInt(document.getElementById('job-workers').value),
        days: parseInt(document.getElementById('job-days').value),
        verifiedOnly: document.getElementById('verified-only').checked,
        massHire: document.getElementById('mass-hire').checked,
    };
    
    try {
        const res = await fetch('/api/manager/post-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            document.getElementById('post-job-form').classList.add('hidden');
            document.getElementById('post-success').classList.remove('hidden');
            document.getElementById('success-message').textContent = result.message;
        }
    } catch (e) {
        console.error('Failed to publish job:', e);
    }
}

function resetPostForm() {
    document.getElementById('post-job-form').classList.remove('hidden');
    document.getElementById('post-success').classList.add('hidden');
    document.getElementById('post-job-form').reset();
    document.getElementById('verified-only').checked = true;
    updateEscrowCalc();
}

// Workers Tab
async function loadWorkers(jobId) {
    currentJobId = jobId || currentJobId;
    if (!currentJobId) return;
    
    switchTab('workers');
    
    try {
        const res = await fetch(`/api/manager/workers?view=applicants&job_id=${currentJobId}`);
        const data = await res.json();
        renderWorkers(data);
    } catch (e) {
        console.error('Failed to load workers:', e);
    }
}

function renderWorkers(data) {
    const container = document.getElementById('workers-content');
    const job = data.job;
    const hiredCount = data.hiredCount;
    
    container.innerHTML = `
        <div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Select job">
            ${[
                {id: 'JB-2041', title: 'Welder (Arc)', applicants: 4, needed: 2, wage: 750},
                {id: 'JB-2038', title: 'Machine Operator', applicants: 9, needed: 5, wage: 680},
                {id: 'JB-2035', title: 'Packing Helper', applicants: 5, needed: 3, wage: 520},
            ].map(j => `
                <button type="button" onclick="loadWorkers('${j.id}')"
                        class="min-h-11 shrink-0 rounded-full border-2 px-4 text-sm font-bold ${j.id === currentJobId ? 'border-manager bg-manager text-manager-foreground' : 'border-border bg-card'}">
                    ${j.title}
                </button>
            `).join('')}
        </div>
        
        <div class="flex items-center justify-between rounded-xl bg-manager-soft px-3 py-2.5 text-sm font-bold text-manager">
            <span>${job.id} · ${formatINR(job.wage)}/day</span>
            <span>Hired ${hiredCount} / ${job.needed}</span>
        </div>
        
        <ul class="flex flex-col gap-3" id="applicants-list">
            ${data.applicants.map(a => renderApplicant(a, job)).join('')}
        </ul>
    `;
    lucide.createIcons();
}

function renderApplicant(a, job) {
    const decision = a.decision;
    const initials = a.name.split(' ').map(p => p[0]).join('').slice(0, 2);
    
    return `
        <li class="rounded-2xl border bg-card p-4 shadow-sm ${decision === 'hired' ? 'border-manager' : 'border-border'} ${decision === 'declined' ? 'opacity-60' : ''}">
            <div class="flex items-start gap-3">
                <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-base font-extrabold text-foreground">${initials}</span>
                <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <p class="text-lg font-extrabold text-foreground">${a.name}</p>
                        ${a.verified ? '<span class="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground"><i data-lucide="badge-check" class="size-3.5"></i>Verified</span>' : '<span class="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning ring-1 ring-warning/30"><i data-lucide="clock" class="size-3.5"></i>Unverified</span>'}
                    </div>
                    <p class="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm font-semibold text-muted-foreground">
                        <span>Age ${a.age}</span>
                        <span class="inline-flex items-center gap-0.5 text-sm font-bold text-foreground">${a.rating.toFixed(1)} <i data-lucide="star" class="size-3.5 fill-warning text-warning"></i></span>
                        <span>${a.jobsDone} jobs</span>
                        <span class="inline-flex items-center gap-0.5"><i data-lucide="map-pin" class="size-3.5"></i>${a.distanceKm} km</span>
                    </p>
                    <div class="mt-2 flex flex-wrap gap-1.5">
                        ${a.skills.map(s => `<span class="rounded-md bg-muted px-2 py-0.5 text-xs font-bold text-foreground">${s}</span>`).join('')}
                    </div>
                </div>
            </div>
            
            ${decision ? `
                <div class="mt-3 flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
                    <span class="font-extrabold ${decision === 'hired' ? 'text-manager' : 'text-muted-foreground'}">
                        ${decision === 'hired' ? `Hired · ${formatINR(job.wage)} reserved` : 'Declined'}
                    </span>
                    <button type="button" onclick="undoDecision('${job.id}-${a.id}')" class="text-sm font-bold underline underline-offset-2">Undo</button>
                </div>
            ` : `
                <div class="mt-3 flex gap-2">
                    <button type="button" onclick="makeDecision('${job.id}', '${a.id}', 'decline')"
                            class="flex min-h-12 items-center justify-center gap-1 rounded-xl border-2 border-border px-4 font-extrabold text-foreground">
                        <i data-lucide="x" class="size-5"></i> Decline
                    </button>
                    <button type="button" onclick="makeDecision('${job.id}', '${a.id}', 'hire')"
                            class="flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl bg-manager font-extrabold text-manager-foreground">
                        <i data-lucide="check" class="size-5"></i> Hire & Reserve Escrow
                    </button>
                </div>
            `}
        </li>
    `;
}

async function makeDecision(jobId, applicantId, action) {
    try {
        const res = await fetch('/api/manager/hire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_id: jobId, applicant_id: applicantId, action })
        });
        const data = await res.json();
        if (data.success) {
            loadWorkers(jobId);
        }
    } catch (e) {
        console.error('Failed to make decision:', e);
    }
}

async function undoDecision(key) {
    try {
        await fetch('/api/manager/undo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
        });
        loadWorkers(currentJobId);
    } catch (e) {
        console.error('Failed to undo:', e);
    }
}

function formatINR(n) {
    return '₹' + n.toLocaleString('en-IN');
}