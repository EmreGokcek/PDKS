import type { TimesheetCode } from './api'

/** Gün kodlarının renkleri (Excel çıktısıyla aynı). */
export const codeStyle: Partial<Record<TimesheetCode, string>> = {
  WeeklyOff: 'bg-[#eceff3] text-[#52687c] dark:bg-[#22364a] dark:text-[#a9bccd]',
  AnnualLeave: 'bg-[#d9f4f7] text-[#0b7f8c] dark:bg-[#0e3940] dark:text-[#6fd3df]',
  SickLeave: 'bg-[#fbe3e7] text-[#b0304a] dark:bg-[#43202a] dark:text-[#f19aab]',
  ExcusedLeave: 'bg-[#fbf1dc] text-[#8a5e10] dark:bg-[#3d321a] dark:text-[#e7c27a]',
  Absent: 'bg-overrun-soft text-overrun',
  PublicHoliday: 'bg-[#ede7f6] text-[#5b3c99] dark:bg-[#2e2445] dark:text-[#c3b0f0]',
}

