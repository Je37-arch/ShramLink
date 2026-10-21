// Admin Dashboard JavaScript

let currentAdminTab = 'verify';
let currentVerifyKind = 'factories';
let selectedEscrowId = null;
let activeMassHireId = null;
let pickedWorkers = [];

document.addEventListener('DOMContentLoaded', () => {
    loadVerification();
    loadEscrow();
    loadMassHire();
    lucide.createIcons();
});

function switchAdminTab(tab) {
    currentAdminTab = tab;
    document.querySelectorAll('#admin-main .tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('tab-' + tab).classList.remove('hidden');
    
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('text-foreground');
        btn.classList.add('text-muted-foreground');
        const bar = btn.querySelector('span.absolute');
        if (bar) bar.remove();
    });
    
    const activeBtn = document.querySelector(`button[onclick="switchAdminTab('${tab}')"]`);
    if (activeBtn) {
        activeBtn.classList.remove('text-muted-foreground');
        activeBtn.classList.add('text-foreground');
        if (!activeBtn.querySelector('span.absolute')) {
            const bar = document.createElement('span');
            bar.className = 'absolute inset-x-6 top-0 h-1 rounded-b-full bg-foreground';
            bar.setAttribute('aria-hidden', 'true');
            activeBtn.insertBefore(bar, activeBtn.firstChild);
        }
    }
}

function switchVerifyTab(kind) {
    currentVerifyKind = kind;
    document.getElementById('tab-factories').classList.toggle('bg-primary', kind === 'factories');
    document.getElementById('tab-factories').classList.toggle('text-primary-foreground', kind === 'factories');
    document.getElementById('tab-factories').classList.toggle('text-muted-foreground', kind !== 'factories');
    document.getElementById('tab-laborers').classList.toggle('bg-primary', kind === 'laborers');
    document.getElementById('tab-laborers').classList.toggle('text-primary-foreground', kind === 'laborers');
    document.getElementById('tab-laborers').classList.toggle('text-muted-foreground', kind !== 'laborers');
    loadVerification();
}

// Verification Queue
async function loadVerification() {
    try {
        const res = await fetch(`/api/verification?kind=${currentVerifyKind}`);
        const data = await res.json();
        renderVerification(data);
    } catch (e) {
        console.error('Failed to load verification:', e);
    }
}

function renderVerification(data) {
    document.getElementById('pending-count').textContent = `${data.pendingCount} pending reviews · Avg. wait 3 hrs`;
    document.getElementById('count-factories').textContent = data.items.filter(i => i.kind === 'factories').length;
    document.getElementById('count-laborers').textContent = data.items.filter(i => i.kind === 'laborers').length;
    
    const list = document.getElementById('verification-list');
    list.innerHTML = data.items.map(item => `
        <li class="rounded-2xl border-2 bg-card p-4 shadow-sm ${getResultBorder(item.result)}">
            <div class="flex items-start gap-3">
                <span class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                    <i data-lucide="${currentVerifyKind === 'factories' ? 'building-2' : 'hard-hat'}" class="size-6"></i>
                </span>
                <div class="min-w-0 flex-1">
                    <p class="font-extrabold leading-tight text-foreground">${item.title}</p>
                    <p class="text-sm font-semibold text-muted-foreground">${item.subtitle}</p>
                </div>
                <span class="shrink-0 text-xs font-bold text-muted-foreground">${item.submitted}</span>
            </div>
            
            <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-xl bg-muted p-3 text-sm">
                ${item.rows.map(([k, v]) => `
                    <div class="contents">
                        <dt class="font-bold text-muted-foreground">${k}</dt>
                        <dd class="break-all font-mono font-bold text-foreground">${v}</dd>
                    </div>
                `).join('')}
            </dl>
            <button type="button" class="mt-2 inline-flex items-center gap-1 text-sm font-bold text-manager">
                <i data-lucide="file-text" class="size-4"></i> View documents
            </button>
            
            ${item.result ? `
                <div class="mt-3 flex items-center justify-between rounded-xl px-3 py-2.5 font-extrabold ${item.result === 'approved' ? 'bg-accent text-accent-foreground' : 'bg-red-50 text-red-800'}">
                    ${item.result === 'approved' ? 'Approved' : 'Rejected / Flagged'}
                    <button type="button" onclick="undoVerification('${item.id}')" class="inline-flex items-center gap-1 text-sm font-bold underline underline-offset-2">
                        <i data-lucide="undo-2" class="size-4"></i> Undo
                    </button>
                </div>
            ` : `
                <div class="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onclick="decideVerification('${item.id}', 'flagged')"
                            class="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border-2 border-destructive font-extrabold text-destructive">
                        <i data-lucide="flag" class="size-5"></i> Reject / Flag
                    </button>
                    <button type="button" onclick="decideVerification('${item.id}', 'approved')"
                            class="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-primary font-extrabold text-primary-foreground">
                        <i data-lucide="check" class="size-5"></i> Approve
                    </button>
                </div>
            `}
        </li>
    `).join('');
    
    lucide.createIcons();
}

function getResultBorder(result) {
    if (result === 'approved') return 'border-primary';
    if (result === 'flagged') return 'border-destructive';
    return 'border-border';
}

async function decideVerification(id, result) {
    try {
        await fetch('/api/verification/decide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, result })
        });
        loadVerification();
    } catch (e) {
        console.error('Failed to decide:', e);
    }
}

async function undoVerification(id) {
    try {
        await fetch('/api/verification/undo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        loadVerification();
    } catch (e) {
        console.error('Failed to undo:', e);
    }
}

// Escrow Manager
async function loadEscrow() {
    try {
        const res = await fetch('/api/escrow');
        const data = await res.json();
        renderEscrow(data);
    } catch (e) {
        console.error('Failed to load escrow:', e);
    }
}

function renderEscrow(data) {
    const container = document.getElementById('escrow-content');
    container.innerHTML = `
        <div class="grid grid-cols-2 gap-2">
            <div class="rounded-xl bg-foreground p-3 text-background">
                <p class="text-xs font-bold opacity-80">Escrow Held</p>
                <p class="text-2xl font-extrabold">${formatINR(data.held)}</p>
            </div>
            <div class="rounded-xl border border-border bg-card p-3">
                <p class="text-xs font-bold text-muted-foreground">Ready to Pay</p>
                <p class="text-2xl font-extrabold text-foreground">${data.readyCount} jobs</p>
            </div>
        </div>
        
        <div class="overflow-x-auto rounded-xl border border-border bg-card">
            <table class="w-full min-w-[460px] text-left text-sm">
                <caption class="sr-only">Escrow and payout status by job. Select a row to take action.</caption>
                <thead class="bg-muted text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                    <tr>
                        <th scope="col" class="px-3 py-2.5">Job ID</th>
                        <th scope="col" class="px-3 py-2.5">Factory</th>
                        <th scope="col" class="px-3 py-2.5 text-right">Escrow</th>
                        <th scope="col" class="px-3 py-2.5 text-center">Wkrs</th>
                        <th scope="col" class="px-3 py-2.5">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.rows.map(r => `
                        <tr onclick="selectEscrow('${r.id}')" aria-selected="${r.id === selectedEscrowId}"
                            class="cursor-pointer border-t border-border font-semibold ${r.id === selectedEscrowId ? 'bg-manager-soft' : 'hover:bg-muted/60'}">
                            <td class="px-3 py-3"><button type="button" onclick="event.stopPropagation(); selectEscrow('${r.id}')" class="whitespace-nowrap font-mono text-xs font-bold text-foreground">${r.id}</button></td>
                            <td class="px-3 py-3 text-foreground">${r.factory}</td>
                            <td class="px-3 py-3 text-right font-extrabold text-foreground">${formatINR(r.escrow)}</td>
                            <td class="px-3 py-3 text-center text-foreground">${r.workers}</td>
                            <td class="px-3 py-3">
                                <span class="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${data.statusStyle[r.status]}">${r.status}</span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div id="escrow-actions" class="hidden"></div>
    `;
    lucide.createIcons();
}

function selectEscrow(id) {
    selectedEscrowId = id;
    loadEscrow();
    // Load actions for selected row
    fetch('/api/escrow')
        .then(res => res.json())
        .then(data => {
            const row = data.rows.find(r => r.id === id);
            if (row) renderEscrowActions(row, data.statusStyle);
        });
}

function renderEscrowActions(row, statusStyle) {
    const container = document.getElementById('escrow-actions');
    const isOpen = row.status === 'Held' || row.status === 'Work Done';
    
    container.classList.remove('hidden');
    container.innerHTML = `
        <section class="flex flex-col gap-2 rounded-2xl border-2 border-foreground bg-card p-4" aria-label="Payout actions">
            <div class="flex items-center justify-between">
                <p class="font-extrabold text-foreground"><span class="font-mono">${row.id}</span> · ${row.factory}</p>
                <span class="rounded-full px-2 py-0.5 text-xs font-bold ${statusStyle[row.status]}">${row.status}</span>
            </div>
            
            <button type="button" ${!isOpen ? 'disabled' : ''} onclick="updateEscrow('${row.id}', 'Paid UPI')"
                    class="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary font-extrabold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">
                <i data-lucide="smartphone" class="size-5"></i> Release Payout to UPI
            </button>
            <button type="button" ${!isOpen ? 'disabled' : ''} onclick="updateEscrow('${row.id}', 'Cash Zone')"
                    class="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-warning bg-warning-soft font-extrabold text-warning disabled:border-border disabled:bg-muted disabled:text-muted-foreground">
                <i data-lucide="banknote" class="size-5"></i> Assign Cash Zone Distributor
            </button>
            <button type="button" ${!isOpen ? 'disabled' : ''} onclick="updateEscrow('${row.id}', 'Refunded')"
                    class="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-destructive font-extrabold text-destructive disabled:border-border disabled:text-muted-foreground">
                <i data-lucide="rotate-ccw" class="size-5"></i> Issue Refund to Factory
            </button>
            <button type="button" onclick="generateBill('${row.id}')"
                    class="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-foreground font-extrabold text-background">
                <i data-lucide="file-text" class="size-5"></i> Generate GST E-Bill (PDF)
            </button>
            <p id="escrow-notice" class="min-h-5 text-center text-sm font-bold text-primary"></p>
        </section>
    `;
    lucide.createIcons();
}

async function updateEscrow(id, status) {
    try {
        const res = await fetch('/api/escrow/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('escrow-notice').textContent = data.message;
            loadEscrow();
        }
    } catch (e) {
        console.error('Failed to update escrow:', e);
    }
}

async function generateBill(id) {
    try {
        const res = await fetch('/api/escrow/generate-bill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('escrow-notice').textContent = data.message;
        }
    } catch (e) {
        console.error('Failed to generate bill:', e);
    }
}

// Mass Hire Dispatcher
async function loadMassHire() {
    try {
        const res = await fetch('/api/mass-hire');
        const data = await res.json();
        renderMassHire(data);
    } catch (e) {
        console.error('Failed to load mass hire:', e);
    }
}

function renderMassHire(data) {
    const requests = data.requests;
    activeMassHireId = activeMassHireId || requests[1]?.id || requests[0]?.id;
    const active = requests.find(r => r.id === activeMassHireId) || requests[0];
    const remaining = active.needed - active.assigned;
    
    const container = document.getElementById('mass-hire-content');
    container.innerHTML = `
        <div>
            <h1 class="text-xl font-extrabold text-foreground">Mass Hire Dispatcher</h1>
            <p class="text-sm font-semibold text-muted-foreground">Factory requests for 10+ workers</p>
        </div>
        
        <ul class="flex flex-col gap-2" id="mass-requests-list">
            ${requests.map(r => {
                const pct = Math.round((r.assigned / r.needed) * 100);
                const isActive = r.id === activeMassHireId;
                return `
                    <li>
                        <button type="button" aria-pressed="${isActive}" onclick="selectMassRequest('${r.id}')"
                                class="w-full rounded-xl border-2 bg-card p-3 text-left ${isActive ? 'border-foreground' : 'border-border'}">
                            <div class="flex items-start justify-between gap-2">
                                <div class="min-w-0">
                                    <p class="text-xs font-bold text-muted-foreground">${r.id}</p>
                                    <p class="font-extrabold text-foreground">${r.job} <span class="font-semibold text-muted-foreground">· ${r.factory}</span></p>
                                </div>
                                <span class="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-muted-foreground">
                                    <i data-lucide="calendar-days" class="size-3.5"></i> ${r.date}
                                </span>
                            </div>
                            <div class="mt-2 flex items-center gap-2">
                                <div class="h-2.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow="${r.assigned}" aria-valuemin="0" aria-valuemax="${r.needed}" aria-label="${r.assigned} of ${r.needed} assigned">
                                    <div class="h-full rounded-full ${pct >= 100 ? 'bg-primary' : 'bg-warning'}" style="width: ${Math.min(pct, 100)}%"></div>
                                </div>
                                <span class="text-sm font-extrabold text-foreground">${r.assigned}/${r.needed}</span>
                            </div>
                        </button>
                    </li>
                `;
            }).join('')}
        </ul>
        
        <section class="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4" aria-label="Batch assign workers">
            <div class="flex items-center justify-between gap-2">
                <h2 class="font-extrabold text-foreground">Assign to <span class="font-mono">${active.id}</span></h2>
                <span class="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">${remaining} needed</span>
            </div>
            
            <button type="button" onclick="pickNearest(${remaining})" ${remaining <= 0 ? 'disabled' : ''}
                    class="min-h-11 rounded-xl border-2 border-foreground text-sm font-extrabold text-foreground disabled:border-border disabled:text-muted-foreground">
                Auto-select nearest ${Math.min(remaining, data.verified_pool.length)} verified
            </button>
            
            <ul class="flex flex-col divide-y divide-border" id="verified-pool-list">
                ${data.verified_pool.map(w => {
                    const on = pickedWorkers.includes(w.id);
                    return `
                        <li>
                            <label class="flex min-h-12 cursor-pointer items-center gap-3 py-2 ${on ? 'bg-manager-soft' : ''}">
                                <input type="checkbox" ${on ? 'checked' : ''} onchange="toggleWorker('${w.id}')" ${remaining <= 0 ? 'disabled' : ''} class="size-5 shrink-0 accent-primary">
                                <span class="min-w-0 flex-1">
                                    <span class="flex items-center gap-1 font-bold text-foreground">${w.name} <i data-lucide="badge-check" class="size-4 text-primary" aria-label="Verified"></i></span>
                                    <span class="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                        <span class="inline-flex items-center gap-0.5"><i data-lucide="map-pin" class="size-3"></i> ${w.distanceKm} km · ${w.zone}</span>
                                    </span>
                                </span>
                                <span class="inline-flex items-center gap-0.5 text-sm font-bold text-foreground">${w.rating.toFixed(1)} <i data-lucide="star" class="size-3.5 fill-warning text-warning"></i></span>
                            </label>
                        </li>
                    `;
                }).join('')}
            </ul>
            
            <button type="button" onclick="assignWorkers()" ${pickedWorkers.length === 0 || remaining <= 0 ? 'disabled' : ''}
                    class="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary font-extrabold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">
                <i data-lucide="users" class="size-5"></i> Assign ${Math.min(pickedWorkers.length, Math.max(remaining, 0))} Workers
            </button>
            <p id="mass-notice" class="min-h-5 text-center text-sm font-bold text-primary"></p>
        </section>
    `;
    lucide.createIcons();
}

function selectMassRequest(id) {
    activeMassHireId = id;
    pickedWorkers = [];
    loadMassHire();
}

function toggleWorker(id) {
    if (pickedWorkers.includes(id)) {
        pickedWorkers = pickedWorkers.filter(x => x !== id);
    } else {
        pickedWorkers.push(id);
    }
    loadMassHire();
}

function pickNearest(remaining) {
    fetch('/api/mass-hire')
        .then(res => res.json())
        .then(data => {
            const count = Math.min(remaining, data.verified_pool.length);
            pickedWorkers = data.verified_pool.slice(0, count).map(w => w.id);
            loadMassHire();
        });
}

async function assignWorkers() {
    if (pickedWorkers.length === 0) return;
    
    try {
        const res = await fetch('/api/mass-hire/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request_id: activeMassHireId, worker_ids: pickedWorkers })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('mass-notice').textContent = data.message;
            pickedWorkers = [];
            loadMassHire();
        }
    } catch (e) {
        console.error('Failed to assign workers:', e);
    }
}

function formatINR(n) {
    return '₹' + n.toLocaleString('en-IN');
}