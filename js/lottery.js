// H-1B 加权抽签（2026-02-27 起生效，FY2027 首次使用）。
// 单次中签率为 DHS 在最终规则中的估算（基于 FY2020–FY2024 数据）：
// https://www.federalregister.gov/documents/2025/12/29/2025-23853/weighted-selection-process-for-registrants-and-petitioners-seeking-to-file-cap-subject-h-1b
export const LEVEL_P = { 1: 0.1529, 2: 0.3058, 3: 0.4587, 4: 0.6116 };
export const LEVEL_ENTRIES = { 1: 1, 2: 2, 3: 3, 4: 4 };

export function cumulativeOdds(level, chances) {
  const p = LEVEL_P[level];
  if (!p || !(chances > 0)) return 0;
  return 1 - Math.pow(1 - p, chances);
}
