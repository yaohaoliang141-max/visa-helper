import { computeTimeline } from './rules.js';
import { today as getToday, parseDate, diffDays } from './dates.js';
import { LEVEL_P, cumulativeOdds } from './lottery.js';
import { buildIcs } from './ics.js';
import { POLICY, POLICY_UPDATED } from './policy.js';
import { WAITLIST_ENDPOINT } from './config.js';

const KEY = 'visa-helper:v1';
const $ = (s) => document.querySelector(s);
const form = $('#form');

const PHASE = {
  'pre-opt': '等待 OPT',
  opt: 'OPT 期间',
  stem: 'STEM OPT 期间',
  grace: '60 天宽限期',
  expired: '已过期',
};

function store(get, val) {
  try {
    if (get) return JSON.parse(localStorage.getItem(KEY) || 'null');
    localStorage.setItem(KEY, JSON.stringify(val));
  } catch { return null; }
}

function readForm() {
  const f = new FormData(form);
  return {
    programEnd: f.get('programEnd') || '',
    isStem: f.get('isStem') === 'on',
    hasEad: f.get('hasEad') === 'yes',
    eadStart: f.get('eadStart') || '',
    eadEnd: f.get('eadEnd') || '',
    onStem: f.get('onStem') === 'on',
    stemEnd: f.get('stemEnd') || '',
    unemployedDays: f.get('unemployedDays') || '0',
    wageLevel: f.get('wageLevel') || '1',
    h1bFiled: f.get('h1bFiled') === 'on',
  };
}

function writeForm(v) {
  for (const [k, val] of Object.entries(v)) {
    const els = form.elements[k];
    if (!els) continue;
    if (k === 'hasEad') {
      for (const r of form.querySelectorAll('[name=hasEad]')) r.checked = r.value === (val ? 'yes' : 'no');
    } else if (els.type === 'checkbox') els.checked = !!val;
    else els.value = val;
  }
}

function toggle(v) {
  form.querySelectorAll('[data-show=ead]').forEach((el) => (el.hidden = !v.hasEad));
  form.querySelectorAll('[data-show=stem]').forEach((el) => (el.hidden = !(v.hasEad && v.isStem)));
  form.querySelectorAll('[data-show=onstem]').forEach((el) => (el.hidden = !v.onStem));
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function relDays(n) {
  if (n === 0) return '今天';
  return n > 0 ? `${n} 天后` : `${-n} 天前`;
}

let current = null;

function render() {
  const v = readForm();
  toggle(v);
  if (!demo) store(false, v);

  const now = getToday();
  const input = {
    programEnd: v.programEnd,
    isStem: v.isStem,
    eadStart: v.hasEad ? v.eadStart : '',
    eadEnd: v.hasEad ? v.eadEnd : '',
    onStem: v.hasEad && v.onStem,
    stemEnd: v.hasEad && v.onStem ? v.stemEnd : '',
    unemployedDays: v.hasEad ? v.unemployedDays : 0,
    h1bFiled: v.hasEad && v.h1bFiled,
  };
  // 已有工卡但两个日期都没填时，先不出结果
  const ready = parseDate(v.programEnd) && (!v.hasEad || parseDate(v.eadStart) || parseDate(v.eadEnd));
  const r = ready ? computeTimeline(input, now) : null;
  current = r;
  $('#result').hidden = !r || !r.status;
  if (!r || !r.status) return;
  const s = r.status;

  // 警告
  const alert = $('#alert');
  alert.hidden = true;
  alert.className = 'alert';
  if (s.missedOptWindow) {
    alert.textContent = '已经过了 OPT 申请截止日（课程结束后 60 天）。请尽快联系学校 DSO 确认你的身份选项。';
    alert.classList.add('red');
    alert.hidden = false;
  } else if (s.overLimit) {
    alert.textContent = `累计失业已达 ${s.unemployUsed} 天，超过 ${s.unemployLimit} 天上限，SEVIS 记录可能被终止。请立即联系 DSO。`;
    alert.classList.add('red');
    alert.hidden = false;
  } else if (s.phase === 'grace') {
    alert.textContent = '你在 60 天宽限期内：不能工作，需要在宽限期结束前离境、转换身份或入读新项目。';
    alert.classList.add('amber');
    alert.hidden = false;
  } else if (s.phase === 'expired') {
    alert.textContent = '按你填写的日期，身份和宽限期都已结束。请联系 DSO 或移民律师。';
    alert.classList.add('red');
    alert.hidden = false;
  }

  // 数字
  $('#s-phase').textContent = PHASE[s.phase];
  $('#s-days-k').textContent = s.phase === 'grace' ? '宽限期剩余' : s.phase === 'pre-opt' && !input.eadEnd ? '距 OPT 申请截止' : '身份剩余';
  $('#s-days').textContent = s.daysLeft;
  $('#s-days-n').textContent = s.authEnd ? `到 ${s.phase === 'grace' ? '宽限期结束' : s.authEnd}` : '';
  const ub = $('#s-unemploy-box');
  ub.hidden = !input.eadEnd && !input.eadStart;
  ub.classList.toggle('red', s.overLimit || s.unemployLeft <= 15);
  ub.classList.toggle('green', !s.overLimit && s.unemployLeft > 15);
  $('#s-unemploy').textContent = s.unemployLeft;
  $('#s-unemploy-n').textContent = `已用 ${s.unemployUsed} / 上限 ${s.unemployLimit}`;

  // 时间线
  const ol = $('#timeline');
  ol.replaceChildren();
  let todayPlaced = false;
  const todayLine = () => {
    const li = el('li', 'tl-today');
    li.append(el('span', '', '今天'));
    return li;
  };
  for (const m of r.milestones) {
    const d = parseDate(m.date);
    const delta = diffDays(now, d);
    if (!todayPlaced && delta > 0) { ol.append(todayLine()); todayPlaced = true; }
    const li = el('li', `tl ${m.kind}${delta < 0 ? ' past' : ''}${delta === 0 ? ' now' : ''}`);
    const date = el('div', 'tl-date', m.date);
    date.append(el('b', '', relDays(delta)));
    li.append(date, el('div', 'tl-label', m.label));
    if (m.note) li.append(el('div', 'tl-note', m.note));
    ol.append(li);
  }
  if (!todayPlaced) ol.append(todayLine());

  // 抽签
  const lv = +v.wageLevel;
  const lot = $('#lottery');
  lot.hidden = !input.eadStart && !input.eadEnd || input.h1bFiled;
  $('#l-intro').textContent = s.h1bChances > 0
    ? `按你的身份时间，还能参加 ${s.h1bChances} 次 3 月的抽签注册（假设每年都由雇主注册，工资等级不变）。`
    : '按你填写的日期，身份到期前已经赶不上下一次 3 月抽签了。可以和 DSO、律师讨论 Cap-exempt 雇主、读书转 F-1 等其他方案。';
  $('#l-one').textContent = `${(LEVEL_P[lv] * 100).toFixed(1)}%`;
  $('#l-all-k').textContent = `累计 ${s.h1bChances} 次`;
  $('#l-all').textContent = `${(cumulativeOdds(lv, s.h1bChances) * 100).toFixed(1)}%`;
  const bars = $('#l-bars');
  bars.replaceChildren();
  for (const L of [1, 2, 3, 4]) {
    const odds = cumulativeOdds(L, s.h1bChances);
    const row = el('div', `bar${L === lv ? ' me' : ''}`);
    row.append(el('span', '', `Level ${['', 'I', 'II', 'III', 'IV'][L]}`));
    const track = el('div', 'bar-track');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${(odds * 100).toFixed(1)}%`;
    track.append(fill);
    row.append(track, el('span', '', `${(odds * 100).toFixed(0)}%`));
    bars.append(row);
  }
}

function exportIcs() {
  if (!current) return;
  const now = getToday();
  const upcoming = current.milestones.filter((m) => diffDays(now, parseDate(m.date)) >= 0);
  const blob = new Blob([buildIcs(upcoming.length ? upcoming : current.milestones)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '留学身份时间线.ics';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function renderPolicy() {
  $('#p-updated').textContent = POLICY_UPDATED;
  const ol = $('#policy');
  for (const p of POLICY) {
    const li = el('li');
    li.append(el('div', 'p-date', p.date), el('div', 'p-title', p.title), el('p', 'p-body', p.body));
    const src = el('div', 'p-src');
    const a = el('a', '', `来源：${p.sourceName}`);
    a.href = p.source;
    a.target = '_blank';
    a.rel = 'noopener';
    src.append(a);
    li.append(src);
    ol.append(li);
  }
}

async function onWaitlist(e) {
  e.preventDefault();
  const msg = $('#wl-msg');
  const email = new FormData(e.target).get('email');
  msg.hidden = false;
  if (!WAITLIST_ENDPOINT) {
    try { localStorage.setItem(KEY + ':wl', '1'); } catch {}
    msg.textContent = '谢谢！付费版还在准备中，名单功能马上开放。';
    return;
  }
  msg.textContent = '提交中…';
  try {
    const res = await fetch(WAITLIST_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source: 'visa-helper' }),
    });
    if (!res.ok) throw new Error(res.status);
    msg.textContent = '已登记！开放时第一时间通知你。';
    e.target.reset();
  } catch {
    msg.textContent = '提交失败，请稍后再试。';
  }
}

// ?demo 用示例数据展示（不写入本地存储），方便第一次来的人和截图
const DEMO = {
  programEnd: '2026-05-15', isStem: true, hasEad: true, eadStart: '2026-06-01', eadEnd: '',
  onStem: false, stemEnd: '', unemployedDays: '23', wageLevel: '1', h1bFiled: false,
};
let demo = new URLSearchParams(location.search).has('demo');
const saved = demo ? DEMO : store(true);
if (saved) writeForm(saved);
if (demo) form.addEventListener('input', () => { demo = false; history.replaceState(null, '', location.pathname); }, { once: true });
form.addEventListener('input', render);
form.addEventListener('change', render);
$('#ics').addEventListener('click', exportIcs);
$('#waitlist').addEventListener('submit', onWaitlist);
renderPolicy();
render();
if (demo && location.hash) document.querySelector(location.hash)?.scrollIntoView();
