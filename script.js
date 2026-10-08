(function () {
  'use strict';

  var TASKS_KEY = 'aurora-todo-v2';
  var META_KEY = 'aurora-todo-meta-v1';
  var STARS_KEY = 'aurora-todo-stars-v1';
  var DAY = 86400000, WEEK = 7 * DAY;
  var THEMES = ['midnight', 'ember', 'forest', 'mono'];
  var NS = 'http://www.w3.org/2000/svg';

  var $ = function (s) { return document.querySelector(s); };
  var listEl = $('#list'), input = $('#input'), field = $('#field'), aurora = $('#aurora');
  var emptyEl = $('#empty'), footEl = $('#foot'), countEl = $('#count'), barEl = $('#bar');
  var clearBtn = $('#clear'), filtersEl = $('#filters'), spot = $('#spot'), stageEl = $('#stage');
  var btnFocus = $('#btnFocus'), btnSky = $('#btnSky'), btnSound = $('#btnSound'), btnTheme = $('#btnTheme');
  var themePop = $('#themePop'), focusEl = $('#focus'), fCard = $('#fCard');
  var skyEl = $('#sky'), skyBody = $('#skyBody'), skyClose = $('#skyClose');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =========================================================
     Storage
  ========================================================= */
  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw);
    } catch (e) {}
    return fallback;
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var meta = readJSON(META_KEY, null);
  if (!meta || typeof meta !== 'object') meta = {};
  if (typeof meta.start !== 'number') meta.start = Date.now();          // the day you began
  if (THEMES.indexOf(meta.theme) < 0) meta.theme = 'midnight';
  if (typeof meta.sound !== 'boolean') meta.sound = true;
  if (typeof meta.seen !== 'number') meta.seen = -1;                    // newest constellation you've viewed
  function saveMeta() { writeJSON(META_KEY, meta); }
  saveMeta();

  var stars = readJSON(STARS_KEY, []);
  if (!Array.isArray(stars)) stars = [];
  function saveStars() { writeJSON(STARS_KEY, stars); }

  var tasks = readJSON(TASKS_KEY, []);
  if (!Array.isArray(tasks)) tasks = [];
  tasks = tasks.filter(function (t) { return t && typeof t.text === 'string'; }).map(function (t) {
    return {
      id: t.id || uid(),
      text: t.text,
      done: !!t.done,
      created: typeof t.created === 'number' ? t.created : Date.now(),
      touched: typeof t.touched === 'number' ? t.touched : null
    };
  });
  function saveTasks() { writeJSON(TASKS_KEY, tasks); }
  saveTasks();

  var filter = 'all';

  /* =========================================================
     Helpers
  ========================================================= */
  function match(t) { return filter === 'all' || (filter === 'open' && !t.done) || (filter === 'done' && t.done); }
  function findTask(id) { for (var i = 0; i < tasks.length; i++) if (tasks[i].id === id) return tasks[i]; return null; }
  function findEl(id) { return listEl.querySelector('[data-id="' + id + '"]'); }
  function openCount() { return tasks.filter(function (t) { return !t.done; }).length; }

  function pulse() {
    if (reduce) return;
    aurora.classList.remove('pulse');
    void aurora.offsetWidth;
    aurora.classList.add('pulse');
  }

  function showLayer(el) {
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('open');
  }
  function hideLayer(el) {
    el.classList.remove('open');
    setTimeout(function () { if (!el.classList.contains('open')) el.hidden = true; }, reduce ? 0 : 650);
  }

  /* =========================================================
     Themes
  ========================================================= */
  function applyTheme(name, announce) {
    if (THEMES.indexOf(name) < 0) name = 'midnight';
    meta.theme = name;
    document.documentElement.setAttribute('data-theme', name);
    saveMeta();
    Array.prototype.forEach.call(themePop.querySelectorAll('.topt'), function (b) {
      b.setAttribute('aria-checked', b.dataset.theme === name ? 'true' : 'false');
    });
    if (announce) pulse();
  }
  function setThemePop(open) {
    themePop.hidden = !open;
    btnTheme.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  btnTheme.addEventListener('click', function (e) {
    e.stopPropagation();
    setThemePop(themePop.hidden);
  });
  themePop.addEventListener('click', function (e) {
    var b = e.target.closest('.topt');
    if (!b) return;
    applyTheme(b.dataset.theme, true);
    setThemePop(false);
  });
  document.addEventListener('click', function (e) {
    if (!themePop.hidden && !e.target.closest('.theme-wrap')) setThemePop(false);
  });

  /* =========================================================
     Melody of completion (Web Audio, no files needed)
  ========================================================= */
  var audioCtx = null, master = null, noteStep = 0;
  var SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21].map(function (s) { return 261.63 * Math.pow(2, s / 12); }); // C major pentatonic

  function ensureAudio() {
    if (!audioCtx) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        audioCtx = new AC();
        master = audioCtx.createGain();
        master.gain.value = 0.55;
        // soft echo for a shimmery tail
        var delay = audioCtx.createDelay(1);
        delay.delayTime.value = 0.27;
        var feedback = audioCtx.createGain(); feedback.gain.value = 0.32;
        var wet = audioCtx.createGain(); wet.gain.value = 0.34;
        master.connect(audioCtx.destination);
        master.connect(delay);
        delay.connect(feedback); feedback.connect(delay);
        delay.connect(wet); wet.connect(audioCtx.destination);
      } catch (e) { return false; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return true;
  }
  function bell(freq, t, dur, vol) {
    var o1 = audioCtx.createOscillator(), o2 = audioCtx.createOscillator();
    var g = audioCtx.createGain(), g2 = audioCtx.createGain();
    o1.type = 'sine'; o1.frequency.value = freq;
    o2.type = 'sine'; o2.frequency.value = freq * 2.01;
    g2.gain.value = 0.28;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
    o1.start(t); o2.start(t);
    o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function playCompletion(allClear) {
    if (!meta.sound || !ensureAudio()) return;
    var t = audioCtx.currentTime + 0.01;
    if (allClear) {
      [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach(function (f, i) {
        bell(f, t + i * 0.11, i === 4 ? 2.4 : 1.4, 0.22);
      });
    } else {
      var pos = noteStep % 18;                       // walks up the scale, then back down
      var idx = pos < 10 ? pos : 18 - pos;
      noteStep++;
      bell(SCALE[idx], t, 1.7, 0.27);
    }
  }
  function applySound() {
    btnSound.setAttribute('aria-pressed', meta.sound ? 'true' : 'false');
    btnSound.title = meta.sound ? 'Sound on' : 'Sound off';
  }
  btnSound.addEventListener('click', function () {
    meta.sound = !meta.sound;
    saveMeta();
    applySound();
    if (meta.sound && ensureAudio()) bell(SCALE[4], audioCtx.currentTime + 0.01, 1.4, 0.25);
  });

  /* =========================================================
     Dust: ignored tasks slowly gather haze
  ========================================================= */
  function ageDays(t) { return Math.floor((Date.now() - (t.touched || t.created)) / DAY); }
  function dustLevel(t) {
    if (t.done) return 0;
    var age = (Date.now() - (t.touched || t.created)) / DAY;
    return age >= 7 ? 3 : age >= 4 ? 2 : age >= 2 ? 1 : 0;
  }
  function refreshDust() {
    Array.prototype.forEach.call(listEl.querySelectorAll('.task'), function (li) {
      var t = findTask(li.dataset.id);
      if (!t) return;
      var lvl = dustLevel(t);
      li.dataset.dust = lvl;
      var btn = li.querySelector('.dustoff');
      if (btn && lvl > 0) {
        var n = ageDays(t);
        var msg = 'Gathering dust (' + n + (n === 1 ? ' day' : ' days') + '). Click to dust it off.';
        btn.title = msg;
        btn.setAttribute('aria-label', msg);
      }
    });
  }
  function dustOff(id) {
    var t = findTask(id);
    if (!t) return;
    t.touched = Date.now();
    saveTasks();
    refreshDust();
    pulse();
  }

  /* =========================================================
     Constellation stars (one per finished task, kept forever)
  ========================================================= */
  function addStar(t) {
    if (stars.some(function (s) { return s.id === t.id; })) return;
    stars.push({ id: t.id, text: t.text, at: Date.now() });
    saveStars();
    updateSkyBadge();
  }
  function removeStar(id) {
    var n = stars.length;
    stars = stars.filter(function (s) { return s.id !== id; });
    if (stars.length !== n) saveStars();
  }
  function renameStar(id, text) {
    for (var i = 0; i < stars.length; i++) if (stars[i].id === id) { stars[i].text = text; saveStars(); return; }
  }
  function currentWeek() { return Math.max(0, Math.floor((Date.now() - meta.start) / WEEK)); }
  function starsOfWeek(w) {
    return stars.filter(function (s) {
      var i = Math.floor((s.at - meta.start) / WEEK);
      return Math.max(0, i) === w;
    }).sort(function (a, b) { return a.at - b.at; });
  }
  function updateSkyBadge() {
    var newest = currentWeek() - 1;                        // newest week that has finished
    btnSky.classList.toggle('has-new', newest >= 0 && newest > meta.seen);
  }

  /* ---------- sky drawing helpers ---------- */
  function svgEl(name, attrs) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function layoutPoints(n, rng) {                          // spreads stars out evenly (best-candidate sampling)
    var pts = [];
    for (var i = 0; i < n; i++) {
      var best = null, bestD = -1, tries = i === 0 ? 1 : 16;
      for (var k = 0; k < tries; k++) {
        var p = { x: 80 + rng() * 840, y: 70 + rng() * 420 };
        var d = Infinity;
        for (var j = 0; j < pts.length; j++) {
          var dx = p.x - pts[j].x, dy = p.y - pts[j].y;
          d = Math.min(d, dx * dx + dy * dy);
        }
        if (d > bestD) { bestD = d; best = p; }
      }
      pts.push(best);
    }
    return pts;
  }
  function spanningEdges(pts) {                            // links nearby stars like a real constellation
    var n = pts.length, edges = [];
    if (n < 2) return edges;
    var used = [], d = [], par = [];
    for (var i = 0; i < n; i++) { used.push(false); d.push(Infinity); par.push(-1); }
    d[0] = 0;
    for (var it = 0; it < n; it++) {
      var u = -1;
      for (var a = 0; a < n; a++) if (!used[a] && (u < 0 || d[a] < d[u])) u = a;
      used[u] = true;
      if (par[u] >= 0) edges.push([par[u], u]);
      for (var v = 0; v < n; v++) {
        if (used[v]) continue;
        var dx = pts[u].x - pts[v].x, dy = pts[u].y - pts[v].y, dd = dx * dx + dy * dy;
        if (dd < d[v]) { d[v] = dd; par[v] = u; }
      }
    }
    return edges;
  }
  function fmtWhen(ts) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(ts));
  }
  function fmtDay(ts) {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(ts));
  }
  var ADJ = ['Quiet', 'Steady', 'Bright', 'Gentle', 'Patient', 'Bold', 'Swift', 'Calm', 'Wandering', 'Silver'];
  var CRE = ['Fox', 'Heron', 'Lantern', 'Comet', 'Harbor', 'Owl', 'River', 'Lynx', 'Moth', 'Crane'];
  function constellationName(w) {
    var h = hashStr('name' + w + ':' + meta.start);
    return 'The ' + ADJ[h % ADJ.length] + ' ' + CRE[(h >>> 5) % CRE.length];
  }

  function buildSky(list, seedKey, isSample) {
    var wrap = document.createElement('div');
    wrap.className = 'sky-wrap';
    var svg = svgEl('svg', { 'class': 'sky-svg', viewBox: '0 0 1000 560', role: 'group', 'aria-label': 'Constellation of finished tasks' });

    var defs = svgEl('defs');
    var filt = svgEl('filter', { id: 'halo-blur', x: '-200%', y: '-200%', width: '500%', height: '500%' });
    filt.appendChild(svgEl('feGaussianBlur', { stdDeviation: '7' }));
    defs.appendChild(filt);
    svg.appendChild(defs);

    var rng = mulberry(hashStr(seedKey));

    var bg = svgEl('g', { 'class': 'bgstars' });
    for (var b = 0; b < 70; b++) {
      bg.appendChild(svgEl('circle', {
        cx: (rng() * 1000).toFixed(1), cy: (rng() * 560).toFixed(1),
        r: (0.5 + rng() * 1.1).toFixed(2), opacity: (0.12 + rng() * 0.38).toFixed(2)
      }));
    }
    svg.appendChild(bg);

    var pts = layoutPoints(list.length, rng);
    var edges = spanningEdges(pts);

    var gLines = svgEl('g');
    edges.forEach(function (e, i) {
      var p = pts[e[0]], q = pts[e[1]];
      gLines.appendChild(svgEl('path', {
        'class': 'cline', pathLength: '1',
        d: 'M' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + 'L' + q.x.toFixed(1) + ' ' + q.y.toFixed(1),
        style: 'animation-delay:' + (0.15 + i * 0.09).toFixed(2) + 's'
      }));
    });
    svg.appendChild(gLines);

    var gHalos = svgEl('g', { filter: 'url(#halo-blur)' });
    var gStars = svgEl('g');
    var tip = document.createElement('div');
    tip.className = 'sky-tip';
    tip.setAttribute('aria-hidden', 'true');
    var tipTitle = document.createElement('strong'), tipWhen = document.createElement('span');
    tip.appendChild(tipTitle); tip.appendChild(tipWhen);

    function showTip(i, node) {
      var s = list[i];
      tipTitle.textContent = s.text.length > 90 ? s.text.slice(0, 89) + '\u2026' : s.text;
      tipWhen.textContent = isSample ? 'Sample star' : 'Finished ' + fmtWhen(s.at);
      var r = node.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      var left = r.left + r.width / 2 - wr.left;
      left = Math.max(135, Math.min(wr.width - 135, left));
      tip.style.left = left + 'px';
      tip.style.top = (r.top + r.height / 2 - wr.top - 10) + 'px';
      tip.classList.add('show');
    }
    function hideTip() { tip.classList.remove('show'); }

    list.forEach(function (s, i) {
      var p = pts[i];
      var r = 3 + rng() * 2.6;
      var delay = (0.1 + i * 0.07).toFixed(2) + 's';

      gHalos.appendChild(svgEl('circle', {
        'class': 'halo st-' + (i % 3), cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: (r * 3.4).toFixed(1),
        style: 'animation-delay:' + (rng() * 3).toFixed(2) + 's;animation-duration:' + (2.8 + rng() * 2).toFixed(1) + 's'
      }));

      var g = svgEl('g', { transform: 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')' });
      var pop = svgEl('g', { 'class': 'pop', style: 'animation-delay:' + delay });
      pop.appendChild(svgEl('circle', { 'class': 'core st-' + (i % 3), r: r.toFixed(2) }));
      var hit = svgEl('circle', { 'class': 'hit', r: '20', tabindex: '0', role: 'img', 'aria-label': (isSample ? 'Sample star: ' : 'Finished: ') + s.text });
      hit.addEventListener('mouseenter', function () { showTip(i, hit); });
      hit.addEventListener('mouseleave', hideTip);
      hit.addEventListener('focus', function () { showTip(i, hit); });
      hit.addEventListener('blur', hideTip);
      hit.addEventListener('click', function (e) { e.stopPropagation(); showTip(i, hit); });
      pop.appendChild(hit);
      g.appendChild(pop);
      gStars.appendChild(g);
    });
    svg.appendChild(gHalos);
    svg.appendChild(gStars);
    wrap.appendChild(svg);
    wrap.appendChild(tip);
    wrap.addEventListener('click', hideTip);

    if (!list.length) {
      var empty = document.createElement('div');
      empty.className = 'sky-empty';
      empty.textContent = 'A quiet week. No stars this time.';
      wrap.appendChild(empty);
    }
    return wrap;
  }

  /* ---------- sky views ---------- */
  var skyMode = 'auto', selWeek = null;

  function sampleStars() {
    var texts = ['Reply to emails', 'Go for a walk', 'Finish the report', 'Call a friend', 'Clean the desk', 'Read 20 pages',
      'Pay the bills', 'Plan the week', 'Water the plants', 'Back up photos', 'Book the dentist', 'Cook dinner', 'Stretch', 'Update the resume'];
    var base = Date.now() - 6 * DAY;
    return texts.map(function (tx, i) { return { id: 's' + i, text: tx, at: base + i * 0.4 * DAY }; });
  }

  function renderSky() {
    skyBody.innerHTML = '';
    var cw = currentWeek();

    if (skyMode === 'sample') {
      var banner = document.createElement('div');
      banner.className = 'sky-head';
      banner.innerHTML = '<h2>A sample sky</h2><p>This is what your own stars will look like. These are not your tasks.</p>';
      skyBody.appendChild(banner);
      skyBody.appendChild(buildSky(sampleStars(), 'sample-sky', true));
      var bar = document.createElement('div');
      bar.className = 'sky-banner';
      bar.innerHTML = '<button type="button" class="ghost-btn" data-act="back">Back</button>';
      skyBody.appendChild(bar);
      return;
    }

    if (cw === 0) { renderLocked(); return; }

    if (selWeek === null || selWeek >= cw || selWeek < 0) selWeek = cw - 1;
    var list = starsOfWeek(selWeek);

    var head = document.createElement('div');
    head.className = 'sky-head';
    var h2 = document.createElement('h2');
    h2.textContent = constellationName(selWeek);
    var p = document.createElement('p');
    var s0 = meta.start + selWeek * WEEK, s1 = meta.start + (selWeek + 1) * WEEK - 1;
    p.textContent = 'Week ' + (selWeek + 1) + ', ' + fmtDay(s0) + ' to ' + fmtDay(s1) + '. ' + list.length + (list.length === 1 ? ' star.' : ' stars.');
    head.appendChild(h2); head.appendChild(p);
    skyBody.appendChild(head);

    var tabs = document.createElement('div');
    tabs.className = 'tabs';
    tabs.setAttribute('role', 'tablist');
    for (var w = cw - 1; w >= 0; w--) {
      var tb = document.createElement('button');
      tb.type = 'button';
      tb.className = 'tab' + (w === selWeek ? ' on' : '');
      tb.setAttribute('role', 'tab');
      tb.setAttribute('aria-selected', w === selWeek ? 'true' : 'false');
      tb.dataset.week = w;
      tb.textContent = 'Week ' + (w + 1);
      tabs.appendChild(tb);
    }
    skyBody.appendChild(tabs);

    skyBody.appendChild(buildSky(list, 'week' + selWeek + ':' + meta.start, false));

    var daysLeft = Math.max(1, Math.ceil((meta.start + (cw + 1) * WEEK - Date.now()) / DAY));
    var gathering = starsOfWeek(cw).length;
    var note = document.createElement('p');
    note.className = 'sky-note';
    note.textContent = 'Week ' + (cw + 1) + ' is still gathering (' + gathering + (gathering === 1 ? ' star' : ' stars') +
      ' so far). It opens in ' + daysLeft + (daysLeft === 1 ? ' day.' : ' days.');
    skyBody.appendChild(note);

    if (selWeek === cw - 1 && meta.seen < selWeek) {
      meta.seen = selWeek;
      saveMeta();
      updateSkyBadge();
    }
  }

  function renderLocked() {
    var now = Date.now();
    var dayNum = Math.min(7, Math.floor((now - meta.start) / DAY) + 1);
    var left = Math.max(1, Math.ceil((meta.start + WEEK - now) / DAY));
    var count = stars.length;
    var dots = '';
    for (var d = 1; d <= 7; d++) dots += '<span class="day' + (d < dayNum ? ' on' : '') + (d === dayNum ? ' now' : '') + '"></span>';
    var box = document.createElement('div');
    box.className = 'locked';
    box.innerHTML =
      '<h2>Your first constellation is forming</h2>' +
      '<p>Every task you finish becomes a star. The sky opens once you have been here for 7 days, and then a new constellation appears every week.</p>' +
      '<div class="days" aria-hidden="true">' + dots + '</div>' +
      '<p><span class="strong">Day ' + dayNum + ' of 7.</span> ' + count + (count === 1 ? ' star' : ' stars') + ' gathered so far.<br>It opens in ' + left + (left === 1 ? ' day.' : ' days.') + '</p>' +
      '<button type="button" class="ghost-btn" data-act="sample">See a sample sky</button>';
    skyBody.appendChild(box);
  }

  skyBody.addEventListener('click', function (e) {
    var tab = e.target.closest('.tab');
    if (tab) { selWeek = parseInt(tab.dataset.week, 10); renderSky(); return; }
    var act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'sample') { skyMode = 'sample'; renderSky(); }
    else if (act.dataset.act === 'back') { skyMode = 'auto'; renderSky(); }
  });

  function openSky() {
    setThemePop(false);
    skyMode = 'auto';
    renderSky();
    showLayer(skyEl);
    skyEl.scrollTop = 0;
    skyClose.focus({ preventScroll: true });
  }
  function closeSky() {
    hideLayer(skyEl);
    btnSky.focus({ preventScroll: true });
  }
  btnSky.addEventListener('click', openSky);
  skyClose.addEventListener('click', closeSky);
  skyEl.addEventListener('click', function (e) { if (e.target === skyEl) closeSky(); });

  /* =========================================================
     List rendering
  ========================================================= */
  function createEl(task) {
    var li = document.createElement('li');
    li.className = 'task' + (task.done ? ' done' : '');
    li.dataset.id = task.id;
    li.dataset.dust = dustLevel(task);
    li.innerHTML =
      '<div class="inner"><div class="row">' +
        '<span class="dust" aria-hidden="true"></span>' +
        '<button type="button" class="check" role="checkbox" aria-checked="' + task.done + '" aria-label="Mark as done">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>' +
        '</button>' +
        '<div class="text"><span class="label"></span></div>' +
        '<button type="button" class="dustoff" aria-label="Dust off this task" title="Dust off">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.8 5.5h7.2a2.2 2.2 0 10-2.2-2.2M1.8 8.5h10a2.2 2.2 0 11-2.2 2.2M1.8 11.5h4"/></svg>' +
        '</button>' +
        '<button type="button" class="del" aria-label="Delete task">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>' +
        '</button>' +
      '</div></div>';
    li.querySelector('.label').textContent = task.text;
    return li;
  }

  function animateIn(el) {
    if (reduce || !el) return;
    el.classList.add('entering');
    var end = function (e) {
      if (e.target !== el) return;
      el.classList.remove('entering');
      el.removeEventListener('animationend', end);
    };
    el.addEventListener('animationend', end);
  }

  function leave(el, delay) {
    delay = delay || 0;
    if (!el) return;
    if (reduce) { el.remove(); return; }
    el.style.transitionDelay = delay + 'ms';
    el.classList.add('leaving');
    setTimeout(function () { el.remove(); }, 460 + delay);
  }

  function render() {
    listEl.innerHTML = '';
    tasks.filter(match).forEach(function (t) { listEl.appendChild(createEl(t)); });
    updateUI();
  }

  function updateUI() {
    var total = tasks.length;
    var doneCount = tasks.filter(function (t) { return t.done; }).length;
    var remaining = total - doneCount;

    countEl.textContent = total === 0 ? '' : (remaining === 0 ? 'All done' : remaining + ' left');
    barEl.style.width = (total ? (doneCount / total) * 100 : 0) + '%';
    footEl.classList.toggle('is-hidden', total === 0);
    clearBtn.classList.toggle('is-hidden', doneCount === 0);

    var visible = tasks.filter(match).length;
    if (visible === 0) {
      var msg = total === 0 ? 'Nothing on the list yet. Type a task above and press Enter.'
              : filter === 'open' ? 'Everything is done. Nice work.'
              : 'Nothing finished yet.';
      if (emptyEl.textContent !== msg) emptyEl.textContent = msg;
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;
    }

    Array.prototype.forEach.call(filtersEl.querySelectorAll('button'), function (b) {
      var on = b.dataset.filter === filter;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
    refreshDust();
  }

  function setFilter(f) { filter = f; render(); }

  /* =========================================================
     Actions
  ========================================================= */
  function addTask(text) {
    var task = { id: uid(), text: text, done: false, created: Date.now(), touched: null };
    tasks.unshift(task);
    saveTasks();
    if (!match(task)) setFilter('all');
    else { listEl.prepend(createEl(task)); updateUI(); }
    animateIn(listEl.firstElementChild);
    pulse();
  }

  function toggle(id) {
    var t = findTask(id), el = findEl(id);
    if (!t) return;
    t.done = !t.done;
    t.touched = Date.now();
    saveTasks();

    if (t.done) addStar(t); else removeStar(t.id);

    if (el) {
      el.classList.toggle('done', t.done);
      el.dataset.dust = dustLevel(t);
      var check = el.querySelector('.check');
      check.setAttribute('aria-checked', t.done);
      if (t.done && !reduce) {
        check.classList.remove('pop');
        void check.offsetWidth;
        check.classList.add('pop');
      }
      if (!match(t)) leave(el, 380);
    }
    if (t.done) {
      pulse();
      playCompletion(tasks.length > 0 && openCount() === 0);
    }
    updateUI();
  }

  function removeTask(id) {
    tasks = tasks.filter(function (t) { return t.id !== id; });   // its star (if any) stays in the sky
    saveTasks();
    leave(findEl(id));
    updateUI();
  }

  function clearDone() {
    var doneIds = tasks.filter(function (t) { return t.done; }).map(function (t) { return t.id; });
    tasks = tasks.filter(function (t) { return !t.done; });
    saveTasks();
    doneIds.forEach(function (id, i) { leave(findEl(id), i * 70); });
    updateUI();
  }

  function edit(li) {
    var t = findTask(li.dataset.id);
    var label = li.querySelector('.label');
    if (!t || li.classList.contains('editing')) return;
    li.classList.add('editing');
    label.contentEditable = 'plaintext-only';
    if (label.contentEditable !== 'plaintext-only') label.contentEditable = 'true';
    label.focus();
    var range = document.createRange();
    range.selectNodeContents(label);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    var cancelled = false;
    function finish() {
      label.removeEventListener('keydown', onKey);
      label.removeEventListener('blur', finish);
      label.contentEditable = 'false';
      li.classList.remove('editing');
      var v = cancelled ? t.text : label.textContent.replace(/\s+/g, ' ').trim();
      if (v && v !== t.text) { t.text = v; t.touched = Date.now(); saveTasks(); renameStar(t.id, v); refreshDust(); }
      label.textContent = t.text;
    }
    function onKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); label.blur(); }
      else if (e.key === 'Escape') { cancelled = true; label.blur(); }
    }
    label.addEventListener('keydown', onKey);
    label.addEventListener('blur', finish);
  }

  /* =========================================================
     One-thing mode
  ========================================================= */
  var focusOn = false, focusBusy = false;

  function nextOpen() {
    for (var i = 0; i < tasks.length; i++) if (!tasks[i].done) return tasks[i];
    return null;
  }
  function mk(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function renderFocus() {
    var t = nextOpen();
    fCard.innerHTML = '';
    if (!t) {
      fCard.appendChild(mk('p', 'f-big', 'All clear'));
      fCard.appendChild(mk('p', 'f-sub', 'Nothing left to do right now. Breathe.'));
      var links0 = mk('div', 'f-links');
      links0.style.marginTop = '40px';
      var back0 = mk('button', 'f-link', 'Back to list'); back0.type = 'button'; back0.dataset.act = 'exit';
      links0.appendChild(back0);
      fCard.appendChild(links0);
    } else {
      var open = openCount();
      fCard.appendChild(mk('p', 'f-count', open === 1 ? 'The last one' : open + ' left'));
      fCard.appendChild(mk('h2', 'f-task', t.text));
      var n = ageDays(t);
      if (n >= 2) fCard.appendChild(mk('p', 'f-age', 'This one has been waiting for ' + n + ' days.'));

      var actions = mk('div', 'f-actions');
      var done = mk('button', 'f-done'); done.type = 'button'; done.dataset.act = 'done'; done.setAttribute('aria-label', 'Mark as done');
      done.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.8l4.2 4.2 8.8-10"/></svg>';
      actions.appendChild(done);
      actions.appendChild(mk('span', 'f-hint', 'Press Enter when it is done'));

      var links = mk('div', 'f-links');
      if (open > 1) {
        var later = mk('button', 'f-link', 'Later'); later.type = 'button'; later.dataset.act = 'later';
        links.appendChild(later);
      }
      var back = mk('button', 'f-link', 'Back to list'); back.type = 'button'; back.dataset.act = 'exit';
      links.appendChild(back);
      actions.appendChild(links);
      fCard.appendChild(actions);
    }
    fCard.classList.remove('out', 'in');
    void fCard.offsetWidth;
    fCard.classList.add('in');
  }

  function swapFocusCard() {
    if (reduce) { renderFocus(); focusBusy = false; return; }
    focusBusy = true;
    fCard.classList.remove('in');
    fCard.classList.add('out');
    setTimeout(function () { renderFocus(); focusBusy = false; var d = fCard.querySelector('.f-done'); if (d) d.focus({ preventScroll: true }); }, 400);
  }

  function focusDone() {
    var t = nextOpen();
    if (!t || focusBusy) return;
    toggle(t.id);
    swapFocusCard();
  }
  function focusLater() {
    var t = nextOpen();
    if (!t || focusBusy || openCount() < 2) return;
    tasks.splice(tasks.indexOf(t), 1);
    tasks.push(t);
    saveTasks();
    render();
    swapFocusCard();
  }

  function enterFocus() {
    if (focusOn) return;
    focusOn = true;
    setThemePop(false);
    document.body.classList.add('focus-on');
    stageEl.setAttribute('inert', '');
    btnFocus.setAttribute('aria-pressed', 'true');
    renderFocus();
    showLayer(focusEl);
    var d = fCard.querySelector('.f-done');
    if (d) d.focus({ preventScroll: true });
  }
  function exitFocus() {
    if (!focusOn) return;
    focusOn = false;
    document.body.classList.remove('focus-on');
    stageEl.removeAttribute('inert');
    btnFocus.setAttribute('aria-pressed', 'false');
    hideLayer(focusEl);
  }
  btnFocus.addEventListener('click', function () { focusOn ? exitFocus() : enterFocus(); });
  fCard.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.dataset.act;
    if (act === 'done') focusDone();
    else if (act === 'later') focusLater();
    else if (act === 'exit') exitFocus();
  });

  /* =========================================================
     Events
  ========================================================= */
  input.addEventListener('input', function () {
    field.classList.toggle('has-text', input.value.trim() !== '');
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.isComposing) {
      var text = input.value.replace(/\s+/g, ' ').trim();
      if (!text) {
        if (!reduce && field.animate) {
          field.animate(
            [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
            { duration: 260, easing: 'ease-out' }
          );
        }
        return;
      }
      addTask(text);
      input.value = '';
      field.classList.remove('has-text');
    } else if (e.key === 'Escape') {
      input.value = '';
      field.classList.remove('has-text');
    }
  });

  listEl.addEventListener('click', function (e) {
    var li = e.target.closest('.task');
    if (!li) return;
    if (e.target.closest('.check')) toggle(li.dataset.id);
    else if (e.target.closest('.dustoff')) dustOff(li.dataset.id);
    else if (e.target.closest('.del')) removeTask(li.dataset.id);
  });
  listEl.addEventListener('dblclick', function (e) {
    var li = e.target.closest('.task');
    if (li && e.target.closest('.text')) edit(li);
  });

  filtersEl.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) setFilter(b.dataset.filter);
  });
  clearBtn.addEventListener('click', clearDone);

  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

    if (e.key === 'Escape') {
      if (!skyEl.hidden) { closeSky(); return; }
      if (!themePop.hidden) { setThemePop(false); return; }
      if (focusOn) { exitFocus(); return; }
      return;
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

    if (focusOn && skyEl.hidden) {
      if (e.key === 'Enter' && tag !== 'button') { e.preventDefault(); focusDone(); return; }
      if ((e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') && tag !== 'button') { focusLater(); return; }
    }
    if (e.key === '/' && !focusOn && skyEl.hidden) { e.preventDefault(); input.focus(); }
    else if ((e.key === 'f' || e.key === 'F') && skyEl.hidden) { e.preventDefault(); focusOn ? exitFocus() : enterFocus(); }
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { refreshDust(); updateSkyBadge(); }
  });
  setInterval(function () { refreshDust(); updateSkyBadge(); }, 10 * 60 * 1000);

  /* ---------- pointer light ---------- */
  if (!reduce && window.matchMedia('(pointer: fine)').matches) {
    var tx = window.innerWidth / 2, ty = window.innerHeight / 3, x = tx, y = ty;
    window.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY; spot.style.opacity = 1;
    });
    (function loop() {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      spot.style.transform = 'translate3d(' + (x - 260) + 'px,' + (y - 260) + 'px,0)';
      requestAnimationFrame(loop);
    })();
  }

  /* =========================================================
     Init
  ========================================================= */
  $('#date').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  applyTheme(meta.theme, false);
  applySound();
  render();
  updateSkyBadge();
  if (window.matchMedia('(hover: hover)').matches) input.focus({ preventScroll: true });
})();
