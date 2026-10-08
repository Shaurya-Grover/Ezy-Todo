(function () {
  'use strict';

  var TASKS_KEY = 'aurora-todo-v2';
  var META_KEY = 'aurora-todo-meta-v1';
  var STARS_KEY = 'aurora-todo-stars-v1';
  var LISTS_KEY = 'aurora-todo-lists-v1';
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
  var listsEl = $('#lists');
  var devSwitch = $('#devSwitch'), btnDevSky = $('#btnDevSky');
  var dlg = $('#dlg'), dlgName = $('#dlgName'), dlgCName = $('#dlgCName'), dlgColors = $('#dlgColors'), dlgShapes = $('#dlgShapes');
  var dlgPrev = $('#dlgPrev'), dlgSave = $('#dlgSave'), dlgCancel = $('#dlgCancel'), dlgDelete = $('#dlgDelete'), dlgTitle = $('#dlgTitle');
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
  if (typeof meta.dev !== 'boolean') meta.dev = false;                  // dev mode switch
  function saveMeta() { writeJSON(META_KEY, meta); }
  saveMeta();

  /* ---------- constellation looks ---------- */
  var PALETTES = {
    aurora: { label: 'Aurora' },
    ice:    { label: 'Ice',    c: ['#7cc4ff', '#a8e0ff', '#d4ecff'], line: '124,196,255' },
    rose:   { label: 'Rose',   c: ['#ff6f9c', '#ff9ab8', '#ffc7d8'], line: '255,111,156' },
    gold:   { label: 'Gold',   c: ['#ffc24d', '#ffd98a', '#fff1c9'], line: '255,194,77' },
    mint:   { label: 'Mint',   c: ['#3fd6c6', '#7ee8d9', '#bdf6ee'], line: '63,214,198' },
    violet: { label: 'Violet', c: ['#8b7bff', '#b3a6ff', '#dcd6ff'], line: '139,123,255' }
  };
  var SHAPES = { scatter: 'Scatter', ring: 'Ring', spiral: 'Spiral', wave: 'Wave' };
  var SIZES = ['s', 'm', 'l'];
  var SIZE_NAME = { s: 'small', m: 'medium', l: 'big' };
  var SIZE_R = { s: 3, m: 5.2, l: 8.4 };
  function swatchBg(key) {
    var p = PALETTES[key];
    return p && p.c ? 'linear-gradient(135deg,' + p.c[0] + ',' + p.c[1] + ')' : 'linear-gradient(135deg,var(--a1),var(--a2) 60%,var(--a3))';
  }

  var lists = readJSON(LISTS_KEY, []);
  if (!Array.isArray(lists)) lists = [];
  lists = lists.filter(function (l) { return l && typeof l.id === 'string' && typeof l.name === 'string'; }).map(function (l) {
    return {
      id: l.id, name: l.name,
      cname: typeof l.cname === 'string' ? l.cname : '',
      palette: PALETTES[l.palette] ? l.palette : 'aurora',
      shape: SHAPES[l.shape] ? l.shape : 'scatter'
    };
  });
  if (!lists.length) lists = [{ id: uid(), name: 'My list', cname: '', palette: 'aurora', shape: 'scatter' }];
  function saveLists() { writeJSON(LISTS_KEY, lists); }
  function listById(id) { for (var i = 0; i < lists.length; i++) if (lists[i].id === id) return lists[i]; return null; }
  if (!listById(meta.active)) meta.active = lists[0].id;
  saveLists(); saveMeta();
  function activeList() { return listById(meta.active) || lists[0]; }

  var stars = readJSON(STARS_KEY, []);
  if (!Array.isArray(stars)) stars = [];
  stars = stars.filter(function (x) { return x && typeof x.id === 'string'; }).map(function (x) {
    return {
      id: x.id, text: String(x.text || ''), at: typeof x.at === 'number' ? x.at : Date.now(),
      listId: listById(x.listId) ? x.listId : lists[0].id,
      size: SIZES.indexOf(x.size) >= 0 ? x.size : 'm'
    };
  });
  function saveStars() { writeJSON(STARS_KEY, stars); }

  var tasks = readJSON(TASKS_KEY, []);
  if (!Array.isArray(tasks)) tasks = [];
  tasks = tasks.filter(function (t) { return t && typeof t.text === 'string'; }).map(function (t) {
    return {
      id: t.id || uid(),
      text: t.text,
      done: !!t.done,
      created: typeof t.created === 'number' ? t.created : Date.now(),
      touched: typeof t.touched === 'number' ? t.touched : null,
      listId: listById(t.listId) ? t.listId : lists[0].id,
      size: SIZES.indexOf(t.size) >= 0 ? t.size : 'm'
    };
  });
  function saveTasks() { writeJSON(TASKS_KEY, tasks); }
  saveTasks(); saveStars();

  var filter = 'all';

  /* =========================================================
     Helpers
  ========================================================= */
  function match(t) { return filter === 'all' || (filter === 'open' && !t.done) || (filter === 'done' && t.done); }
  function inList(t) { return t.listId === meta.active; }
  function visibleTasks() { return tasks.filter(function (t) { return inList(t) && match(t); }); }
  function listTasks() { return tasks.filter(inList); }
  function findTask(id) { for (var i = 0; i < tasks.length; i++) if (tasks[i].id === id) return tasks[i]; return null; }
  function findEl(id) { return listEl.querySelector('[data-id="' + id + '"]'); }
  function openCount() { return tasks.filter(function (t) { return inList(t) && !t.done; }).length; }
  function openCountOf(id) { return tasks.filter(function (t) { return t.listId === id && !t.done; }).length; }

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
    stars.push({ id: t.id, text: t.text, at: Date.now(), listId: t.listId, size: t.size });
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
  function resizeStar(id, size) {
    for (var i = 0; i < stars.length; i++) if (stars[i].id === id) { stars[i].size = size; saveStars(); return; }
  }
  function currentWeek() { return Math.max(0, Math.floor((Date.now() - meta.start) / WEEK)); }
  function starsOfWeek(w, listId) {
    return stars.filter(function (s) {
      if (s.listId !== listId) return false;
      var i = Math.floor((s.at - meta.start) / WEEK);
      return Math.max(0, i) === w;
    }).sort(function (a, b) { return a.at - b.at; });
  }
  function starsOfList(listId) {
    return stars.filter(function (s) { return s.listId === listId; }).sort(function (a, b) { return a.at - b.at; });
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
  function constellationName(w, list) {
    if (list && list.cname) return list.cname;
    var h = hashStr('name' + w + ':' + meta.start + ':' + (list ? list.id : ''));
    return 'The ' + ADJ[h % ADJ.length] + ' ' + CRE[(h >>> 5) % CRE.length];
  }

  function shapePoints(n, shape, rng) {
    if (shape === 'scatter' || n < 2) {
      if (n === 1 && shape !== 'scatter') return [{ x: 500, y: 280 }];
      return layoutPoints(n, rng);
    }
    var pts = [], i, off = rng() * Math.PI * 2, last = Math.max(1, n - 1);
    for (i = 0; i < n; i++) {
      if (shape === 'ring') {
        var a = off + (i / n) * Math.PI * 2, j = 1 + (rng() - .5) * .16;
        pts.push({ x: 500 + Math.cos(a) * 340 * j, y: 280 + Math.sin(a) * 195 * j });
      } else if (shape === 'spiral') {
        var turns = Math.min(2.6, .7 + n * .2), t = i / last, ang = off + t * turns * Math.PI * 2, rad = .1 + .9 * t;
        pts.push({ x: 500 + Math.cos(ang) * rad * 410, y: 280 + Math.sin(ang) * rad * 225 });
      } else {                                                  // wave
        pts.push({ x: 90 + i * (820 / last), y: 280 + Math.sin(i * .95 + off) * 130 + (rng() - .5) * 36 });
      }
    }
    return pts;
  }
  function shapeEdges(pts, shape) {
    var n = pts.length, edges = [], i;
    if (shape === 'scatter') return spanningEdges(pts);
    for (i = 0; i < n - 1; i++) edges.push([i, i + 1]);
    if (shape === 'ring' && n > 2) edges.push([n - 1, 0]);
    return edges;
  }

  // items: [{text, at, size}], cfg: {palette, shape}
  function buildSky(items, seedKey, isSample, cfg, still) {
    cfg = cfg || {};
    var shape = SHAPES[cfg.shape] ? cfg.shape : 'scatter';
    var pal = PALETTES[cfg.palette];
    var wrap = document.createElement('div');
    wrap.className = 'sky-wrap' + (still ? ' still' : '');
    if (pal && pal.c) {
      wrap.style.setProperty('--s1', pal.c[0]);
      wrap.style.setProperty('--s2', pal.c[1]);
      wrap.style.setProperty('--s3', pal.c[2]);
      wrap.style.setProperty('--sl', pal.line);
    }
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

    var pts = shapePoints(items.length, shape, rng);
    var edges = shapeEdges(pts, shape);

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
      var s = items[i];
      tipTitle.textContent = s.text.length > 90 ? s.text.slice(0, 89) + '\u2026' : s.text;
      tipWhen.textContent = isSample ? 'Sample star' : 'Finished ' + fmtWhen(s.at) + ' \u00b7 ' + SIZE_NAME[s.size || 'm'] + ' task';
      var r = node.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      var left = r.left + r.width / 2 - wr.left;
      left = Math.max(135, Math.min(wr.width - 135, left));
      tip.style.left = left + 'px';
      tip.style.top = (r.top + r.height / 2 - wr.top - 10) + 'px';
      tip.classList.add('show');
    }
    function hideTip() { tip.classList.remove('show'); }

    items.forEach(function (s, i) {
      var p = pts[i];
      var sz = s.size || 'm';
      var r = SIZE_R[sz] + rng() * 0.8;
      var delay = (0.1 + i * 0.07).toFixed(2) + 's';

      gHalos.appendChild(svgEl('circle', {
        'class': 'halo st-' + (i % 3), cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: (r * (sz === 'l' ? 3.9 : 3.4)).toFixed(1),
        style: 'animation-delay:' + (rng() * 3).toFixed(2) + 's;animation-duration:' + (2.8 + rng() * 2).toFixed(1) + 's'
      }));

      var g = svgEl('g', { transform: 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')' });
      var pop = svgEl('g', { 'class': 'pop', style: 'animation-delay:' + delay });
      if (sz === 'l') {                                   // big tasks get a sparkle cross
        var f = r * 3.1;
        pop.appendChild(svgEl('path', { 'class': 'flare', d: 'M' + (-f).toFixed(1) + ' 0H' + f.toFixed(1) + 'M0 ' + (-f).toFixed(1) + 'V' + f.toFixed(1) }));
      }
      pop.appendChild(svgEl('circle', { 'class': 'core st-' + (i % 3), r: r.toFixed(2) }));
      var hit = svgEl('circle', { 'class': 'hit', r: Math.max(18, r + 10).toFixed(0), tabindex: still ? '-1' : '0', role: 'img', 'aria-label': (isSample ? 'Sample star: ' : 'Finished: ') + s.text });
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

    if (!items.length) {
      var empty = document.createElement('div');
      empty.className = 'sky-empty';
      empty.textContent = isSample ? '' : 'No stars here yet. Finish a task in this list to light one.';
      wrap.appendChild(empty);
    }
    return wrap;
  }

  /* ---------- sky views ---------- */
  var skyMode = 'auto', selWeek = null, skySel = null;

  function sampleStars() {
    var texts = ['Reply to emails', 'Go for a walk', 'Finish the report', 'Call a friend', 'Clean the desk', 'Read 20 pages',
      'Pay the bills', 'Plan the week', 'Water the plants', 'Back up photos', 'Book the dentist', 'Cook dinner', 'Stretch', 'Update the resume'];
    var sizes = ['m', 'l', 's', 'm', 'm', 'l', 's', 'm', 's', 'm', 'l', 's', 'm', 's'];
    var base = Date.now() - 6 * DAY;
    return texts.map(function (tx, i) { return { id: 's' + i, text: tx, at: base + i * 0.4 * DAY, size: sizes[i] }; });
  }
  function previewStars() {
    var sizes = ['m', 's', 'l', 'm', 's', 'm', 'l', 's', 'm'];
    return sizes.map(function (z, i) { return { id: 'p' + i, text: 'Sample task', at: i, size: z }; });
  }

  function skyChips() {
    var box = document.createElement('div');
    box.className = 'sky-chips';
    box.setAttribute('role', 'tablist');
    lists.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (l.id === skySel ? ' on' : '');
      b.dataset.list = l.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', l.id === skySel ? 'true' : 'false');
      var dot = document.createElement('i'); dot.className = 'dot'; dot.style.background = swatchBg(l.palette);
      var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = l.name;
      var n = document.createElement('span'); n.className = 'n'; n.textContent = String(starsOfList(l.id).length);
      b.appendChild(dot); b.appendChild(nm); b.appendChild(n);
      box.appendChild(b);
    });
    return box;
  }

  function renderSky() {
    skyBody.innerHTML = '';
    var cw = currentWeek();
    if (!listById(skySel)) skySel = meta.active;
    var L = listById(skySel);

    if (skyMode === 'sample') {
      var banner = document.createElement('div');
      banner.className = 'sky-head';
      banner.innerHTML = '<h2>A sample sky</h2><p>This is what your own stars will look like. These are not your tasks.</p>';
      skyBody.appendChild(banner);
      skyBody.appendChild(buildSky(sampleStars(), 'sample-sky', true, L));
      var bar = document.createElement('div');
      bar.className = 'sky-banner';
      bar.innerHTML = '<button type="button" class="ghost-btn" data-act="back">Back</button>';
      skyBody.appendChild(bar);
      return;
    }

    if (skyMode === 'dev') {
      var all = starsOfList(L.id);
      var dh = document.createElement('div');
      dh.className = 'sky-head';
      var dh2 = document.createElement('h2');
      dh2.textContent = L.cname || constellationName(0, L);
      var dp = document.createElement('p');
      dp.textContent = 'Dev constellation. Every star so far in "' + L.name + '", ignoring the 7-day lock. ' + all.length + (all.length === 1 ? ' star.' : ' stars.');
      dh.appendChild(dh2); dh.appendChild(dp);
      skyBody.appendChild(dh);
      skyBody.appendChild(skyChips());
      skyBody.appendChild(buildSky(all, 'dev:' + L.id + ':' + all.length, false, L));
      return;
    }

    if (cw === 0) { renderLocked(); return; }

    if (selWeek === null || selWeek >= cw || selWeek < 0) selWeek = cw - 1;
    var items = starsOfWeek(selWeek, L.id);

    var head = document.createElement('div');
    head.className = 'sky-head';
    var h2 = document.createElement('h2');
    h2.textContent = constellationName(selWeek, L);
    var p = document.createElement('p');
    var s0 = meta.start + selWeek * WEEK, s1 = meta.start + (selWeek + 1) * WEEK - 1;
    p.textContent = L.name + '. Week ' + (selWeek + 1) + ', ' + fmtDay(s0) + ' to ' + fmtDay(s1) + '. ' + items.length + (items.length === 1 ? ' star.' : ' stars.');
    head.appendChild(h2); head.appendChild(p);
    skyBody.appendChild(head);

    skyBody.appendChild(skyChips());

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

    skyBody.appendChild(buildSky(items, 'week' + selWeek + ':' + L.id + ':' + meta.start, false, L));

    var daysLeft = Math.max(1, Math.ceil((meta.start + (cw + 1) * WEEK - Date.now()) / DAY));
    var gathering = starsOfWeek(cw, L.id).length;
    var note = document.createElement('p');
    note.className = 'sky-note';
    note.textContent = 'Week ' + (cw + 1) + ' is still gathering (' + gathering + (gathering === 1 ? ' star' : ' stars') +
      ' so far in this list). It opens in ' + daysLeft + (daysLeft === 1 ? ' day.' : ' days.');
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
      '<h2>Your first constellations are forming</h2>' +
      '<p>Every task you finish becomes a star in its list\'s constellation. The sky opens once you have been here for 7 days, and then a new constellation appears every week.</p>' +
      '<div class="days" aria-hidden="true">' + dots + '</div>' +
      '<p><span class="strong">Day ' + dayNum + ' of 7.</span> ' + count + (count === 1 ? ' star' : ' stars') + ' gathered so far.<br>It opens in ' + left + (left === 1 ? ' day.' : ' days.') + '</p>' +
      '<button type="button" class="ghost-btn" data-act="sample">See a sample sky</button>';
    skyBody.appendChild(box);
  }

  skyBody.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (chip) { skySel = chip.dataset.list; selWeek = null; renderSky(); return; }
    var tab = e.target.closest('.tab');
    if (tab) { selWeek = parseInt(tab.dataset.week, 10); renderSky(); return; }
    var act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'sample') { skyMode = 'sample'; renderSky(); }
    else if (act.dataset.act === 'back') { skyMode = 'auto'; renderSky(); }
  });

  function openSky(mode) {
    setThemePop(false);
    skyMode = mode === 'dev' ? 'dev' : 'auto';
    skySel = meta.active;
    selWeek = null;
    renderSky();
    showLayer(skyEl);
    skyEl.scrollTop = 0;
    skyClose.focus({ preventScroll: true });
  }
  function closeSky() {
    hideLayer(skyEl);
    (skyMode === 'dev' && !btnDevSky.hidden ? btnDevSky : btnSky).focus({ preventScroll: true });
  }
  btnSky.addEventListener('click', function () { openSky('auto'); });
  btnDevSky.addEventListener('click', function () { openSky('dev'); });
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
        '<button type="button" class="grip" aria-label="Drag to reorder. Or use the up and down arrow keys." title="Drag to reorder">' +
          '<svg viewBox="0 0 12 18" aria-hidden="true"><circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/><circle cx="3" cy="9" r="1.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="3" cy="15" r="1.5"/><circle cx="9" cy="15" r="1.5"/></svg>' +
        '</button>' +
        '<button type="button" class="check" role="checkbox" aria-checked="' + task.done + '" aria-label="Mark as done">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>' +
        '</button>' +
        '<div class="text"><span class="label"></span></div>' +
        '<button type="button" class="sizebtn" data-size="' + task.size + '" aria-label="Star size">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.6 7.1.7-5.4 4.8 1.6 7L12 17.9 5.8 21.6l1.6-7L2 9.8l7.1-.7z"/></svg>' +
        '</button>' +
        '<button type="button" class="dustoff" aria-label="Dust off this task" title="Dust off">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.8 5.5h7.2a2.2 2.2 0 10-2.2-2.2M1.8 8.5h10a2.2 2.2 0 11-2.2 2.2M1.8 11.5h4"/></svg>' +
        '</button>' +
        '<button type="button" class="del" aria-label="Delete task">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>' +
        '</button>' +
      '</div></div>';
    li.querySelector('.label').textContent = task.text;
    setSizeUI(li.querySelector('.sizebtn'), task.size);
    return li;
  }

  function setSizeUI(btn, size) {
    if (!btn) return;
    btn.dataset.size = size;
    var msg = 'Star size: ' + SIZE_NAME[size] + '. Click to change. Bigger tasks make bigger stars.';
    btn.title = msg;
    btn.setAttribute('aria-label', msg);
  }
  function cycleSize(id) {
    var t = findTask(id);
    if (!t) return;
    t.size = SIZES[(SIZES.indexOf(t.size) + 1) % SIZES.length];
    saveTasks();
    resizeStar(t.id, t.size);
    var el = findEl(id);
    if (el) setSizeUI(el.querySelector('.sizebtn'), t.size);
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
    visibleTasks().forEach(function (t) { listEl.appendChild(createEl(t)); });
    updateUI();
  }

  function updateUI() {
    var mine = listTasks();
    var total = mine.length;
    var doneCount = mine.filter(function (t) { return t.done; }).length;
    var remaining = total - doneCount;

    countEl.textContent = total === 0 ? '' : (remaining === 0 ? 'All done' : remaining + ' left');
    barEl.style.width = (total ? (doneCount / total) * 100 : 0) + '%';
    footEl.classList.toggle('is-hidden', total === 0);
    clearBtn.classList.toggle('is-hidden', doneCount === 0);

    var visible = visibleTasks().length;
    if (visible === 0) {
      var msg = total === 0 ? 'Nothing in "' + activeList().name + '" yet. Type a task above and press Enter.'
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
    refreshChipCounts();
  }

  function setFilter(f) { filter = f; render(); }

  /* =========================================================
     Actions
  ========================================================= */
  function addTask(text) {
    var task = { id: uid(), text: text, done: false, created: Date.now(), touched: null, listId: meta.active, size: 'm' };
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
      playCompletion(listTasks().length > 0 && openCount() === 0);
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
    var doneIds = tasks.filter(function (t) { return inList(t) && t.done; }).map(function (t) { return t.id; });
    tasks = tasks.filter(function (t) { return !(inList(t) && t.done); });
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
    for (var i = 0; i < tasks.length; i++) if (inList(tasks[i]) && !tasks[i].done) return tasks[i];
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
      fCard.appendChild(mk('p', 'f-count', activeList().name + '  \u00b7  ' + (open === 1 ? 'the last one' : open + ' left')));
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
    else if (e.target.closest('.sizebtn')) cycleSize(li.dataset.id);
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
      if (drag && drag.active && !drag.settling) { endDrag(false); return; }
      if (!dlg.hidden) { closeDlg(); return; }
      if (!skyEl.hidden) { closeSky(); return; }
      if (!themePop.hidden) { setThemePop(false); return; }
      if (focusOn) { exitFocus(); return; }
      return;
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || !dlg.hidden) return;

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
     Drag to reorder (the order IS the priority)
  ========================================================= */
  var drag = null;

  function dragItems() {
    return Array.prototype.filter.call(listEl.children, function (el) {
      return el.classList.contains('task') && !el.classList.contains('leaving');
    });
  }
  function commitOrder(ids) {                              // ids = new order of the tasks currently shown
    var slots = [], byId = {};
    tasks.forEach(function (t, i) { byId[t.id] = t; if (inList(t) && match(t)) slots.push(i); });
    var next = tasks.slice();
    ids.forEach(function (id, k) { if (byId[id] && slots[k] !== undefined) next[slots[k]] = byId[id]; });
    tasks = next;
    saveTasks();
  }

  listEl.addEventListener('pointerdown', function (e) {
    if (drag || (e.button !== undefined && e.button > 0)) return;
    var li = e.target.closest('.task');
    if (!li || li.classList.contains('editing') || li.classList.contains('leaving')) return;
    if (e.target.closest('.check, .del, .dustoff, .sizebtn')) return;
    var grip = e.target.closest('.grip');
    if (!grip && !(e.target.closest('.text') && e.pointerType !== 'touch')) return;
    drag = { li: li, id: li.dataset.id, sx: e.clientX, sy: e.clientY, cy: e.clientY, scroll0: window.scrollY, pid: e.pointerId, active: false, settling: false };
    document.addEventListener('pointermove', onDragMove, { passive: false });
    document.addEventListener('pointerup', onDragUp);
    document.addEventListener('pointercancel', onDragCancel);
  });

  function onDragMove(e) {
    var d = drag;
    if (!d || d.settling || e.pointerId !== d.pid) return;
    d.cy = e.clientY;
    if (!d.active) {
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 5) return;
      beginDrag(d);
      if (!d.active) return;
    }
    e.preventDefault();
    updateDrag();
  }
  function onDragUp(e) { if (drag && e.pointerId === drag.pid && !drag.settling) endDrag(true); }
  function onDragCancel(e) { if (drag && e.pointerId === drag.pid && !drag.settling) endDrag(false); }

  function beginDrag(d) {
    d.items = dragItems();
    d.from = d.items.indexOf(d.li);
    if (d.from < 0) { endDrag(false); return; }
    d.rects = d.items.map(function (el) {
      var r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY, h: r.height };
    });
    d.h = d.rects[d.from].h;
    d.to = d.from;
    d.active = true;
    d.items.forEach(function (el) { if (el !== d.li) el.classList.add('sib'); });
    d.li.classList.add('dragging');
    document.body.classList.add('is-dragging');
    d.raf = requestAnimationFrame(autoScroll);
  }

  function updateDrag() {
    var d = drag;
    var dy = (d.cy + window.scrollY) - (d.sy + d.scroll0);
    var first = d.rects[0], last = d.rects[d.rects.length - 1], me = d.rects[d.from];
    dy = Math.max(first.top - me.top, Math.min(last.top + last.h - d.h - me.top, dy));
    d.li.style.transform = 'translate3d(0,' + dy + 'px,0)';
    var center = me.top + d.h / 2 + dy, to = 0;
    d.rects.forEach(function (r, i) { if (i !== d.from && center > r.top + r.h / 2) to++; });
    if (dy >= last.top + last.h - d.h - me.top - 1) to = d.rects.length - 1;     // dragged to the very bottom
    else if (dy <= first.top - me.top + 1) to = 0;                                // dragged to the very top
    if (to !== d.to) {
      d.to = to;
      d.items.forEach(function (el, i) {
        if (i === d.from) return;
        var shift = 0;
        if (i < d.from && i >= to) shift = d.h;
        else if (i > d.from && i <= to) shift = -d.h;
        el.style.transform = shift ? 'translate3d(0,' + shift + 'px,0)' : '';
      });
    }
  }

  function autoScroll() {
    var d = drag;
    if (!d || !d.active || d.settling) return;
    var vh = window.innerHeight, edge = 80, v = 0;
    if (d.cy < edge) v = -Math.min(18, Math.ceil((edge - d.cy) / 5));
    else if (d.cy > vh - edge) v = Math.min(18, Math.ceil((d.cy - (vh - edge)) / 5));
    if (v) { window.scrollBy(0, v); updateDrag(); }
    d.raf = requestAnimationFrame(autoScroll);
  }

  function endDrag(commit) {
    var d = drag;
    if (!d) return;
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragUp);
    document.removeEventListener('pointercancel', onDragCancel);
    if (!d.active) { drag = null; return; }
    cancelAnimationFrame(d.raf);
    d.settling = true;
    var to = commit ? d.to : d.from, me = d.rects[d.from], newTop;
    if (to > d.from) newTop = d.rects[to].top + d.rects[to].h - d.h;
    else if (to < d.from) newTop = d.rects[to].top;
    else newTop = me.top;
    d.li.style.transition = 'transform .24s cubic-bezier(.22,1,.36,1)';
    d.li.style.transform = 'translate3d(0,' + (newTop - me.top) + 'px,0)';
    if (to === d.from) d.items.forEach(function (el) { if (el !== d.li) el.style.transform = ''; });
    setTimeout(function () {
      var ids = d.items.map(function (el) { return el.dataset.id; });
      d.items.forEach(function (el) { el.classList.remove('sib', 'dragging'); el.style.transform = ''; el.style.transition = ''; });
      document.body.classList.remove('is-dragging');
      if (to !== d.from) {
        ids.splice(d.from, 1);
        ids.splice(to, 0, d.id);
        commitOrder(ids);
        render();
        var moved = findEl(d.id);
        if (moved) { moved.classList.add('dropped'); setTimeout(function () { moved.classList.remove('dropped'); }, 1000); }
      }
      drag = null;
    }, 250);
  }

  // keyboard: focus the handle, then use the up and down arrows
  listEl.addEventListener('keydown', function (e) {
    if (!e.target.closest || !e.target.closest('.grip')) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    var li = e.target.closest('.task');
    var items = dragItems(), i = items.indexOf(li), j = i + (e.key === 'ArrowUp' ? -1 : 1);
    if (i < 0 || j < 0 || j >= items.length) return;
    e.preventDefault();
    var ids = items.map(function (el) { return el.dataset.id; });
    var tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
    commitOrder(ids);
    render();
    var g = findEl(li.dataset.id);
    if (g) g.querySelector('.grip').focus({ preventScroll: true });
  });

  /* =========================================================
     Lists (each one has its own constellation)
  ========================================================= */
  function renderLists() {
    listsEl.innerHTML = '';
    lists.forEach(function (l) {
      var b = mk('button', 'chip' + (l.id === meta.active ? ' on' : ''));
      b.type = 'button';
      b.dataset.list = l.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', l.id === meta.active ? 'true' : 'false');
      var dot = mk('i', 'dot'); dot.style.background = swatchBg(l.palette);
      b.appendChild(dot);
      b.appendChild(mk('span', 'nm', l.name));
      b.appendChild(mk('span', 'n'));
      listsEl.appendChild(b);
    });
    var add = mk('button', 'chip-ico'); add.type = 'button'; add.dataset.act = 'add'; add.title = 'New list'; add.setAttribute('aria-label', 'New list');
    add.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>';
    var ed = mk('button', 'chip-ico plain'); ed.type = 'button'; ed.dataset.act = 'edit'; ed.title = 'Edit this list and its constellation'; ed.setAttribute('aria-label', 'Edit this list and its constellation');
    ed.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 13.5l.7-3L10.8 3a1.6 1.6 0 012.2 2.2L5.5 12.8z M9.6 4.3l2.1 2.1"/></svg>';
    listsEl.appendChild(add);
    listsEl.appendChild(ed);
    refreshChipCounts();
  }
  function refreshChipCounts() {
    Array.prototype.forEach.call(listsEl.querySelectorAll('.chip'), function (b) {
      var n = openCountOf(b.dataset.list), el = b.querySelector('.n');
      if (!el) return;
      el.textContent = n ? String(n) : '';
      el.hidden = !n;
    });
  }
  function selectList(id) {
    if (!listById(id) || id === meta.active) return;
    meta.active = id;
    saveMeta();
    renderLists();
    render();
    listEl.classList.remove('swap');
    void listEl.offsetWidth;
    listEl.classList.add('swap');
  }
  listsEl.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (chip) { selectList(chip.dataset.list); return; }
    var b = e.target.closest('[data-act]');
    if (!b) return;
    openDlg(b.dataset.act === 'edit' ? 'edit' : 'new');
  });

  /* ---------- new / edit list dialog ---------- */
  var dlgState = null;

  function buildDlgOptions() {
    dlgColors.innerHTML = '';
    Object.keys(PALETTES).forEach(function (k) {
      var b = mk('button', 'swatch'); b.type = 'button'; b.dataset.palette = k;
      b.style.background = swatchBg(k); b.title = PALETTES[k].label;
      b.setAttribute('role', 'radio'); b.setAttribute('aria-label', PALETTES[k].label);
      dlgColors.appendChild(b);
    });
    dlgShapes.innerHTML = '';
    Object.keys(SHAPES).forEach(function (k) {
      var b = mk('button', 'shape', SHAPES[k]); b.type = 'button'; b.dataset.shape = k;
      b.setAttribute('role', 'radio');
      dlgShapes.appendChild(b);
    });
  }
  function syncDlgOptions() {
    Array.prototype.forEach.call(dlgColors.children, function (b) { b.setAttribute('aria-checked', b.dataset.palette === dlgState.palette ? 'true' : 'false'); });
    Array.prototype.forEach.call(dlgShapes.children, function (b) { b.setAttribute('aria-checked', b.dataset.shape === dlgState.shape ? 'true' : 'false'); });
    dlgPrev.innerHTML = '';
    dlgPrev.appendChild(buildSky(previewStars(), 'preview:' + dlgState.shape, true, { palette: dlgState.palette, shape: dlgState.shape }, true));
  }
  dlgColors.addEventListener('click', function (e) {
    var b = e.target.closest('.swatch'); if (!b || !dlgState) return;
    dlgState.palette = b.dataset.palette; syncDlgOptions();
  });
  dlgShapes.addEventListener('click', function (e) {
    var b = e.target.closest('.shape'); if (!b || !dlgState) return;
    dlgState.shape = b.dataset.shape; syncDlgOptions();
  });

  function openDlg(mode) {
    var l = mode === 'edit' ? activeList() : { id: null, name: '', cname: '', palette: 'aurora', shape: 'scatter' };
    dlgState = { mode: mode, id: l.id, palette: l.palette, shape: l.shape };
    dlgTitle.textContent = mode === 'edit' ? 'Edit list' : 'New list';
    dlgSave.textContent = mode === 'edit' ? 'Save' : 'Create';
    dlgName.value = l.name;
    dlgCName.value = l.cname || '';
    dlgDelete.hidden = !(mode === 'edit' && lists.length > 1);
    dlgDelete.textContent = 'Delete list';
    dlgDelete.classList.remove('armed');
    setThemePop(false);
    syncDlgOptions();
    showLayer(dlg);
    dlgName.focus({ preventScroll: true });
    if (mode === 'edit') dlgName.select();
  }
  function closeDlg() {
    hideLayer(dlg);
    dlgState = null;
    input.focus({ preventScroll: true });
  }
  function saveDlg() {
    if (!dlgState) return;
    var name = dlgName.value.replace(/\s+/g, ' ').trim();
    if (!name) {
      dlgName.focus();
      if (!reduce && dlgName.animate) dlgName.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260, easing: 'ease-out' });
      return;
    }
    var cname = dlgCName.value.replace(/\s+/g, ' ').trim();
    if (dlgState.mode === 'edit') {
      var l = activeList();
      l.name = name; l.cname = cname; l.palette = dlgState.palette; l.shape = dlgState.shape;
    } else {
      var nl = { id: uid(), name: name, cname: cname, palette: dlgState.palette, shape: dlgState.shape };
      lists.push(nl);
      meta.active = nl.id;
      saveMeta();
    }
    saveLists();
    renderLists();
    render();
    pulse();
    closeDlg();
  }
  function deleteActiveList() {
    var id = meta.active;
    if (lists.length < 2) return;
    tasks = tasks.filter(function (t) { return t.listId !== id; });
    stars = stars.filter(function (x) { return x.listId !== id; });
    lists = lists.filter(function (l) { return l.id !== id; });
    meta.active = lists[0].id;
    saveTasks(); saveStars(); saveLists(); saveMeta();
    renderLists();
    render();
    closeDlg();
  }
  dlgSave.addEventListener('click', saveDlg);
  dlgCancel.addEventListener('click', closeDlg);
  dlgDelete.addEventListener('click', function () {
    if (!dlgDelete.classList.contains('armed')) {
      dlgDelete.classList.add('armed');
      dlgDelete.textContent = 'Tap again to delete this list, its tasks and its stars';
      return;
    }
    deleteActiveList();
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDlg(); });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !e.isComposing) { e.preventDefault(); saveDlg(); }
  });
  buildDlgOptions();

  /* =========================================================
     Dev mode
  ========================================================= */
  function applyDev() {
    devSwitch.setAttribute('aria-checked', meta.dev ? 'true' : 'false');
    btnDevSky.hidden = !meta.dev;
    document.body.classList.toggle('dev-on', meta.dev);
  }
  devSwitch.addEventListener('click', function () {
    meta.dev = !meta.dev;
    saveMeta();
    applyDev();
  });

  /* =========================================================
     Init
  ========================================================= */
  $('#date').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  applyTheme(meta.theme, false);
  applySound();
  applyDev();
  renderLists();
  render();
  updateSkyBadge();
  if (window.matchMedia('(hover: hover)').matches) input.focus({ preventScroll: true });
})();
