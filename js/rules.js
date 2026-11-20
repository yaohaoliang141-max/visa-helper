// 身份时间线规则引擎（纯函数，不碰 DOM）。
// 规则出处：
//  - OPT 申请窗口（毕业前 90 天 ~ 后 60 天）、失业上限 90 天：
//    https://studyinthestates.dhs.gov/sevis-help-hub/student-records/fm-student-employment/f-1-optional-practical-training-opt
//  - STEM OPT 24 个月、到期前 90 天内申请、失业合计 150 天：
//    https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-extension-for-stem-students-stem-opt
//  - 60 天宽限期、Cap-gap 延至次年 4 月 1 日（2025-01-17 起）：
//    https://studyinthestates.dhs.gov/stem-opt-hub/additional-resources/stem-opt-extension-overview
import { parseDate, addDays, addMonths, diffDays, fmt, ymd } from './dates.js';

export const RULES = {
  optApplyBefore: 90,
  optApplyAfter: 60,
  graceDays: 60,
  optUnemploy: 90,
  stemUnemploy: 150,
  optMonths: 12,
  stemMonths: 24,
  stemApplyBefore: 90,
};

function ms(key, date, label, kind, note = '') {
  return { key, date: fmt(date), label, kind, note };
}

// 某年 3 月注册 → 4/1 起递交 → 需要身份在当年 4 月 1 日仍有效
function countChances(authEnd, today) {
  if (!authEnd) return { n: 0, first: null };
  let n = 0;
  let first = null;
  for (let y = today.getUTCFullYear(); y <= authEnd.getUTCFullYear(); y++) {
    const apr1 = ymd(y, 4, 1);
    if (apr1 > today && authEnd >= apr1) {
      n++;
      if (first === null) first = y;
    }
  }
  return { n, first };
}

export function computeTimeline(input, today) {
  const programEnd = parseDate(input.programEnd);
  if (!programEnd) return { milestones: [], status: null };

  const isStem = !!input.isStem;
  const onStem = isStem && !!input.onStem;
  const eadStart = parseDate(input.eadStart);
  let eadEnd = parseDate(input.eadEnd);
  if (eadStart && !eadEnd) eadEnd = addDays(addMonths(eadStart, RULES.optMonths), -1);

  const out = [];
  out.push(ms('program-end', programEnd, '课程结束（Program End Date）', 'info'));
  const optOpen = addDays(programEnd, -RULES.optApplyBefore);
  const optClose = addDays(programEnd, RULES.optApplyAfter);
  out.push(ms('opt-window-open', optOpen, 'OPT 申请窗口开启', 'window', '最早可在课程结束前 90 天递交 I-765'));
  out.push(ms('opt-window-close', optClose, 'OPT 申请截止 / 无 OPT 宽限期结束', 'deadline', '课程结束后 60 天内必须递交，且需在 DSO 推荐后 30 天内'));

  const used = Math.max(0, Math.floor(+input.unemployedDays || 0));
  const unemployLimit = onStem ? RULES.stemUnemploy : RULES.optUnemploy;
  const unemployLeft = Math.max(0, unemployLimit - used);
  const overLimit = used >= unemployLimit;

  let phase;
  let authEnd = null;
  let daysLeft = 0;
  let missedOptWindow = false;
  let potentialEnd = null; // 用来估算抽签次数（含尚未申请的 STEM）

  if (!eadEnd) {
    authEnd = optClose;
    if (today <= optClose) {
      phase = 'pre-opt';
      daysLeft = diffDays(today, optClose);
    } else {
      phase = 'expired';
      missedOptWindow = true;
    }
    potentialEnd = null;
  } else {
    if (eadStart) out.push(ms('ead-start', eadStart, 'OPT 工卡（EAD）生效', 'info', '从这天起开始计算失业天数'));
    out.push(ms('ead-end', eadEnd, 'OPT 工卡到期', 'deadline'));

    let stemEnd = null;
    if (isStem) {
      stemEnd = parseDate(input.stemEnd) || addMonths(eadEnd, RULES.stemMonths);
      if (onStem) {
        out.push(ms('stem-end', stemEnd, 'STEM OPT 到期', 'deadline'));
      } else {
        out.push(ms('stem-window-open', addDays(eadEnd, -RULES.stemApplyBefore), 'STEM OPT 延期申请窗口开启', 'window', '需在 OPT 工卡到期前 90 天内递交，且在 DSO 推荐后 60 天内'));
        out.push(ms('stem-window-close', eadEnd, 'STEM OPT 最晚申请日', 'deadline', '宽限期内不能再申请 STEM OPT'));
      }
    }

    const baseEnd = onStem ? stemEnd : eadEnd;
    out.push(ms('grace-end', addDays(baseEnd, RULES.graceDays), '60 天宽限期结束', 'deadline', '宽限期内不能工作，需离境、转身份或入读新项目'));
    authEnd = baseEnd;
    potentialEnd = isStem ? stemEnd : eadEnd;

    if (input.h1bFiled) {
      const y = today.getUTCMonth() >= 3 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
      const capGapEnd = ymd(y + 1, 4, 1);
      out.push(ms('cap-gap-end', capGapEnd, 'Cap-gap 延期到期', 'deadline', 'H-1B 申请已递交时，F-1 身份和工作许可自动延至次年 4 月 1 日'));
      if (capGapEnd > authEnd) authEnd = capGapEnd;
      if (capGapEnd > potentialEnd) potentialEnd = capGapEnd;
    }

    const graceEnd = addDays(authEnd, RULES.graceDays);
    if (today <= authEnd) {
      phase = onStem && today > eadEnd ? 'stem' : eadStart && today < eadStart ? 'pre-opt' : 'opt';
      daysLeft = diffDays(today, authEnd);
    } else if (today <= graceEnd) {
      phase = 'grace';
      daysLeft = diffDays(today, graceEnd);
    } else {
      phase = 'expired';
    }
  }

  const chances = countChances(potentialEnd, today);
  if (chances.first && !input.h1bFiled) {
    out.push(ms('h1b-registration', ymd(chances.first, 3, 1), `下一次 H-1B 抽签注册（${chances.first} 年 3 月）`, 'window', '具体日期以 USCIS 当年公告为准，通常在 3 月上中旬'));
  }

  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    milestones: out,
    status: {
      phase,
      authEnd: authEnd ? fmt(authEnd) : null,
      daysLeft,
      unemployLimit,
      unemployUsed: used,
      unemployLeft,
      overLimit,
      missedOptWindow,
      h1bChances: chances.n,
    },
  };
}
