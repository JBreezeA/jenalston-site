/*! AI Share of Voice Calculator. (c) 2026 Jennifer Alston, jenalston.com. All rights reserved. Not licensed for reuse or redistribution. */
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
view: 'quick',
qPlat: 'chatgpt',
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
if (!PLATFORMS.some(function (p) { return p.id === s.qPlat; })) {
var filled = PLATFORMS.filter(function (p) { return s.answers[p.id].trim(); });
s.qPlat = filled.length === 1 ? filled[0].id : 'chatgpt';
}
if (s.view !== 'quick' && s.view !== 'advanced') s.view = hasAdvanced(s) ? 'advanced' : 'quick';
return s;
} catch (e) { return null; }
}
function filledVal(v) { return v !== undefined && v !== null && String(v).trim() !== ''; }
function hasAdvanced(s) {
if (s.mode === 'manual' || s.countBy === 'all') return true;
if (s.you.aliases.trim() || s.you.domain.trim() || s.you.pages.trim()) return true;
if (s.comps.some(function (c, i) { return (i >= 2 && c.name.trim()) || c.aliases.trim() || c.domain.trim(); })) return true;
return PLATFORMS.some(function (p) {
if (p.id !== s.qPlat && s.answers[p.id].trim()) return true;
return Object.keys(s.counts[p.id]).some(function (k) { return filledVal(s.counts[p.id][k]); }) ||
Object.keys(s.cites[p.id]).some(function (k) { return filledVal(s.cites[p.id][k]); });
});
}
function isQuick() { return state.view === 'quick'; }
function platName(id) { for (var i = 0; i < PLATFORMS.length; i++) if (PLATFORMS[i].id === id) return PLATFORMS[i].name; return ''; }
function save() {
try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}
var state = load() || blankState();
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
var modernRe = (function () { try { new RegExp('(?<![\\p{L}])a', 'u'); return true; } catch (e) { return false; } })();
function nameMatcher(terms) {
if (!terms.length) return null;
var body = terms.map(escRe).sort(function (a, b) { return b.length - a.length; }).join('|');
if (modernRe) return new RegExp('(?<![\\p{L}\\p{N}./@])(?:' + body + ')(?![\\p{L}\\p{N}]|\\.[\\p{L}\\p{N}])', 'giu');
return new RegExp('\\b(?:' + body + ')\\b(?!\\.[a-z0-9])', 'gi');
}
function domainMatcher(domain) {
if (!domain) return null;
if (modernRe) return new RegExp('(?<![\\p{L}\\p{N}-])' + escRe(domain) + '(?![\\p{L}\\p{N}-]|\\.[\\p{L}\\p{N}])', 'giu');
return new RegExp('(?:^|[^a-z0-9-])' + escRe(domain) + '(?![a-z0-9-]|\\.[a-z0-9])', 'gi');
}
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
// Quick start counts only what it shows: your brand name, competitors 1-2 (names only) and the one answer box.
function brands() {
var q = isQuick();
var list = [{ key: 'you', name: state.you.name.trim() || 'Your brand', aliases: q ? '' : state.you.aliases, domain: q ? '' : cleanDomain(state.you.domain), isYou: true }];
state.comps.forEach(function (c, i) {
if (q && i > 1) return;
if (c.name.trim()) list.push({ key: 'c' + i, name: c.name.trim(), aliases: q ? '' : c.aliases, domain: q ? '' : cleanDomain(c.domain), isYou: false });
});
return list;
}
function compute() {
var q = isQuick();
var mode = q ? 'paste' : state.mode;
var countBy = q ? 'unique' : state.countBy;
var bs = brands();
var pages = mode === 'paste' && !q ? trackedPages() : [];
var res = {
quick: q, mode: mode, countBy: countBy, brands: bs, pages: pages, platforms: [],
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
if (q && p.id !== state.qPlat) return;
var row = { id: p.id, name: p.name, counts: {}, cites: {}, total: 0, citeTotal: 0, answers: 0, youAnswers: 0, youCited: 0, pages: {} };
bs.forEach(function (b) { row.counts[b.key] = 0; row.cites[b.key] = 0; });
pages.forEach(function (pg) { row.pages[pg.key] = 0; });
if (mode === 'paste') {
var ans = splitAnswers(state.answers[p.id]);
row.answers = ans.length;
ans.forEach(function (a) {
bs.forEach(function (b) {
var n = countIn(nm[b.key], a);
var c = countIn(dm[b.key], a);
if (countBy === 'unique') { n = Math.min(n, 1); c = Math.min(c, 1); }
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
var used = mode === 'paste' ? row.answers > 0 : (row.total > 0 || row.citeTotal > 0);
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
var ta = el('textarea', { id: 'sov-ans-' + p.id, rows: '6', spellcheck: 'false', placeholder: 'Paste a ' + p.name + ' answer here.' });
ta.value = state.answers[p.id];
var meta = el('span', { class: 'sov-meta', 'aria-live': 'polite' });
function upd() { var n = splitAnswers(ta.value).length; meta.textContent = n ? n + (n === 1 ? ' answer' : ' answers') : 'Skipped'; }
ta.addEventListener('input', function () { state.answers[p.id] = ta.value; upd(); changed(false); });
upd();
var addBtn = el('button', { type: 'button', class: 'sov-add-answer', text: '+ Add another answer', 'aria-label': 'Add another ' + p.name + ' answer' });
addBtn.addEventListener('click', function () { addAnswer(ta, p.id, upd); });
var det = el('details', { class: 'sov-plat' }, [
el('summary', { class: p.id === 'aio' ? 'sov-tip-host' : '' }, [el('span', { class: 'sov-plat-name' }, [document.createTextNode(p.name), p.id === 'aio' ? aioTip('sov-aio-tip-adv') : null]), meta]),
el('label', { class: 'sr', for: 'sov-ans-' + p.id, text: p.name + ' answers' }),
ta,
el('div', { class: 'sov-plat-actions' }, [addBtn, el('span', { class: 'sov-plat-tip', text: 'Paste one answer, click this, then paste the next.' })])
]);
if (state.answers[p.id].trim() || p.id === state.qPlat) det.open = true;
box.appendChild(det);
});
}
// Google AI Overviews tip: shows on hover, keyboard focus or tap.
var AIO_TIP = 'Google AI Overviews are the AI summary at the top of regular Google results. Go to google.com, type your question into the normal search box and press Enter. If Google opens a chat-style AI Mode page that looks like Gemini, that’s a different tool, so go back to the regular results. No summary at the top? Try rewording the question.';
function aioTip(id) {
var btn = el('button', { type: 'button', class: 'sov-tip-btn', 'aria-label': 'How to get a Google AI Overview', 'aria-describedby': id, text: '?' });
btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); btn.focus(); });
return el('span', { class: 'sov-tip' }, [btn, el('span', { class: 'sov-tip-text', role: 'tooltip', id: id, text: AIO_TIP })]);
}
// Inserts the --- separator so beginners never have to type it.
function addAnswer(ta, pid, upd) {
var v = ta.value.replace(/\s+$/, '');
if (v && !/(^|\n)\s*-{3,}\s*$/.test(v)) v += '\n---\n';
else if (v) v += '\n';
ta.value = v;
state.answers[pid] = ta.value; upd(); changed(false);
ta.focus();
try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) { /* ignore */ }
ta.scrollTop = ta.scrollHeight;
}
function ensureTwoComps() { while (state.comps.length < 2) state.comps.push(blankComp()); }
function quickMeta() {
var n = splitAnswers(state.answers[state.qPlat]).length;
$('#sov-q-meta').textContent = n ? n + (n === 1 ? ' answer' : ' answers') : '';
}
function renderQuick() {
ensureTwoComps();
$('#sov-q-name').value = state.you.name;
$('#sov-q-c0').value = state.comps[0].name;
$('#sov-q-c1').value = state.comps[1].name;
var sel = $('#sov-q-plat');
if (!sel.options.length) PLATFORMS.forEach(function (p) { sel.appendChild(el('option', { value: p.id, text: p.name })); });
sel.value = state.qPlat;
$('#sov-q-answer').value = state.answers[state.qPlat];
var tipSlot = $('#sov-q-aio-tip');
if (!tipSlot.firstChild) tipSlot.appendChild(aioTip('sov-aio-tip-quick'));
tipSlot.hidden = state.qPlat !== 'aio';
quickMeta();
$('#sov-q-hidden-note').hidden = !hasAdvanced(state);
}
function renderView() {
var q = isQuick();
$('#sov-quick').hidden = !q;
$('#sov-adv').hidden = q;
var btn = $('#sov-view-toggle');
btn.textContent = q ? 'Show advanced options' : 'Back to quick start';
btn.setAttribute('aria-expanded', q ? 'false' : 'true');
$('#sov-view-note').textContent = q
? 'Quick start: your brand, a competitor or two and one AI answer. That’s it.'
: 'Advanced options: up to six platforms, more competitors, other names and websites, specific pages, how mentions are counted, and citation share of voice.';
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
if (r.quick) { renderQuickResult(out, r); return; }
if (!r.platforms.length || (r.grand === 0 && r.citeGrand === 0)) {
out.appendChild(el('p', { class: 'sov-empty', text: r.platforms.length
? 'No tracked brands or websites were found in these answers yet. Check the names and websites in step 1.'
: (r.mode === 'paste' ? 'Paste at least one AI answer in step 2 to see your share of voice.' : 'Enter mention counts in step 2 to see your share of voice.') }));
return;
}
var you = r.brands[0];
var hasCites = r.citeGrand > 0;
var blended = pct(r.totals.you, r.grand);
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
var ranked = r.brands.slice().sort(function (a, b) { return r.totals[b.key] - r.totals[a.key]; });
out.appendChild(board('Mention share of voice by brand', 'Who AI tools name.', ranked, r.totals, r.grand));
out.appendChild(shareTable('Mentions', r, ranked, 'counts', r.totals, r.grand, 'total'));
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
var tips = insights(r, ranked);
if (tips.length) {
var ul = el('ul');
tips.forEach(function (t) { ul.appendChild(el('li', { text: t })); });
out.appendChild(el('div', { class: 'sov-insights' }, [el('h3', { text: 'What this tells you' }), ul]));
}
}
function joinNames(list) {
if (list.length <= 1) return list.join('');
if (list.length === 2) return list[0] + ' and ' + list[1];
return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
}
function quickSentence(r) {
var you = r.brands[0].name, plat = r.platforms[0].name, n = r.answers, named = r.youMentionAnswers;
var s = [];
if (n === 1) s.push(named ? plat + ' named ' + you + ' in this answer.' : plat + ' didn’t name ' + you + ' in this answer.');
else s.push(plat + ' named ' + you + ' in ' + named + ' of ' + n + ' answers.');
var others = r.brands.slice(1);
var top = Math.max.apply(null, r.brands.map(function (b) { return r.totals[b.key]; }));
var leaders = others.filter(function (b) { return r.totals[b.key] === top; }).map(function (b) { return b.name; });
if (r.totals.you > 0) {
s.push('That gives ' + you + ' ' + fmtPct(pct(r.totals.you, r.grand)) + ' of the mentions among the brands you’re tracking.');
if (r.totals.you === top && !leaders.length) s.push('You’re in the lead. Nice!');
else if (r.totals.you === top) s.push('You’re tied for the lead with ' + joinNames(leaders) + '.');
else s.push(joinNames(leaders) + (leaders.length > 1 ? ' were' : ' was') + ' named more often, so it’s worth reading what the answer says about them.');
} else {
s.push(joinNames(others.filter(function (b) { return r.totals[b.key] > 0; }).map(function (b) { return b.name; })) + ' got all the mentions this time. That’s useful to know, and it’s a good place to start working.');
}
return s.join(' ');
}
function renderQuickResult(out, r) {
var hasComp = r.brands.length > 1;
if (!r.answers) { out.appendChild(el('p', { class: 'sov-empty', text: 'Paste an AI answer in step 2 to see your result.' })); return; }
if (!hasComp) { out.appendChild(el('p', { class: 'sov-empty', text: 'Add at least one competitor in step 1 so there’s someone to compare you with.' })); return; }
if (r.grand === 0) {
out.appendChild(el('p', { class: 'sov-empty', text: r.platforms[0].name + ' didn’t name any of these brands. That happens! Try another question your customers would ask, or check the spelling of the names in step 1.' }));
return;
}
var you = r.brands[0];
var blended = pct(r.totals.you, r.grand);
out.appendChild(el('div', { class: 'sov-head' }, [el('div', null, [
el('div', { class: 'sov-kicker', text: you.name + ': AI share of voice on ' + r.platforms[0].name }),
el('div', { class: 'sov-big', text: fmtPct(blended) }),
el('div', { class: 'sov-sub', text: r.totals.you + ' of ' + r.grand + ' brand mentions across ' + r.answers + (r.answers === 1 ? ' answer' : ' answers') })
])]));
out.appendChild(el('p', { class: 'sov-sentence', text: quickSentence(r) }));
var ranked = r.brands.slice().sort(function (a, b) { return r.totals[b.key] - r.totals[a.key]; });
out.appendChild(board('Share of the mentions', 'Each brand counts once per answer.', ranked, r.totals, r.grand));
if (r.answers < 3) out.appendChild(el('div', { class: 'sov-insights' }, [el('p', { class: 'sov-nudge', text: SAMPLE_NOTE_QUICK })]));
out.appendChild(el('p', { class: 'sov-note', text: 'Want to compare platforms, add more competitors or see whether AI tools cite your website? Use Show advanced options at the top of the calculator.' }));
}
var SAMPLE_NOTE_QUICK = 'Nice start! AI answers change from run to run, so think of this as a snapshot. For a steadier number, ask the same question two or three more times in a fresh chat, and add each answer with “+ Add another answer.”';
var SAMPLE_NOTE = 'Nice start! AI answers change from run to run, so think of this as a snapshot. Ask each question two or three times per platform for a steadier number.';
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
if (r.mode === 'paste' && r.answers < 10) t.push(SAMPLE_NOTE);
return t;
}
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
function loadQuickExample() {
var s = blankState();
s.view = 'quick';
s.qPlat = 'chatgpt';
s.you.name = 'Sketchwell';
s.comps[0].name = 'Pixelry';
s.comps[1].name = 'Canvasly';
s.answers.chatgpt = 'Here are a few strong options for small business design: 1. Canvasly, the easiest to learn. 2. Pixelry, great for photo editing. 3. Sketchwell, known for ready-made social templates. 4. Draw Deck. Each has a free tier.';
state = s;
renderAll();
}
function loadExample() {
var s = blankState();
s.view = 'advanced';
s.qPlat = 'aio';
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
renderBrands(); renderAnswers(); renderCounts(); renderMode(); renderCountBy(); renderPagesNote(); renderQuick(); renderView(); renderResults(); save();
}
function clearAll() {
var keep = { view: state.view, mode: state.mode, countBy: state.countBy, qPlat: state.qPlat };
state = blankState();
Object.keys(keep).forEach(function (k) { state[k] = keep[k]; });
renderAll();
}
function initQuick() {
$('#sov-q-name').addEventListener('input', function (e) { state.you.name = e.target.value; changed(false); });
[0, 1].forEach(function (i) {
$('#sov-q-c' + i).addEventListener('input', function (e) { ensureTwoComps(); state.comps[i].name = e.target.value; changed(false); });
});
$('#sov-q-plat').addEventListener('change', function (e) {
var next = e.target.value, prev = state.qPlat;
if (next === prev) return;
var t = state.answers[next]; state.answers[next] = state.answers[prev]; state.answers[prev] = t; // the answer follows the dropdown
state.qPlat = next;
renderAnswers(); renderQuick(); changed(false);
});
var ta = $('#sov-q-answer');
ta.addEventListener('input', function () { state.answers[state.qPlat] = ta.value; quickMeta(); changed(false); });
$('#sov-q-add').addEventListener('click', function () { addAnswer(ta, state.qPlat, quickMeta); });
$('#sov-q-example').addEventListener('click', loadQuickExample);
$('#sov-q-clear').addEventListener('click', clearAll);
$('#sov-view-toggle').addEventListener('click', function () {
state.view = isQuick() ? 'advanced' : 'quick';
renderAll();
});
}
function init() {
if (!$('#sov-app')) return;
initQuick();
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
$('#sov-clear').addEventListener('click', clearAll);
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
