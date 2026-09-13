/* ==========================================================================
   samuelwesleymondal.com — site behaviour.
   All content lives in the HTML; this file only wires it up.
   Sections: helpers · theme · nav · menu · reveal · case studies · VAWT plot ·
   project filter · timeline · lightbox · command palette · contact · misc
   ========================================================================== */
(function () {
  'use strict';

  const doc = document, root = doc.documentElement;
  const $ = (s, c) => (c || doc).querySelector(s);
  const $$ = (s, c) => Array.from((c || doc).querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  const EMAIL = 'samwes22522@gmail.com';
  const EMAIL_COLLEGE = 'samuelwesley.mondal2@mail.dcu.ie';
  const LINKEDIN = 'https://www.linkedin.com/in/samuel-wesley-mondal/';
  const INSTAGRAM = 'https://www.instagram.com/samwes22522';

  /* ---------- helpers ---------- */
  const toastEl = $('#toast');
  let toastTimer = 0;
  function toast(msg) {
    if (!toastEl) return;
    $('span', toastEl).textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }
  function scrollToId(id) {
    const el = doc.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', '#' + id);
  }
  function flash(el) {
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1700);
  }
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = doc.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      doc.body.appendChild(ta); ta.select();
      try { doc.execCommand('copy'); } catch (err) { /* ignore */ }
      ta.remove();
    }
    toast('Copied ' + text);
  }

  /* ---------- theme ---------- */
  const themeMeta = $('meta[name="theme-color"]');
  function syncTheme() {
    const light = root.dataset.theme === 'light';
    $$('[data-theme-toggle]').forEach((b) => {
      b.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    });
    if (themeMeta) themeMeta.setAttribute('content', light ? '#f4f1ec' : '#0a0a0b');
  }
  function toggleTheme() {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
    syncTheme();
    toast(next === 'light' ? 'Light theme' : 'Dark theme');
  }
  $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); toggleTheme(); }));
  syncTheme();

  /* ---------- nav: stuck state, progress bar, scroll-spy, to-top ---------- */
  const nav = $('#nav');
  const bar = $('.progress span');
  const toTop = $('[data-to-top]');
  let ticking = false;
  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    const max = doc.documentElement.scrollHeight - window.innerHeight;
    nav.classList.toggle('stuck', y > 24);
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    if (toTop) toTop.classList.toggle('show', y > window.innerHeight * 1.2);
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });

  const spyLinks = $$('.nav-links a[href^="#"]');
  const spyTargets = spyLinks.map((a) => doc.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if ('IntersectionObserver' in window && spyTargets.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        spyLinks.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + en.target.id)));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    spyTargets.forEach((t) => spy.observe(t));
    // clear the highlight when back in the hero
    const heroEl = $('#top');
    if (heroEl) new IntersectionObserver((es) => { if (es[0].isIntersecting) spyLinks.forEach((a) => a.setAttribute('aria-current', 'false')); }, { rootMargin: '-45% 0px -50% 0px' }).observe(heroEl);
  }

  /* ---------- mobile menu ---------- */
  const menu = $('#menu');
  $$('[data-menu-open]').forEach((b) => b.addEventListener('click', () => menu && menu.showModal()));
  $$('[data-menu-close]').forEach((b) => b.addEventListener('click', () => menu && menu.close()));

  /* in-page anchors inside any open dialog: close the dialog first, then scroll */
  doc.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.dataset.case !== undefined || a.hasAttribute('data-palette-open') || a.hasAttribute('data-theme-toggle')) return;
    const id = a.getAttribute('href').slice(1);
    const dlg = a.closest('dialog[open]');
    if (!dlg || !id) return;
    const target = doc.getElementById(id);
    if (!target || dlg.contains(target)) return;
    e.preventDefault();
    if (dlg.classList.contains('case')) closeCases(true); else dlg.close();
    requestAnimationFrame(() => scrollToId(id));
  });

  /* ---------- reveal on scroll ---------- */
  const reveals = $$('.rv');
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  /* ---------- case studies ---------- */
  const cases = $$('dialog.case');
  const caseIds = cases.map((d) => d.id);
  let pushed = false;                        // did opening a case add a history entry?

  function buildCaseFoot(dlg, i) {
    const foot = $('.case-foot', dlg);
    if (!foot) return;
    const prev = cases[(i - 1 + cases.length) % cases.length];
    const next = cases[(i + 1) % cases.length];
    foot.innerHTML = '';
    [['Previous', prev], ['Next', next]].forEach(([label, d]) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span class="mono">${label} case study</span><strong></strong>`;
      $('strong', b).textContent = d.dataset.title;
      b.addEventListener('click', () => openCase(d.id));
      foot.appendChild(b);
    });
  }
  cases.forEach(buildCaseFoot);

  function openCase(id, opts) {
    const push = !opts || opts.push !== false;
    const dlg = doc.getElementById(id);
    if (!dlg) return;
    cases.forEach((d) => { if (d.open && d !== dlg) { d.dataset.silent = '1'; d.close(); } });
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    if (push && location.hash.slice(1) !== id) {
      if (pushed) history.replaceState({ case: id }, '', '#' + id);
      else { history.pushState({ case: id }, '', '#' + id); pushed = true; }
    }
    const aoa = $('[data-aoa]', dlg);
    if (aoa && aoa._draw) aoa._draw();
  }
  function closeCases(keepHistory) {
    if (keepHistory) pushed = false;
    cases.forEach((d) => { if (d.open) { d.dataset.silent = '1'; d.close(); } });
  }
  cases.forEach((dlg, i) => {
    dlg.addEventListener('close', () => {
      if (dlg.dataset.silent) { delete dlg.dataset.silent; return; }
      if (pushed) { pushed = false; history.back(); }
      else if (location.hash === '#' + dlg.id) history.replaceState(null, '', location.pathname + location.search);
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    $('[data-case-close]', dlg).addEventListener('click', () => dlg.close());
    $('[data-case-prev]', dlg).addEventListener('click', () => openCase(cases[(i - 1 + cases.length) % cases.length].id));
    $('[data-case-next]', dlg).addEventListener('click', () => openCase(cases[(i + 1) % cases.length].id));
    dlg.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight' && e.altKey) openCase(cases[(i + 1) % cases.length].id);
      if (e.key === 'ArrowLeft' && e.altKey) openCase(cases[(i - 1 + cases.length) % cases.length].id);
    });
  });
  doc.addEventListener('click', (e) => {
    const t = e.target.closest('[data-case]');
    if (!t) return;
    e.preventDefault();
    openCase('case-' + t.dataset.case);
  });
  window.addEventListener('popstate', () => {
    const h = location.hash.slice(1);
    pushed = false;
    if (caseIds.includes(h)) openCase(h, { push: false });
    else closeCases();
  });
  if (caseIds.includes(location.hash.slice(1))) openCase(location.hash.slice(1), { push: false });

  /* ---------- VAWT: blade angle of attack vs azimuth ---------- */
  $$('[data-aoa]').forEach((fig) => {
    const svg = $('svg', fig), input = $('input', fig), out = $('output', fig);
    const NS = 'http://www.w3.org/2000/svg';
    const Wv = 640, Hv = 250, L = 46, Rm = 14, T = 12, Bm = 32, YM = 45, STALL = 13;
    const px = (th) => L + (th / 360) * (Wv - L - Rm);
    const py = (a) => T + ((YM - a) / (2 * YM)) * (Hv - T - Bm);
    const el = (tag, attrs, parent) => {
      const n = doc.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      (parent || svg).appendChild(n);
      return n;
    };
    el('rect', { class: 'band', x: L, y: py(STALL), width: Wv - L - Rm, height: py(-STALL) - py(STALL) });
    [-45, -30, -15, 0, 15, 30, 45].forEach((a) => {
      el('line', { class: a === 0 ? 'axl' : 'gl', x1: L, x2: Wv - Rm, y1: py(a), y2: py(a) });
      el('text', { x: L - 8, y: py(a) + 3, 'text-anchor': 'end' }).textContent = (a > 0 ? '+' : a < 0 ? '−' : '') + Math.abs(a) + '°';
    });
    [0, 90, 180, 270, 360].forEach((th) => {
      el('line', { class: 'gl', x1: px(th), x2: px(th), y1: T, y2: Hv - Bm });
      el('text', { x: px(th), y: Hv - Bm + 16, 'text-anchor': 'middle' }).textContent = th + '°';
    });
    el('text', { x: Wv - Rm, y: Hv - 4, 'text-anchor': 'end' }).textContent = 'azimuth θ';
    el('text', { x: L + 6, y: T + 11 }).textContent = 'α';
    el('text', { x: Wv - Rm - 4, y: py(STALL) - 5, 'text-anchor': 'end' }).textContent = 'static stall ±13°';
    const curve = el('path', { class: 'curve' });
    const hair = el('line', { class: 'hair', y1: T, y2: Hv - Bm, opacity: 0 });
    const dot = el('circle', { class: 'pt', r: 4.5, opacity: 0 });
    const tip = el('text', { x: 0, y: T + 12, opacity: 0 });
    const peakEl = $('[data-aoa-peak]', fig), stallEl = $('[data-aoa-stall]', fig), wEl = $('[data-aoa-w]', fig);
    const aoa = (th, lam) => Math.atan2(Math.sin(th * Math.PI / 180), lam + Math.cos(th * Math.PI / 180)) * 180 / Math.PI;

    function draw() {
      const lam = +input.value;
      out.textContent = lam.toFixed(1);
      input.style.setProperty('--fill', ((lam - input.min) / (input.max - input.min)) * 100 + '%');
      let d = '', over = 0, n = 0;
      for (let th = 0; th <= 360; th += 2) {
        const a = aoa(th, lam);
        d += (th ? 'L' : 'M') + px(th).toFixed(1) + ' ' + py(Math.max(-YM, Math.min(YM, a))).toFixed(1);
        if (th < 360) { n++; if (Math.abs(a) > STALL) over++; }
      }
      curve.setAttribute('d', d);
      peakEl.textContent = '±' + (Math.asin(1 / lam) * 180 / Math.PI).toFixed(1) + '°';
      stallEl.textContent = Math.round((over / n) * 100) + '%';
      wEl.textContent = (lam - 1).toFixed(1) + ' to ' + (lam + 1).toFixed(1);
    }
    function hover(e) {
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * Wv;
      const th = Math.max(0, Math.min(360, ((x - L) / (Wv - L - Rm)) * 360));
      const a = aoa(th, +input.value);
      const X = px(th), Y = py(Math.max(-YM, Math.min(YM, a)));
      hair.setAttribute('x1', X); hair.setAttribute('x2', X); hair.setAttribute('opacity', 1);
      dot.setAttribute('cx', X); dot.setAttribute('cy', Y); dot.setAttribute('opacity', 1);
      tip.setAttribute('x', X > Wv / 2 ? X - 8 : X + 8);
      tip.setAttribute('text-anchor', X > Wv / 2 ? 'end' : 'start');
      tip.setAttribute('opacity', 1);
      tip.textContent = `θ ${th.toFixed(0)}°  α ${a >= 0 ? '+' : '−'}${Math.abs(a).toFixed(1)}°`;
    }
    svg.addEventListener('pointermove', hover);
    svg.addEventListener('pointerleave', () => [hair, dot, tip].forEach((n) => n.setAttribute('opacity', 0)));
    input.addEventListener('input', draw);
    fig._draw = draw;
    draw();
  });

  /* ---------- project index: filter, counts, sort ---------- */
  const grid = $('#proj-grid');
  if (grid) {
    const items = $$('.proj', grid);
    const chips = $$('[data-filter]');
    const countEl = $('#proj-count');
    const sortBtn = $('#proj-sort');
    const cats = (it) => it.dataset.cat.split(/\s+/);
    let current = 'all', newest = true;
    let empty = null;

    chips.forEach((c) => {
      const f = c.dataset.filter;
      const n = f === 'all' ? items.length : items.filter((it) => cats(it).includes(f)).length;
      const nEl = $('.n', c);
      if (nEl) nEl.textContent = n;
    });

    function apply(f, animate) {
      current = f;
      let shown = 0;
      items.forEach((it) => {
        const show = f === 'all' || cats(it).includes(f);
        it.hidden = !show;
        if (show) {
          shown++;
          it.classList.add('in');
          if (animate && !reduce) { it.classList.remove('pop'); void it.offsetWidth; it.classList.add('pop'); }
        }
      });
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === f)));
      if (countEl) countEl.textContent = `Showing ${shown} of ${items.length}`;
      if (!shown) {
        if (!empty) { empty = doc.createElement('li'); empty.className = 'empty'; empty.textContent = 'Nothing in this category yet.'; }
        grid.appendChild(empty);
      } else if (empty) empty.remove();
    }
    chips.forEach((c) => c.addEventListener('click', () => apply(c.dataset.filter, true)));
    if (sortBtn) sortBtn.addEventListener('click', () => {
      newest = !newest;
      items.slice().sort((a, b) => (newest ? -1 : 1) * (a.dataset.start - b.dataset.start)).forEach((it) => grid.appendChild(it));
      sortBtn.textContent = newest ? 'Newest first' : 'Oldest first';
      sortBtn.setAttribute('aria-label', 'Sort order: ' + sortBtn.textContent.toLowerCase());
      apply(current, true);
    });
    apply('all', false);
    grid._showAll = () => { if (current !== 'all') apply('all', false); };
  }

  /* ---------- experience timeline ---------- */
  const gantt = $('#gantt');
  if (gantt) {
    const now = new Date();
    const dec = now.getFullYear() + (now.getMonth() + now.getDate() / 31) / 12;
    gantt.style.setProperty('--now', dec.toFixed(3));
    $$('.g-row[data-ongoing]', gantt).forEach((r) => { r.style.setProperty('--to', dec.toFixed(3)); r.classList.add('ongoing'); });
    if (reduce || !('IntersectionObserver' in window)) gantt.classList.add('in');
    else new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { gantt.classList.add('in'); o.disconnect(); } }, { threshold: 0.25 }).observe(gantt);
  }

  /* ---------- lightbox ---------- */
  const lb = $('#lightbox');
  if (lb) {
    const img = $('img', lb), cap = $('.lb-cap', lb), count = $('.lb-count', lb);
    let set = [], idx = 0;
    function show(i) {
      idx = (i + set.length) % set.length;
      const a = set[idx];
      const thumb = $('img', a);
      img.src = a.getAttribute('href');
      img.alt = thumb ? thumb.alt : '';
      cap.textContent = a.dataset.caption || img.alt;
      count.textContent = `${idx + 1} / ${set.length}`;
      [idx + 1, idx - 1].forEach((j) => { const n = set[(j + set.length) % set.length]; if (n) new Image().src = n.getAttribute('href'); });
    }
    doc.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-lightbox]');
      if (!a) return;
      e.preventDefault();
      set = $$(`a[data-lightbox="${a.dataset.lightbox}"]`);
      show(set.indexOf(a));
      if (!lb.open) lb.showModal();
    });
    $('[data-lb-close]', lb).addEventListener('click', () => lb.close());
    $('[data-lb-prev]', lb).addEventListener('click', () => show(idx - 1));
    $('[data-lb-next]', lb).addEventListener('click', () => show(idx + 1));
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
    });
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.tagName === 'FIGURE') lb.close(); });
    let x0 = null;
    lb.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    lb.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    });
  }

  /* ---------- command palette ---------- */
  const pal = $('#palette');
  if (pal) {
    const input = $('#pal-input'), list = $('#pal-list');
    const ICON = { section: 'i-hash', case: 'i-book', project: 'i-folder', action: 'i-bolt', link: 'i-ext' };
    const items = [];
    const add = (group, type, label, hint, keys, run) => items.push({ group, type, label, hint, keys: (label + ' ' + (keys || '')).toLowerCase(), run });

    $$('main section[data-title]').forEach((s) => add('Sections', 'section', s.dataset.title, 'Jump', s.dataset.keywords, () => scrollToId(s.id)));
    cases.forEach((d) => add('Case studies', 'case', d.dataset.title, 'Case study', d.dataset.keywords, () => openCase(d.id)));
    $$('.proj').forEach((p) => {
      const title = $('h3', p).textContent;
      if (p.classList.contains('featured')) return;
      add('Projects', 'project', title, $('.proj-top span', p).textContent, p.textContent, () => {
        if (grid && grid._showAll) grid._showAll();
        requestAnimationFrame(() => { scrollToId(p.id); setTimeout(() => flash(p), reduce ? 0 : 450); });
      });
    });
    $$('.role[id]').forEach((r) => add('Experience', 'section', $('h3', r).textContent + ' — ' + $('.org', r).textContent, $('.period', r).textContent, r.textContent, () => { scrollToId(r.id); setTimeout(() => flash(r), reduce ? 0 : 450); }));
    add('Actions', 'action', 'Copy personal email', EMAIL, 'contact mail gmail', () => copy(EMAIL));
    add('Actions', 'action', 'Copy college email', EMAIL_COLLEGE, 'contact mail dcu university', () => copy(EMAIL_COLLEGE));
    add('Actions', 'action', 'Write an email', 'mailto', 'contact message hire', () => { location.href = 'mailto:' + EMAIL; });
    add('Actions', 'link', 'Open LinkedIn', 'linkedin.com', 'profile social', () => window.open(LINKEDIN, '_blank', 'noopener'));
    add('Actions', 'link', 'Open Instagram', 'instagram.com', 'profile social photos', () => window.open(INSTAGRAM, '_blank', 'noopener'));
    add('Actions', 'link', 'Open the web CV', 'cv.html', 'resume print pdf', () => { location.href = 'cv.html'; });
    add('Actions', 'action', 'Save contact card', '.vcf', 'vcard address book download', () => { const a = doc.createElement('a'); a.href = 'samuel-wesley-mondal.vcf'; a.download = ''; doc.body.appendChild(a); a.click(); a.remove(); });
    add('Actions', 'action', 'Toggle light / dark theme', 'Theme', 'dark light mode colour', toggleTheme);
    add('Actions', 'action', 'Pause / play the flow simulation', 'Hero', 'animation motion aerofoil', () => doc.dispatchEvent(new CustomEvent('flow:toggle')));

    let results = [], active = 0;
    function score(it, q) {
      if (!q) return 1;
      const words = q.split(/\s+/).filter(Boolean);
      if (!words.every((w) => it.keys.includes(w))) return 0;
      const l = it.label.toLowerCase();
      return l.startsWith(q) ? 3 : l.includes(q) ? 2 : 1;
    }
    function render() {
      const q = input.value.trim().toLowerCase();
      results = items.map((it) => [it, score(it, q)]).filter((x) => x[1] > 0);
      if (q) results.sort((a, b) => b[1] - a[1]);
      results = results.map((x) => x[0]);
      active = Math.min(active, Math.max(0, results.length - 1));
      list.innerHTML = '';
      if (!results.length) {
        const li = doc.createElement('li');
        li.className = 'pal-empty';
        li.textContent = 'No matches. Try “drone”, “award” or “email”.';
        list.appendChild(li);
        input.removeAttribute('aria-activedescendant');
        return;
      }
      let group = null;
      results.forEach((it, i) => {
        if (!q && it.group !== group) {
          group = it.group;
          const g = doc.createElement('li');
          g.className = 'pal-group'; g.setAttribute('role', 'presentation'); g.textContent = group;
          list.appendChild(g);
        }
        const li = doc.createElement('li');
        li.className = 'pal-item'; li.id = 'pal-' + i; li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(i === active));
        li.innerHTML = `<svg aria-hidden="true"><use href="#${ICON[it.type]}"/></svg><span class="t"></span><span class="h"></span>`;
        $('.t', li).textContent = it.label;
        $('.h', li).textContent = it.hint || '';
        li.addEventListener('mousemove', () => { if (active !== i) { active = i; highlight(); } });
        li.addEventListener('click', () => run(i));
        list.appendChild(li);
      });
      highlight();
    }
    function highlight() {
      $$('.pal-item', list).forEach((li) => li.setAttribute('aria-selected', String(li.id === 'pal-' + active)));
      const cur = $('#pal-' + active);
      if (cur) { input.setAttribute('aria-activedescendant', cur.id); cur.scrollIntoView({ block: 'nearest' }); }
    }
    function run(i) {
      const it = results[i];
      if (!it) return;
      pal.close();
      const openCaseDlg = cases.find((d) => d.open);
      if (openCaseDlg && it.type !== 'case' && it.type !== 'action' && it.type !== 'link') closeCases(true);
      requestAnimationFrame(() => it.run());
    }
    function openPalette() {
      if (pal.open) return;
      input.value = '';
      active = 0;
      render();
      pal.showModal();
      input.focus();
    }
    input.addEventListener('input', () => { active = 0; render(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, results.length); highlight(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + results.length) % Math.max(1, results.length); highlight(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(active); }
    });
    pal.addEventListener('click', (e) => { if (e.target === pal) pal.close(); });
    $$('[data-palette-open]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); openPalette(); }));
    doc.addEventListener('keydown', (e) => {
      const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); pal.open ? pal.close() : openPalette(); }
      else if (e.key === '/' && !typing && !pal.open) { e.preventDefault(); openPalette(); }
    });
  }
  $$('[data-mod]').forEach((k) => { k.textContent = isMac ? '⌘ K' : 'Ctrl K'; });
  $$('[data-mod-text]').forEach((k) => { k.textContent = isMac ? '⌘K' : 'Ctrl K'; });

  /* ---------- contact ---------- */
  $$('[data-copy]').forEach((b) => b.addEventListener('click', () => copy(b.dataset.copy)));

  const form = $('#contact-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const name = (f.get('name') || '').toString().trim();
      const org = (f.get('org') || '').toString().trim();
      const msg = (f.get('message') || '').toString().trim();
      const reason = (f.get('reason') || '').toString();
      if (!name || !msg) {
        const bad = !name ? $('#f-name') : $('#f-msg');
        bad.focus();
        bad.setAttribute('aria-invalid', 'true');
        toast(!name ? 'Add your name first' : 'Add a short message');
        return;
      }
      $$('[aria-invalid]', form).forEach((x) => x.removeAttribute('aria-invalid'));
      const subject = `${reason} — ${name}${org ? ', ' + org : ''}`;
      const body = `${msg}\n\n— ${name}${org ? '\n' + org : ''}`;
      location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      toast('Opening your email app…');
    });
  }

  const timeEls = $$('[data-dublin-time]');
  if (timeEls.length) {
    const fmt = new Intl.DateTimeFormat('en-IE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Dublin', timeZoneName: 'short' });
    const tick = () => { const s = fmt.format(new Date()); timeEls.forEach((t) => { t.textContent = s; }); };
    tick();
    setInterval(tick, 30000);
  }

  /* ---------- misc ---------- */
  $$('[data-year]').forEach((y) => { y.textContent = new Date().getFullYear(); });
})();
