/**
 * notif.js — StudySphere Global Notification System v2
 * =====================================================
 * Drop this file next to your HTML pages and add 4 lines to each page's
 * onAuthStateChanged (see bottom of this file for the snippet).
 *
 * What fires on EVERY page:
 *  • 📬 Someone sends you a study invite  → popup banner + bell badge + browser notification
 *  • 🎉 Someone accepts your invite       → popup banner + browser notification
 *  • Bell button (bottom-right)           → opens panel with Accept / Decline
 *  • Accept / Decline works from any page → writes mutual follow to Firestore
 *
 * Pages that have their OWN bell (match.html, dashboard.html) won't get the
 * floating bell but WILL still get popups and toasts.
 */

import {
    collection, query, where, onSnapshot,
    updateDoc, setDoc, getDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const GRADS = [
    'linear-gradient(135deg,#7c3aed,#4d94ff)',
    'linear-gradient(135deg,#0891b2,#6d28d9)',
    'linear-gradient(135deg,#059669,#0891b2)',
    'linear-gradient(135deg,#d97706,#ec4899)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#6d28d9,#ec4899)',
];
function _grad(uid = '') {
    let h = 0;
    for (const c of uid) h = (h * 31 + c.charCodeAt(0)) & 0xfffffff;
    return GRADS[h % GRADS.length];
}
function _initials(name = '') {
    return name.split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || '??';
}
function _esc(t = '') {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(t));
    return d.innerHTML;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
#_gn_bell {
    position: fixed;
    bottom: 28px; right: 28px;
    z-index: 99900;
    background: linear-gradient(135deg,#111118,#1a1a26);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 999px;
    padding: 11px 20px;
    display: flex; align-items: center; gap: 8px;
    cursor: pointer;
    font-size: 13px; font-weight: 600;
    color: #e2e8f0;
    font-family: 'Inter', sans-serif;
    box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(109,40,217,0.08);
    transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
    user-select: none;
}
#_gn_bell:hover {
    border-color: rgba(109,40,217,0.6);
    box-shadow: 0 8px 32px rgba(109,40,217,0.25), 0 0 0 1px rgba(109,40,217,0.2);
    transform: translateY(-1px);
}
#_gn_bell_badge {
    background: #ef4444; color: #fff;
    font-size: 10px; font-weight: 800;
    min-width: 18px; height: 18px;
    border-radius: 999px; padding: 0 4px;
    display: none; align-items: center; justify-content: center;
    line-height: 1;
    box-shadow: 0 2px 6px rgba(239,68,68,0.5);
}
@keyframes _gnRing {
    0%  { transform: translateY(0) rotate(-10deg) scale(1.12); }
    25% { transform: translateY(0) rotate(10deg)  scale(1.15); }
    50% { transform: translateY(0) rotate(-6deg)  scale(1.08); }
    75% { transform: translateY(0) rotate(5deg)   scale(1.04); }
    100%{ transform: translateY(0) rotate(0deg)   scale(1);    }
}
._gn_bell_ring { animation: _gnRing 0.55s ease forwards; }

/* ── Panel ── */
#_gn_panel {
    position: fixed; bottom: 90px; right: 28px;
    width: min(380px, calc(100vw - 24px)); max-height: 72vh;
    overflow-y: auto;
    background: #0e0e1a;
    border: 1px solid rgba(255,255,255,0.1); border-radius: 20px;
    z-index: 99901; display: none;
    box-shadow: 0 24px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(109,40,217,0.1);
    font-family: 'Inter', sans-serif;
    scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.12) transparent;
}
#_gn_panel::-webkit-scrollbar { width: 4px; }
#_gn_panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
._gn_ph {
    position: sticky; top: 0; background: #0e0e1a;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    padding: 14px 18px;
    display: flex; justify-content: space-between; align-items: center;
    font-weight: 700; font-size: 14px; color: #e2e8f0;
    z-index: 1; border-radius: 20px 20px 0 0;
}
._gn_ph_close { cursor:pointer; color:#6b7280; font-size:22px; line-height:1; padding:0 2px; background:none; border:none; transition:color 0.15s; }
._gn_ph_close:hover { color:#e2e8f0; }
#_gn_panel_body { padding: 12px; }
._gn_inv {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 14px; margin-bottom: 10px;
    transition: border-color 0.2s, background 0.2s;
}
._gn_inv:last-child { margin-bottom: 0; }
._gn_inv:hover { border-color: rgba(109,40,217,0.35); background: rgba(109,40,217,0.05); }
._gn_av { width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:14px; color:#fff; flex-shrink:0; }
._gn_acc { flex:1; padding:8px 0; border-radius:10px; border:none; background:linear-gradient(135deg,#059669,#10b981); color:#fff; font-size:12px; font-weight:700; cursor:pointer; transition:opacity 0.15s; font-family:'Inter',sans-serif; }
._gn_acc:hover { opacity:0.88; }
._gn_dec { flex:1; padding:8px 0; border-radius:10px; border:none; background:linear-gradient(135deg,#dc2626,#ef4444); color:#fff; font-size:12px; font-weight:700; cursor:pointer; transition:opacity 0.15s; font-family:'Inter',sans-serif; }
._gn_dec:hover { opacity:0.88; }
._gn_empty { text-align:center; padding:32px 12px; color:#6b7280; font-size:13px; }

/* ══ POPUP BANNER ══ */
#_gn_popup_wrap {
    position: fixed; top: 72px; right: 20px;
    z-index: 100000;
    display: flex; flex-direction: column; gap: 12px;
    pointer-events: none;
    width: min(390px, calc(100vw - 32px));
}
._gn_popup {
    pointer-events: all;
    background: linear-gradient(135deg,#12121f 0%,#1c1c30 100%);
    border: 1px solid rgba(109,40,217,0.4);
    border-radius: 20px;
    padding: 18px 18px 16px;
    box-shadow: 0 24px 70px rgba(0,0,0,0.8),
                0 0 0 1px rgba(109,40,217,0.12),
                0 0 50px rgba(109,40,217,0.07);
    display: flex; gap: 14px; align-items: flex-start;
    opacity: 0; transform: translateX(50px) scale(0.96);
    transition: opacity 0.32s cubic-bezier(.34,1.56,.64,1),
                transform 0.32s cubic-bezier(.34,1.56,.64,1);
    font-family: 'Inter', sans-serif;
    position: relative; overflow: hidden;
}
._gn_popup::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: linear-gradient(90deg,#7c3aed,#22d3ee,#10b981);
    border-radius: 20px 20px 0 0;
}
._gn_popup.gn-show { opacity:1; transform:translateX(0) scale(1); }
._gn_popup.gn-hide { opacity:0; transform:translateX(50px) scale(0.96); }
._gn_pav {
    width:46px; height:46px; border-radius:50%; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    font-weight:800; font-size:18px; color:white;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
._gn_pb { flex:1; min-width:0; }
._gn_pt { font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.35); margin-bottom:5px; }
._gn_pn { font-size:15px; font-weight:800; color:#e2e8f0; margin-bottom:3px; line-height:1.2; }
._gn_ps { font-size:12px; color:rgba(255,255,255,0.42); margin-bottom:10px; line-height:1.4; }
._gn_psc {
    display:inline-flex; align-items:center; gap:5px;
    font-size:11px; font-weight:700;
    background:rgba(16,185,129,0.14); border:1px solid rgba(16,185,129,0.3);
    color:#34d399; padding:3px 11px; border-radius:999px; margin-bottom:12px;
}
._gn_pac_badge {
    display:inline-flex; align-items:center; gap:5px;
    font-size:12px; font-weight:700;
    background:rgba(109,40,217,0.14); border:1px solid rgba(109,40,217,0.3);
    color:#a78bfa; padding:4px 13px; border-radius:999px; margin-bottom:12px;
}
._gn_pa { display:flex; gap:8px; }
._gn_pacc {
    flex:1; padding:8px 0; border-radius:10px; border:none;
    background:linear-gradient(135deg,#059669,#10b981);
    color:#fff; font-size:12px; font-weight:700; cursor:pointer;
    font-family:'Inter',sans-serif; transition:opacity 0.15s,transform 0.1s;
}
._gn_pacc:hover { opacity:0.87; transform:translateY(-1px); }
._gn_pdec {
    flex:1; padding:8px 0; border-radius:10px;
    background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.28);
    color:#f87171; font-size:12px; font-weight:700; cursor:pointer;
    font-family:'Inter',sans-serif; transition:background 0.15s;
}
._gn_pdec:hover { background:rgba(239,68,68,0.24); }
._gn_pview {
    flex:1; padding:8px 0; border-radius:10px;
    background:rgba(109,40,217,0.12); border:1px solid rgba(109,40,217,0.3);
    color:#a78bfa; font-size:12px; font-weight:700; cursor:pointer;
    font-family:'Inter',sans-serif; transition:background 0.15s;
}
._gn_pview:hover { background:rgba(109,40,217,0.28); color:white; }
._gn_pclose {
    position:absolute; top:12px; right:14px;
    cursor:pointer; color:rgba(255,255,255,0.22); font-size:18px; line-height:1;
    background:none; border:none; transition:color 0.15s; padding:0;
}
._gn_pclose:hover { color:rgba(255,255,255,0.7); }

/* ── Toast ── */
#_gn_toast {
    position: fixed; bottom: 24px; left: 50%;
    transform: translateX(-50%) translateY(70px);
    background: rgba(14,14,26,0.97);
    border: 1px solid rgba(255,255,255,0.1);
    color: #e2e8f0; padding: 12px 26px;
    border-radius: 12px; font-size: 13px;
    font-family: 'Inter', sans-serif;
    z-index: 100001; opacity: 0;
    transition: all 0.32s cubic-bezier(.34,1.56,.64,1);
    pointer-events: none;
    max-width: calc(100vw - 32px);
    text-align: center;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    white-space: nowrap;
}
#_gn_toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }

body.has-own-bell #_gn_bell { display: none !important; }

@media (max-width: 540px) {
    #_gn_bell  { bottom: 18px; right: 14px; padding: 9px 16px; font-size: 12px; }
    #_gn_panel { bottom: 76px; right: 8px; left: 8px; width: auto; }
    #_gn_popup_wrap { top: 62px; right: 8px; left: 8px; width: auto; }
    ._gn_popup { padding: 14px; gap: 11px; }
    ._gn_pav   { width: 38px; height: 38px; font-size: 15px; }
    #_gn_toast { width: calc(100% - 32px); white-space: normal; }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// INJECT UI
// ─────────────────────────────────────────────────────────────────────────────
function _injectUI() {
    if (document.getElementById('_gn_bell')) return;

    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);

    // Popup stack container
    const pw = document.createElement('div');
    pw.id = '_gn_popup_wrap';
    document.body.appendChild(pw);

    // Floating bell
    const bell = document.createElement('button');
    bell.id = '_gn_bell';
    bell.setAttribute('aria-label', 'Study Invites');
    bell.innerHTML = `<span style="font-size:16px;line-height:1;">🔔</span><span id="_gn_bell_label">Invites</span><span id="_gn_bell_badge"></span>`;
    bell.addEventListener('click', _togglePanel);
    document.body.appendChild(bell);

    // Panel
    const panel = document.createElement('div');
    panel.id = '_gn_panel';
    panel.innerHTML = `
        <div class="_gn_ph">
            <span>📬 Study Invites</span>
            <button class="_gn_ph_close" onclick="document.getElementById('_gn_panel').style.display='none'">×</button>
        </div>
        <div id="_gn_panel_body"><div class="_gn_empty">⏳ Loading…</div></div>`;
    document.body.appendChild(panel);

    // Toast
    if (!document.getElementById('_gn_toast')) {
        const t = document.createElement('div');
        t.id = '_gn_toast';
        document.body.appendChild(t);
    }

    // Outside click → close panel
    document.addEventListener('click', e => {
        const p = document.getElementById('_gn_panel');
        const b = document.getElementById('_gn_bell');
        if (p && p.style.display === 'block' && !p.contains(e.target) && b && !b.contains(e.target))
            p.style.display = 'none';
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            const p = document.getElementById('_gn_panel');
            if (p) p.style.display = 'none';
        }
    });
}

function _togglePanel() {
    const p = document.getElementById('_gn_panel');
    if (!p) return;
    p.style.display = p.style.display === 'block' ? 'none' : 'block';
}

// ─────────────────────────────────────────────────────────────────────────────
// BROWSER PUSH (fires when tab is hidden)
// ─────────────────────────────────────────────────────────────────────────────
async function _askPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}
function _pushNotif(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!document.hidden) return; // only when tab not focused
    try { new Notification(title, { body, icon: '/favicon.ico', tag: 'ss-' + Date.now() }); }
    catch(e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST (works on any page's toast element)
// ─────────────────────────────────────────────────────────────────────────────
export function showGlobalToast(msg) {
    const t = document.getElementById('toast')
           || document.getElementById('gnToast')
           || document.getElementById('_gn_toast');
    if (!t) return;
    t.textContent = msg;

    if (t.id === '_gn_toast') {
        t.classList.add('show');
        clearTimeout(window._gn_tt);
        window._gn_tt = setTimeout(() => t.classList.remove('show'), 3800);
    } else {
        t.style.opacity = '1';
        t.style.transform = 'translateX(-50%) translateY(0)';
        clearTimeout(window._gn_tt);
        window._gn_tt = setTimeout(() => {
            t.style.opacity = '0';
            t.style.transform = 'translateX(-50%) translateY(60px)';
        }, 3800);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POPUP BANNER
// ─────────────────────────────────────────────────────────────────────────────
function _showPopup(opts) {
    const wrap = document.getElementById('_gn_popup_wrap');
    if (!wrap) return;

    const el = document.createElement('div');
    el.className = '_gn_popup';
    const isInvite = opts.type === 'invite';

    el.innerHTML = `
        <div class="_gn_pav" style="background:${_grad(opts.fromUid)};">${_initials(opts.fromName)}</div>
        <div class="_gn_pb">
            <div class="_gn_pt">${isInvite ? '📬 NEW STUDY INVITE' : '🎉 INVITE ACCEPTED'}</div>
            <div class="_gn_pn">${_esc(opts.fromName)}</div>
            <div class="_gn_ps">${isInvite ? _esc(opts.fromUniversity || 'wants to study with you') : 'accepted your invite — you\'re now study partners!'}</div>
            ${isInvite
                ? `<div class="_gn_psc">🎯 ${opts.compatScore}% compatibility</div>`
                : `<div class="_gn_pac_badge">✅ Study Partners</div>`
            }
            <div class="_gn_pa">
                ${isInvite
                    ? `<button class="_gn_pacc" onclick="_gnPopupRespond('${opts.inviteId}','accepted','${opts.fromUid}','${(opts.fromName||'').replace(/'/g,"\\'")}',${opts.compatScore},this)">✓ Accept</button>
                       <button class="_gn_pdec" onclick="_gnPopupRespond('${opts.inviteId}','declined','${opts.fromUid}','${(opts.fromName||'').replace(/'/g,"\\'")}',0,this)">✗ Decline</button>`
                    : `<button class="_gn_pview" onclick="window.location.href='match.html'">View on Match →</button>
                       <button class="_gn_pdec" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);" onclick="_gnClosePopup(this.closest('._gn_popup'))">Dismiss</button>`
                }
            </div>
        </div>
        <button class="_gn_pclose" onclick="_gnClosePopup(this.closest('._gn_popup'))">×</button>`;

    wrap.appendChild(el);

    // Animate in (double RAF to ensure layout)
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('gn-show')));

    // Auto-dismiss
    el._gnTimer = setTimeout(() => _gnClosePopup(el), isInvite ? 15000 : 8000);
}

window._gnClosePopup = function(el) {
    if (!el) return;
    clearTimeout(el._gnTimer);
    el.classList.remove('gn-show');
    el.classList.add('gn-hide');
    setTimeout(() => el?.remove(), 350);
};

// ─────────────────────────────────────────────────────────────────────────────
// ACCEPT / DECLINE — from popup
// ─────────────────────────────────────────────────────────────────────────────
window._gnPopupRespond = async function(inviteId, status, fromUid, fromName, compatScore, btn) {
    const db  = window._gn_db;
    const uid = window._gn_uid;
    if (!db || !uid) { showGlobalToast('⚠️ Not logged in'); return; }

    const popup = btn?.closest('._gn_popup');
    if (popup) popup.querySelectorAll('button:not(._gn_pclose)').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });

    try {
        await updateDoc(doc(db,'invites',inviteId), { status, respondedAt: serverTimestamp() });
        if (status === 'accepted') {
            await _writeMutualFollow(db, uid, fromUid, fromName, compatScore);
            showGlobalToast(`🎉 You and ${fromName} are now study partners!`);
        } else {
            showGlobalToast(`❌ Declined ${fromName}'s invite.`);
        }
        if (popup) setTimeout(() => _gnClosePopup(popup), 400);
        const p = document.getElementById('_gn_panel');
        if (p) p.style.display = 'none';
    } catch(e) {
        console.error('_gnPopupRespond:', e);
        showGlobalToast('⚠️ ' + e.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ACCEPT / DECLINE — from panel list
// ─────────────────────────────────────────────────────────────────────────────
window._gnRespond = async function(inviteId, status, fromUid, fromName, compatScore) {
    const db  = window._gn_db;
    const uid = window._gn_uid;
    if (!db || !uid) { showGlobalToast('⚠️ Not logged in'); return; }

    const item = document.getElementById('_gni_' + inviteId);
    try {
        await updateDoc(doc(db,'invites',inviteId), { status, respondedAt: serverTimestamp() });
        if (status === 'accepted') {
            await _writeMutualFollow(db, uid, fromUid, fromName, compatScore);
            showGlobalToast(`🎉 You and ${fromName} are now study partners!`);
        } else {
            showGlobalToast(`❌ Declined ${fromName}'s invite.`);
        }
        if (item) { item.style.opacity = '0'; item.style.transform = 'scale(0.97)'; setTimeout(() => item.remove(), 300); }
        const p = document.getElementById('_gn_panel');
        if (p && status === 'accepted') p.style.display = 'none';
    } catch(e) {
        console.error('_gnRespond:', e);
        showGlobalToast('⚠️ ' + e.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// WRITE MUTUAL FOLLOW
// ─────────────────────────────────────────────────────────────────────────────
async function _writeMutualFollow(db, uid, fromUid, fromName, compatScore) {
    const [mySnap, theirSnap] = await Promise.all([
        getDoc(doc(db,'users',uid)),
        getDoc(doc(db,'users',fromUid)),
    ]);
    const myD    = mySnap.exists()    ? mySnap.data()    : {};
    const theirD = theirSnap.exists() ? theirSnap.data() : {};
    const myName    = myD.displayName    || myD.name    || window._gn_myUserData?.name || 'User';
    const theirName = theirD.displayName || theirD.name || fromName || 'User';

    await Promise.all([
        setDoc(doc(db,'social',uid,'following',fromUid), { displayName:theirName, email:theirD.email||'', color:theirD.color||'#4d94ff', subject:theirD.subject||'Studying', subjects:theirD.subjects||[], matchScore:compatScore, matched:true, followedAt:serverTimestamp() }),
        setDoc(doc(db,'social',fromUid,'following',uid), { displayName:myName, email:myD.email||'', color:myD.color||'#6a4dff', subject:myD.subject||'Studying', subjects:myD.subjects||[], matchScore:compatScore, matched:true, followedAt:serverTimestamp() }),
        setDoc(doc(db,'social',uid,'followers',fromUid), { displayName:theirName, email:theirD.email||'', color:theirD.color||'#4d94ff', subject:theirD.subject||'Studying', matchScore:compatScore, matched:true, followedAt:serverTimestamp() }),
        setDoc(doc(db,'social',fromUid,'followers',uid), { displayName:myName, email:myD.email||'', color:myD.color||'#6a4dff', subject:myD.subject||'Studying', matchScore:compatScore, matched:true, followedAt:serverTimestamp() }),
    ]);
    try {
        await Promise.all([
            updateDoc(doc(db,'users',uid),    { matchedCount:(myD.matchedCount||0)+1,    matchedThisWeek:(myD.matchedThisWeek||0)+1 }),
            updateDoc(doc(db,'users',fromUid),{ matchedCount:(theirD.matchedCount||0)+1, matchedThisWeek:(theirD.matchedThisWeek||0)+1 }),
        ]);
    } catch(e) { /* non-critical */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER PANEL
// ─────────────────────────────────────────────────────────────────────────────
function _renderPanel(invites) {
    const body = document.getElementById('_gn_panel_body');
    if (!body) return;
    if (!invites.length) { body.innerHTML = `<div class="_gn_empty">🎉 No pending invites!</div>`; return; }
    body.innerHTML = invites.map(inv => `
        <div class="_gn_inv" id="_gni_${inv.id}" style="transition:opacity 0.25s,transform 0.25s;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                <div class="_gn_av" style="background:${_grad(inv.fromUid)};">${_initials(inv.fromName)}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;font-weight:700;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(inv.fromName)}</div>
                    <div style="font-size:11px;color:#6b7280;">${_esc(inv.fromUniversity||'wants to study with you')}</div>
                    <div style="font-size:11px;color:#34d399;margin-top:2px;">🎯 ${inv.compatScore}% match</div>
                </div>
            </div>
            ${inv.fromStrong?`<div style="font-size:11px;color:#6b7280;margin-bottom:3px;">💪 <span style="color:#34d399;">${_esc(inv.fromStrong)}</span></div>`:''}
            ${inv.fromWeak  ?`<div style="font-size:11px;color:#6b7280;margin-bottom:3px;">⚠️ <span style="color:#f87171;">${_esc(inv.fromWeak)}</span></div>`:''}
            ${inv.sharedSlots?`<div style="font-size:11px;color:#6b7280;margin-bottom:8px;">🗓 <span style="color:#22d3ee;">${_esc(inv.sharedSlots)}</span></div>`:''}
            <div style="display:flex;gap:8px;margin-top:10px;">
                <button class="_gn_acc" onclick="_gnRespond('${inv.id}','accepted','${inv.fromUid}','${(inv.fromName||'').replace(/'/g,"\\'")}',${inv.compatScore})">✓ Accept</button>
                <button class="_gn_dec" onclick="_gnRespond('${inv.id}','declined','${inv.fromUid}','${(inv.fromName||'').replace(/'/g,"\\'")}',0)">✗ Decline</button>
            </div>
        </div>`).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// BELL BADGE (updates all possible badge elements on the page)
// ─────────────────────────────────────────────────────────────────────────────
function _setBadge(n) {
    ['_gn_bell_badge','gnBellBadge','bellCount'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent   = n || '';
        el.style.display = n > 0 ? 'flex' : 'none';
    });
    // Make sure the floating bell is visible after login
    const b = document.getElementById('_gn_bell');
    if (b) b.style.display = 'flex';
    const b2 = document.getElementById('gnBellBtn');
    if (b2) b2.style.display = 'flex';
}

// ─────────────────────────────────────────────────────────────────────────────
// BELL ANIMATION
// ─────────────────────────────────────────────────────────────────────────────
function _ringBell() {
    ['_gn_bell','gnBellBtn'].forEach(id => {
        const b = document.getElementById(id);
        if (!b) return;
        b.classList.remove('_gn_bell_ring');
        void b.offsetWidth;
        b.classList.add('_gn_bell_ring');
        b.style.borderColor = 'rgba(109,40,217,0.9)';
        b.style.boxShadow   = '0 0 0 5px rgba(109,40,217,0.28)';
        setTimeout(() => { b.style.borderColor = ''; b.style.boxShadow = ''; b.classList.remove('_gn_bell_ring'); }, 1800);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE LISTENERS
// ─────────────────────────────────────────────────────────────────────────────
let _initLoad     = true;
let _acceptedSeen = new Set();

function _listenIncoming(db, uid) {
    _initLoad = true;
    onSnapshot(
        query(collection(db,'invites'), where('toUid','==',uid), where('status','==','pending')),
        snap => {
            const invites = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            _setBadge(invites.length);
            _renderPanel(invites);

            snap.docChanges().forEach(ch => {
                if (ch.type === 'added' && !_initLoad) {
                    const d = ch.doc.data();
                    // 1. Popup
                    _showPopup({ type:'invite', inviteId:ch.doc.id, fromUid:d.fromUid, fromName:d.fromName||'Someone', fromUniversity:d.fromUniversity||'', compatScore:d.compatScore||0, fromStrong:d.fromStrong||'', fromWeak:d.fromWeak||'', sharedSlots:d.sharedSlots||'' });
                    // 2. Bell ring
                    _ringBell();
                    // 3. Browser push (background tab)
                    _pushNotif('📬 New Study Invite — StudySphere', `${d.fromName} wants to study with you! (${d.compatScore}% match)`);
                }
            });
            _initLoad = false;
        }
    );
}

function _listenAccepted(db, uid) {
    onSnapshot(
        query(collection(db,'invites'), where('fromUid','==',uid), where('status','==','accepted')),
        snap => {
            snap.docChanges().forEach(ch => {
                const fresh = !_acceptedSeen.has(ch.doc.id);
                _acceptedSeen.add(ch.doc.id);
                if (fresh && ch.type === 'modified') {
                    const d = ch.doc.data();
                    // 1. Popup
                    _showPopup({ type:'accepted', fromUid:d.toUid||'', fromName:d.toName||'Someone', compatScore:d.compatScore||0 });
                    // 2. Toast
                    showGlobalToast(`🎉 ${d.toName} accepted your invite! Now study partners.`);
                    // 3. Browser push
                    _pushNotif('🎉 Invite Accepted — StudySphere', `${d.toName} accepted your study invite!`);
                }
            });
        }
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Call once inside onAuthStateChanged after user is resolved.
 *
 *   import { initNotifications } from "./notif.js";
 *
 *   onAuthStateChanged(auth, user => {
 *     if (!user) return;
 *     window._gn_db         = db;
 *     window._gn_uid        = user.uid;
 *     window._gn_myUserData = { name: user.displayName || user.email };
 *     initNotifications(db, user.uid, window._gn_myUserData);
 *     // ... rest of your page logic
 *   });
 */
export function initNotifications(db, currentUid, myUserData = {}) {
    window._gn_db         = db;
    window._gn_uid        = currentUid;
    window._gn_myUserData = myUserData;

    _injectUI();
    _askPermission();

    // Suppress floating bell on pages that already have their own
    if (document.getElementById('bellCount') || document.getElementById('gnBellBtn')) {
        document.body.classList.add('has-own-bell');
    }

    _listenIncoming(db, currentUid);
    _listenAccepted(db, currentUid);
}
