import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeftRight, Bell, Coffee, UserX, Megaphone, PartyPopper, CalendarCheck2, CalendarClock, CheckCircle2, Inbox, Wrench, XCircle } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { can, myDayPath, pathFor, type User } from '../../auth/types'
import { formatDay, isoDate } from '../../lib/dates'
import { relativeTime, formatTime } from '../../lib/format'
import { useMarkRead, useNotifications, type AppNotification, type NotificationType } from './api'

const icons: Record<NotificationType, ReactNode> = {
  ShiftWeekPublished: <CalendarCheck2 className="size-4" />,
  ShiftChanged: <CalendarClock className="size-4" />,
  RequestCreated: <Inbox className="size-4" />,
  RequestApproved: <CheckCircle2 className="size-4" />,
  RequestRejected: <XCircle className="size-4" />,
  RecordCorrected: <Wrench className="size-4" />,
  AnnouncementPublished: <Megaphone className="size-4" />,
  Congratulated: <PartyPopper className="size-4" />,
  SwapRequested: <ArrowLeftRight className="size-4" />,
  SwapUpdated: <ArrowLeftRight className="size-4" />,
  SwapNeedsApproval: <ArrowLeftRight className="size-4" />,
  EmployeeNotArrived: <UserX className="size-4" />,
  BreakOverrun: <Coffee className="size-4" />,
}

const tones: Record<NotificationType, string> = {
  ShiftWeekPublished: 'bg-signal-soft text-signal',
  ShiftChanged: 'bg-pause-soft text-pause',
  RequestCreated: 'bg-pause-soft text-pause',
  RequestApproved: 'bg-signal-soft text-signal',
  RequestRejected: 'bg-overrun-soft text-overrun',
  RecordCorrected: 'bg-panel-2 text-ink-soft ring-1 ring-line',
  AnnouncementPublished: 'bg-signal-soft text-signal',
  Congratulated: 'bg-pause-soft text-pause',
  SwapRequested: 'bg-pause-soft text-pause',
  SwapUpdated: 'bg-panel-2 text-ink-soft ring-1 ring-line',
  SwapNeedsApproval: 'bg-pause-soft text-pause',
  EmployeeNotArrived: 'bg-overrun-soft text-overrun',
  BreakOverrun: 'bg-overrun-soft text-overrun',
}

/** Bildirime tıklayınca gidilecek sayfa (kullanıcının yetkilerine göre). */
function targetOf(type: NotificationType, user: User): string {
  const at = (segment: string) => pathFor(user.role, segment)
  switch (type) {
    case 'ShiftWeekPublished':
    case 'ShiftChanged':
      return can(user, 'attendance.self') ? at('vardiyalarim') : at('vardiyalar')
    case 'RequestCreated':
      return at('talepler')
    case 'RequestApproved':
    case 'RequestRejected':
      return at('taleplerim')
    case 'RecordCorrected':
      return myDayPath(user)
    case 'AnnouncementPublished':
    case 'Congratulated':
      return at('duyurular')
    case 'SwapRequested':
    case 'SwapUpdated':
      return at('vardiyalarim')
    case 'SwapNeedsApproval':
      return at('talepler')
    case 'EmployeeNotArrived':
    case 'BreakOverrun':
      return can(user, 'dashboard.view') ? at('pano') : at('')
  }
}

/** Menüdeki zil: okunmamış sayısı ve açılır bildirim listesi. */
export function NotificationBell({ tone = 'default' }: { tone?: 'default' | 'onBrand' }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const query = useNotifications()
  const markRead = useMarkRead()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const unread = query.data?.unreadCount ?? 0

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function openItem(n: AppNotification) {
    if (!n.isRead) markRead.mutate([n.id])
    setOpen(false)
    if (user) navigate(targetOf(n.type, user))
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t('notifications.title')}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`relative grid size-9 place-items-center rounded-lg transition-colors ${tone === 'onBrand' ? 'text-on-brand/80 hover:bg-on-brand/10' : 'text-ink-soft hover:bg-panel-2 hover:text-ink'}`}
      >
        <motion.span key={unread} animate={unread ? { rotate: [0, -14, 12, -8, 0] } : undefined} transition={{ duration: 0.6 }}>
          <Bell className="size-5" />
        </motion.span>
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="tabular absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-overrun px-1 text-[11px] font-semibold text-white ring-2 ring-panel"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={t('notifications.title')}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'top left' }}
            className="absolute top-full left-0 z-40 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-panel text-ink shadow-pop ring-1 ring-line max-lg:right-0 max-lg:left-auto"
          >
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-semibold">{t('notifications.title')}</h2>
              {unread > 0 && (
                <button type="button" onClick={() => markRead.mutate(null)} className="text-sm text-signal hover:underline">
                  {t('notifications.markAll')}
                </button>
              )}
            </header>
            <ul className="max-h-[60vh] overflow-y-auto">
              {(query.data?.items ?? []).length === 0 ? (
                <li className="px-4 py-10 text-center text-sm text-ink-soft">{t('notifications.empty')}</li>
              ) : (
                query.data!.items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-panel-2 ${n.isRead ? '' : 'bg-signal-soft/30'}`}
                    >
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${tones[n.type]}`}>{icons[n.type]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{t(`notifications.${n.type}.title`)}</span>
                          {!n.isRead && <span className="size-2 shrink-0 rounded-full bg-signal" />}
                        </span>
                        <span className="block text-sm text-ink-soft first-letter:uppercase">
                          <NotificationBody n={n} />
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-soft/80">{relativeTime(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Bildirim metni seçili dilde, saklanan parametrelerden oluşturulur. */
function NotificationBody({ n }: { n: AppNotification }) {
  const { t } = useTranslation()
  const d = (n.data ?? {}) as Record<string, unknown>
  const day = (iso: string) => formatDay(iso, { day: 'numeric', month: 'long' })
  const typeName = (x: unknown) => (x === 'Leave' ? t('requests.types.Leave') : t('requests.types.Correction')).toLocaleLowerCase()

  let text: string
  switch (n.type) {
    case 'ShiftWeekPublished':
      text = t('notifications.ShiftWeekPublished.body', { date: day(String(d.weekStart)) })
      break
    case 'ShiftChanged':
      text = t('notifications.ShiftChanged.body', { dates: ((d.dates as string[]) ?? []).map(day).join(', ') })
      break
    case 'RequestCreated':
      text = t('notifications.RequestCreated.body', { name: String(d.name ?? ''), type: typeName(d.type) })
      break
    case 'RequestApproved':
    case 'RequestRejected':
      text = t(`notifications.${n.type}.body`, { type: typeName(d.type) })
      break
    case 'RecordCorrected': {
      const at = String(d.at ?? '')
      text = t('notifications.RecordCorrected.body', {
        date: at ? day(isoDate(new Date(at))) : '',
        time: at ? formatTime(at) : '',
        event: t(`attendance.eventNames.${String(d.type) as 'CheckIn'}`).toLocaleLowerCase(),
        action: t(`notifications.actions.${String(d.action) as 'added'}`),
      })
      break
    }
    case 'AnnouncementPublished':
      text = t('notifications.AnnouncementPublished.body', { author: String(d.author ?? ''), title: String(d.title ?? '') })
      break
    case 'Congratulated':
      text =
        d.kind === 'WorkAnniversary'
          ? t('notifications.Congratulated.bodyAnniversary', { from: String(d.from ?? '') })
          : t('notifications.Congratulated.bodyBirthday', { from: String(d.from ?? '') })
      break
    case 'SwapRequested':
      text = t('notifications.SwapRequested.body', { name: String(d.name ?? ''), date: day(String(d.date)) })
      break
    case 'SwapUpdated': {
      const status = String(d.status ?? 'Approved') as 'Approved'
      text = t(`notifications.SwapUpdated.${status}`, { name: String(d.name ?? ''), date: day(String(d.date)) })
      break
    }
    case 'SwapNeedsApproval':
      text = t('notifications.SwapNeedsApproval.body', { date: day(String(d.date)) })
      break
    case 'EmployeeNotArrived':
      text = t('notifications.EmployeeNotArrived.body', { name: String(d.name ?? ''), start: String(d.start ?? ''), minutes: Number(d.minutes ?? 0) })
      break
    case 'BreakOverrun':
      text = t('notifications.BreakOverrun.body', { name: String(d.name ?? ''), minutes: Number(d.minutes ?? 0) })
      break
  }
  const note = typeof d.note === 'string' && d.note ? ` ${t('notifications.note', { note: d.note })}` : ''
  return (
    <>
      {text}
      {note}
    </>
  )
}
