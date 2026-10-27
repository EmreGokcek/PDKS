import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Role } from '../../auth/types'
import { api } from '../../lib/api'
import type { WeekDayName } from '../../lib/dates'
import type { AttendanceState } from '../attendance/api'
import type { ShiftKind } from '../shifts/leave'

export type DayStatus = 'Off' | 'OnLeave' | 'Upcoming' | 'NotArrived' | 'InProgress' | 'Present' | 'Absent' | 'Unplanned'

export interface DayRecord {
  date: string
  status: DayStatus
  plan: { kind: ShiftKind; startTime: string; endTime: string; breakMinutes: number | null; name: string | null; color: string | null } | null
  firstIn: string | null
  lastOut: string | null
  workedSeconds: number
  breakSeconds: number
  breakAllowanceSeconds: number
  breakOverrunSeconds: number
  lateMinutes: number
  earlyLeaveMinutes: number
  hasUnclosedSession: boolean
}

export interface LivePerson {
  userId: string
  name: string
  role: Role
  state: AttendanceState
  sessionStartedAt: string | null
  breakStartedAt: string | null
  today: DayRecord
}

export interface LiveDashboard {
  date: string
  serverNow: string
  toleranceMinutes: number
  people: LivePerson[]
}

export interface ReportPerson {
  userId: string
  name: string
  role: Role
  isActive: boolean
  workedSeconds: number
  plannedSeconds: number
  overtimeSeconds: number
  breakOverrunSeconds: number
  lateCount: number
  lateMinutes: number
  earlyLeaveCount: number
  absentCount: number
  leaveCount: number
  presentDays: number
  unplannedDays: number
  unclosedCount: number
}

export interface TeamReport {
  from: string
  to: string
  weeklyWorkMinutes: number
  weekStartsOn: WeekDayName
  people: ReportPerson[]
}

export function useLiveDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'live'],
    queryFn: () => api<LiveDashboard>('/dashboard/live'),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

export function useTeamReport(from: string | null, to: string | null) {
  return useQuery({
    queryKey: ['reports', 'team', from, to],
    queryFn: () => api<TeamReport>(`/reports/attendance?from=${from}&to=${to}`),
    enabled: !!from && !!to,
    placeholderData: keepPreviousData,
  })
}

export function usePersonReport(userId: string | null, from: string | null, to: string | null) {
  return useQuery({
    queryKey: ['reports', 'person', userId, from, to],
    queryFn: () => api<{ summary: ReportPerson; days: DayRecord[] }>(`/reports/attendance/${userId}?from=${from}&to=${to}`),
    enabled: !!userId && !!from && !!to,
  })
}
