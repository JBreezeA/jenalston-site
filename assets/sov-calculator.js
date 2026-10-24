/* AI Share of Voice Calculator: jenalston.com
   Everything runs in the visitor's browser. Nothing is sent anywhere. */
(function () {
  'use strict';

  var PLATFORMS = [
    { id: 'aio', name: 'Google AI Overviews' },
    { id: 'chatgpt', name: 'ChatGPT' },
    { id: 'gemini', name: 'Gemini' },
    { id: 'perplexity', name: 'Perplexity' },
    { id: 'claude', name: 'Claude' },
    { id: 'copilot', name: 'Copilot' }
  ];
  var MAX_COMPETITORS = 8;
  var MAX_PAGES = 10;
  var STORE_KEY = 'jen-sov-calculator-v2';

  function blankComp() { return { name: '', aliases: '', domain: '' }; }
  function blankState() {
    var s = {
      mode: 'paste',
      countBy: 'unique',
      you: { name: '', aliases: '', domain: '', pages: '' },
      comps: [blankComp(), blankComp(), blankComp()],
      answers: {},
      counts: {},
      cites: {}
    };
    PLATFORMS.forEach(function (p) { s.answers[p.id] = ''; s.counts[p.id] = {}; s.cites[p.id] = {}; });
    return s;
  }

  /* ---------- storage (per-visitor convenience only) ---------- */
  function load() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.you || !Array.isArray(s.comps)) return null;
      var b = blankState();
      if (s.mode !== 'manual') s.mode = 'paste';
      if (s.countBy !== 'all') s.countBy = 'unique';
      ['name', 'aliases', 'domain', 'pages'].forEach(function (k) { if (typeof s.you[k] !== 'string') s.you[k] = ''; });
      s.comps = s.comps.slice(0, MAX_COMPETITORS).map(function (c) {
        c = c || {};
        return { name: String(c.name || ''), aliases: String(c.aliases || ''), domain: String(c.domain || '') };
      });
      ['answers', 'counts', 'cites'].forEach(function (k) { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; });
      PLATFORMS.forEach(function (p) {
        if (typeof s.answers[p.id] !== 'string') s.answers[p.id] = b.answers[p.id];
        if (!s.counts[p.id] || typeof s.counts[p.id] !== 'object') s.counts[p.id] = {};
        if (!s.cites[p.id] || typeof s.cites[p.id] !== 'object') s.cites[p.id] = {};
      });
      return s;
    } catch (e) { return null; }
  }
  function save() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  var state = load() || blankState();

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function splitAliases(name, aliases) {
    var list = [name].concat((aliases || '').split(','));
    var seen = {};
    return list.map(function (a) { return a.trim(); }).filter(function (a) {
      var k = a.toLowerCase();
      if (!a || seen[k]) return false;
      seen[k] = true; return true;
    });
  }
  // Modern browsers support Unicode classes and lookbehind; older ones get a simpler fallback.
  var modernRe = (function () { try { new RegExp('(?<![\\p{L}])a', 'u'); return true; } catch (e) { return false; } })();

  // Brand names: whole words only. A name inside a web address (sketchwell.com) is a citation, not a mention.
  function nameMatcher(terms) {
    if (!terms.length) return null;
    var body = terms.map(escRe).sort(function (a, b) { return b.length - a.length; }).join('|');
    if (modernRe) return new RegExp('(?<![\\p{L}\\p{N}./@])(?:' + body + ')(?![\\p{L}\\p{N}]|\\.[\\p{L}\\p{N}])', 'giu');
    return new RegExp('\\b(?:' + body + ')\\b(?!\\.[a-z0-9])', 'gi');
  }
  // A whole website, including subdomains and any page on it.
  function domainMatcher(domain) {
    if (!domain) return null;
    if (modernRe) return new RegExp('(?<![\\p{L}\\p{N}-])' + escRe(domain) + '(?![\\p{L}\\p{N}-]|\\.[\\p{L}\\p{N}])', 'giu');
    return new RegExp('(?:^|[^a-z0-9-])' + escRe(domain) + '(?![a-z0-9-]|\\.[a-z0-9])', 'gi');
  }
  // One specific page: the exact address, with or without https://, www., a trailing slash, ?query or #anchor.
  function pageMatcher(key) {
    if (modernRe) return new RegExp('(?<![\\p{L}\\p{N}-])(?:www\\.)?' + escRe(key) + '/?(?![\\p{L}\\p{N}_/-]|\\.[\\p{L}\\p{N}])', 'giu');
    return new RegExp('(?:^|[^a-z0-9-])(?:www\\.)?' + escRe(key) + '/?(?![a-z0-9_/-]|\\.[a-z0-9])', 'gi');
  }
  function cleanDomain(d) {
    return (d || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '');
  }
  function cleanPage(u, fallbackDomain) {
    var s = (u || '').trim().toLowerCase();
    if (!s) return '';
    s = s.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
    if (s.charAt(0) === '/') { if (!fallbackDomain) return ''; s = fallbackDomain + s; }
    if (s.indexOf('/') === -1) return ''; // a bare domain is the whole site, not a page
    return s;
  }
  function trackedPages() {
    var dom = cleanDomain(state.you.domain), seen = {}, out = [];
    (state.you.pages || '').split(/[\n,]+/).forEach(function (line) {
      var key = cleanPage(line, dom);
      if (!key || seen[key] || out.length >= MAX_PAGES) return;
      seen[key] = true;
      out.push({ key: key, label: key, re: pageMatcher(key) });
    });
    return out;
  }
  function countIn(re, text) {
    if (!re) return 0;
    re.lastIndex = 0;
    var m = text.match(re);
    return m ? m.length : 0;
  }
  function splitAnswers(text) {
    if (!text || !text.trim()) return [];
    return text.split(/^\s*-{3,}\s*$/m).map(function (a) { return a.trim(); }).filter(Boolean);
  }
  function pct(n, d) { return d > 0 ? (n / d) * 100 : null; }
  function fmtPct(v) {
    if (v === null || v === undefined) return '–';
    if (v > 0 && v < 1) return v.toFixed(1) + '%';
    return Math.round(v) + '%';
  }
  function num(v) { var n = parseInt(v, 10); return isNaN(n) || n < 0 ? 0 : n; }
  function brands() {
    var list = [{ key: 'you', name: state.you.name.trim() || 'Your brand', aliases: state.you.aliases, domain: cleanDomain(state.you.domain), isYou: true }];
    state.comps.forEach(function (c, i) {
      if (c.name.trim()) list.push({ key: 'c' + i, name: c.name.trim(), aliases: c.aliases, domain: cleanDomain(c.domain), isYou: false });
    });
    return list;
  }

  /* ---------- the math ---------- */
  function compute() {
    var bs = brands();
    var pages = state.mode === 'paste' ? trackedPages() : [];
    var res = {
      mode: state.mode, countBy: state.countBy, brands: bs, pages: pages, platforms: [],
      totals: {}, citeTotals: {}, grand: 0, citeGrand: 0,
      answers: 0, youMentionAnswers: 0, youCiteAnswers: 0, pageAnswers: {},
      domain: bs[0].domain, anyDomains: bs.some(function (b) { return !!b.domain; })
    };
    bs.forEach(function (b) { res.totals[b.key] = 0; res.citeTotals[b.key] = 0; });
    pages.forEach(function (pg) { res.pageAnswers[pg.key] = 0; });
    var nm = {}, dm = {};
    bs.forEach(function (b) {
      nm[b.key] = nameMatcher(splitAliases(b.isYou ? state.you.name.trim() : b.name, b.aliases));
      dm[b.key] = domainMatcher(b.domain);
    });

    PLATFORMS.forEach(function (p) {
      var row = { id: p.id, name: p.name, counts: {}, cites: {}, total: 0, citeTotal: 0, answers: 0, youAnswers: 0, youCited: 0, pages: {} };
      bs.forEach(function (b) { row.counts[b.key] = 0; row.cites[b.key] = 0; });
      pages.forEach(function (pg) { row.pages[pg.key] = 0; });
      if (state.mode === 'paste') {
        var ans = splitAnswers(state.answers[p.id]);
        row.answers = ans.length;
        ans.forEach(function (a) {
          bs.forEach(function (b) {
            var n = countIn(nm[b.key], a);
            var c = countIn(dm[b.key], a);
            if (state.countBy === 'unique') { n = Math.min(n, 1); c = Math.min(c, 1); }
            row.counts[b.key] += n;
            row.cites[b.key] += c;
            if (b.isYou && n > 0) row.youAnswers++;
            if (b.isYou && c > 0) row.youCited++;
          });
          pages.forEach(function (pg) { if (countIn(pg.re, a) > 0) row.pages[pg.key]++; });
        });
      } else {
        bs.forEach(function (b) {
          row.counts[b.key] = num(state.counts[p.id][b.key]);
          row.cites[b.key] = num(state.cites[p.id][b.key]);
        });
      }
      bs.forEach(function (b) { row.total += row.counts[b.key]; row.citeTotal += row.cites[b.key]; });
      var used = state.mode === 'paste' ? row.answers > 0 : (row.total > 0 || row.citeTotal > 0);
      if (!used) return;
      bs.forEach(function (b) { res.totals[b.key] += row.counts[b.key]; res.citeTotals[b.key] += row.cites[b.key]; });
      pages.forEach(function (pg) { res.pageAnswers[pg.key] += row.pages[pg.key]; });
      res.grand += row.total;
      res.citeGrand += row.citeTotal;
      res.answers += row.answers;
      res.youMentionAnswers += row.youAnswers;
      res.youCiteAnswers += row.youCited;
      res.platforms.push(row);
    });
    return res;
  }

  /* ---------- rendering: inputs ---------- */
  function renderBrands() {
    var box = $('#sov-comps');
    box.textContent = '';
    state.comps.forEach(function (c, i) {
      var n = i + 1;
      var nameIn = el('input', { type: 'text', placeholder: 'Competitor ' + n, 'aria-label': 'Competitor ' + n + ' name', maxlength: '80' });
      nameIn.value = c.name;
      nameIn.addEventListener('input', function () { state.comps[i].name = nameIn.value; changed(true); });
      var aliasIn = el('input', { type: 'text', placeholder: 'Other names, comma separated', 'aria-label': 'Competitor ' + n + ' other names', maxlength: '300' });
      aliasIn.value = c.aliases;
      aliasIn.addEventListener('input', function () { state.comps[i].aliases = aliasIn.value; changed(false); });
      var domIn = el('input', { type: 'text', placeholder: 'Website, e.g. example.com', 'aria-label': 'Competitor ' + n + ' website', maxlength: '120', inputmode: 'url' });
      domIn.value = c.domain;
      domIn.addEventListener('input', function () { state.comps[i].domain = domIn.value; changed(false); });
      var rm = el('button', { type: 'button', class: 'sov-x', 'aria-label': 'Remove competitor ' + n, text: '×', onclick: function () {
        state.comps.splice(i, 1);
        PLATFORMS.forEach(function (p) { reindex(state.counts, p.id, i); reindex(state.cites, p.id, i); });
        renderBrands(); renderCounts(); changed(false);
      } });
      box.appendChild(el('div', { class: 'sov-brand-row' }, [nameIn, aliasIn, domIn, rm]));
    });
    $('#sov-add').disabled = state.comps.length >= MAX_COMPETITORS;
  }
  function reindex(store, pid, removed) {
    var old = store[pid], next = {};
    if (old.you !== undefined) next.you = old.you;
    for (var j = 0; j < MAX_COMPETITORS; j++) {
      if (j === removed || old['c' + j] === undefined) continue;
      next['c' + (j > removed ? j - 1 : j)] = old['c' + j];
    }
    store[pid] = next;
  }

  function renderAnswers() {
    var box = $('#sov-answers');
    box.textContent = '';
    PLATFORMS.forEach(function (p) {
      var ta = el('textarea', { id: 'sov-ans-' + p.id, rows: '6', spellcheck: 'false', placeholder: 'Paste ' + p.name + ' answers here, including their sources. Put a line with --- between answers.' });
      ta.value = state.answers[p.id];
      var meta = el('span', { class: 'sov-meta', 'aria-live': 'polite' });
      function upd() { var n = splitAnswers(ta.value).length; meta.textContent = n ? n + (n === 1 ? ' answer' : ' answers') : 'Skipped'; }
      ta.addEventListener('input', function () { state.answers[p.id] = ta.value; upd(); changed(false); });
      upd();
      var det = el('details', { class: 'sov-plat' }, [
        el('summary', null, [el('span', { class: 'sov-plat-name', text: p.name }), meta]),
        el('label', { class: 'sr', for: 'sov-ans-' + p.id, text: p.name + ' answers' }),
        ta
      ]);
      if (state.answers[p.id].trim() || p.id === 'aio') det.open = true;
      box.appendChild(det);
    });
  }

  function countTable(store, what) {
    var bs = brands();
    var thead = el('tr', null, [el('th', { scope: 'col', text: 'Brand' })].concat(PLATFORMS.map(function (p) { return el('th', { scope: 'col', text: p.name }); })));
    var tbody = el('tbody');
    bs.forEach(function (b) {
      var tr = el('tr', null, [el('th', { scope: 'row', text: b.name })]);
      PLATFORMS.forEach(function (p) {
        var v = store[p.id][b.key];
        var inp = el('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', 'aria-label': b.name + ' ' + what + ' on ' + p.name });
        inp.value = v === undefined ? '' : v;
        inp.addEventListener('input', function () { store[p.id][b.key] = inp.value; changed(false); });
        tr.appendChild(el('td', null, [inp]));
      });
      tbody.appendChild(tr);
    });
    return el('table', { class: 'sov-count-table' }, [el('thead', null, [thead]), tbody]);
  }
  function renderCounts() {
    var box = $('#sov-counts');
    box.textContent = '';
    box.appendChild(el('div', { class: 'sov-lbl', text: 'Mentions' }));
    box.appendChild(countTable(state.counts, 'mentions'));
    box.appendChild(el('div', { class: 'sov-lbl sov-lbl-gap', text: 'Citations (optional)' }));
    box.appendChild(countTable(state.cites, 'citations'));
  }

  function renderMode() {
    var paste = state.mode === 'paste';
    $('#sov-mode-paste').setAttribute('aria-selected', paste ? 'true' : 'false');
    $('#sov-mode-manual').setAttribute('aria-selected', paste ? 'false' : 'true');
    $('#sov-paste-panel').hidden = !paste;
    $('#sov-manual-panel').hidden = paste;
  }
  function renderCountBy() {
    $('#sov-count-all').setAttribute('aria-checked', state.countBy === 'all' ? 'true' : 'false');
    $('#sov-count-unique').setAttribute('aria-checked', state.countBy === 'unique' ? 'true' : 'false');
  }
  function renderPagesNote() {
    var note = $('#sov-pages-note');
    if (!note) return;
    var n = trackedPages().length;
    var raw = (state.you.pages || '').trim();
    if (!raw) { note.textContent = ''; return; }
    note.textContent = n ? 'Tracking ' + n + (n === 1 ? ' page' : ' pages') + '.' : 'Enter full page addresses, like yoursite.com/pricing. Addresses starting with / need your website filled in.';
  }

  /* ---------- rendering: results ---------- */
  function bar(value, isYou) {
    var w = value === null ? 0 : Math.max(0, Math.min(100, value));
    return el('span', { class: 'sov-bar' + (isYou ? ' you' : '') }, [el('span', { class: 'sov-fill', style: 'width:' + w.toFixed(1) + '%' })]);
  }
  function board(title, note, ranked, totals, grand) {
    var box = el('div', { class: 'sov-board' }, [el('h3', { text: title })]);
    if (note) box.appendChild(el('p', { class: 'sov-board-note', text: note }));
    ranked.forEach(function (b) {
      var v = pct(totals[b.key], grand);
      box.appendChild(el('div', { class: 'sov-board-row' + (b.isYou ? ' is-you' : '') }, [
        el('span', { class: 'sov-board-name', text: b.name + (b.isYou ? ' (you)' : '') }),
        bar(v, b.isYou),
        el('span', { class: 'sov-board-val', text: fmtPct(v) })
      ]));
    });
    return box;
  }
  function shareTable(label, r, ranked, field, totals, grand, totalField) {
    var thead = el('tr', null, [el('th', { scope: 'col', text: label })]
      .concat(r.platforms.map(function (p) { return el('th', { scope: 'col', text: p.name }); }))
      .concat([el('th', { scope: 'col', text: 'All platforms' })]));
    var tbody = el('tbody');
    ranked.forEach(function (b) {
      var tr = el('tr', { class: b.isYou ? 'is-you' : '' }, [el('th', { scope: 'row', text: b.name })]);
      r.platforms.forEach(function (p) { tr.appendChild(el('td', { text: fmtPct(pct(p[field][b.key], p[totalField])) + ' (' + p[field][b.key] + ')' })); });
      tr.appendChild(el('td', { text: fmtPct(pct(totals[b.key], grand)) + ' (' + totals[b.key] + ')' }));
      tbody.appendChild(tr);
    });
    return el('div', { class: 'sov-table-wrap', tabindex: '0', role: 'region', 'aria-label': label + ' table' }, [
      el('table', { class: 'sov-table' }, [el('thead', null, [thead]), tbody])
    ]);
  }

  var lastResult = null;
  function renderResults() {
    var r = compute();
    var out = $('#sov-results');
    out.textContent = '';
    lastResult = r;
    if (!r.platforms.length || (r.grand === 0 && r.citeGrand === 0)) {
      out.appendChild(el('p', { class: 'sov-empty', text: r.platforms.length
        ? 'No tracked brands or websites were found in these answers yet. Check the names and websites in step 1.'
        : (state.mode === 'paste' ? 'Paste at least one AI answer in step 2 to see your share of voice.' : 'Enter mention counts in step 2 to see your share of voice.') }));
      return;
    }
    var you = r.brands[0];
    var hasCites = r.citeGrand > 0;
    var blended = pct(r.totals.you, r.grand);

    // headline
    var head = el('div', { class: 'sov-head' }, [
      el('div', null, [
        el('div', { class: 'sov-kicker', text: you.name + ': AI share of voice, all platforms' }),
        el('div', { class: 'sov-big', text: fmtPct(blended) }),
        el('div', { class: 'sov-sub', text: r.totals.you + ' of ' + r.grand + ' brand mentions' + (r.mode === 'paste' ? ' across ' + r.answers + (r.answers === 1 ? ' answer' : ' answers') + ' · ' + methodLabel(r) : '') })
      ])
    ]);
    var stats = el('div', { class: 'sov-stats' });
    if (hasCites) stats.appendChild(el('div', null, [el('b', { text: fmtPct(pct(r.citeTotals.you, r.citeGrand)) }), el('span', { text: 'Citation share of voice: your share of all tracked citations' })]));
    if (r.mode === 'paste' && r.answers) {
      stats.appendChild(el('div', null, [el('b', { text: fmtPct(pct(r.youMentionAnswers, r.answers)) }), el('span', { text: 'Mention rate: answers that name you' })]));
      if (r.domain) stats.appendChild(el('div', null, [el('b', { text: fmtPct(pct(r.youCiteAnswers, r.answers)) }), el('span', { text: 'Citation rate: answers that cite ' + r.domain })]));
    }
    if (stats.childNodes.length) head.appendChild(stats);
    out.appendChild(head);

    // per platform
    var grid = el('div', { class: 'sov-plats' });
    r.platforms.forEach(function (row) {
      var v = pct(row.counts.you, row.total);
      var lines = [el('div', { class: 'sov-plat-sub', text: row.counts.you + ' of ' + row.total + ' mentions' })];
      if (hasCites) lines.push(el('div', { class: 'sov-plat-sub', text: 'Citation share: ' + fmtPct(pct(row.cites.you, row.citeTotal)) + ' (' + row.cites.you + ' of ' + row.citeTotal + ')' }));
      if (r.mode === 'paste' && r.domain) lines.push(el('div', { class: 'sov-plat-sub', text: 'Cited in ' + row.youCited + ' of ' + row.answers + ' answers' }));
      grid.appendChild(el('div', { class: 'sov-plat-card' }, [
        el('div', { class: 'sov-plat-title', text: row.name }),
        el('div', { class: 'sov-plat-val', text: fmtPct(v) }),
        bar(v, true)
      ].concat(lines)));
    });
    out.appendChild(grid);

    // mentions
    var ranked = r.brands.slice().sort(function (a, b) { return r.totals[b.key] - r.totals[a.key]; });
    out.appendChild(board('Mention share of voice by brand', 'Who AI tools name.', ranked, r.totals, r.grand));
    out.appendChild(shareTable('Mentions', r, ranked, 'counts', r.totals, r.grand, 'total'));

    // citations
    if (hasCites) {
      var cRanked = r.brands.slice().sort(function (a, b) { return r.citeTotals[b.key] - r.citeTotals[a.key]; });
      out.appendChild(board('Citation share of voice by brand', 'Who AI tools send people to: websites cited as sources or links.', cRanked, r.citeTotals, r.citeGrand));
      out.appendChild(shareTable('Citations', r, cRanked, 'cites', r.citeTotals, r.citeGrand, 'citeTotal'));
      var missing = r.brands.filter(function (b) { return !b.domain; });
      if (r.mode === 'paste' && missing.length) {
        out.appendChild(el('p', { class: 'sov-note', text: 'No website entered for ' + missing.map(function (b) { return b.name; }).join(', ') + ', so their citations are not counted. Add websites in step 1 for a complete citation share.' }));
      }
    } else if (r.mode === 'paste' && r.anyDomains) {
      out.appendChild(el('p', { class: 'sov-note', text: 'None of the tracked websites were found in these answers. If the AI showed sources, make sure the web addresses were included when you copied the answer.' }));
    }

    // tracked pages
    if (r.mode === 'paste' && r.pages.length) {
      var thead = el('tr', null, [el('th', { scope: 'col', text: 'Page' })]
        .concat(r.platforms.map(function (p) { return el('th', { scope: 'col', text: p.name }); }))
        .concat([el('th', { scope: 'col', text: 'All platforms' })]));
      var tbody = el('tbody');
      r.pages.forEach(function (pg) {
        var tr = el('tr', null, [el('th', { scope: 'row', text: pg.label })]);
        r.platforms.forEach(function (p) { tr.appendChild(el('td', { text: p.pages[pg.key] + ' of ' + p.answers })); });
        tr.appendChild(el('td', { text: r.pageAnswers[pg.key] + ' of ' + r.answers + ' (' + fmtPct(pct(r.pageAnswers[pg.key], r.answers)) + ')' }));
        tbody.appendChild(tr);
      });
      out.appendChild(el('div', { class: 'sov-board' }, [
        el('h3', { text: 'Your tracked pages' }),
        el('p', { class: 'sov-board-note', text: 'How many answers cited each page.' })
      ]));
      out.appendChild(el('div', { class: 'sov-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Tracked pages table' }, [
        el('table', { class: 'sov-table' }, [el('thead', null, [thead]), tbody])
      ]));
    }

    // insights
    var tips = insights(r, ranked);
    if (tips.length) {
      var ul = el('ul');
      tips.forEach(function (t) { ul.appendChild(el('li', { text: t })); });
      out.appendChild(el('div', { class: 'sov-insights' }, [el('h3', { text: 'What this tells you' }), ul]));
    }
  }

  function insights(r, ranked) {
    var t = [];
    var you = r.brands[0].name;
    if (r.grand > 0) {
      var rows = r.platforms.filter(function (p) { return p.total > 0; }).map(function (p) { return { name: p.name, v: pct(p.counts.you, p.total) }; });
      if (rows.length > 1) {
        var best = rows.reduce(function (a, b) { return b.v > a.v ? b : a; });
        var worst = rows.reduce(function (a, b) { return b.v < a.v ? b : a; });
        if (best.v !== worst.v) t.push(you + ' is strongest in ' + best.name + ' (' + fmtPct(best.v) + ') and weakest in ' + worst.name + ' (' + fmtPct(worst.v) + '). Look at the sources ' + worst.name + ' cites for these prompts, and work on getting your brand onto them.');
      }
      var top = ranked[0];
      if (top && !top.isYou && r.totals[top.key] > 0) t.push(top.name + ' leads mentions with ' + fmtPct(pct(r.totals[top.key], r.grand)) + '. Study the pages and sources AI tools use when they name ' + top.name + '.');
      else if (top && top.isYou && ranked.length > 1) t.push(you + ' leads mentions for this prompt set. Re-run the same prompts monthly to make sure the lead holds.');
    }
    if (r.citeGrand > 0) {
      var cTop = r.brands.slice().sort(function (a, b) { return r.citeTotals[b.key] - r.citeTotals[a.key]; })[0];
      var mShare = pct(r.totals.you, r.grand), cShare = pct(r.citeTotals.you, r.citeGrand);
      if (cTop && !cTop.isYou) t.push(cTop.name + '’s website is cited most (' + fmtPct(pct(r.citeTotals[cTop.key], r.citeGrand)) + ' of citations), so AI tools send more people there. See which of its pages get cited and what they cover that yours don’t.');
      if (mShare !== null && cShare !== null && mShare - cShare >= 10) t.push('Your citation share (' + fmtPct(cShare) + ') trails your mention share (' + fmtPct(mShare) + '). AI tools know your name but cite other sites. Pages that answer the prompt directly, with clear facts and structure, are more likely to be cited.');
    }
    if (r.mode === 'paste' && r.pages.length) {
      var none = r.pages.filter(function (pg) { return r.pageAnswers[pg.key] === 0; });
      if (none.length === r.pages.length) t.push('None of your tracked pages were cited. Check that each page answers these prompts directly, and that it is indexed and linked from your other pages.');
      else if (none.length) t.push(none.length + (none.length === 1 ? ' tracked page was' : ' tracked pages were') + ' not cited in any answer: ' + none.map(function (p) { return p.label; }).join(', ') + '.');
    }
    if (r.mode === 'paste' && r.answers < 10) t.push('This is a small sample. Run each prompt two or three times per platform for a steadier number.');
    return t;
  }

  /* ---------- export ---------- */
  function methodLabel(r) { return r.countBy === 'unique' ? 'counted once per answer' : 'counting every mention'; }
  function csvCell(v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function csvBlock(lines, title, r, field, totals, grand, totalField) {
    lines.push(csvCell(title));
    lines.push(['Brand'].concat(r.platforms.map(function (p) { return p.name; }), r.platforms.map(function (p) { return p.name + ' share %'; }), ['All platforms', 'All platforms share %']).map(csvCell).join(','));
    r.brands.forEach(function (b) {
      lines.push([b.name].concat(
        r.platforms.map(function (p) { return p[field][b.key]; }),
        r.platforms.map(function (p) { var v = pct(p[field][b.key], p[totalField]); return v === null ? '' : v.toFixed(1); }),
        [totals[b.key], (pct(totals[b.key], grand) || 0).toFixed(1)]
      ).map(csvCell).join(','));
    });
    lines.push(['Total'].concat(r.platforms.map(function (p) { return p[totalField]; }), r.platforms.map(function () { return ''; }), [grand, '']).map(csvCell).join(','));
    lines.push('');
  }
  function toCSV(r) {
    var lines = [];
    lines.push(csvCell('AI share of voice' + (r.mode === 'paste' ? ' (' + methodLabel(r) + ')' : '')));
    lines.push('');
    csvBlock(lines, 'Mentions', r, 'counts', r.totals, r.grand, 'total');
    if (r.citeGrand > 0) csvBlock(lines, 'Citations', r, 'cites', r.citeTotals, r.citeGrand, 'citeTotal');
    if (r.mode === 'paste' && r.pages.length) {
      lines.push('Tracked pages (answers citing each page)');
      lines.push(['Page'].concat(r.platforms.map(function (p) { return p.name; }), ['All platforms', 'Answers', 'Share of answers %']).map(csvCell).join(','));
      r.pages.forEach(function (pg) {
        lines.push([pg.label].concat(r.platforms.map(function (p) { return p.pages[pg.key]; }), [r.pageAnswers[pg.key], r.answers, (pct(r.pageAnswers[pg.key], r.answers) || 0).toFixed(1)]).map(csvCell).join(','));
      });
    }
    return lines.join('\n');
  }
  function summary(r) {
    var you = r.brands[0].name;
    var s = ['AI share of voice for ' + you + ': ' + fmtPct(pct(r.totals.you, r.grand)) + ' (' + r.totals.you + ' of ' + r.grand + ' brand mentions' + (r.mode === 'paste' ? ', ' + methodLabel(r) : '') + ')'];
    r.platforms.forEach(function (p) { s.push('- ' + p.name + ': ' + fmtPct(pct(p.counts.you, p.total)) + ' (' + p.counts.you + ' of ' + p.total + ')'); });
    if (r.citeGrand > 0) {
      s.push('Citation share of voice: ' + fmtPct(pct(r.citeTotals.you, r.citeGrand)) + ' (' + r.citeTotals.you + ' of ' + r.citeGrand + ' citations)');
      r.platforms.forEach(function (p) { if (p.citeTotal > 0) s.push('- ' + p.name + ': ' + fmtPct(pct(p.cites.you, p.citeTotal)) + ' (' + p.cites.you + ' of ' + p.citeTotal + ')'); });
    }
    if (r.mode === 'paste' && r.answers) {
      s.push('Mention rate: ' + fmtPct(pct(r.youMentionAnswers, r.answers)) + ' of ' + r.answers + ' answers');
      if (r.domain) s.push('Citation rate (' + r.domain + '): ' + fmtPct(pct(r.youCiteAnswers, r.answers)));
      r.pages.forEach(function (pg) { s.push('Page ' + pg.label + ': cited in ' + r.pageAnswers[pg.key] + ' of ' + r.answers + ' answers'); });
    }
    s.push('Calculated with the AI Share of Voice Calculator: https://jenalston.com/ai-share-of-voice-calculator');
    return s.join('\n');
  }
  function flash(btn, msg) {
    var old = btn.textContent; btn.textContent = msg;
    setTimeout(function () { btn.textContent = old; }, 1600);
  }

  /* ---------- examples ---------- */
  function loadExample() {
    var s = blankState();
    s.mode = state.mode;
    s.countBy = state.countBy;
    if (s.mode === 'paste') {
      s.you = { name: 'Sketchwell', aliases: 'Sketchwell app', domain: 'sketchwell.com', pages: 'sketchwell.com/templates\nsketchwell.com/pricing' };
      s.comps = [
        { name: 'Pixelry', aliases: '', domain: 'pixelry.io' },
        { name: 'Canvasly', aliases: 'Canvas.ly', domain: 'canvasly.com' },
        { name: 'DrawDeck', aliases: 'Draw Deck', domain: 'drawdeck.com' },
        { name: 'Frameo Studio', aliases: 'Frameo', domain: 'frameo.studio' }
      ];
      s.answers.aio = [
        'For small businesses, popular design apps include Sketchwell, Canvasly and Pixelry. Sketchwell is known for ready-made social templates. Source: https://sketchwell.com/templates',
        '---',
        'Canvasly and DrawDeck both offer free plans. Frameo is better for video. Many reviewers also mention Sketchwell for brand kits. Sources: canvasly.com/pricing, drawdeck.com',
        '---',
        'Top picks: Pixelry for photo editing, Canvas.ly for quick graphics, and Sketchwell app for teams. Sources: www.sketchwell.com/pricing/, pixelry.io'
      ].join('\n');
      s.answers.chatgpt = [
        'Here are a few strong options: 1. Canvasly 2. Pixelry 3. Sketchwell 4. Draw Deck. Each has a free tier. Sources: canvasly.com, pixelry.io/blog/best-design-apps',
        '---',
        'If you need brand consistency, Sketchwell and Frameo Studio both support brand kits. Canvasly is the easiest to learn. Source: frameo.studio/brand-kits',
        '---',
        'For print materials, Pixelry and Canvasly are the most common recommendations. Source: https://canvasly.com/print'
      ].join('\n');
      s.answers.gemini = [
        'Canvasly, Pixelry and DrawDeck are widely used for small business graphics.',
        '---',
        'Consider Frameo for video, Canvasly for social posts, and Pixelry for photos. Sources: canvasly.com, pixelry.io',
        '---',
        'Sketchwell offers templates, though Canvasly has a larger library. Source: canvasly.com/templates'
      ].join('\n');
      s.answers.perplexity = [
        'Based on recent reviews, Sketchwell [1], Canvasly [2] and Pixelry [3] are the top choices. [1] sketchwell.com/pricing [2] canvasly.com [3] pixelry.io',
        '---',
        'DrawDeck and Sketchwell both integrate with common tools. Sources: sketchwell.com/integrations, drawdeck.com'
      ].join('\n');
    } else {
      // The worked example from the AI share of voice guide
      s.you = { name: 'Your design app', aliases: '', domain: '', pages: '' };
      s.comps = [{ name: 'Competitor A', aliases: '', domain: '' }, { name: 'Competitor B', aliases: '', domain: '' }, { name: 'Competitor C', aliases: '', domain: '' }, { name: 'Competitor D', aliases: '', domain: '' }];
      s.counts.aio = { you: 8, c0: 5, c1: 4, c2: 2, c3: 1 };
      s.counts.chatgpt = { you: 5, c0: 4, c1: 3, c2: 2, c3: 2 };
      s.counts.gemini = { you: 3, c0: 5, c1: 4, c2: 2, c3: 1 };
      s.cites.aio = { you: 3, c0: 2, c1: 1, c2: 0, c3: 0 };
      s.cites.chatgpt = { you: 1, c0: 2, c1: 1, c2: 1, c3: 0 };
      s.cites.gemini = { you: 0, c0: 3, c1: 1, c2: 0, c3: 0 };
    }
    state = s;
    renderAll();
  }

  /* ---------- wiring ---------- */
  var timer = null;
  function changed(rebuildCounts) {
    save();
    if (rebuildCounts && state.mode === 'manual') renderCounts();
    renderPagesNote();
    clearTimeout(timer);
    timer = setTimeout(renderResults, 150);
  }
  function renderAll() {
    $('#sov-you-name').value = state.you.name;
    $('#sov-you-aliases').value = state.you.aliases;
    $('#sov-you-domain').value = state.you.domain;
    $('#sov-you-pages').value = state.you.pages;
    renderBrands(); renderAnswers(); renderCounts(); renderMode(); renderCountBy(); renderPagesNote(); renderResults(); save();
  }

  function init() {
    if (!$('#sov-app')) return;
    $('#sov-you-name').addEventListener('input', function (e) { state.you.name = e.target.value; changed(true); });
    $('#sov-you-aliases').addEventListener('input', function (e) { state.you.aliases = e.target.value; changed(false); });
    $('#sov-you-domain').addEventListener('input', function (e) { state.you.domain = e.target.value; changed(false); });
    $('#sov-you-pages').addEventListener('input', function (e) { state.you.pages = e.target.value; changed(false); });
    $('#sov-add').addEventListener('click', function () {
      if (state.comps.length >= MAX_COMPETITORS) return;
      state.comps.push(blankComp());
      renderBrands(); changed(true);
      var inputs = document.querySelectorAll('#sov-comps .sov-brand-row input:first-child');
      if (inputs.length) inputs[inputs.length - 1].focus();
    });
    $('#sov-mode-paste').addEventListener('click', function () { state.mode = 'paste'; renderMode(); changed(false); });
    $('#sov-mode-manual').addEventListener('click', function () { state.mode = 'manual'; renderCounts(); renderMode(); changed(false); });
    $('#sov-count-all').addEventListener('click', function () { state.countBy = 'all'; renderCountBy(); changed(false); });
    $('#sov-count-unique').addEventListener('click', function () { state.countBy = 'unique'; renderCountBy(); changed(false); });
    $('#sov-example').addEventListener('click', loadExample);
    $('#sov-clear').addEventListener('click', function () {
      var mode = state.mode, cb = state.countBy; state = blankState(); state.mode = mode; state.countBy = cb; renderAll();
    });
    $('#sov-copy').addEventListener('click', function (e) {
      var btn = e.currentTarget;
      if (!lastResult || (!lastResult.grand && !lastResult.citeGrand)) { flash(btn, 'Nothing to copy yet'); return; }
      var text = summary(lastResult);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { flash(btn, 'Copied'); }, function () { flash(btn, 'Copy failed'); });
      } else { flash(btn, 'Copy not supported'); }
    });
    $('#sov-csv').addEventListener('click', function (e) {
      var btn = e.currentTarget;
      if (!lastResult || (!lastResult.grand && !lastResult.citeGrand)) { flash(btn, 'Nothing to download yet'); return; }
      var blob = new Blob([toCSV(lastResult)], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ai-share-of-voice.csv';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
