import { AnimatePresence, motion } from 'motion/react'
import { History, Megaphone, BarChart3, CalendarDays, FileSpreadsheet, UserRound, CalendarRange, Clock3, Inbox, LayoutDashboard, LogOut, Menu as MenuIcon, Send, SlidersHorizontal, Users, X } from 'lucide-react'
import { NotificationBell } from '../features/notifications/NotificationBell'
import { usePendingCount } from '../features/requests/api'
import { Suspense, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { basePath, can, pathFor, type Permission, type User } from '../auth/types'
import { LanguageMenu, ThemeSwitch } from './PreferencesControls'
import { Avatar } from './ui/Avatar'
import { IconButton } from './ui/Button'
import { Spinner } from './ui/Spinner'

type Section = 'today' | 'planning' | 'reports' | 'management' | 'team' | 'me'

interface NavItem {
  to: string
  section?: Section
  /** Mobil alt sekme çubuğunda görünsün mü */
  tab?: boolean
  label: string
  icon: ReactNode
  end?: boolean
  /** Menüde sağda gösterilen sayı (ör. bekleyen talep) */
  badge?: number
}

/** Menü yetkilere göre kurulur: kullanıcı yalnızca yetkisi olan sayfaları görür. */
function useNavItems(user: User): NavItem[] {
  const { t } = useTranslation()
  const icon = 'size-[18px]'
  const has = (p: Permission) => can(user, p)
  const pending = usePendingCount(has('requests.review')).data ?? 0
  const at = (segment: string) => pathFor(user.role, segment)
  const hasBoard = has('dashboard.view')

  // Panosu olmayan (personel): bölümsüz, sade menü; hepsi alt sekme.
  if (!hasBoard) {
    return [
      { to: basePath[user.role], tab: true, label: t('nav.myDay'), icon: <Clock3 className={icon} />, end: true },
      { to: at('vardiyalarim'), tab: true, label: t('nav.myShifts'), icon: <CalendarDays className={icon} /> },
      { to: at('taleplerim'), tab: true, label: t('nav.myRequests'), icon: <Send className={icon} /> },
      { to: at('duyurular'), tab: true, label: t('nav.announcements'), icon: <Megaphone className={icon} /> },
      { to: at('profil'), tab: true, label: t('nav.profile'), icon: <UserRound className={icon} /> },
    ]
  }

  const items: (NavItem & { show: boolean })[] = [
    { show: true, to: basePath[user.role], end: true, section: 'today', tab: true, label: t('nav.dashboard'), icon: <LayoutDashboard className={icon} /> },
    { show: has('requests.review'), to: at('talepler'), section: 'today', tab: true, label: t('nav.requests'), icon: <Inbox className={icon} />, badge: pending },
    { show: true, to: at('duyurular'), section: 'today', label: t('nav.announcements'), icon: <Megaphone className={icon} /> },
    { show: has('shifts.plan'), to: at('vardiyalar'), section: 'planning', tab: true, label: t('nav.shiftPlanner'), icon: <CalendarRange className={icon} /> },
    { show: has('reports.view'), to: at('sureler'), section: 'reports', label: t('nav.teamHours'), icon: <BarChart3 className={icon} /> },
    { show: has('timesheet.view'), to: at('puantaj'), section: 'reports', tab: !has('shifts.plan'), label: t('nav.timesheet'), icon: <FileSpreadsheet className={icon} /> },
    { show: has('staff.view'), to: at('personel'), section: 'management', label: has('staff.manage') ? t('nav.staff') : t('nav.team'), icon: <Users className={icon} /> },
    { show: has('rules.view'), to: at('kurallar'), section: 'management', label: t('nav.rules'), icon: <SlidersHorizontal className={icon} /> },
    { show: has('audit.view'), to: at('denetim'), section: 'management', label: t('nav.audit'), icon: <History className={icon} /> },
    { show: has('attendance.self'), to: at('bugunum'), section: 'me', tab: true, label: t('nav.myDay'), icon: <Clock3 className={icon} /> },
    { show: has('attendance.self'), to: at('vardiyalarim'), section: 'me', label: t('nav.myShifts'), icon: <CalendarDays className={icon} /> },
    { show: has('attendance.self'), to: at('taleplerim'), section: 'me', label: t('nav.myRequests'), icon: <Send className={icon} /> },
  ]
  return items.filter((i) => i.show).map(({ show: _show, ...item }) => item)
}

/** Menü maddelerini bölümlerine göre gruplar (bölümü olmayanlar tek grup). */
function groupBySection(items: NavItem[]) {
  const groups: { section?: Section; items: NavItem[] }[] = []
  for (const item of items) {
    const last = groups.at(-1)
    if (last && last.section === item.section) last.items.push(item)
    else groups.push({ section: item.section, items: [item] })
  }
  return groups
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const items = useNavItems(user!)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pt-6 pb-6">
        <img src="/favicon.svg" alt="" className="size-9 rounded-xl" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold">{user!.companyName}</p>
          {user!.branchName && <p className="truncate text-sm text-ink-soft">{user!.branchName}</p>}
        </div>
        <span className="max-lg:hidden">
          <NotificationBell />
        </span>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groupBySection(items.filter((i) => !i.to.endsWith('/profil'))).map((group, gi) => (
          <div key={gi} className="space-y-1">
            {group.section && (
              <p className="px-3 pb-1 text-xs font-medium text-ink-soft/70">{t(`nav.sections.${group.section}`)}</p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-medium transition-colors ${isActive ? 'text-ink' : 'text-ink-soft hover:bg-panel-2 hover:text-ink'}`
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
          </div>
        ))}
      </nav>

      <div className="space-y-4 border-t border-line p-4">
        <div className="flex items-center justify-between gap-2">
          <ThemeSwitch compact />
          <LanguageMenu />
        </div>
        <div className="flex items-center gap-3">
          <NavLink
            to={pathFor(user!.role, 'profil')}
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

/** Telefonda altta sabit sekme çubuğu. Admin ve müdürde son sekme menüyü açar. */
function TabBar({ onMore }: { onMore: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const tabs = useNavItems(user!).filter((i) => i.tab).slice(0, 4)
  const showMore = can(user, 'dashboard.view')

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden print:hidden"
      aria-label={t('nav.menu')}
    >
      <div className="mx-auto flex max-w-lg">
        {tabs.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-1 px-1 pt-2.5 pb-2 text-[11px] font-medium transition-colors ${isActive ? 'text-signal' : 'text-ink-soft'}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="tab-active"
                    className="absolute top-0 h-[3px] w-10 rounded-b-full bg-signal"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <motion.span className="relative" animate={{ scale: isActive ? 1.12 : 1 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                  {item.icon}
                  {!!item.badge && (
                    <span className="tabular absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-pause px-1 text-[10px] font-semibold text-white">
                      {item.badge}
                    </span>
                  )}
                </motion.span>
                <span className="max-w-full truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
        {showMore && (
          <button type="button" onClick={onMore} className="flex flex-1 flex-col items-center gap-1 px-1 pt-2.5 pb-2 text-[11px] font-medium text-ink-soft">
            <MenuIcon className="size-[18px]" />
            {t('nav.more')}
          </button>
        )}
      </div>
    </nav>
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
        <NotificationBell />
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

      <TabBar onMore={() => setDrawerOpen(true)} />

      <main className="min-w-0">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-8 sm:pt-10 lg:pb-10 print:max-w-none print:p-0"
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
