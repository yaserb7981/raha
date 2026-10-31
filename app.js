/* ═══════════════════════════════════════════════════════════
   رها — منطق اپ
   ═══════════════════════════════════════════════════════════ */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const FA_D = '۰۱۲۳۴۵۶۷۸۹';
const fa = v => String(v).replace(/\d/g, d => FA_D[+d]);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const faDate = iso => {
  try {
    return new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' }).format(new Date(iso + 'T00:00:00'));
  } catch { return iso; }
};

const TRIGGERS = ['تنهایی', 'بی‌حوصلگی', 'شب', 'استرس', 'خستگی', 'شبکه اجتماعی', 'خانه خالی', 'گوشی', 'خواب بد', 'دلخوری'];

let STATE = null;
let selectedTriggers = new Set();

/* ───────────────────────────── API ───────────────────────────── */
async function api(path, body) {
  // نسخه‌ی آفلاین (بدون سرور): همه‌ی درخواست‌ها به موتور محلی می‌ره
  if (window.RAHA_OFFLINE) return window.RAHA_OFFLINE.handle(path, body);
  const url = path + (path.includes('?') ? '&' : '?') + 'today=' + todayLocal();
  const opt = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, today: todayLocal() }) }
    : {};
  const r = await fetch(url, opt);
  if (!r.ok) throw new Error('network');
  return r.json();
}
async function del(path) {
  if (window.RAHA_OFFLINE) return window.RAHA_OFFLINE.handle('DELETE ' + path, null);
  return fetch(path + (path.includes('?') ? '&' : '?') + 'today=' + todayLocal(), { method: 'DELETE' });
}

async function refresh() {
  STATE = await api('/api/state');
  render();
}

/* ───────────────────────────── toast ───────────────────────────── */
let toastT;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), ms);
}

/* ───────────────────────────── onboarding ───────────────────────────── */
function initOnboarding() {
  $('#onb-start').value = todayLocal() === '' ? '' : todayLocal();
  $$('.onb-step [data-next]').forEach(b => b.onclick = () => {
    $('.onb-step[data-step="1"]').classList.add('hidden');
    $('.onb-step[data-step="2"]').classList.remove('hidden');
  });
  $('#add-reason').onclick = () => {
    const i = document.createElement('input');
    i.className = 'reason-in';
    i.type = 'text';
    i.placeholder = 'یک دلیل دیگه...';
    $('#reason-inputs').appendChild(i);
    i.focus();
  };
  $('#onb-finish').onclick = async () => {
    const reasons = $$('.reason-in').map(i => i.value.trim()).filter(Boolean);
    if (!reasons.length) return toast('حداقل یک دلیل بنویس — این مهم‌ترین بخشه');
    await api('/api/setup', {
      start_date: $('#onb-start').value || todayLocal(),
      goal_days: 91,
      name: $('#onb-name').value.trim(),
      vision: $('#onb-vision').value.trim(),
      reasons,
    });
    $('#onboarding').classList.remove('show');
    await refresh();
    toast('مسیر شروع شد. روز ۱ 🔥', 3500);
  };
}

/* ───────────────────────────── render ───────────────────────────── */
function render() {
  const S = STATE;
  if (!S) return;
  if (!S.onboarded) { $('#onboarding').classList.add('show'); return; }
  $('#onboarding').classList.remove('show');

  /* hero */
  const pct = Math.min(100, (S.day / S.goal) * 100);
  $('#ring-day').textContent = fa(S.day);
  $('#ring-goal').textContent = fa(S.goal);
  $('#ring-pct').textContent = fa(Math.round(pct)) + '٪';
  const circ = 2 * Math.PI * 60;
  $('#ring-fg').style.strokeDasharray = circ;
  $('#ring-fg').style.strokeDashoffset = circ * (1 - pct / 100);

  const name = (S.settings.name || '').trim();
  $('#hero-name').textContent = name ? `${name}، سلام` : 'سلام';
  $('#hero-phase').textContent = S.phase.name;
  $('#hero-phase-desc').textContent = S.phase.desc || '';
  $('#rewire-pct').textContent = fa(S.rewiring) + '٪';
  $('#rewire-bar').style.width = S.rewiring + '%';
  $('#streak-days').textContent = fa(Math.max(0, S.day));
  $('#lvl-chip').textContent = `سطح ${fa(S.level)} · ${fa(S.xp)} XP`;

  $('#m-best').textContent = fa(S.best_streak);
  $('#m-clean').textContent = fa(S.total_clean);
  $('#m-freeze').textContent = fa(S.freezes_available);
  $('#m-urges').textContent = fa(S.urges_resisted);

  /* mission */
  $('#mission-day').textContent = `روز ${fa(S.day)} از ${fa(S.goal)}`;
  $('#mission-text').textContent = S.mission;
  $('#mission-focus').innerHTML = (S.phase.focus || []).map(f => `<span>${esc(f)}</span>`).join('');

  /* quote */
  $('#quote-text').textContent = S.quote;

  /* checkin defaults */
  if (!STATE._ciFilled) {
    const c = S.today_checkin;
    if (c) {
      setMetric('mood', c.mood); setMetric('urge', c.urge);
      setMetric('sleep', c.sleep); setMetric('energy', c.energy);
      $('#ci-win').value = c.win || '';
      $('#ci-note').value = c.note || '';
      selectedTriggers = new Set(c.triggers || []);
      $('#checkin-status').textContent = 'ثبت شده ✓';
    } else {
      selectedTriggers = new Set();
      $('#checkin-status').textContent = 'ثبت نشده';
    }
    renderChips();
    STATE._ciFilled = true;
  }

  /* next milestone */
  const nm = S.next_milestone;
  if (nm) {
    const p = Math.min(100, (S.day / nm.day) * 100);
    $('#next-ms').innerHTML = `
      <div class="nm-ring">
        <svg viewBox="0 0 56 56" width="56" height="56">
          <circle cx="28" cy="28" r="24" stroke="rgba(255,255,255,.1)"/>
          <circle cx="28" cy="28" r="24" stroke="#fbbf24" stroke-dasharray="${2 * Math.PI * 24}"
            stroke-dashoffset="${2 * Math.PI * 24 * (1 - p / 100)}"/>
        </svg>
      </div>
      <div class="nm-body">
        <div class="nm-title">نقطه عطف بعدی: ${esc(nm.title)}</div>
        <div class="nm-desc">${esc(nm.desc)}</div>
        <div class="nm-left">${fa(nm.day - S.day)} روز دیگه</div>
      </div>`;
  } else {
    $('#next-ms').innerHTML = `<div class="nm-body"><div class="nm-title">🏆 همه نقاط عطف باز شد</div>
      <div class="nm-desc">تو ۹۱ روز کامل رو گذروندی. حالا مسیر بعدی رو انتخاب کن.</div></div>`;
  }

  renderStats();
  renderPath();
  renderJournal();
  renderSettings();
  renderSOSReasons();
}

/* ── metrics ── */
function setMetric(key, val) {
  const block = $(`.metric[data-metric="${key}"]`);
  if (!block) return;
  const input = $('input', block);
  input.value = val;
  $('.metric-val', block).textContent = fa(val);
}
function getMetric(key) {
  const block = $(`.metric[data-metric="${key}"]`);
  return block ? Number($('input', block).value) : 5;
}
$$('.metric input[type=range]').forEach(inp => {
  inp.addEventListener('input', () => {
    $('.metric-val', inp.closest('.metric')).textContent = fa(inp.value);
  });
});

/* ── chips ── */
function renderChips() {
  $('#trigger-chips').innerHTML = TRIGGERS.map(t =>
    `<button class="chip ${selectedTriggers.has(t) ? 'on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('');
  $$('#trigger-chips .chip').forEach(c => c.onclick = () => {
    const t = c.dataset.t;
    selectedTriggers.has(t) ? selectedTriggers.delete(t) : selectedTriggers.add(t);
    c.classList.toggle('on');
  });
}

$('#save-checkin').onclick = async () => {
  const body = {
    date: todayLocal(),
    mood: getMetric('mood'), urge: getMetric('urge'),
    sleep: getMetric('sleep'), energy: getMetric('energy'),
    triggers: [...selectedTriggers],
    win: $('#ci-win').value, note: $('#ci-note').value,
  };
  await api('/api/checkin', body);
  const before = STATE.day;
  await refresh();
  $('#checkin-status').textContent = 'ثبت شده ✓';
  toast('ثبت شد. +۲۰ XP — استریکت قوی‌تر شد 💪');
  if (STATE.day !== before) setTimeout(() => toast('روز جدید شمرده شد! 🌅'), 2800);
};

/* ───────────────────────────── weekly report ───────────────────────────── */
function delta(cur, prev, invert = false) {
  if (!prev || !cur) return '';
  const d = +(cur - prev).toFixed(1);
  if (Math.abs(d) < 0.15) return `<span class="flat">ثابت</span>`;
  const good = invert ? d < 0 : d > 0;
  return `<span class="${good ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${fa(Math.abs(d))}</span>`;
}
function renderWeekly(w) {
  if (!w) return;
  const t = w.this, p = w.prev;
  const cells = [
    ['چک‌این', fa(t.checkins), delta(t.checkins, p.checkins)],
    ['میانگین حال', fa(t.mood || 0), delta(t.mood, p.mood)],
    ['میانگین وسوسه', fa(t.urge || 0), delta(t.urge, p.urge, true)],
    ['میانگین خواب', fa(t.sleep || 0), delta(t.sleep, p.sleep)],
    ['موج‌ها', fa(t.urges), delta(t.urges, p.urges, true)],
    ['لغزش', fa(t.relapses), (t.relapses === 0 ? '<span class="up">پاک ✓</span>' : delta(t.relapses, p.relapses, true))],
  ];
  $('#wk-grid').innerHTML = cells.map(([l, v, d]) =>
    `<div class="wk-cell"><div class="wk-lbl">${l}</div><div class="wk-val">${v}</div><div class="wk-delta">${d}</div></div>`).join('');
  $('#wk-insights').innerHTML = (w.insights || []).map(i => `<div class="insight">${esc(i)}</div>`).join('');
  $('#wk-pill').textContent = `مقایسه با هفته قبل${w.worst_weekday ? ' · پرخطر: ' + w.worst_weekday : ''}`;
}

/* ───────────────────────────── stats tab ───────────────────────────── */
function renderStats() {
  const S = STATE;
  renderWeekly(S.weekly);

  /* heatmap */
  $('#heatmap').innerHTML = S.heatmap.map(c =>
    `<div class="hm-cell ${c.status} ${c.checkin ? 'has-checkin' : ''}" title="${c.date}"></div>`).join('');

  /* urge chart */
  drawUrgeChart(S.urge_trend);

  /* triggers */
  const tr = S.triggers || [];
  $('#trigger-bars').innerHTML = tr.length
    ? tr.map(t => {
      const max = tr[0].count || 1;
      return `<div class="tb"><span class="tb-name">${esc(t.name)}</span>
        <span class="tb-track"><i style="width:${Math.max(6, (t.count / max) * 100)}%"></i></span>
        <span class="tb-n">${fa(t.count)}</span></div>`;
    }).join('')
    : `<div class="empty">هنوز تریگری ثبت نشده — با اولین موج شروع می‌شه.</div>`;

  /* streak history */
  const sh = [...(S.streak_history || [])].reverse();
  $('#streak-history').innerHTML = sh.length
    ? sh.map(s => `<div class="sh ${s.current ? 'current' : ''}">
        <span class="sh-days">${fa(s.days)}</span>
        <span>روز</span>
        ${s.best ? '<span class="sh-badge">رکورد</span>' : ''}
        ${s.current ? '<span class="sh-badge" style="background:rgba(52,211,153,.18);color:#34d399">فعال</span>' : ''}
        <span class="sh-range">از ${faDate(s.start)} تا ${s.current ? 'امروز' : faDate(s.end)}</span>
      </div>`).join('')
    : `<div class="empty">استریکی ثبت نشده.</div>`;

  /* badges */
  const un = S.badges.filter(b => b.un).length;
  $('#badge-count').textContent = `${fa(un)} از ${fa(S.badges.length)}`;
  $('#badges').innerHTML = S.badges.map(b => `
    <div class="badge ${b.un ? 'un' : ''}">
      <div class="badge-emoji">${b.un ? b.emoji : '🔒'}</div>
      <div class="badge-title">${esc(b.title)}</div>
      <div class="badge-desc">${esc(b.desc)}</div>
    </div>`).join('');

  /* relapses */
  const rl = S.relapses || [];
  $('#relapse-list').innerHTML = rl.length
    ? rl.map(r => `<div class="rl ${r.frozen ? 'frozen' : ''}">
        <div class="rl-top"><span>${faDate(r.date)} · استریک ${fa(r.streak_days || 0)} روزه</span>
        <span>${r.frozen ? '🧊 سپر استفاده شد' : '↺ ریست'}</span></div>
        <div class="rl-trigger">${esc(r.trigger || 'بدون تریگر ثبت‌شده')}</div>
        ${r.note ? `<div class="rl-note">درس: ${esc(r.note)}</div>` : ''}
      </div>`).join('')
    : `<div class="empty">هیچ لغزشی ثبت نشده. تمیز بمون 🤍</div>`;
}

function drawUrgeChart(data) {
  const svg = $('#urge-chart');
  const W = 600, H = 180, pad = 10;
  if (!data || !data.length) {
    svg.innerHTML = `<text x="300" y="95" text-anchor="middle" fill="#6b7297" font-size="13"
      font-family="Vazirmatn">هنوز داده‌ای نیست — اولین موج رو ثبت کن</text>`;
    return;
  }
  const n = data.length;
  const slots = Math.max(n, 14);                 // keep bars slim with few points
  const maxC = Math.max(1, ...data.map(d => d.count));
  const bw = (W - pad * 2) / slots;
  const barW = Math.min(26, bw * 0.6);
  let bars = '', pts = [], labels = '';
  data.forEach((d, i) => {
    const h = Math.max(4, (d.count / maxC) * (H - 60));
    const x = pad + i * bw + (bw - barW) / 2;
    const y = H - 30 - h;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="${Math.min(4, barW / 2)}"
      fill="url(#barGrad)" opacity=".9"/>`;
    const yy = H - 30 - (d.avg / 10) * (H - 60);
    pts.push(`${x + barW / 2},${yy}`);
  });
  const step = Math.max(1, Math.ceil(n / 6));
  data.forEach((d, i) => {
    if (i % step === 0) {
      const cx = pad + i * bw + bw / 2;
      labels += `<text x="${cx}" y="${H - 10}" text-anchor="middle"
        fill="#6b7297" font-size="10" font-family="Vazirmatn">${esc(faDate(d.date))}</text>`;
    }
  });
  if (n === 1) pts.push(pts[0].replace(/^([\d.]+),/, (m, x) => (+x + 0.1) + ','));
  svg.innerHTML = `<defs>
      <linearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#e879f9" stop-opacity=".35"/>
        <stop offset="100%" stop-color="#22d3ee"/>
      </linearGradient></defs>
    <line x1="0" y1="${H - 30}" x2="${W}" y2="${H - 30}" stroke="rgba(255,255,255,.09)"/>
    ${bars}
    <polyline points="${pts.join(' ')}" fill="none" stroke="#fbbf24" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round" opacity=".9"/>
    ${labels}`;
}

/* ───────────────────────────── path tab ───────────────────────────── */
function renderPath() {
  const S = STATE;
  let g = '';
  for (let i = 1; i <= S.goal; i++) {
    const cls = i < S.day ? 'done' : i === S.day ? 'now' : '';
    g += `<div class="g-cell ${cls}" title="روز ${i}">${i === S.day ? fa(i) : ''}</div>`;
  }
  $('#grid91').innerHTML = g;
  $('#path-pill').textContent = `${fa(S.day)} / ${fa(S.goal)}`;

  const active = S.phase.name;
  $('#phases').innerHTML = S.phases.map(p => {
    const isActive = p.name === active;
    const past = S.day > p.to;
    return `<div class="ph ${isActive ? 'active' : ''} ${past ? 'past' : ''}">
      <div class="ph-top"><span class="ph-name">${esc(p.name)}</span>
      <span class="ph-range">${fa(p.from)}–${fa(p.to > 900 ? S.goal : p.to)}</span></div>
      <div class="ph-desc">${esc(p.desc)}</div>
      <div class="ph-focus">${p.focus.map(f => `<span>${esc(f)}</span>`).join('')}</div>
    </div>`;
  }).join('');

  $('#milestones').innerHTML = S.milestones.map(m => `
    <div class="ms ${m.unlocked ? 'un' : 'locked'}">
      <div class="ms-top"><span class="ms-day">روز ${fa(m.day)}</span>
      <span class="ms-title">${esc(m.title)}</span>
      ${m.unlocked ? '<span style="font-size:11px;color:#34d399">✓</span>' : ''}</div>
      <div class="ms-desc">${esc(m.desc)}</div>
    </div>`).join('');
}

/* ───────────────────────────── journal tab ───────────────────────────── */
function renderJournal() {
  const S = STATE;
  $('#journal-list').innerHTML = (S.journal || []).length
    ? S.journal.map(j => `<div class="j-entry">
        <div class="j-date"><span>${faDate(j.date)}</span>
          <button class="j-del" data-del-j="${j.id}">✕</button></div>
        <div class="j-title">${esc(j.title || 'بدون عنوان')}</div>
        <div class="j-body">${esc(j.body)}</div>
      </div>`).join('')
    : `<div class="empty">ژورنال خالیه. اولین نوشته رو بنویس.</div>`;
  $$('[data-del-j]').forEach(b => b.onclick = async () => {
    await del('/api/journal/' + b.dataset.delJ);
    await refresh();
  });

  const ci = [...(S.checkins || [])].reverse();
  $('#checkin-history').innerHTML = ci.length
    ? ci.map(c => {
      let tg = [];
      try { tg = JSON.parse(c.triggers || '[]'); } catch { }
      return `<div class="ci-row">
        <span class="ci-d">${faDate(c.date)}</span>
        <span class="ci-dots">
          <span class="ci-dot">😊 ${fa(c.mood)}</span>
          <span class="ci-dot">🔥 ${fa(c.urge)}</span>
          <span class="ci-dot">😴 ${fa(c.sleep)}</span>
          <span class="ci-dot">⚡ ${fa(c.energy)}</span>
          ${tg.length ? `<span class="ci-dot">${esc(tg.join('، '))}</span>` : ''}
        </span>
        ${c.win ? `<span class="ci-win">🏅 ${esc(c.win)}</span>` : ''}
      </div>`;
    }).join('')
    : `<div class="empty">هنوز چک‌اینی ثبت نشده.</div>`;
}

/* ───────────────────────────── settings ───────────────────────────── */
function renderSettings() {
  const S = STATE;
  const s = S.settings || {};
  if (document.activeElement?.id !== 's-name') $('#s-name').value = s.name || '';
  if (document.activeElement?.id !== 's-start') $('#s-start').value = s.start_date || '';
  if (document.activeElement?.id !== 's-goal') $('#s-goal').value = S.goal;
  if (document.activeElement?.id !== 's-vision') $('#s-vision').value = s.vision || '';
  if (document.activeElement?.id !== 's-buddy-name') $('#s-buddy-name').value = s.buddy_name || '';
  if (document.activeElement?.id !== 's-buddy-phone') $('#s-buddy-phone').value = s.buddy_phone || '';

  $('#reasons-list').innerHTML = (S.reasons || []).length
    ? S.reasons.map(r => `<div class="reason-item"><span class="reason-dot">✦</span><span>${esc(r.text)}</span>
        <button class="j-del" data-del-r="${r.id}">✕</button></div>`).join('')
    : `<div class="empty">هنوز دلیلی ثبت نشده.</div>`;
  $$('[data-del-r]').forEach(b => b.onclick = async () => {
    await del('/api/reasons/' + b.dataset.delR);
    await refresh();
  });

  /* personal triggers */
  let ptr = [];
  try { ptr = JSON.parse(s.personal_triggers || '[]'); } catch { }
  $('#personal-triggers-list').innerHTML = ptr.length
    ? ptr.map(t => `<span class="chip on" data-ptr-del="${esc(t)}">${esc(t)} ✕</span>`).join('')
    : `<span class="hint" style="margin:0">هنوز چیزی اضافه نکردی.</span>`;
  $$('[data-ptr-del]').forEach(c => c.onclick = async () => {
    const next = ptr.filter(x => x !== c.dataset.ptrDel);
    await api('/api/settings', { personal_triggers: JSON.stringify(next) });
    await refresh();
  });

  /* reminder */
  const remOn = s.reminder_on === '1';
  if (document.activeElement?.id !== 'rem-time') $('#rem-time').value = s.reminder_time || '21:30';
  $('#rem-on').checked = remOn;
  updateNotifStatus();

  /* sync */
  renderSyncCard(s);

  /* share */
  if (window.RAHA_OFFLINE) {
    $('#btn-share-create').classList.add('hidden');
    $('#share-box').classList.add('hidden');
  } else {
    const tok = S.share_token || '';
    if (tok) showShare(tok); else $('#share-box').classList.add('hidden');
  }

  try { renderIcsStatus(); } catch (e) { }

  const fz = $('#freeze-count');
  if (fz) fz.textContent = fa(S.freezes_available);
  $('#freeze-row').style.display = S.freezes_available > 0 ? 'flex' : 'none';
}

$('#save-profile').onclick = async () => {
  const body = {
    name: $('#s-name').value.trim(),
    start_date: $('#s-start').value,
    goal_days: Number($('#s-goal').value) || 91,
    vision: $('#s-vision').value.trim(),
    buddy_name: $('#s-buddy-name').value.trim(),
    buddy_phone: $('#s-buddy-phone').value.trim(),
  };
  STATE._ciFilled = false;
  await api('/api/settings', body);
  await refresh();
  toast('ذخیره شد ✓');
};

$('#add-reason-2').onclick = async () => {
  const v = $('#new-reason').value.trim();
  if (!v) return;
  $('#new-reason').value = '';
  await api('/api/reasons', { text: v });
  await refresh();
  toast('دلیل اضافه شد ✦');
};
$('#new-reason').addEventListener('keydown', e => { if (e.key === 'Enter') $('#add-reason-2').click(); });

$('#save-journal').onclick = async () => {
  const body = { title: $('#j-title').value, body: $('#j-body').value };
  if (!body.title.trim() && !body.body.trim()) return toast('چیزی بنویس');
  await api('/api/journal', body);
  $('#j-title').value = ''; $('#j-body').value = '';
  await refresh();
  toast('نوشته ثبت شد. +۱۰ XP 📓');
};

$('#btn-settings').onclick = () => switchTab('settings');
$('#btn-relapse-open').onclick = () => openModal('#modal-relapse');

/* ───────────────────────────── tabs ───────────────────────────── */
function switchTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$$('.nav-btn').forEach(b => b.onclick = () => switchTab(b.dataset.tab));

/* ───────────────────────────── modals ───────────────────────────── */
function openModal(sel) { $(sel).classList.add('show'); }
function closeModal(sel) { $(sel).classList.remove('show'); }
$$('[data-close]').forEach(b => b.onclick = () => b.closest('.overlay').classList.remove('show'));
$$('.overlay').forEach(o => o.addEventListener('click', e => {
  if (e.target === o && o.id !== 'sos' && o.id !== 'onboarding') o.classList.remove('show');
}));

/* ───────────────────────────── SOS ───────────────────────────── */
function renderSOSReasons() {
  const rs = (STATE.reasons || []).map(r => r.text);
  const vision = (STATE.settings.vision || '').trim();
  const items = [...rs];
  if (vision) items.push(vision);
  $('#sos-reasons').innerHTML = items.length
    ? items.slice(0, 8).map(t => `<li>${esc(t)}</li>`).join('')
    : `<li>هنوز دلیلی ثبت نکردی — برو تنظیمات و اضافه کن. این مهم‌ترین سلاحه.</li>`;

  const ph = (STATE.settings.buddy_phone || '').trim();
  const callBtn = $('#sos-call');
  if (ph) {
    const nm = (STATE.settings.buddy_name || '').trim();
    callBtn.href = 'tel:' + ph.replace(/[^0-9+]/g, '');
    callBtn.innerHTML = '📞 ' + (nm ? `زنگ بزن به ${esc(nm)}` : 'زنگ بزن به همراهت');
    callBtn.classList.remove('hidden');
  } else {
    callBtn.classList.add('hidden');
  }

  let ptrs = [];
  try { ptrs = JSON.parse(STATE.settings.personal_triggers || '[]'); } catch { }
  const tp = $('#sos-trigger-panel');
  if (ptrs.length) {
    $('#sos-personal-triggers').innerHTML = ptrs.map(t => `<span class="chip on">${esc(t)}</span>`).join('');
    tp.classList.remove('hidden');
  } else {
    tp.classList.add('hidden');
  }

  $('#sos-steps').innerHTML = (STATE.urge_steps || []).map((s, i) =>
    `<div class="step" data-step="${i}"><span class="step-box"></span><span>${esc(s)}</span></div>`).join('');
  $$('#sos-steps .step').forEach(el => el.onclick = () => {
    el.classList.toggle('done');
    const box = $('.step-box', el);
    box.textContent = el.classList.contains('done') ? '✓' : '';
  });
}

$('#fab-sos').onclick = () => {
  openModal('#sos');
  $('#halt-out').textContent = '';
  $$('.halt-btn').forEach(b => b.classList.remove('on'));
};

$('#sos-close').onclick = () => { stopBreath(); stopWave(); closeModal('#sos'); };

/* ── breathing 4-7-8 ── */
let breathTimer = null, breathRunning = false;
function startBreath() {
  if (breathRunning) return;
  breathRunning = true;
  const orb = $('#breath-orb'), txt = $('#breath-txt');
  let cycle = 0, phase = 0; // 0=inhale 4, 1=hold 7, 2=exhale 8
  const seq = [[4, 'دم بگیر', 'inhale'], [7, 'نگه دار', 'hold'], [8, 'آرام بازدم', 'exhale']];
  let t = 0, left = seq[0][0];
  const tick = () => {
    const [dur, label, cls] = seq[phase];
    $('#breath-phase-lbl').textContent = label;
    $('#breath-count').textContent = fa(cycle + 1) + ' / ۴ · ' + fa(left) + ' ثانیه';
    orb.classList.remove('inhale', 'exhale');
    if (cls === 'inhale') orb.classList.add('inhale');
    if (cls === 'exhale') orb.classList.add('exhale');
    txt.textContent = label;
    left--;
    if (left < 0) {
      phase++;
      if (phase > 2) { phase = 0; cycle++; }
      if (cycle >= 4) { stopBreath(); toast('۴ دور تنفس کامل. بدنت آروم‌تره 🌬️'); return; }
      left = seq[phase][0];
    }
  };
  tick();
  breathTimer = setInterval(tick, 1000);
}
function stopBreath() {
  clearInterval(breathTimer);
  breathRunning = false;
  $('#breath-orb').classList.remove('inhale', 'exhale');
  $('#breath-orb').style.transform = '';
  $('#breath-txt').textContent = 'آماده‌ای؟';
  $('#breath-phase-lbl').textContent = 'تنفس ۴-۷-۸';
  $('#breath-count').textContent = '۰ / ۴';
}
$('#breath-start').onclick = startBreath;
$('#breath-stop').onclick = () => { stopBreath(); };

/* ── wave timer 5 min ── */
const WAVE_MSGS = [
  'همین‌طور نفس بکش. کاری لازم نیست بکنی.',
  'موج بلند شده — یعنی داره می‌شکنه.',
  'این حس، یه پیام عصبیه؛ یه دستور نیست.',
  'بدنت داره یاد می‌گیره بدون این محرک کار کنه.',
  'نیمه راه. تو از پسش برمی‌آی.',
  'هنوز اینجایی؟ عالیه. یکی از سخت‌ترین موج‌ها رو داری می‌گذرونی.',
  'چند لحظه دیگه، شدتش می‌افته. قول داده‌نفس‌شناسی.',
];
let waveTimer = null, waveLeft = 300, waveRunning = false;
function fmtTime(s) {
  const m = Math.floor(s / 60), ss = s % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
function startWave() {
  if (waveRunning) return;
  waveRunning = true;
  waveLeft = 300;
  $('#wave-time').textContent = fmtTime(waveLeft);
  $('#wave-fill').style.width = '0%';
  let msgIdx = 0;
  $('#wave-msg').textContent = WAVE_MSGS[0];
  waveTimer = setInterval(() => {
    waveLeft--;
    $('#wave-time').textContent = fmtTime(Math.max(0, waveLeft));
    $('#wave-fill').style.width = ((300 - waveLeft) / 300 * 100) + '%';
    if (waveLeft % 45 === 0 && msgIdx < WAVE_MSGS.length - 1) {
      msgIdx++;
      $('#wave-msg').textContent = WAVE_MSGS[msgIdx];
    }
    if (waveLeft <= 0) {
      stopWave();
      $('#wave-msg').textContent = '۵ دقیقه گذشت و تو تسلیم نشدی. موج شکست. 🌊';
      toast('۵ دقیقه مقاومت. تو بردی 🏆', 4000);
    }
  }, 1000);
}
function stopWave() {
  clearInterval(waveTimer);
  waveRunning = false;
  $('#wave-fill').style.width = '0%';
  $('#wave-time').textContent = '۰۵:۰۰';
}
$('#wave-start').onclick = startWave;

/* ── HALT ── */
const HALT_TXT = {
  'گرسنه': 'یه چیز بخور — آب + یه میان‌وعده واقعی. گرسنگی، کنترل تصمیم رو می‌گیره.',
  'عصبانی': '۱۰ نفس عمیق + ۲۰ اسکات. انرژی رو بسوزون، نه سرکوبش کن.',
  'تنها': 'به یه نفر پیام بده یا زنگ بزن. انزوا، سوخت اصلی این عادته.',
  'خسته': 'خواب، بهترین ضدوسوسه. صفحه رو ببند و دراز بکش — حتی ۲۰ دقیقه.',
};
$$('.halt-btn').forEach(b => b.onclick = () => {
  const was = b.classList.contains('on');
  $$('.halt-btn').forEach(x => x.classList.remove('on'));
  if (was) { $('#halt-out').textContent = ''; return; }
  b.classList.add('on');
  $('#halt-out').innerHTML = `<b>${esc(b.dataset.h)}</b> — ${esc(HALT_TXT[b.dataset.h])}`;
});

/* ── SOS outcomes ── */
$('#sos-resisted').onclick = () => { stopBreath(); stopWave(); closeModal('#sos'); openModal('#modal-urge'); };
$('#sos-lost').onclick = () => { stopBreath(); stopWave(); closeModal('#sos'); openModal('#modal-relapse'); };

$('#urge-save').onclick = async () => {
  const intensity = Number($('#modal-urge input[type=range]').value);
  await api('/api/urge', {
    intensity,
    trigger: $('#urge-trigger').value,
    note: $('#urge-note').value,
    outcome: 'resisted',
  });
  $('#urge-trigger').value = ''; $('#urge-note').value = '';
  closeModal('#modal-urge');
  await refresh();
  toast(`ثبت شد. +۱۵ XP — این ${fa(STATE.urges_resisted)}اُمین موجه که شکوندیش 🌊`, 3600);
};

$('#relapse-save').onclick = async () => {
  const body = {
    trigger: $('#rl-trigger').value,
    feeling: $('#rl-feeling').value,
    note: $('#rl-note').value,
    use_freeze: $('#rl-freeze').checked,
  };
  const res = await api('/api/relapse', body);
  $('#rl-trigger').value = ''; $('#rl-feeling').value = ''; $('#rl-note').value = '';
  $('#rl-freeze').checked = false;
  closeModal('#modal-relapse');
  await refresh();
  if (res.frozen) toast('سپر استفاده شد 🧊 استریکت حفظ شد. ادامه بده.', 4000);
  else toast('ثبت شد. مهم نیست که افتادی — مهم اینه که دوباره شروع کنی. فردا روز ۱ه.', 5000);
};

/* ───────────────────────────── keys ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    $$('.overlay.show').forEach(o => {
      if (o.id !== 'onboarding') o.classList.remove('show');
    });
    stopBreath(); stopWave();
  }
});

/* ───────────────────────────── share / accountability ───────────────────────────── */
function showShare(tok) {
  const box = $('#share-box');
  const url = location.origin + '/share/' + tok;
  box.innerHTML = `لینک پیشرفت (فقط خواندنی):
    <a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>
    <div class="row">
      <button class="btn btn-ghost btn-sm grow" id="copy-link" style="margin:0">کپی لینک</button>
      <button class="btn btn-ghost btn-sm" id="revoke-link" style="margin:0">لغو</button>
    </div>`;
  box.classList.remove('hidden');
  $('#copy-link').onclick = () => copyText(url, 'لینک کپی شد 🔗');
  $('#revoke-link').onclick = async () => {
    await del('/api/share');
    box.classList.add('hidden');
    await refresh();
    toast('لینک لغو شد');
  };
}
$('#btn-share-create').onclick = async () => {
  const r = await api('/api/share', {});
  if (r.state) STATE = r.state;
  showShare(r.token);
  toast('لینک ساخته شد — بفرستش برای همراهت 🔗');
};
$('#btn-share-copy').onclick = () => {
  const S = STATE;
  const txt = `🕊️ رها — روز ${S.day} از ${S.goal}\n` +
    `رکورد: ${S.best_streak} روز | روز پاک: ${S.total_clean} | موج مهارشده: ${S.urges_resisted}\n` +
    `امروز چک‌این: ${S.today_checkin ? '✅' : '⛔'}\n` +
    `مرحله: ${S.phase.name}`;
  copyText(txt, 'گزارش کپی شد — بفرستش 📋');
};
function copyText(txt, msg) {
  const done = () => toast(msg);
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch { toast('کپی نشد'); }
    ta.remove();
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(done).catch(fallback);
  else fallback();
}

/* ───────────────────────────── personal triggers ───────────────────────────── */
$('#add-ptr').onclick = async () => {
  const v = $('#new-ptr').value.trim();
  if (!v) return;
  let cur = [];
  try { cur = JSON.parse(STATE.settings.personal_triggers || '[]'); } catch { }
  if (cur.includes(v)) return toast('قبلاً اضافه شده');
  cur.push(v);
  $('#new-ptr').value = '';
  await api('/api/settings', { personal_triggers: JSON.stringify(cur) });
  await refresh();
  toast('اضافه شد — لحظه‌ی بحران نشونت می‌دم');
};
$('#new-ptr').addEventListener('keydown', e => { if (e.key === 'Enter') $('#add-ptr').click(); });

/* ───────────────────────────── reminders ───────────────────────────── */
function updateNotifStatus() {
  const el = $('#notif-status');
  if (!el) return;
  if (!('Notification' in window)) {
    el.textContent = 'این مرورگر نوتیفیکیشن رو پشتیبانی نمی‌کنه.';
    return;
  }
  const p = Notification.permission;
  el.innerHTML = p === 'granted'
    ? '✅ نوتیفیکیشن فعاله. یادآور وقتی اجرا می‌شه که «رها» باز یا نصب‌شده در پس‌زمینه باشه.'
    : p === 'denied'
      ? '⛔ نوتیفیکیشن رد شده — از تنظیمات مرورگر مجازش کن.'
      : 'برای یادآور، اول اجازه‌ی نوتیفیکیشن رو بده.';
}
$('#btn-notif').onclick = async () => {
  if (!('Notification' in window)) return toast('مرورگرت پشتیبانی نمی‌کنه');
  const p = await Notification.requestPermission();
  updateNotifStatus();
  toast(p === 'granted' ? 'نوتیفیکیشن فعال شد 🔔' : 'اجازه داده نشد');
};

/* ─────────────────── تقویم (.ics) — ساخته‌شده از دادهٔ همین اپ ─────────────────── */
const ICS_DOMAIN = '@raha-app';
function icsEsc(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function icsFold(line) {
  line = String(line);
  if (line.length <= 60) return line;
  const out = [line.slice(0, 60)];
  let tail = line.slice(60);
  for (let i = 0; i < tail.length; i += 59) out.push(tail.slice(i, i + 59));
  return out.join('\r\n ');
}
function icsP(n) { return String(n).padStart(2, '0'); }
function icsIsoLocal(d) { return d.getFullYear() + '-' + icsP(d.getMonth() + 1) + '-' + icsP(d.getDate()); }
function icsAddDays(iso, n) { const t = new Date(iso + 'T00:00:00'); t.setDate(t.getDate() + n); return t; }
function icsUtcStamp(d, hh, mm, addMin) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0);
  t.setMinutes(t.getMinutes() + (addMin || 0));
  return String(t.getUTCFullYear()) + icsP(t.getUTCMonth() + 1) + icsP(t.getUTCDate()) +
    'T' + icsP(t.getUTCHours()) + icsP(t.getUTCMinutes()) + '00Z';
}
function icsDateOnly(d) { return String(d.getFullYear()) + icsP(d.getMonth() + 1) + icsP(d.getDate()); }
function icsNowStamp() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function buildIcs() {
  const S = STATE, goal = S.goal || 91, dayNow = Math.max(1, S.day || 1);
  const hm = String((S.settings || {}).reminder_time || '21:30').split(':');
  const hh = parseInt(hm[0], 10) || 21, mm = parseInt(hm[1], 10) || 30;
  let startIso = (S.settings || {}).start_date || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso)) {
    const t = new Date(); t.setDate(t.getDate() - (dayNow - 1)); startIso = icsIsoLocal(t);
  }
  const phases = S.phases || [];
  const phaseOf = d => { const p = phases.find(x => x.from <= d && d <= x.to); return p ? p.title : ''; };
  const L = [];
  L.push('BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Raha//91-Day Tracker//FA',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + icsEsc('رها — ۹۱ روز'),
    'X-WR-TIMEZONE:' + (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tehran'));
  for (let d = dayNow; d <= goal; d++) {
    const date = icsAddDays(startIso, d - 1);
    const ph = phaseOf(d);
    L.push('BEGIN:VEVENT');
    L.push('UID:raha-d' + icsDateOnly(date) + ICS_DOMAIN);
    L.push('DTSTAMP:' + icsNowStamp());
    L.push('DTSTART:' + icsUtcStamp(date, hh, mm, 0));
    L.push('DTEND:' + icsUtcStamp(date, hh, mm, 15));
    L.push('SUMMARY:' + icsEsc('رها · روز ' + fa(d) + ' از ' + fa(goal) + (ph ? ' · ' + ph : '')));
    L.push('DESCRIPTION:' + icsEsc('روز ' + fa(d) + ' از ' + fa(goal) + '.\n' +
      '۱) امروز چه چیزی را برنده شدم؟\n۲) محرک‌ها کجا سراغم آمدند؟\n۳) فردا یک کار کوچک برای خودم چیست؟\n\n' +
      'این رویداد از دادهٔ اپ رها ساخته شده؛ اگر روزشماری عوض شد، از تنظیمات دوباره بساز.'));
    L.push('CATEGORIES:' + icsEsc('رها'));
    L.push('TRANSP:TRANSPARENT');
    L.push('BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY',
      'DESCRIPTION:' + icsEsc('چک‌این رها'), 'END:VALARM');
    L.push('END:VEVENT');
  }
  const ms = [[7, '🎖️', 'هفتهٔ اول رد شد'], [30, '💎', 'یک ماه پاکی'], [goal, '🏆', 'پایان مسیر']];
  ms.forEach(function (it) {
    const d = it[0]; if (d > goal) return;
    const date = icsAddDays(startIso, d - 1);
    const next = new Date(date.getTime()); next.setDate(next.getDate() + 1);
    L.push('BEGIN:VEVENT');
    L.push('UID:raha-ms' + d + ICS_DOMAIN);
    L.push('DTSTAMP:' + icsNowStamp());
    L.push('DTSTART;VALUE=DATE:' + icsDateOnly(date));
    L.push('DTEND;VALUE=DATE:' + icsDateOnly(next));
    L.push('SUMMARY:' + icsEsc(it[1] + ' رها — روز ' + fa(d) + ': ' + it[2]));
    L.push('TRANSP:TRANSPARENT');
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n') + '\r\n';
}
function renderIcsStatus() {
  const el = $('#ics-status'); if (!el) return;
  if (!STATE || !STATE.onboarded) { el.textContent = 'بعد از آنبوردینگ فعال می‌شود.'; return; }
  const goal = STATE.goal || 91, day = Math.max(1, STATE.day || 1);
  const base = 'این فایل ' + fa(Math.max(0, goal - day + 1)) + ' رویداد روزانه دارد (امروز تا روز ' + fa(goal) + ') + ۳ نقطهٔ عطف.';
  let rec = null;
  try { rec = JSON.parse(localStorage.getItem('raha:ics') || 'null'); } catch (e) { }
  if (!rec) { el.innerHTML = base + '<br>هنوز نساخته‌ای — با دکمهٔ بالا بساز و یک بار وارد تقویم کن.'; return; }
  const stale = Number(rec.day) !== day;
  el.innerHTML = base + '<br>آخرین ساخت: روز ' + fa(rec.day) + ' · ساعت ' + fa(rec.hm) + ' · ' + fa(String(rec.at || '').slice(0, 10)) +
    (stale
      ? ' — <b style="color:#fbbf24">⚠️ روزشماری‌ات عوض شده؛ دوباره بساز تا تقویم با اپ هم‌قدم شود.</b>'
      : ' · <b style="color:#34d399">✅ با اپ هم‌قدم است.</b>');
}
function downloadIcs() {
  if (!STATE || !STATE.onboarded) return toast('اول آنبوردینگ را کامل کن');
  let text = '';
  try { text = buildIcs(); } catch (e) { return toast('ساخت فایل تقویم ناموفق بود'); }
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'raha-calendar-' + todayLocal() + '.ics';
  a.setAttribute('data-ics', '1');
  a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) { } }, 5000);
  try {
    localStorage.setItem('raha:ics', JSON.stringify({
      day: STATE.day, hm: (STATE.settings || {}).reminder_time || '21:30',
      at: new Date().toISOString(), events: Math.max(0, (STATE.goal || 91) - Math.max(1, STATE.day || 1) + 1)
    }));
  } catch (e) { }
  renderIcsStatus();
  toast('فایل تقویم ساخته شد 📅');
}
if ($('#btn-ics')) $('#btn-ics').onclick = downloadIcs;
if ($('#btn-ics-help')) $('#btn-ics-help').onclick = function () {
  const s = $('#ics-steps'); if (s) s.classList.toggle('hidden');
};

$('#rem-on').onchange = async () => {
  await api('/api/settings', {
    reminder_on: $('#rem-on').checked ? '1' : '0',
    reminder_time: $('#rem-time').value,
  });
  await refresh();
  toast($('#rem-on').checked ? 'یادآور روشن شد' : 'یادآور خاموش شد');
};
$('#rem-time').onchange = async () => {
  await api('/api/settings', { reminder_time: $('#rem-time').value });
  await refresh();
};

function tickReminder() {
  const S = STATE;
  if (!S || !S.onboarded) return;
  if (S.settings.reminder_on !== '1') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (S.today_checkin) return;
  const t = S.settings.reminder_time || '21:30';
  const n = new Date();
  const now = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
  if (now < t) return;
  const key = 'raha-reminded-' + todayLocal();
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  const title = `روز ${fa(S.day)} منتظرته`;
  const body = `چک‌این امروز رو ثبت کن و استریک ${fa(S.day)} روزه‌ت رو زنده نگه دار.`;
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'notify', title, body });
  } else {
    try { new Notification(title, { body, icon: 'icons/icon-192.png', dir: 'rtl', lang: 'fa' }); } catch { }
  }
}
setInterval(tickReminder, 60000);

/* ───────────────────────────── PWA / install / offline ───────────────────────────── */
let deferredPrompt = null;

function initPWA() {
  if ('serviceWorker' in navigator) {
    const swUrl = new URL('sw.js', document.baseURI).href;
    navigator.serviceWorker.register(swUrl, { scope: './' }).then(() => {
      updateNotifStatus();
      setTimeout(tickReminder, 3000);
    }).catch(() => { });
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    $('#install-banner').classList.remove('hidden');
  });

  $('#ib-btn').onclick = async () => {
    if (!deferredPrompt) {
      toast('از منوی مرورگر «افزودن به صفحه اصلی» رو بزن', 4000);
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('#install-banner').classList.add('hidden');
  };
  $('#btn-install').onclick = () => $('#ib-btn').click();

  window.addEventListener('appinstalled', () => {
    $('#install-banner').classList.add('hidden');
    toast('نصب شد 🎉 از آیکونش باز کن');
  });

  const pill = $('#offline-pill');
  const setNet = () => {
    // در نسخه‌ی بدون‌سرور اصلاً هشدار آفلاین لازم نیست — همیشه محلی است
    pill.classList.toggle('show', !window.RAHA_OFFLINE && !navigator.onLine);
  };
  window.addEventListener('online', () => { setNet(); if (!window.RAHA_OFFLINE) refresh().catch(() => { }); });
  window.addEventListener('offline', () => {
    setNet();
    if (!window.RAHA_OFFLINE) toast('آفلاین شدی — آخرین داده‌ها نمایش داده می‌شن', 3500);
  });
  setNet();
}

/* ───────────────────────────── sync: سرور ⇄ آفلاین ───────────────────────────── */
function renderSyncCard(s) {
  const offline = !!window.RAHA_OFFLINE;
  $('#sync-offline').classList.toggle('hidden', !offline);
  $('#sync-online').classList.toggle('hidden', offline);
  const st = $('#sync-status');
  const last = localStorage.getItem('raha:lastSync');

  if (offline) {
    if (document.activeElement?.id !== 'sync-server') $('#sync-server').value = s.sync_server || '';
    if (document.activeElement?.id !== 'sync-token') $('#sync-token').value = s.sync_token || '';
    $('#sync-auto').checked = s.sync_auto === '1';
    st.textContent = last ? last : 'سینک نشده';
  } else {
    st.textContent = 'نسخه‌ی سرور';
    if (!s.sync_token_shown) {
      $('#sync-info').innerHTML = 'برای دیدن توکن، دکمه‌ی پایین رو بزن.';
    }
  }
}

$('#sync-auto').onchange = async () => {
  await api('/api/settings', { sync_auto: $('#sync-auto').checked ? '1' : '0' });
  await refresh();
};

$('#sync-now').onclick = async () => {
  const server = $('#sync-server').value.trim();
  const token = $('#sync-token').value.trim();
  if (!server || !token) return toast('آدرس سرور و توکن رو وارد کن');
  await api('/api/settings', { sync_server: server, sync_token: token });
  await doSync(true);
};

async function doSync(showToast) {
  if (!window.RAHA_OFFLINE) return;
  if (!navigator.onLine) { if (showToast) toast('اینترنت/شبکه نیست — بعداً سینک می‌کنم'); return; }
  try {
    const r = await window.RAHA_OFFLINE.sync();
    localStorage.setItem('raha:lastSync', 'آخرین سینک: ' + r.at);
    STATE._ciFilled = false;
    await refresh();
    if (showToast) toast(`سینک شد ✓  ${fa(r.checkins)} چک‌این · ${fa(r.urges)} موج · ${fa(r.journal)} نوشته`, 4000);
  } catch (e) {
    localStorage.setItem('raha:lastSync', 'خطای سینک');
    if (showToast) toast('سینک نشد: ' + (e.message || 'سرور در دسترس نیست'), 4000);
    renderSyncCard(STATE.settings || {});
  }
}

$('#btn-sync-token').onclick = async () => {
  const r = await api('/api/sync-token', {});
  if (r.state) STATE = r.state;
  const tok = r.token || '';
  const url = location.origin;
  $('#sync-info').innerHTML = `آدرس سرور (در نسخه‌ی آفلاین وارد کن):
    <a href="#" id="cp-url" style="display:block">${esc(url)}</a>
    توکن سینک:
    <a href="#" id="cp-tok" style="display:block">${esc(tok)}</a>
    <div class="hint" style="margin:8px 0 0">اگر از گوشی وصلی، به‌جای localhost آدرس IP کامپیوتر رو بذار (مثل http://192.168.1.42:8000).</div>`;
  $('#cp-url').onclick = e => { e.preventDefault(); copyText(url, 'آدرس کپی شد'); };
  $('#cp-tok').onclick = e => { e.preventDefault(); copyText(tok, 'توکن کپی شد'); };
};

/* ───────────────────────────── backup: export / import ───────────────────────────── */
document.addEventListener('click', e => {
  const a = e.target.closest('a[download]');
  if (a && a.hasAttribute('data-ics')) return;   /* فایل تقویم را خودش دانلود می‌کند */
  if (a && window.RAHA_OFFLINE) {
    e.preventDefault();
    window.RAHA_OFFLINE.download();
  }
});

$('#btn-import').onclick = () => $('#import-file').click();
$('#import-file').onchange = async e => {
  const f = e.target.files?.[0];
  if (!f) return;
  const txt = await f.text();
  let data;
  try { data = JSON.parse(txt); } catch { return toast('فایل معتبر نیست'); }
  if (!confirm('همه‌ی داده‌های فعلی با محتوای این فایل جایگزین می‌شه. مطمئنی؟')) return;
  const r = await api('/api/import', data);
  if (r && r.state) STATE = r.state;
  STATE._ciFilled = false;
  await refresh();
  toast('بازیابی انجام شد ✓', 3500);
  e.target.value = '';
};

/* ───────────────────────────── boot ── */
(async function boot() {
  initOnboarding();
  initPWA();
  try {
    await refresh();
  } catch (e) {
    toast('اتصال به سرور برقرار نشد');
  }
  // نسخه‌ی آفلاین: اگر سینک خودکار روشنه و شبکه هست، بی‌صدا سینک کن
  if (window.RAHA_OFFLINE && STATE && STATE.settings?.sync_auto === '1'
      && STATE.settings?.sync_server && STATE.settings?.sync_token && navigator.onLine) {
    setTimeout(() => doSync(false), 1200);
  }
})();
