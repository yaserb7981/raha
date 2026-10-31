/* ═══════════════════════════════════════════════════════════════════
   رها — موتور آفلاین (بدون سرور)
   همه‌ی محاسبه‌های server.py این‌جا پورت شده و داده در localStorage است.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  const KEY = 'raha:offline:v1';
  const C = window.RAHA_CONST || {};
  const PHASES = C.phases || [], MILESTONES = C.milestones || [];
  const MISSIONS = C.missions || [], QUOTES = C.quotes || [], URGE_STEPS = C.urge_steps || [];

  /* ── storage ── */
  const blank = () => ({ v: 1, seq: 1, settings: {}, checkins: [], urges: [], relapses: [], reasons: [], journal: [] });

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (!d) return blank();
      d.settings = d.settings || {};
      ['checkins', 'urges', 'relapses', 'reasons', 'journal'].forEach(k => { d[k] = d[k] || []; });
      d.seq = d.seq || 1;
      ['checkins', 'urges', 'relapses', 'reasons', 'journal'].forEach(k => {
        d[k].forEach(r => {
          if (!r.uid) r.uid = genUid();
          if (r.updated_at === undefined) r.updated_at = nowMs();
          if (r.deleted === undefined) r.deleted = 0;
        });
      });
      return d;
    } catch (e) { return blank(); }
  }
  function save(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { alert('حافظه‌ی مرورگر پر شده — یک بکاپ بگیر.'); return false; }
  }
  const nid = db => db.seq++;
  const genUid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const nowMs = () => Date.now();

  /* ── date utils ── */
  const p2 = n => String(n).padStart(2, '0');
  const fmt = t => `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}`;
  const pd = iso => new Date(iso + 'T00:00:00');
  const todayS = () => fmt(new Date());
  function addDays(iso, n) { const t = pd(iso); t.setDate(t.getDate() + n); return fmt(t); }
  function diffDays(a, b) { return Math.round((pd(b) - pd(a)) / 86400000); }
  function weekdayFa(iso) {
    return ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'][pd(iso).getDay()];
  }
  const num = (v, lo, hi, def) => {
    const n = Math.round(Number(v));
    if (!isFinite(n)) return def;
    return Math.max(lo, Math.min(hi, n));
  };

  /* ══════════════════ محاسبه‌ی کامل وضعیت ══════════════════ */
  function buildState(todayStr) {
    const db = load();
    const st = db.settings;
    const today = todayStr || todayS();
    const goal = num(st.goal_days || 91, 1, 365, 91);
    const start = st.start_date || null;

    const live = arr => arr.filter(x => !x.deleted);
    const checkins = live(db.checkins).sort((a, b) => a.date < b.date ? -1 : 1);
    const relapses = live(db.relapses).sort((a, b) => (a.date === b.date ? a.id - b.id : (a.date < b.date ? -1 : 1)));
    const urges = live(db.urges).sort((a, b) => (a.ts || '') < (b.ts || '') ? -1 : 1);
    const journal = live(db.journal).sort((a, b) => (a.ts || '') < (b.ts || '') ? 1 : -1);
    const reasons = live(db.reasons).sort((a, b) => a.id - b.id);

    const hard = relapses.filter(r => !r.frozen);
    const lastRel = hard.length ? hard[hard.length - 1].date : null;

    let day = 0, streakStart = today;
    if (start) {
      streakStart = lastRel ? addDays(lastRel, 1) : start;
      if (streakStart < start) streakStart = start;
      day = diffDays(streakStart, today) + 1;
      if (day < 0) day = 0;
    }

    /* streak history */
    const streak_hist = [];
    if (start) {
      const anchors = [start, ...hard.map(r => addDays(r.date, 1))];
      anchors.forEach((a, i) => {
        const isCur = i === anchors.length - 1;
        const end = isCur ? today : addDays(hard[i].date, -1);
        streak_hist.push({
          start: a, end, days: Math.max(0, diffDays(a, end) + 1),
          current: isCur, best: false,
        });
      });
    }
    const best = streak_hist.reduce((m, s) => Math.max(m, s.days), 0);
    if (best > 0) { const b = streak_hist.find(s => s.days === best); if (b) b.best = true; }

    const totalSpan = start ? Math.max(0, diffDays(start, today) + 1) : 0;
    const total_clean = Math.max(0, totalSpan - hard.filter(r => r.date <= today).length);

    const earned = Math.min(3, Math.floor(total_clean / 7));
    const usedF = relapses.filter(r => r.frozen).length;
    const freezes_available = Math.max(0, earned - usedF);

    const resisted = urges.filter(u => u.outcome === 'resisted').length;
    let xp = checkins.length * 20 + resisted * 15 + journal.length * 10 +
      total_clean * 5 + relapses.length * 5 +
      checkins.filter(c => (c.mood || 0) >= 7).length * 5;
    const level = 1 + Math.floor(Math.pow(xp / 60, 0.75));

    const dNum = Math.max(day, 1);
    const phase = PHASES.find(p => p.from <= dNum && dNum <= p.to) || PHASES[PHASES.length - 1]
      || { name: '—', desc: '', focus: [], color: '#818cf8' };
    const next_phase = PHASES.find(p => p.from > day) || null;

    const milestones = MILESTONES.map(([md, title, desc]) => ({
      day: md, title, desc, unlocked: day >= md,
      pct: Math.min(100, Math.round(day / md * 100)),
    }));
    const next_milestone = milestones.find(m => !m.unlocked) || null;

    const maxUrge = urges.filter(u => u.outcome === 'resisted').reduce((m, u) => Math.max(m, u.intensity || 0), 0);
    const badges = [
      { id: 'first', title: 'اولین ثبت', emoji: '🌱', desc: 'اولین چک‌این روزانه', un: checkins.length >= 1 },
      { id: 'd3', title: '۷۲ ساعت', emoji: '🔥', desc: '۳ روز پاک', un: day >= 3 },
      { id: 'd7', title: 'یک هفته', emoji: '🛡️', desc: '۷ روز پاک', un: day >= 7 },
      { id: 'd30', title: 'یک ماه', emoji: '💎', desc: '۳۰ روز پاک', un: day >= 30 },
      { id: 'd91', title: 'آزادی', emoji: '🏆', desc: '۹۱ روز کامل', un: day >= 91 },
      { id: 'u10', title: 'موج‌سوار', emoji: '🌊', desc: '۱۰ وسوسه مهارشده', un: resisted >= 10 },
      { id: 'u30', title: 'دیوار آهنین', emoji: '⛰️', desc: '۳۰ وسوسه مهارشده', un: resisted >= 30 },
      { id: 'j5', title: 'خودنویس', emoji: '📓', desc: '۵ نوشته در ژورنال', un: journal.length >= 5 },
      { id: 'c7', title: 'منظم', emoji: '📅', desc: '۷ چک‌این روزانه', un: checkins.length >= 7 },
      { id: 'c30', title: 'راتین', emoji: '⏰', desc: '۳۰ چک‌این', un: checkins.length >= 30 },
      { id: 'hard', title: 'سخت‌ترین موج', emoji: '⚡', desc: 'وسوسه‌ای با شدت ۹ یا ۱۰ رو رد کردی', un: maxUrge >= 9 },
      { id: 'honest', title: 'صادق', emoji: '🪞', desc: 'یک لغزش رو ثبت و تحلیل کردی', un: relapses.length >= 1 },
    ];

    /* heatmap ۱۲۰ روز */
    const heat = [];
    if (start) {
      for (let i = 119; i >= 0; i--) {
        const dd = addDays(today, -i);
        let status;
        if (dd < start) status = 'before';
        else if (dd === today) status = 'today';
        else if (relapses.some(r => r.date === dd && !r.frozen)) status = 'relapse';
        else status = 'clean';
        heat.push({ date: dd, status, checkin: checkins.some(c => c.date === dd) });
      }
    }

    /* urge trend */
    const byDay = {};
    urges.forEach(u => { const k = u.date || (u.ts || '').slice(0, 10); (byDay[k] = byDay[k] || []).push(u); });
    const urge_trend = Object.keys(byDay).sort().map(k => {
      const v = byDay[k];
      return {
        date: k, count: v.length,
        max: Math.max(...v.map(x => x.intensity || 0)),
        avg: Math.round(v.reduce((s, x) => s + (x.intensity || 0), 0) / v.length * 10) / 10,
      };
    }).slice(-60);

    /* triggers */
    const trig = {};
    urges.forEach(u => { const t = (u.trigger || '').trim(); if (t) trig[t] = (trig[t] || 0) + 1; });
    relapses.forEach(r => { const t = (r.trigger || '').trim(); if (t) trig[t] = (trig[t] || 0) + 2; });
    const triggers = Object.keys(trig).map(k => ({ name: k, count: trig[k] }))
      .sort((a, b) => b.count - a.count).slice(0, 8);

    /* ── weekly ── */
    function win(a, b) {
      const cs = checkins.filter(c => a <= c.date && c.date <= b);
      const us = urges.filter(u => (u.date || '') && a <= u.date && u.date <= b);
      const rs = hard.filter(r => a <= r.date && r.date <= b);
      const avg = (arr, k) => {
        const v = arr.map(x => x[k]).filter(x => x !== undefined && x !== null);
        return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length * 10) / 10 : 0;
      };
      const allTrig = [...us, ...rs].map(x => x.trigger).filter(Boolean);
      const counts = {};
      allTrig.forEach(t => counts[t] = (counts[t] || 0) + 1);
      const top = Object.keys(counts).sort((x, y) => counts[y] - counts[x])[0] || '';
      return {
        checkins: cs.length, mood: avg(cs, 'mood'), urge: avg(cs, 'urge'),
        sleep: avg(cs, 'sleep'), energy: avg(cs, 'energy'),
        urges: us.length, relapses: rs.length, top_trigger: top,
      };
    }
    const this_w = win(addDays(today, -6), today);
    const prev_w = win(addDays(today, -13), addDays(today, -7));

    const wdCount = {};
    urges.forEach(u => { const iso = u.date || (u.ts || '').slice(0, 10); if (iso) { const w = weekdayFa(iso); wdCount[w] = (wdCount[w] || 0) + 1; } });
    const worst_wd = Object.keys(wdCount).sort((a, b) => wdCount[b] - wdCount[a])[0] || '';

    /* sleep↔urge correlation */
    const pairs = checkins.filter(c => c.sleep != null && c.urge != null).map(c => [c.sleep, c.urge]);
    let corr = null;
    if (pairs.length >= 4) {
      const n = pairs.length;
      const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
      const my = pairs.reduce((s, p) => s + p[1], 0) / n;
      const numr = pairs.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0);
      const dx = Math.sqrt(pairs.reduce((s, p) => s + (p[0] - mx) ** 2, 0));
      const dy = Math.sqrt(pairs.reduce((s, p) => s + (p[1] - my) ** 2, 0));
      if (dx && dy) corr = Math.round(numr / (dx * dy) * 100) / 100;
    }

    const insights = [];
    if (this_w.urges || prev_w.urges) {
      if (this_w.urges < prev_w.urges) insights.push(`این هفته ${prev_w.urges - this_w.urges} موج کمتر از هفته قبل داشتی. داری قوی‌تر می‌شی.`);
      else if (this_w.urges > prev_w.urges) insights.push('این هفته موج‌ها بیشتر شده — معمولاً یعنی استرس یا خواب کم. چک‌این‌ها رو دقیق‌تر پر کن.');
    }
    if (corr !== null && corr <= -0.3) insights.push('هرچی خوابت بهتر، وسوسه‌ت کمتر بوده. خواب = سلاح مخفی تو.');
    if (corr !== null && corr >= 0.3) insights.push('رابطه‌ی خواب و وسوسه‌ت مستقیمه؛ شب‌های بی‌خوابی، روزهای پرخطرن.');
    if (worst_wd) insights.push(`پرخطرترین روز هفته‌ت: ${worst_wd}. برای اون روز از قبل برنامه بذار.`);
    if (this_w.checkins >= 5) insights.push('۵ روز یا بیشتر چک‌این کردی — همین نظم، نصف مسیره.');
    if (!insights.length) insights.push('با چند روز چک‌این، الگوهای شخصی‌ت اینجا ظاهر می‌شن.');

    const tci = checkins.find(c => c.date === today) || null;
    const today_checkin = tci ? { ...tci, triggers: safeArr(tci.triggers) } : null;

    return {
      settings: st,
      onboarded: !!start,
      today, day: Math.max(day, 0), goal,
      percent: Math.min(100, Math.round(Math.max(day, 0) / goal * 1000) / 10),
      rewiring: Math.min(99, Math.round(100 * (1 - Math.exp(-Math.max(day, 0) / 34)))),
      best_streak: best, total_clean,
      relapses_count: hard.length, urges_resisted: resisted,
      freezes_available, freezes_earned: earned, freezes_used: usedF,
      xp, level,
      phase, next_phase,
      milestones, next_milestone,
      badges, heatmap: heat,
      urge_trend, triggers,
      streak_history: streak_hist,
      today_checkin,
      checkins: checkins.slice(-60),
      relapses: [...relapses].reverse().slice(0, 20),
      journal: journal.slice(0, 30),
      reasons,
      mission: MISSIONS[(dNum - 1) % (MISSIONS.length || 1)] || '',
      quote: QUOTES[(dNum - 1) % (QUOTES.length || 1)] || '',
      urge_steps: URGE_STEPS,
      phases: PHASES,
      weekly: { this: this_w, prev: prev_w, worst_weekday: worst_wd, sleep_urge_corr: corr, insights },
      share_token: '',
    };
  }
  function safeArr(v) { try { return JSON.parse(v || '[]'); } catch (e) { return []; } }

  /* ══════════════════ روتر (هم‌رفتار با API سرور) ══════════════════ */
  async function handle(path, body) {
    const today = todayS();
    const db = load();

    if (path === '/api/state') return buildState(today);

    if (path === '/api/setup') {
      db.settings = {
        ...db.settings,
        start_date: body.start_date || today,
        goal_days: String(num(body.goal_days || 91, 1, 365, 91)),
        name: (body.name || '').trim(),
        vision: (body.vision || '').trim(),
        onboarded: '1',
      };
      (body.reasons || []).forEach(r => {
        if (String(r).trim()) db.reasons.push({ id: nid(db), text: String(r).trim(), created_at: new Date().toISOString() });
      });
      save(db);
      return buildState(today);
    }

    if (path === '/api/checkin') {
      const date = body.date || today;
      const rec = {
        id: 0, date, uid: genUid(), updated_at: nowMs(), deleted: 0,
        mood: num(body.mood, 1, 10, 5), urge: num(body.urge, 0, 10, 0),
        sleep: num(body.sleep, 1, 10, 5), energy: num(body.energy, 1, 10, 5),
        triggers: JSON.stringify(body.triggers || []),
        note: (body.note || '').trim(), win: (body.win || '').trim(),
        created_at: new Date().toISOString(),
      };
      const i = db.checkins.findIndex(c => c.date === date);
      if (i >= 0) {
        rec.id = db.checkins[i].id;
        rec.uid = db.checkins[i].uid || rec.uid;
        db.checkins[i] = { ...db.checkins[i], ...rec };
      }
      else { rec.id = nid(db); db.checkins.push(rec); }
      save(db);
      return buildState(today);
    }

    if (path === '/api/urge') {
      db.urges.push({
        id: nid(db), uid: genUid(), updated_at: nowMs(), deleted: 0,
        ts: new Date().toISOString(), date: today,
        intensity: num(body.intensity, 0, 10, 5),
        trigger: (body.trigger || '').trim(), note: (body.note || '').trim(),
        outcome: body.outcome || 'resisted',
      });
      save(db);
      return buildState(today);
    }

    if (path === '/api/relapse') {
      const before = buildState(today);
      let frozen = body.use_freeze ? 1 : 0;
      if (frozen && before.freezes_available < 1) frozen = 0;
      db.relapses.push({
        id: nid(db), uid: genUid(), updated_at: nowMs(), deleted: 0,
        ts: new Date().toISOString(), date: today,
        trigger: (body.trigger || '').trim(), feeling: (body.feeling || '').trim(),
        note: (body.note || '').trim(), frozen, streak_days: before.day,
      });
      save(db);
      return { ok: true, frozen: !!frozen, state: buildState(today) };
    }

    if (path === '/api/reasons') {
      if ((body.text || '').trim()) {
        db.reasons.push({
          id: nid(db), uid: genUid(), updated_at: nowMs(), deleted: 0,
          text: body.text.trim(), created_at: new Date().toISOString(),
        });
        save(db);
      }
      return buildState(today);
    }

    if (path === '/api/journal') {
      if ((body.title || '').trim() || (body.body || '').trim()) {
        db.journal.push({
          id: nid(db), uid: genUid(), updated_at: nowMs(), deleted: 0,
          ts: new Date().toISOString(), date: today,
          title: (body.title || '').trim(), body: (body.body || '').trim(),
          mood: num(body.mood, 1, 10, 5),
        });
        save(db);
      }
      return buildState(today);
    }

    if (path === '/api/settings') {
      ['name', 'vision', 'goal_days', 'start_date', 'buddy_name', 'buddy_phone',
        'reminder_time', 'reminder_on', 'personal_triggers',
        'sync_server', 'sync_token', 'sync_auto'].forEach(k => {
          if (body[k] !== undefined) db.settings[k] = String(body[k]);
        });
      db.settings.settings_updated_at = String(nowMs());
      save(db);
      return buildState(today);
    }

    if (path === '/api/import') {
      const b = body || {};
      const norm = x => ({
        ...x, id: x.id || nid(db), uid: x.uid || genUid(),
        updated_at: x.updated_at || nowMs(), deleted: x.deleted || 0,
      });
      db.checkins = (b.checkins || []).map(norm);
      db.urges = (b.urges || []).map(norm);
      db.relapses = (b.relapses || []).map(norm);
      db.reasons = (b.reasons || []).map(norm);
      db.journal = (b.journal || []).map(norm);
      if (b.settings) db.settings = { ...db.settings, ...b.settings };
      delete db.settings.share_token;
      save(db);
      return { ok: true, state: buildState(today) };
    }

    if (path === '/api/share') return { token: '', state: buildState(today) };

    /* DELETE /api/<table>/<id> */
    if (path.startsWith('DELETE ')) {
      const m = path.replace('DELETE ', '').match(/^\/api\/(reasons|journal|relapses|urges)\/(\d+)/);
      if (m) {
        const [, table, id] = m;
        db[table].forEach(x => {
          if (String(x.id) === String(id)) { x.deleted = 1; x.updated_at = nowMs(); }
        });
        save(db);
      }
      return buildState(today);
    }

    return buildState(today);
  }

  /* ── export ── */
  function download() {
    const db = load();
    const payload = {
      exported_at: new Date().toISOString().slice(0, 19),
      settings: db.settings, checkins: db.checkins, urges: db.urges,
      relapses: db.relapses, journal: db.journal, reasons: db.reasons,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'raha-backup-' + todayS() + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ══════════════════ همگام‌سازی با سرور ══════════════════ */
  const LOCAL_KEYS = ['sync_server', 'sync_token', 'sync_auto'];

  async function sync(serverUrl, token) {
    const db = load();
    const server = String(serverUrl || db.settings.sync_server || '').replace(/\/+$/, '');
    const tok = String(token || db.settings.sync_token || '');
    if (!server || !tok) throw new Error('آدرس سرور یا توکن سینک تنظیم نشده');

    const payload = {
      data: {
        checkins: db.checkins, urges: db.urges, relapses: db.relapses,
        reasons: db.reasons, journal: db.journal,
      },
      settings: { ...db.settings },
      settings_updated_at: Number(db.settings.settings_updated_at || 0),
    };
    delete payload.settings.sync_server;
    delete payload.settings.sync_token;
    delete payload.settings.sync_auto;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    let res;
    try {
      res = await fetch(server + '/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Raha-Sync': tok },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
    } finally { clearTimeout(t); }

    if (res.status === 403) throw new Error('توکن سینک اشتباه است');
    if (!res.ok) throw new Error('سرور پاسخ نداد (' + res.status + ')');
    const j = await res.json();

    const nd = load();
    const localOnly = {};
    LOCAL_KEYS.forEach(k => { localOnly[k] = db.settings[k]; });
    ['checkins', 'urges', 'relapses', 'reasons', 'journal'].forEach(k => {
      nd[k] = (j.data && j.data[k]) || [];
    });
    nd.settings = { ...nd.settings, ...(j.settings || {}) };
    Object.keys(localOnly).forEach(k => { if (localOnly[k] !== undefined) nd.settings[k] = localOnly[k]; });
    nd.settings.settings_updated_at = String(j.settings_updated_at || 0);
    nd.seq = Math.max(nd.seq || 1, 1);
    save(nd);

    const count = k => (nd[k] || []).filter(x => !x.deleted).length;
    return {
      ok: true,
      checkins: count('checkins'), urges: count('urges'), journal: count('journal'),
      reasons: count('reasons'), relapses: count('relapses'),
      at: new Date().toLocaleTimeString('fa-IR'),
    };
  }

  window.RAHA_OFFLINE = { handle, download, buildState, load, sync, save };
})();
