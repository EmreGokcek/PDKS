import { AnimatePresence, motion } from 'motion/react'
import { CalendarOff, Plus, Wrench } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { PageHeader } from '../../components/AppShell'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Sheet } from '../../components/ui/Overlay'
import { Segmented } from '../../components/ui/Segmented'
import { Spinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/api'
import { addDays, parseDate, todayIso } from '../../lib/dates'
import type { AttendanceAction } from '../attendance/api'
import type { LeaveKind } from '../shifts/leave'
import { useCancelRequest, useCreateRequest, useMyRequests, type RequestType } from './api'
import { RequestCard } from './RequestCard'

/** Personelin talepleri: düzeltme ve izin. */
export function MyRequestsPage() {
  const { t } = useTranslation()
  const list = useMyRequests()
  const cancel = useCancelRequest()
  const [open, setOpen] = useState(false)

  return (
    <>
      <PageHeader
        title={t('requests.myTitle')}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-[18px]" />
            {t('requests.new')}
          </Button>
        }
      />

      {list.isPending ? (
        <div className="grid place-items-center py-24 text-ink-soft">
          <Spinner />
        </div>
      ) : (list.data?.length ?? 0) === 0 ? (
        <p className="rounded-2xl bg-panel p-8 text-center text-ink-soft ring-1 ring-line">{t('requests.empty')}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {list.data!.map((r) => (
              <motion.li key={r.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <RequestCard request={r}>
                  {r.status === 'Pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={cancel.isPending && cancel.variables === r.id}
                      onClick={async () => {
                        try {
                          await cancel.mutateAsync(r.id)
                          toast.success(t('requests.cancelled'))
                        } catch (err) {
                          toast.error(errorMessage(err, t))
                        }
                      }}
                    >
                      {t('requests.cancel')}
                    </Button>
                  )}
                </RequestCard>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} closeLabel={t('common.close')} title={t('requests.new')}>
        {open && <NewRequestForm onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  )
}

const eventTypes: AttendanceAction[] = ['CheckIn', 'BreakStart', 'BreakEnd', 'CheckOut']
const leaveTypes: LeaveKind[] = ['AnnualLeave', 'SickLeave', 'ExcusedLeave']

function NewRequestForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const create = useCreateRequest()
  const [type, setType] = useState<RequestType>('Correction')
  const [eventType, setEventType] = useState<AttendanceAction>('CheckOut')
  const [date, setDate] = useState(addDays(todayIso(), -1))
  const [time, setTime] = useState('18:00')
  const [leaveKind, setLeaveKind] = useState<LeaveKind>('AnnualLeave')
  const [start, setStart] = useState(addDays(todayIso(), 1))
  const [end, setEnd] = useState(addDays(todayIso(), 1))
  const [reason, setReason] = useState('')

  const days = start && end && end >= start ? Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / 86_400_000) + 1 : 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await create.mutateAsync(
        type === 'Correction'
          ? { type, eventType, date, time, reason: reason.trim() }
          : { type, leaveKind, startDate: start, endDate: end, reason: reason.trim() },
      )
      toast.success(t('requests.sent'))
      onDone()
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Segmented<RequestType>
        label={t('requests.new')}
        value={type}
        onChange={setType}
        options={[
          { value: 'Correction', label: t('requests.types.Correction'), icon: <Wrench className="size-4" /> },
          { value: 'Leave', label: t('requests.types.Leave'), icon: <CalendarOff className="size-4" /> },
        ]}
      />
      <p className="text-sm text-ink-soft">{type === 'Correction' ? t('requests.correctionHint') : t('requests.leaveHint')}</p>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={type} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-4">
          {type === 'Correction' ? (
            <>
              <Field label={t('requests.eventType')}>
                {(p) => (
                  <Select {...p} value={eventType} onChange={(e) => setEventType(e.target.value as AttendanceAction)}>
                    {eventTypes.map((ty) => (
                      <option key={ty} value={ty}>
                        {t(`attendance.eventNames.${ty}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('requests.date')}>{(p) => <Input {...p} type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
                <Field label={t('requests.time')}>{(p) => <Input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
              </div>
            </>
          ) : (
            <>
              <Field label={t('requests.leaveKind')}>
                {(p) => (
                  <Select {...p} value={leaveKind} onChange={(e) => setLeaveKind(e.target.value as LeaveKind)}>
                    {leaveTypes.map((lk) => (
                      <option key={lk} value={lk}>
                        {t(`shifts.kinds.${lk}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('requests.start')}>{(p) => <Input {...p} type="date" value={start} onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value) }} />}</Field>
                <Field label={t('requests.end')} hint={days > 0 ? t('requests.dayCount', { count: days }) : undefined}>
                  {(p) => <Input {...p} type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />}
                </Field>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <Field label={t('requests.reason')}>
        {(p) => (
          <textarea
            {...p}
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={type === 'Correction' ? t('requests.reasonCorrection') : t('requests.reasonLeave')}
            className="w-full resize-none rounded-xl border border-line bg-panel px-3.5 py-2.5 text-ink placeholder:text-ink-soft/60 focus:border-signal focus:ring-4 focus:ring-signal/15 focus:outline-none"
          />
        )}
      </Field>

      <Button type="submit" className="w-full" loading={create.isPending} disabled={reason.trim().length < 3 || (type === 'Leave' && days <= 0)}>
        {t('requests.send')}
      </Button>
    </form>
  )
}
