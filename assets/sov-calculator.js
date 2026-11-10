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
var STORE_KEY = 'jen-sov-calculator-v3';
var OLD_KEY = 'jen-sov-calculator-v2';
var CALC_URL = 'jenalston.com/ai-share-of-voice-calculator';

function blankComp() { return { site: '', page: '', name: '' }; }
function blankState() {
return { view: 'quick', qPlat: 'chatgpt', you: blankComp(), comps: [blankComp(), blankComp()], cards: [] };
}
function validPlat(id) { return PLATFORMS.some(function (p) { return p.id === id; }); }
function str(v) { return typeof v === 'string' ? v : ''; }
function splitAnswers(text) {
if (!text || !text.trim()) return [];
return text.split(/^\s*-{3,}\s*$/m).map(function (a) { return a.trim(); }).filter(Boolean);
}
// Brings over the brand, websites and answers from the previous version of the calculator.
function migrate(old) {
var s = blankState();
if (!old || !old.you) return null;
s.view = old.view === 'advanced' ? 'advanced' : 'quick';
s.qPlat = validPlat(old.qPlat) ? old.qPlat : 'chatgpt';
s.you = { site: str(old.you.domain), page: '', name: str(old.you.name) };
if (Array.isArray(old.comps)) s.comps = old.comps.slice(0, MAX_COMPETITORS).map(function (c) { c = c || {}; return { site: str(c.domain), page: '', name: str(c.name) }; });
if (old.answers && typeof old.answers === 'object') PLATFORMS.forEach(function (p) {
splitAnswers(str(old.answers[p.id])).forEach(function (t) { s.cards.push({ plat: p.id, text: t }); });
});
return s;
}
function load() {
try {
var raw = window.localStorage.getItem(STORE_KEY), s;
if (raw) s = JSON.parse(raw);
else { var o = window.localStorage.getItem(OLD_KEY); s = o ? migrate(JSON.parse(o)) : null; }
if (!s || !s.you) return null;
var b = blankState();
b.view = s.view === 'advanced' ? 'advanced' : 'quick';
b.qPlat = validPlat(s.qPlat) ? s.qPlat : 'chatgpt';
b.you = { site: str(s.you.site), page: str(s.you.page), name: str(s.you.name) };
if (Array.isArray(s.comps)) b.comps = s.comps.slice(0, MAX_COMPETITORS).map(function (c) { c = c || {}; return { site: str(c.site), page: str(c.page), name: str(c.name) }; });
if (Array.isArray(s.cards)) b.cards = s.cards.filter(function (c) { return c && validPlat(c.plat); }).map(function (c) { return { plat: c.plat, text: str(c.text) }; });
return b;
} catch (e) { return null; }
}
var state = load() || blankState();
function save() { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage off */ } }
function isQuick() { return state.view === 'quick'; }
function platName(id) { for (var i = 0; i < PLATFORMS.length; i++) if (PLATFORMS[i].id === id) return PLATFORMS[i].name; return ''; }
function ensureTwoComps() { while (state.comps.length < 2) state.comps.push(blankComp()); }

function $(sel, root) { return (root || document).querySelector(sel); }
function el(tag, attrs, kids) {
var n = document.createElement(tag);
if (attrs) Object.keys(attrs).forEach(function (k) {
var v = attrs[k];
if (v === null || v === undefined || v === false) return;
if (k === 'text') n.textContent = v;
else if (k === 'class') n.className = v;
else if (k.indexOf('on') === 0 && typeof v === 'function') n.addEventListener(k.slice(2), v);
else n.setAttribute(k, v);
});
(kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
return n;
}

// ---------- Matching ----------
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
var modernRe = (function () { try { new RegExp('(?<![\\p{L}])a', 'u'); return true; } catch (e) { return false; } })();
function nameMatcher(name) {
if (!name) return null;
var body = escRe(name);
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
// "https://www.example.com/page/?x=1" -> domain "example.com", page "example.com/page". A bare domain has no page.
function parseTarget(u) {
var s = (u || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
if (!s || s.indexOf('.') === -1) return null;
var slash = s.indexOf('/');
var dom = (slash === -1 ? s : s.slice(0, slash)).replace(/:\d+$/, '');
if (!/^[a-z0-9.-]+\.[a-z0-9-]+$/.test(dom)) return null;
var page = slash === -1 ? '' : dom + s.slice(slash);
return { dom: dom, page: page, label: page || dom };
}
// Website URL gives the domain, page URL gives the page. A page URL alone also supplies the domain.
function targetOf(e) {
var ts = parseTarget(e.site), tp = parseTarget(e.page);
var dom = ts ? ts.dom : (tp ? tp.dom : '');
if (!dom) return null;
var page = tp ? tp.page : '';
return { dom: dom, page: page, label: page || dom };
}
// Quick start shows one box: the page URL if there is one, otherwise the website URL.
function quickValue(e) { return e.page.trim() ? e.page : e.site; }
function setQuick(e, v) {
var t = parseTarget(v);
if (t && t.page) { e.page = v; var ts = parseTarget(e.site); if (!ts || ts.dom !== t.dom) e.site = t.dom; } // fills the website so advanced shows both
else { e.site = v; e.page = ''; }
}
function filledEnt(c) { return !!(c.site.trim() || c.page.trim() || c.name.trim()); }
function hits(re, text) { if (!re) return false; re.lastIndex = 0; return re.test(text); }

// ---------- Results ----------
function entities() {
var q = isQuick();
var list = [{ key: 'you', isYou: true, t: targetOf(state.you), name: state.you.name.trim() }];
state.comps.forEach(function (c, i) {
if (q && i > 1) return;
var t = targetOf(c), n = c.name.trim();
if (t || n) list.push({ key: 'c' + i, isYou: false, t: t, name: n });
});
list.forEach(function (e) {
e.dm = e.t ? domainMatcher(e.t.dom) : null;
e.pm = e.t && e.t.page ? pageMatcher(e.t.page) : e.dm;
e.nm = nameMatcher(e.name);
});
return list;
}
function activeCards() {
return state.cards.filter(function (c) { return c.text.trim() && (!isQuick() || c.plat === state.qPlat); });
}
// Each site, page and name counts once per answer.
function tally(answers, ents) {
var t = { answers: answers.length, by: {}, page: 0, dom: 0, men: 0 };
ents.forEach(function (e) { t.by[e.key] = { page: 0, dom: 0, men: 0 }; });
answers.forEach(function (a) {
ents.forEach(function (e) {
var b = t.by[e.key];
if (hits(e.pm, a)) b.page++;
if (hits(e.dm, a)) b.dom++;
if (hits(e.nm, a)) b.men++;
});
});
ents.forEach(function (e) { var b = t.by[e.key]; t.page += b.page; t.dom += b.dom; t.men += b.men; });
return t;
}
function compute() {
var ents = entities(), cards = activeCards();
var r = { quick: isQuick(), ents: ents, you: ents[0], answers: cards.length, platforms: [] };
r.all = tally(cards.map(function (c) { return c.text; }), ents);
PLATFORMS.forEach(function (p) {
var list = cards.filter(function (c) { return c.plat === p.id; }).map(function (c) { return c.text; });
if (list.length) r.platforms.push({ id: p.id, name: p.name, t: tally(list, ents) });
});
r.isPage = !!(r.you.t && r.you.t.page);
r.hasNames = !!r.you.name;
return r;
}
function pct(n, d) { return d > 0 ? (n / d) * 100 : null; }
function fmtPct(v) { if (v === null || v === undefined) return '–'; return Math.round(v) + '%'; }
function times(n) { return n === 1 ? '1 time' : n + ' times'; }
function ans(n) { return n === 1 ? '1 answer' : n + ' answers'; }
function lead(r) { return r.isPage ? { k: 'page', label: 'page-level share', what: 'your page', pool: 'the pages you’re tracking' } : { k: 'dom', label: 'domain-level share', what: 'your site', pool: 'the sites you’re tracking' }; }
function whereText(r) { return r.quick ? r.platforms[0].name : 'AI tools'; }
function problem(r) {
if (!r.you.t) return 'Add your website or page in step 1 to see your results here.';
if (r.ents.length < 2) return 'Add at least one competitor in step 1 so there’s someone to compare you with.';
if (!r.answers) return 'Paste an AI answer in step 2. Your results will appear here as soon as you do.';
return '';
}
function stat(label, value, line) {
return el('div', { class: 'sov-stat' }, [el('div', { class: 'sov-stat-top' }, [el('span', { text: label }), el('b', { text: value })]), line ? el('p', { class: 'sov-stat-line', text: line }) : null]);
}
var lastResult = null;
function renderResults() {
var r = compute(), out = $('#sov-results');
lastResult = r;
out.textContent = '';
var msg = problem(r);
$('#sov-csv').hidden = isQuick();
if (msg) { out.appendChild(el('p', { class: 'sov-empty', text: msg })); r.ok = false; updateBar(r); return; }
r.ok = true;
var L = lead(r), me = r.all.by.you, tot = r.all[L.k], n = me[L.k], who = whereText(r);
out.appendChild(el('div', { class: 'sov-kicker', text: 'Your ' + L.label + (r.quick ? ' on ' + r.platforms[0].name : ', all platforms') }));
out.appendChild(el('div', { class: 'sov-big', text: fmtPct(pct(n, tot)) }));
var why;
if (!tot) why = who + ' didn’t cite any of ' + L.pool + ' in ' + (r.answers === 1 ? 'this answer' : 'these answers') + '. Check that you copied the sources, and that the web addresses in step 1 are spelled right.';
else if (r.quick) why = who + ' cited ' + L.what + ' in ' + n + ' of ' + ans(r.answers) + '. That gives ' + L.what + ' ' + fmtPct(pct(n, tot)) + ' of the citations among ' + L.pool + '.';
else why = 'AI tools cited ' + L.what + ' ' + n + ' of the ' + times(tot) + ' they cited ' + L.pool + ', across ' + ans(r.answers) + '.';
out.appendChild(el('p', { class: 'sov-why', text: why }));
var stats = el('div', { class: 'sov-stats' });
if (r.isPage) stats.appendChild(stat('Domain-level share', fmtPct(pct(me.dom, r.all.dom)), 'Counts any page on each site. ' + who + ' cited ' + r.you.t.dom + ' ' + me.dom + ' of ' + times(r.all.dom) + '.'));
else stats.appendChild(el('p', { class: 'sov-stat-line', text: 'Want page-level results? Enter a page URL, like https://' + r.you.t.dom + '/your-page, in step 1.' }));
if (r.hasNames) stats.appendChild(stat('Mention share', fmtPct(pct(me.men, r.all.men)), r.all.men ? who + ' named ' + r.you.name + ' in ' + me.men + ' of ' + r.all.men + ' brand mentions.' : who + ' didn’t name any of these brands.'));
else stats.appendChild(el('p', { class: 'sov-stat-line', text: 'Want brand mentions too? Open “Also count brand mentions” in step 1.' }));
out.appendChild(stats);
if (!r.quick) renderPlatformTable(out, r, L);
if (r.answers < 3) out.appendChild(el('p', { class: 'sov-nudge', text: r.quick ? SAMPLE_NOTE_QUICK : SAMPLE_NOTE }));
if (r.quick) out.appendChild(el('p', { class: 'sov-note', text: 'Want to compare platforms or add more competitors? Use Compare more competitors and platforms at the top of the calculator.' }));
updateBar(r);
}
function renderPlatformTable(out, r, L) {
var head = [el('th', { scope: 'col', text: 'Platform' }), el('th', { scope: 'col', text: r.isPage ? 'Page' : 'Domain' })];
if (r.isPage) head.push(el('th', { scope: 'col', text: 'Domain' }));
if (r.hasNames) head.push(el('th', { scope: 'col', text: 'Mentions' }));
var body = r.platforms.map(function (p) {
var m = p.t.by.you, cells = [el('th', { scope: 'row', text: p.name }), el('td', { text: fmtPct(pct(m[L.k], p.t[L.k])) })];
if (r.isPage) cells.push(el('td', { text: fmtPct(pct(m.dom, p.t.dom)) }));
if (r.hasNames) cells.push(el('td', { text: fmtPct(pct(m.men, p.t.men)) }));
return el('tr', null, cells);
});
out.appendChild(el('h4', { class: 'sov-sub-h', text: 'By platform' }));
out.appendChild(el('div', { class: 'sov-table-wrap' }, [el('table', { class: 'sov-table' }, [el('thead', null, [el('tr', null, head)]), el('tbody', null, body)])]));
var scored = r.platforms.filter(function (p) { return p.t[L.k] > 0; }).map(function (p) { return { name: p.name, v: pct(p.t.by.you[L.k], p.t[L.k]) }; });
if (r.platforms.length > 1 && scored.length) {
var all = r.platforms.map(function (p) { return { name: p.name, v: p.t[L.k] ? pct(p.t.by.you[L.k], p.t[L.k]) : 0 }; });
var best = all.reduce(function (a, b) { return b.v > a.v ? b : a; }), worst = all.reduce(function (a, b) { return b.v < a.v ? b : a; });
if (best.v !== worst.v) out.appendChild(el('p', { class: 'sov-why', text: (r.isPage ? 'Your page' : 'Your site') + ' does best on ' + best.name + ' and weakest on ' + worst.name + '. Start with the sources ' + worst.name + ' cites.' }));
}
}
var SAMPLE_NOTE_QUICK = 'Nice start! AI answers change from run to run, so think of this as a snapshot. For a steadier number, ask the same question two or three more times in a fresh chat, and add each answer with “+ Add another answer.”';
var SAMPLE_NOTE = 'Nice start! AI answers change from run to run, so think of this as a snapshot. Ask each question two or three times per platform for a steadier number.';

// ---------- Copy summary and CSV ----------
function today() { try { return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return new Date().toDateString(); } }
function tracked(r) {
var label = function (e) { return e.t ? e.t.label : e.name; };
return 'Tracked: ' + label(r.you) + ' vs. ' + r.ents.slice(1).map(label).join(', ');
}
function summary(r) {
var me = r.all.by.you, s = [];
s.push('AI share of voice, ' + (r.quick ? r.platforms[0].name : (r.platforms.length === 1 ? '1 platform' : r.platforms.length + ' platforms')) + ', ' + ans(r.answers) + ' (' + today() + ')');
if (r.isPage) s.push('Page-level share: ' + fmtPct(pct(me.page, r.all.page)) + ' (your page was cited ' + me.page + ' of ' + times(r.all.page) + ')');
s.push('Domain-level share: ' + fmtPct(pct(me.dom, r.all.dom)) + (r.isPage ? '' : ' (your site was cited ' + me.dom + ' of ' + times(r.all.dom) + ')'));
if (r.hasNames) s.push('Mention share: ' + fmtPct(pct(me.men, r.all.men)));
if (!r.quick && r.platforms.length > 1) {
s.push('By platform:');
r.platforms.forEach(function (p) {
var m = p.t.by.you, bits = [];
if (r.isPage) bits.push('page ' + fmtPct(pct(m.page, p.t.page)));
bits.push('domain ' + fmtPct(pct(m.dom, p.t.dom)));
if (r.hasNames) bits.push('mentions ' + fmtPct(pct(m.men, p.t.men)));
s.push('- ' + p.name + ': ' + bits.join(', '));
});
}
s.push(tracked(r));
s.push('Made with the free AI Share of Voice Calculator: ' + CALC_URL);
return s.join('\n');
}
function csvCell(v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function share(n, d) { var v = pct(n, d); return v === null ? '' : v.toFixed(1); }
function toCSV(r) {
var lines = [];
lines.push('AI share of voice');
lines.push(['Date', today()].map(csvCell).join(','));
lines.push(['Answers', r.answers].map(csvCell).join(','));
lines.push('');
lines.push(['Platform', 'Website', 'Page', 'Brand name', 'Answers citing the page', 'Answers citing the domain', 'Answers naming the brand', 'Page-level share %', 'Domain-level share %', 'Mention share %'].map(csvCell).join(','));
var blocks = r.platforms.map(function (p) { return { name: p.name, t: p.t }; }).concat([{ name: 'All platforms', t: r.all }]);
blocks.forEach(function (b) {
r.ents.forEach(function (e) {
var m = b.t.by[e.key], hasPage = !!(e.t && e.t.page);
lines.push([b.name, e.t ? e.t.dom : '', hasPage ? e.t.page : '', e.name, hasPage ? m.page : '', e.t ? m.dom : '', e.name ? m.men : '',
e.t ? share(m.page, b.t.page) : '', e.t ? share(m.dom, b.t.dom) : '', e.name ? share(m.men, b.t.men) : ''].map(csvCell).join(','));
});
});
return lines.join('\n');
}
function flash(btn, msg) { var old = btn.textContent; btn.textContent = msg; setTimeout(function () { btn.textContent = old; }, 1600); }

// ---------- Phone results bar ----------
var barSeen = { calc: false, results: false };
function updateBar(r) {
var bar = $('#sov-bar');
if (!bar) return;
if (r && r.ok) {
var L = lead(r);
$('#sov-bar-label').textContent = 'Your ' + L.label + ': ';
$('#sov-bar-val').textContent = fmtPct(pct(r.all.by.you[L.k], r.all[L.k]));
}
bar.hidden = !(lastResult && lastResult.ok && barSeen.calc && !barSeen.results);
}
function initBar() {
var bar = $('#sov-bar');
if (!bar || !('IntersectionObserver' in window)) return;
var watch = function (node, key) {
new IntersectionObserver(function (es) { barSeen[key] = es[0].isIntersecting; updateBar(); }, { threshold: 0.01 }).observe(node);
};
watch($('#calculator'), 'calc');
watch($('#sov-results-panel'), 'results');
bar.addEventListener('click', function () { $('#sov-results-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}

// ---------- Tooltips (hover, keyboard focus or tap) ----------
function closeTips(except) { Array.prototype.forEach.call(document.querySelectorAll('.sov-tip.on'), function (t) { if (t !== except) t.classList.remove('on'); }); }
function wireTip(tip) {
var btn = $('.sov-tip-btn', tip);
btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); closeTips(tip); tip.classList.toggle('on'); });
}
var AIO_TIP = 'Google AI Overviews are the AI summary at the top of regular Google results. Go to google.com, type your question into the normal search box and press Enter. If Google opens a chat-style AI Mode page that looks like Gemini, that’s a different tool, so go back to the regular results. No summary at the top? Try rewording the question. Counting citations? Drag to select the whole AI Overview, including its source cards, then copy and paste: the calculator picks up any real source links automatically. If you only see codes starting /goto?url=, right-click each source and choose Copy link address instead.';
var tipN = 0;
function aioTip() {
var id = 'sov-aio-tip-' + (++tipN);
var tip = el('span', { class: 'sov-tip' }, [
el('button', { type: 'button', class: 'sov-tip-btn', 'aria-label': 'How to get a Google AI Overview', 'aria-describedby': id, text: '?' }),
el('span', { class: 'sov-tip-text', role: 'tooltip', id: id, text: AIO_TIP })
]);
wireTip(tip);
return tip;
}
var GEMINI_TIP = 'Want Gemini’s sources? Copy the answer and paste it here. Then click ⋮ (More) at the bottom of the answer, choose Sources, copy the list that opens on the right, and paste it right under the answer.';

// ---------- Smart paste: pull real source links out of a formatted copy ----------
var SKIP_HOSTS = /(^|\.)(google\.[a-z.]+|gstatic\.com|googleusercontent\.com|chatgpt\.com|openai\.com|perplexity\.ai|bing\.com|copilot\.microsoft\.com|claude\.ai)$/i;
function sourceLinks(html) {
var out = [], seen = {};
try {
var doc = new DOMParser().parseFromString(html, 'text/html');
Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (a) {
var h = a.getAttribute('href') || '';
var m = h.match(/[?&](?:q|url)=(https?[^&]+)/i); // Google /url?q= redirects carry the real address
if (m) { try { h = decodeURIComponent(m[1]); } catch (e) { h = m[1]; } }
if (!/^https?:\/\//i.test(h)) return;
var u; try { u = new URL(h); } catch (e) { return; }
var host = u.hostname.replace(/^www\./, '');
if (SKIP_HOSTS.test(host)) return;
u.hash = '';
['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'srsltid'].forEach(function (k) { u.searchParams.delete(k); });
var clean = u.toString().replace(/\?$/, '');
var key = clean.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();
if (seen[key]) return; seen[key] = true; out.push(clean);
});
} catch (e) { /* ignore */ }
return out;
}
function pasteNote(ta, msg) {
var note = ta.nextElementSibling && ta.nextElementSibling.classList.contains('sov-paste-note') ? ta.nextElementSibling : null;
if (!note) { note = el('p', { class: 'sov-note sov-paste-note', 'aria-live': 'polite' }); ta.parentNode.insertBefore(note, ta.nextSibling); }
note.textContent = msg; note.hidden = false;
clearTimeout(note._t); note._t = setTimeout(function () { note.hidden = true; }, 9000);
}
function smartPaste(ta) {
ta.addEventListener('paste', function (e) {
var cd = e.clipboardData; if (!cd) return;
var old = ta.nextElementSibling; if (old && old.classList.contains('sov-paste-note')) old.hidden = true;
var html = cd.getData('text/html') || '', plain = cd.getData('text/plain') || '';
var coded = /\/goto\?url=/i.test(html + plain);
var links = html ? sourceLinks(html) : [];
var low = plain.toLowerCase();
links = links.filter(function (l) { return low.indexOf(l.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase()) === -1; });
setTimeout(function () {
if (links.length) {
var pos = ta.selectionEnd, v = ta.value;
var add = '\nSources:\n' + links.join('\n') + '\n';
ta.value = v.slice(0, pos).replace(/\s+$/, '') + '\n' + add + v.slice(pos);
try { ta.setSelectionRange(pos + add.length + 1, pos + add.length + 1); } catch (er) { /* ignore */ }
ta.dispatchEvent(new Event('input', { bubbles: true }));
pasteNote(ta, 'Found ' + links.length + (links.length === 1 ? ' source link' : ' source links') + ' in your paste and added ' + (links.length === 1 ? 'it' : 'them') + ' under the answer.');
} else if (coded) {
pasteNote(ta, 'This paste only had Google’s coded links (/goto?url=), so no sources could be added. To count citations, right-click each source and choose Copy link address.');
}
}, 0);
});
}

// ---------- Quick start ----------
function quickText() { return state.cards.filter(function (c) { return c.plat === state.qPlat; }).map(function (c) { return c.text; }).join('\n---\n'); }
function setQuickText(v) {
var pieces = splitAnswers(v), out = [], placed = false;
state.cards.forEach(function (c) {
if (c.plat !== state.qPlat) { out.push(c); return; }
if (!placed) { pieces.forEach(function (t) { out.push({ plat: state.qPlat, text: t }); }); placed = true; }
});
if (!placed) pieces.forEach(function (t) { out.push({ plat: state.qPlat, text: t }); });
state.cards = out;
}
function quickMeta() {
var n = splitAnswers($('#sov-q-answer').value).length;
$('#sov-q-meta').textContent = n ? ans(n) : '';
}
function hasExtras() {
if (state.comps.slice(2).some(filledEnt)) return true;
return state.cards.some(function (c) { return c.text.trim() && c.plat !== state.qPlat; });
}
function renderQuick() {
ensureTwoComps();
$('#sov-q-url').value = quickValue(state.you);
$('#sov-q-name').value = state.you.name;
[0, 1].forEach(function (i) { $('#sov-q-c' + i).value = quickValue(state.comps[i]); $('#sov-q-n' + i).value = state.comps[i].name; });
if (state.you.name || state.comps[0].name || state.comps[1].name) $('#sov-q-names').open = true;
var sel = $('#sov-q-plat');
if (!sel.options.length) PLATFORMS.forEach(function (p) { sel.appendChild(el('option', { value: p.id, text: p.name })); });
sel.value = state.qPlat;
$('#sov-q-answer').value = quickText();
var tipSlot = $('#sov-q-aio-tip');
if (!tipSlot.firstChild) tipSlot.appendChild(aioTip());
tipSlot.hidden = state.qPlat !== 'aio';
$('#sov-q-gem').hidden = state.qPlat !== 'gemini';
quickMeta();
$('#sov-q-hidden-note').hidden = !hasExtras();
}
function addQuickAnswer() {
var ta = $('#sov-q-answer'), v = ta.value.replace(/\s+$/, '');
if (v && !/(^|\n)\s*-{3,}\s*$/.test(v)) v += '\n---\n'; else if (v) v += '\n';
ta.value = v; setQuickText(v); quickMeta(); changed();
ta.focus();
try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) { /* ignore */ }
ta.scrollTop = ta.scrollHeight;
}

// ---------- Advanced ----------
function field(id, label, ph, val, kind, onInput) {
var inp = el('input', { type: 'text', id: id, maxlength: kind === 'name' ? '80' : '200', placeholder: ph, inputmode: kind === 'name' ? null : 'url', autocomplete: 'off' });
inp.value = val;
inp.addEventListener('input', function () { onInput(inp.value); changed(); });
return el('div', null, [el('label', { for: id, text: label }), inp]);
}
function renderBrands() {
var box = $('#sov-comps');
box.textContent = '';
state.comps.forEach(function (c, i) {
var n = i + 1, p = 'sov-c' + i + '-';
var rm = el('button', { type: 'button', class: 'sov-remove', 'aria-label': 'Remove competitor ' + n, text: 'Remove', onclick: function () {
state.comps.splice(i, 1); ensureTwoComps(); renderBrands(); changed();
} });
box.appendChild(el('div', { class: 'sov-comp', role: 'group', 'aria-label': 'Competitor ' + n }, [
el('div', { class: 'sov-comp-head' }, [el('h5', { text: 'Competitor ' + n }), rm]),
el('div', { class: 'sov-ent-grid' }, [
field(p + 'site', 'Website URL', 'e.g., https://competitor.com/', c.site, 'url', function (v) { state.comps[i].site = v; }),
field(p + 'page', 'Page URL (optional)', 'e.g., https://competitor.com/services', c.page, 'url', function (v) { state.comps[i].page = v; }),
field(p + 'name', 'Brand name (optional)', 'e.g., Competitor name', c.name, 'name', function (v) { state.comps[i].name = v; })
])
]));
});
$('#sov-add').hidden = state.comps.length >= MAX_COMPETITORS;
}
function renderCards() {
var box = $('#sov-cards');
box.textContent = '';
if (!state.cards.length) state.cards.push({ plat: state.qPlat, text: '' });
state.cards.forEach(function (c, i) {
var n = i + 1;
var sel = el('select', { 'aria-label': 'Where answer ' + n + ' came from' });
PLATFORMS.forEach(function (p) { sel.appendChild(el('option', { value: p.id, text: p.name })); });
sel.value = c.plat;
var tipSlot = el('span', { class: 'sov-card-tip' }, [aioTip()]);
tipSlot.hidden = c.plat !== 'aio';
var gem = el('p', { class: 'sov-note sov-gem-tip', text: GEMINI_TIP });
gem.hidden = c.plat !== 'gemini';
sel.addEventListener('change', function () { state.cards[i].plat = sel.value; tipSlot.hidden = sel.value !== 'aio'; gem.hidden = sel.value !== 'gemini'; changed(); });
var ta = el('textarea', { rows: '5', spellcheck: 'false', 'aria-label': 'Answer ' + n, placeholder: 'Paste the AI answer here, including its sources.' });
ta.value = c.text;
ta.addEventListener('input', function () { state.cards[i].text = ta.value; changed(); });
smartPaste(ta);
var rm = el('button', { type: 'button', class: 'sov-x', 'aria-label': 'Remove answer ' + n, text: '×', onclick: function () {
state.cards.splice(i, 1); renderCards(); changed();
} });
box.appendChild(el('div', { class: 'sov-card' }, [
el('div', { class: 'sov-card-head' }, [el('span', { class: 'sov-card-n', text: 'Answer ' + n + ' from' }), sel, tipSlot, rm]),
ta, gem
]));
});
}
function addCard() {
var last = state.cards[state.cards.length - 1];
state.cards.push({ plat: last ? last.plat : state.qPlat, text: '' });
renderCards(); changed();
var tas = document.querySelectorAll('#sov-cards textarea');
if (tas.length) tas[tas.length - 1].focus();
}
function renderAdvanced() {
$('#sov-you-site').value = state.you.site;
$('#sov-you-page').value = state.you.page;
$('#sov-you-name').value = state.you.name;
renderBrands();
renderCards();
}

// ---------- Views ----------
function renderView() {
var q = isQuick();
$('#sov-quick').hidden = !q;
$('#sov-adv').hidden = q;
var btn = $('#sov-view-toggle');
btn.textContent = q ? 'Compare more competitors and platforms' : 'Back to quick start';
btn.setAttribute('aria-expanded', q ? 'false' : 'true');
$('#sov-view-note').textContent = q
? 'Quick start: your website or page, a competitor or two and one AI answer. That’s it.'
: 'Advanced: more competitors and platforms.';
$('#sov-view-carry').textContent = q
? 'Everything you’ve entered comes with you.'
: 'Everything you’ve entered comes with you. Quick start counts competitors 1 and 2 and one platform.';
// One shared copy of the prompts and how-to, moved into the step 2 you're looking at.
var slot = $(q ? '#sov-q-shared' : '#sov-a-shared');
slot.appendChild($('#sov-howto'));
slot.appendChild($('#sov-prompts'));
$('#sov-fair').hidden = q;
}
function renderAll() {
renderQuick(); renderAdvanced(); renderView(); renderResults(); save();
}
var timer = null;
function changed() {
save();
if (isQuick()) $('#sov-q-hidden-note').hidden = !hasExtras();
clearTimeout(timer);
timer = setTimeout(renderResults, 120);
}
function clearAll() {
var keep = { view: state.view, qPlat: state.qPlat };
state = blankState();
state.view = keep.view; state.qPlat = keep.qPlat;
renderAll();
}
function switchView() {
if (isQuick()) {
state.view = 'advanced';
} else {
state.view = 'quick';
// Keep showing answers: if none are from the current quick start platform, use the first answer's platform.
var filled = state.cards.filter(function (c) { return c.text.trim(); });
if (filled.length && !filled.some(function (c) { return c.plat === state.qPlat; })) state.qPlat = filled[0].plat;
}
state.cards = state.cards.filter(function (c) { return c.text.trim(); });
renderAll();
}

// ---------- Copy-ready prompts ----------
function initPrompts() {
Array.prototype.forEach.call(document.querySelectorAll('.sov-tip-host .sov-tip'), wireTip);
Array.prototype.forEach.call(document.querySelectorAll('#sov-prompts .sov-prompt'), function (row) {
var tip = $('.sov-tip', row); if (tip) wireTip(tip);
var btn = $('.sov-copy-prompt', row), text = $('.sov-prompt-text', row).textContent.trim();
btn.addEventListener('click', function () {
var done = function () { btn.classList.add('done'); btn.textContent = 'Copied'; setTimeout(function () { btn.classList.remove('done'); btn.textContent = 'Copy'; }, 1600); };
if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
else { fallbackCopy(text); done(); }
});
});
}
function fallbackCopy(t) {
var a = el('textarea', { 'aria-hidden': 'true' }); a.value = t; a.style.position = 'absolute'; a.style.left = '-9999px';
document.body.appendChild(a); a.select();
try { document.execCommand('copy'); } catch (e) { /* ignore */ }
a.remove();
}

function init() {
if (!$('#sov-app')) return;
document.addEventListener('click', function () { closeTips(null); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeTips(null); });
initPrompts();
// Quick start
$('#sov-q-url').addEventListener('input', function (e) { setQuick(state.you, e.target.value); changed(); });
$('#sov-q-name').addEventListener('input', function (e) { state.you.name = e.target.value; changed(); });
[0, 1].forEach(function (i) {
$('#sov-q-c' + i).addEventListener('input', function (e) { ensureTwoComps(); setQuick(state.comps[i], e.target.value); changed(); });
$('#sov-q-n' + i).addEventListener('input', function (e) { ensureTwoComps(); state.comps[i].name = e.target.value; changed(); });
});
$('#sov-q-plat').addEventListener('change', function (e) {
var next = e.target.value, prev = state.qPlat;
if (next === prev) return;
state.cards.forEach(function (c) { if (c.plat === prev) c.plat = next; else if (c.plat === next) c.plat = prev; }); // the answer follows the dropdown
state.qPlat = next;
renderQuick(); renderAdvanced(); changed();
});
var ta = $('#sov-q-answer');
ta.addEventListener('input', function () { setQuickText(ta.value); quickMeta(); changed(); });
smartPaste(ta);
$('#sov-q-add').addEventListener('click', addQuickAnswer);
$('#sov-q-clear').addEventListener('click', clearAll);
// Advanced
$('#sov-you-site').addEventListener('input', function (e) { state.you.site = e.target.value; changed(); });
$('#sov-you-page').addEventListener('input', function (e) { state.you.page = e.target.value; changed(); });
$('#sov-you-name').addEventListener('input', function (e) { state.you.name = e.target.value; changed(); });
$('#sov-add').addEventListener('click', function () {
if (state.comps.length >= MAX_COMPETITORS) return;
state.comps.push(blankComp());
renderBrands(); changed();
var inputs = document.querySelectorAll('#sov-comps .sov-comp input');
if (inputs.length) inputs[inputs.length - 1].focus();
});
$('#sov-add-card').addEventListener('click', addCard);
$('#sov-clear').addEventListener('click', clearAll);
$('#sov-view-toggle').addEventListener('click', switchView);
// Results
$('#sov-copy').addEventListener('click', function (e) {
var btn = e.currentTarget;
if (!lastResult || !lastResult.ok) { flash(btn, 'Nothing to copy yet'); return; }
var text = summary(lastResult);
if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { flash(btn, 'Copied'); }, function () { fallbackCopy(text); flash(btn, 'Copied'); });
else { fallbackCopy(text); flash(btn, 'Copied'); }
});
$('#sov-csv').addEventListener('click', function (e) {
var btn = e.currentTarget;
if (!lastResult || !lastResult.ok) { flash(btn, 'Nothing to download yet'); return; }
var blob = new Blob([toCSV(lastResult)], { type: 'text/csv;charset=utf-8' });
var a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'ai-share-of-voice.csv';
document.body.appendChild(a); a.click();
setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
});
initBar();
renderAll();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
