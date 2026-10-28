import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

export type TimesheetCode = 'None' | 'Work' | 'Planned' | 'WeeklyOff' | 'AnnualLeave' | 'SickLeave' | 'ExcusedLeave' | 'Absent' | 'Off'

export interface TimesheetCell {
  date: string
  code: TimesheetCode
  hours: number
  late: boolean
  earlyLeave: boolean
  breakOverrun: boolean
  unclosed: boolean
  unplanned: boolean
}

export interface TimesheetTotals {
  workedDays: number
  workedHours: number
  plannedHours: number
  overtimeHours: number
  lateCount: number
  lateMinutes: number
  earlyLeaveCount: number
  absentDays: number
  weeklyOffDays: number
  annualLeaveDays: number
  sickLeaveDays: number
  excusedLeaveDays: number
  breakOverrunHours: number
  unclosedCount: number
}

export interface Timesheet {
  companyName: string
  branchName: string | null
  year: number
  month: number
  from: string
  to: string
  weeklyWorkMinutes: number
  rows: {
    userId: string
    name: string
    employeeNumber: string | null
    position: string | null
    cells: TimesheetCell[]
    totals: TimesheetTotals
  }[]
}

export function useTimesheet(year: number, month: number) {
  return useQuery({
    queryKey: ['reports', 'monthly', year, month],
    queryFn: () => api<Timesheet>(`/reports/monthly?year=${year}&month=${month}`),
    placeholderData: keepPreviousData,
  })
}
