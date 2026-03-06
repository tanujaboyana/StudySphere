/**
 * StudySphere — Invite Alert (auto-vanish in 3s)
 * -----------------------------------------------
 * Add once before </body> on every page:
 *   <script src="invite-alert.js"></script>
 *
 * Trigger from anywhere:
 *   window.showInviteAlert([{ name, uid, score }, ...])
 *
 * Firebase: call showInviteAlert() inside your onSnapshot listener.
 */
(function () {
  'use strict';
  /* ─── CSS ─────────────────────────────────────────────────────── */
  document.head.insertAdjacentHTML('beforeend', `<style>
    #ss-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0);z-index:9990;pointer-events:none;transition:background .3s}
    #ss-backdrop.ss-on{background:rgba(0,0,0,.45);pointer-events:auto}

    #ss-popup{
      position:fixed;top:64px;left:50%;
      transform:translateX(-50%) translateY(-24px) scale(.95);
      width:min(440px,calc(100vw - 20px));
      z-index:9999;opacity:0;pointer-events:none;
      font-family:'DM Sans','Inter',system-ui,sans-serif;
      transition:transform .42s cubic-bezier(.34,1.56,.64,1),opacity .28s ease;
    }
    #ss-popup.ss-on{transform:translateX(-50%) translateY(0) scale(1);opacity:1;pointer-events:auto}

    .ss-card{background:#0e0e1b;border:1px solid rgba(124,58,237,.42);border-radius:20px;overflow:hidden;
      box-shadow:0 0 0 1px rgba(124,58,237,.1),0 32px 80px rgba(0,0,0,.82),0 0 90px rgba(109,40,217,.14),inset 0 1px 0 rgba(255,255,255,.04)}

    .ss-shimmer{height:3px;background:linear-gradient(90deg,transparent 0%,#7c3aed 20%,#06b6d4 50%,#a78bfa 70%,transparent 100%);
      background-size:300% 100%;animation:ssS 2.2s linear infinite}
    @keyframes ssS{0%{background-position:100% 0}100%{background-position:-100% 0}}

    .ss-body{padding:18px 20px 16px}
    .ss-head{display:flex;align-items:flex-start;gap:14px;margin-bottom:14px}
    .ss-icon{width:50px;height:50px;border-radius:15px;flex-shrink:0;
      background:linear-gradient(135deg,rgba(124,58,237,.28),rgba(6,182,212,.15));
      border:1px solid rgba(124,58,237,.35);display:flex;align-items:center;justify-content:center;
      font-size:24px;position:relative}
    .ss-dot{position:absolute;top:-3px;right:-3px;width:13px;height:13px;background:#a78bfa;
      border:2.5px solid #0e0e1b;border-radius:50%;animation:ssDP 1.5s ease-in-out infinite}
    @keyframes ssDP{0%,100%{box-shadow:0 0 0 0 rgba(167,139,250,.8)}50%{box-shadow:0 0 0 6px rgba(167,139,250,0)}}

    .ss-text{flex:1;min-width:0}
    .ss-eyebrow{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#a78bfa;margin-bottom:4px}
    .ss-title{font-size:15px;font-weight:700;color:#f0f2f8;line-height:1.3}
    .ss-title b{color:#c4b5fd}
    .ss-sub{font-size:12px;color:#5a6070;margin-top:3px}

    .ss-x{width:30px;height:30px;border-radius:9px;flex-shrink:0;background:rgba(255,255,255,.05);
      border:1px solid rgba(255,255,255,.09);color:#5a6070;font-size:16px;line-height:1;
      display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .18s}
    .ss-x:hover{background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.18)}

    .ss-chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px}
    .ss-chip{display:flex;align-items:center;gap:7px;background:rgba(109,40,217,.1);
      border:1px solid rgba(109,40,217,.25);border-radius:999px;padding:5px 12px 5px 5px;
      animation:ssCIn .35s cubic-bezier(.34,1.56,.64,1) both}
    @keyframes ssCIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
    .ss-av{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      font-size:10px;font-weight:800;color:#fff;flex-shrink:0}
    .ss-chip-name{font-size:12px;font-weight:600;color:#c4b5fd}
    .ss-chip-score{font-size:10px;color:#10b981;font-weight:600;margin-left:1px}
    .ss-chip-extra{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);
      border-radius:999px;padding:5px 12px;font-size:11px;color:#5a6070;display:flex;align-items:center}

    .ss-cta{display:flex;gap:9px}
    .ss-btn-view{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 0;
      background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;font-size:13px;font-weight:700;
      font-family:inherit;border:none;border-radius:12px;cursor:pointer;text-decoration:none;
      transition:opacity .2s,transform .2s;box-shadow:0 4px 22px rgba(109,40,217,.5)}
    .ss-btn-view:hover{opacity:.88;transform:translateY(-1px)}
    .ss-btn-later{padding:11px 16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);
      color:#5a6070;font-size:12px;font-weight:600;font-family:inherit;border-radius:12px;
      cursor:pointer;white-space:nowrap;transition:all .18s}
    .ss-btn-later:hover{background:rgba(255,255,255,.09);color:#94a3b8}

    .ss-footer{display:flex;align-items:center;gap:10px;padding:9px 20px 13px;
      border-top:1px solid rgba(255,255,255,.04)}
    .ss-track{flex:1;height:3px;background:rgba(255,255,255,.06);border-radius:999px;overflow:hidden}
    .ss-fill{height:100%;width:100%;background:linear-gradient(90deg,#7c3aed,#22d3ee);
      border-radius:999px;transform-origin:left}
    .ss-tlabel{font-size:10px;color:#3a3f52;white-space:nowrap;flex-shrink:0}

    [data-theme="light"] .ss-card{background:#fff;border-color:rgba(109,40,217,.28);
      box-shadow:0 28px 70px rgba(0,0,0,.14),0 0 40px rgba(109,40,217,.07)}
    [data-theme="light"] .ss-title{color:#1e1b4b}
    [data-theme="light"] .ss-title b{color:#6d28d9}
    [data-theme="light"] .ss-sub{color:#94a3b8}
    [data-theme="light"] .ss-eyebrow{color:#7c3aed}
    [data-theme="light"] .ss-icon{background:linear-gradient(135deg,rgba(109,40,217,.1),rgba(6,182,212,.07));border-color:rgba(109,40,217,.22)}
    [data-theme="light"] .ss-dot{border-color:#fff}
    [data-theme="light"] .ss-x{background:#f1f5f9;border-color:#e2e8f0;color:#94a3b8}
    [data-theme="light"] .ss-chip{background:rgba(109,40,217,.07);border-color:rgba(109,40,217,.18)}
    [data-theme="light"] .ss-chip-name{color:#6d28d9}
    [data-theme="light"] .ss-chip-extra{background:#f8fafc;border-color:#e2e8f0;color:#94a3b8}
    [data-theme="light"] .ss-btn-later{background:#f1f5f9;border-color:#e2e8f0;color:#64748b}
    [data-theme="light"] .ss-footer{border-top-color:#f1f5f9}
    [data-theme="light"] .ss-track{background:rgba(0,0,0,.07)}
    [data-theme="light"] .ss-tlabel{color:#cbd5e1}
    [data-theme="light"] #ss-backdrop.ss-on{background:rgba(0,0,0,.12)}

    @media(max-width:480px){
      #ss-popup{top:60px}
      .ss-body{padding:14px 14px 12px}
      .ss-cta{flex-direction:column}
      .ss-btn-later{text-align:center}
    }
  </style>`);

  /* ─── HTML ────────────────────────────────────────────────────── */
  document.body.insertAdjacentHTML('beforeend', `
    <div id="ss-backdrop"></div>
    <div id="ss-popup" role="alertdialog" aria-live="assertive">
      <div class="ss-card">
        <div class="ss-shimmer"></div>
        <div class="ss-body">
          <div class="ss-head">
            <div class="ss-icon">📬<div class="ss-dot"></div></div>
            <div class="ss-text">
              <div class="ss-eyebrow">Study Invite</div>
              <div class="ss-title" id="ss-title">You have a new invite!</div>
              <div class="ss-sub"   id="ss-sub">Someone wants to study with you</div>
            </div>
            <button class="ss-x" id="ss-close" aria-label="Close">✕</button>
          </div>
          <div class="ss-chips" id="ss-chips"></div>
          <div class="ss-cta">
            <a class="ss-btn-view" href="match.html" id="ss-view-btn">🤝 View Invites</a>
            <button class="ss-btn-later" id="ss-later-btn">Later</button>
          </div>
        </div>
        <div class="ss-footer">
          <div class="ss-track"><div class="ss-fill" id="ss-fill"></div></div>
          <div class="ss-tlabel" id="ss-tlabel">Closing in 3s</div>
        </div>
      </div>
    </div>
  `);

  /* ─── helpers ─────────────────────────────────────────────────── */
  const AUTO_MS = 3000;
  const GRADS   = [
    'linear-gradient(135deg,#7c3aed,#ec4899)',
    'linear-gradient(135deg,#0891b2,#7c3aed)',
    'linear-gradient(135deg,#059669,#0891b2)',
    'linear-gradient(135deg,#d97706,#ec4899)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#6d28d9,#06b6d4)',
  ];
  function grad(s) {
    let h = 0;
    for (const c of String(s || '?')) h = (h * 31 + c.charCodeAt(0)) & 0xfffffff;
    return GRADS[h % GRADS.length];
  }
  function initials(n) {
    return String(n || '?').split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '??';
  }

  /* ─── timer state ─────────────────────────────────────────────── */
  let raf = null;

  /* ─── dismiss ─────────────────────────────────────────────────── */
  function dismiss() {
  const popup = document.getElementById('ss-popup');
  const backdrop = document.getElementById('ss-backdrop');

  if (popup) popup.classList.remove('ss-on');
  if (backdrop) backdrop.classList.remove('ss-on');

  if (raf) {
    cancelAnimationFrame(raf);
    raf = null;
  }
}

  /* ─── 3-second countdown ──────────────────────────────────────── */
  function startTimer() {
    if (raf) cancelAnimationFrame(raf);
    const fill  = document.getElementById('ss-fill');
    const label = document.getElementById('ss-tlabel');
    const t0    = performance.now();

    // reset bar then animate drain
    fill.style.transition = 'none';
    fill.style.transform  = 'scaleX(1)';
    requestAnimationFrame(() => {
      fill.style.transition = `transform ${AUTO_MS}ms linear`;
      fill.style.transform  = 'scaleX(0)';
    });

    function tick() {
      const elapsed = performance.now() - t0;
      const secs    = Math.max(0, Math.ceil((AUTO_MS - elapsed) / 1000));
      label.textContent = secs > 0 ? `Closing in ${secs}s` : 'Closing…';
      if (elapsed < AUTO_MS) { raf = requestAnimationFrame(tick); }
      else                   { dismiss(); }
    }
    raf = requestAnimationFrame(tick);
  }

  /* ─── PUBLIC API ──────────────────────────────────────────────── */
  /**
   * window.showInviteAlert(senders)
   *
   * @param {Array<{ name:string, uid?:string, score?:number }>} senders
   *
   * Usage examples:
   *   showInviteAlert([{ name:'Priya Sharma', uid:'abc123', score:88 }])
   *   showInviteAlert(snap.docs.map(d => ({ name: d.data().fromName, uid: d.data().fromUid, score: d.data().compatScore })))
   */
  window.showInviteAlert = function (senders) {
    senders = Array.isArray(senders) ? senders : [];
    const count = senders.length;

    // --- title + subtitle ---
    const titleEl = document.getElementById('ss-title');
    const subEl   = document.getElementById('ss-sub');
    if (count === 1) {
      titleEl.innerHTML = `<b>${senders[0].name || 'Someone'}</b> sent you a study invite!`;
      subEl.textContent = 'Tap "View Invites" to accept or decline';
    } else if (count > 1) {
      titleEl.innerHTML = `You have <b>${count} pending</b> study invites`;
      const names = senders.map(s => s.name).filter(Boolean).slice(0, 3).join(', ');
      subEl.textContent = names + (count > 3 ? ` +${count - 3} more` : '');
    } else {
      titleEl.innerHTML = 'You have a <b>new</b> study invite!';
      subEl.textContent = 'Someone wants to study with you';
    }

    // --- sender chips (max 3 shown) ---
    const shown   = senders.slice(0, 3);
    const extra   = senders.length - shown.length;
    document.getElementById('ss-chips').innerHTML =
      shown.map((s, i) => `
        <div class="ss-chip" style="animation-delay:${i * 60}ms">
          <div class="ss-av" style="background:${grad(s.uid || s.name || i)}">${initials(s.name)}</div>
          <span class="ss-chip-name">${s.name || 'User'}</span>
          ${s.score ? `<span class="ss-chip-score">· ${s.score}%</span>` : ''}
        </div>
      `).join('') +
      (extra > 0 ? `<div class="ss-chip-extra">+${extra} more</div>` : '');

    // --- view button: open panel if already on match.html ---
    const viewBtn = document.getElementById('ss-view-btn');
    if (window.location.href.includes('match.html')) {
      viewBtn.href    = '#';
      viewBtn.onclick = e => {
        e.preventDefault();
        if (typeof window.togglePanel === 'function') window.togglePanel();
        dismiss();
      };
    } else {
      viewBtn.href    = 'match.html';
      viewBtn.onclick = null;
    }

    // --- show + start 3s timer ---
    document.getElementById('ss-popup').classList.add('ss-on');
    document.getElementById('ss-backdrop').classList.add('ss-on');
    setTimeout(startTimer, 50);
  };

  /* ─── button events ───────────────────────────────────────────── */
  document.getElementById('ss-close').addEventListener('click', dismiss);
  document.getElementById('ss-later-btn').addEventListener('click', dismiss);
  document.getElementById('ss-backdrop').addEventListener('click', dismiss);

  /* ─── PUBLIC: dismiss from outside ───────────────────────────── */
  // Call window.dismissInviteAlert() from anywhere to hide the popup.
  // e.g. after accepting/declining from the invite panel.
  window.dismissInviteAlert = dismiss;

  /* ─── Auto-dismiss on Accept / Decline click (event delegation) ─ */
  // Listens on the whole document so it works even for buttons that
  // are rendered dynamically (like those inside #inviteList on match.html).
  // Fires in capture phase to run before the button's own handler.
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.btn-success, .btn-danger, [data-dismiss-alert]');
    if (btn) dismiss();
  }, true);

  /* ─── Firebase auto-listen ────────────────────────────────────── */
  /*
    Uncomment this block to have the alert fire automatically
    whenever a new invite arrives in Firestore.

  Promise.all([
    import("https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js"),
  ]).then(([
    { initializeApp, getApps },
    { getAuth, onAuthStateChanged },
    { getFirestore, collection, query, where, onSnapshot }
  ]) => {
    const cfg = {
      apiKey:            "AIzaSyAgmy0go1YLZFUf5c8nEOWDWm-wRkdIvqQ",
      authDomain:        "collabsyncai.firebaseapp.com",
      projectId:         "collabsyncai",
      storageBucket:     "collabsyncai.firebasestorage.app",
      messagingSenderId: "862378374401",
      appId:             "1:862378374401:web:4438203269261b15011700"
    };
    const NAME = 'ss-alert';
    const app  = getApps().find(a => a.name === NAME) || initializeApp(cfg, NAME);
    const auth = getAuth(app);
    const db   = getFirestore(app);

    onAuthStateChanged(auth, user => {
      if (!user) return;
      let prevCount = 0;
      onSnapshot(
        query(collection(db,'invites'), where('toUid','==',user.uid), where('status','==','pending')),
        snap => {
          const docs = snap.docs.map(d => ({
            name:  d.data().fromName,
            uid:   d.data().fromUid,
            score: d.data().compatScore
          }));
          if (docs.length > prevCount) {          // only alert on NEW invites
            window.showInviteAlert(docs);
          }
          prevCount = docs.length;
        }
      );
    });
  });
  */

})();
