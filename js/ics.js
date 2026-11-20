// 把里程碑导出成 .ics 日历文件：全天事件 + 提前 7 天提醒。
function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function stamp(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildIcs(milestones, now = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//visa-helper//CN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:留学身份时间线',
  ];
  for (const m of milestones) {
    const d = m.date.replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${m.key}-${d}@visa-helper`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${d}`,
      `SUMMARY:${esc(m.label)}`,
      `DESCRIPTION:${esc((m.note ? m.note + '\n' : '') + '仅供参考，以 USCIS / 学校 DSO 为准')}`,
      'BEGIN:VALARM',
      'TRIGGER:-P7D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc('7 天后：' + m.label)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
