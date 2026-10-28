import { AnimatePresence, motion } from 'motion/react'
import { BarChart3, CalendarDays, FileSpreadsheet, CalendarRange, Clock3, Inbox, LayoutDashboard, LogOut, Menu as MenuIcon, Send, SlidersHorizontal, Users, X } from 'lucide-react'
import { NotificationBell } from '../features/notifications/NotificationBell'
import { usePendingCount } from '../features/requests/api'
import { Suspense, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../auth/types'
import { LanguageMenu, ThemeSwitch } from './PreferencesControls'
import { Avatar } from './ui/Avatar'
import { IconButton } from './ui/Button'
import { Spinner } from './ui/Spinner'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
  /** Menüde sağda gösterilen sayı (ör. bekleyen talep) */
  badge?: number
}

function useNavItems(role: Role): NavItem[] {
  const { t } = useTranslation()
  const icon = 'size-[18px]'
  const pending = usePendingCount(role === 'Admin' || role === 'Manager').data ?? 0
  switch (role) {
    case 'Admin':
      return [
        { to: '/admin/pano', label: t('nav.dashboard'), icon: <LayoutDashboard className={icon} /> },
        { to: '/admin/vardiyalar', label: t('nav.shiftPlanner'), icon: <CalendarRange className={icon} /> },
        { to: '/admin/sureler', label: t('nav.teamHours'), icon: <BarChart3 className={icon} /> },
        { to: '/admin/puantaj', label: t('nav.timesheet'), icon: <FileSpreadsheet className={icon} /> },
        { to: '/admin/talepler', label: t('nav.requests'), icon: <Inbox className={icon} />, badge: pending },
        { to: '/admin/personel', label: t('nav.staff'), icon: <Users className={icon} /> },
        { to: '/admin/kurallar', label: t('nav.rules'), icon: <SlidersHorizontal className={icon} /> },
      ]
    case 'Manager':
      return [
        { to: '/mudur', label: t('nav.dashboard'), icon: <LayoutDashboard className={icon} />, end: true },
        { to: '/mudur/bugunum', label: t('nav.myDay'), icon: <Clock3 className={icon} /> },
        { to: '/mudur/vardiyalar', label: t('nav.shiftPlanner'), icon: <CalendarRange className={icon} /> },
        { to: '/mudur/vardiyalarim', label: t('nav.myShifts'), icon: <CalendarDays className={icon} /> },
        { to: '/mudur/sureler', label: t('nav.teamHours'), icon: <BarChart3 className={icon} /> },
        { to: '/mudur/puantaj', label: t('nav.timesheet'), icon: <FileSpreadsheet className={icon} /> },
        { to: '/mudur/talepler', label: t('nav.requests'), icon: <Inbox className={icon} />, badge: pending },
        { to: '/mudur/taleplerim', label: t('nav.myRequests'), icon: <Send className={icon} /> },
        { to: '/mudur/ekip', label: t('nav.team'), icon: <Users className={icon} /> },
        { to: '/mudur/kurallar', label: t('nav.rules'), icon: <SlidersHorizontal className={icon} /> },
      ]
    default:
      return [
        { to: '/personel', label: t('nav.myDay'), icon: <Clock3 className={icon} />, end: true },
        { to: '/personel/vardiyalarim', label: t('nav.myShifts'), icon: <CalendarDays className={icon} /> },
        { to: '/personel/taleplerim', label: t('nav.myRequests'), icon: <Send className={icon} /> },
      ]
  }
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const items = useNavItems(user!.role)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pt-6 pb-8">
        <img src="/favicon.svg" alt="" className="size-9 rounded-xl" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold">{user!.companyName}</p>
          {user!.branchName && <p className="truncate text-sm text-ink-soft">{user!.branchName}</p>}
        </div>
        <span className="max-lg:hidden">
          <NotificationBell />
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${isActive ? 'text-ink' : 'text-ink-soft hover:bg-panel-2 hover:text-ink'}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-panel-2 ring-1 ring-line"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                {isActive && (
                  <motion.span
                    layoutId="nav-active-bar"
                    className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-signal"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative">{item.icon}</span>
                <span className="relative flex-1">{item.label}</span>
                <AnimatePresence>
                  {!!item.badge && (
                    <motion.span
                      key={item.badge}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      className="tabular relative grid min-w-6 place-items-center rounded-full bg-pause px-1.5 text-xs font-semibold text-white"
                    >
                      {item.badge}
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-4 border-t border-line p-4">
        <div className="flex items-center justify-between gap-2">
          <ThemeSwitch compact />
          <LanguageMenu />
        </div>
        <div className="flex items-center gap-3">
          <NavLink
            to={`${user!.role === 'Admin' ? '/admin' : user!.role === 'Manager' ? '/mudur' : '/personel'}/profil`}
            onClick={onNavigate}
            title={t('nav.profile')}
            className={({ isActive }) => `-m-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-panel-2 ${isActive ? 'bg-panel-2 ring-1 ring-line' : ''}`}
          >
            <Avatar name={user!.fullName} size="sm" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">{user!.fullName}</p>
              <p className="truncate text-xs text-ink-soft">{t('nav.profile')}</p>
            </div>
          </NavLink>
          <IconButton label={t('nav.logout')} onClick={logout}>
            <LogOut className="size-[18px]" />
          </IconButton>
        </div>
      </div>
    </div>
  )
}

/** Giriş yapılmış sayfaların ortak çerçevesi: kenar menü + içerik. Mobilde menü çekmeceye dönüşür. */
export function AppShell() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!user) return null

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr] print:block">
      <aside className="sticky top-0 z-30 hidden h-dvh border-r border-line bg-panel lg:block print:hidden">
        <Sidebar />
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-panel/85 px-4 py-3 backdrop-blur lg:hidden print:hidden">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-8 rounded-lg" />
          <span className="font-semibold">{user.companyName}</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <IconButton label={t('nav.menu')} onClick={() => setDrawerOpen(true)}>
            <MenuIcon className="size-5" />
          </IconButton>
        </div>
      </header>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-brand/40 backdrop-blur-[2px] lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[min(300px,86vw)] bg-panel shadow-pop lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            >
              <IconButton label={t('common.close')} onClick={() => setDrawerOpen(false)} className="absolute top-5 right-3">
                <X className="size-5" />
              </IconButton>
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="min-w-0">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10 print:max-w-none print:p-0"
        >
          <Suspense fallback={<div className="grid place-items-center py-24 text-ink-soft"><Spinner /></div>}>
            <Outlet />
          </Suspense>
        </motion.div>
      </main>
    </div>
  )
}

/** Sayfa başlığı ve sağdaki işlemler. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
