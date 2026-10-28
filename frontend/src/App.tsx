import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from './auth/AuthContext'
import { FullPageLoader, RequireRole } from './auth/RequireRole'
import { basePath, can, roleHome, type Permission, type Role } from './auth/types'
import type { ReactNode } from 'react'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'

// Sayfalar ihtiyaç anında yüklenir; ilk açılış (giriş ekranı) daha hızlı olur.
const named = <T extends Record<string, unknown>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(() => loader().then((m) => ({ default: m[name] as React.ComponentType<Record<string, unknown>> })))

const ChangePasswordPage = named(() => import('./features/account/ChangePasswordPage'), 'ChangePasswordPage')
const WorkRulesPage = named(() => import('./features/settings/WorkRulesPage'), 'WorkRulesPage')
const MyShiftsPage = named(() => import('./features/shifts/MyShiftsPage'), 'MyShiftsPage')
const ShiftPlannerPage = named(() => import('./features/shifts/ShiftPlannerPage'), 'ShiftPlannerPage')
const UsersPage = named(() => import('./features/users/UsersPage'), 'UsersPage')
const ScanLinkPage = named(() => import('./features/attendance/ScanLinkPage'), 'ScanLinkPage')
const TodayPage = named(() => import('./features/attendance/TodayPage'), 'TodayPage')
const KioskPage = named(() => import('./features/kiosk/KioskPage'), 'KioskPage')
const LiveDashboardPage = named(() => import('./features/dashboard/LiveDashboardPage'), 'LiveDashboardPage')
const TeamReportPage = named(() => import('./features/dashboard/TeamReportPage'), 'TeamReportPage')
const MyRequestsPage = named(() => import('./features/requests/MyRequestsPage'), 'MyRequestsPage')
const RequestsPage = named(() => import('./features/requests/RequestsPage'), 'RequestsPage')
const ProfilePage = named(() => import('./features/profile/ProfilePage'), 'ProfilePage')
const TimesheetPage = named(() => import('./features/timesheet/TimesheetPage'), 'TimesheetPage')
const PrivacyNoticePage = named(() => import('./features/privacy/PrivacyPages'), 'PrivacyNoticePage')
const PrivacyConsentPage = named(() => import('./features/privacy/PrivacyPages'), 'PrivacyConsentPage')
const ProfileSetupPage = named(() => import('./features/profile/ProfileSetupPage'), 'ProfileSetupPage')
const MyMonthPage = named(() => import('./features/month/MyMonthPage'), 'MyMonthPage')
const LeavePage = named(() => import('./features/leave/LeavePage'), 'LeavePage')
const AuditPage = named(() => import('./features/audit/AuditPage'), 'AuditPage')
const CompanySettingsPage = named(() => import('./features/company/CompanySettingsPage'), 'CompanySettingsPage')
const RegisterPage = named(() => import('./features/register/RegisterPage'), 'RegisterPage')
const AnnouncementsPage = named(() => import('./features/announcements/AnnouncementsPage'), 'AnnouncementsPage')

function HomeRedirect() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <FullPageLoader />
  return <Navigate to={user ? roleHome[user.role] : '/giris'} replace />
}

const staffRoles: Role[] = ['Admin', 'Manager', 'HumanResources', 'Employee']

/** Yetkisi olmayan sayfaya gelen kişi kendi ana sayfasına döner. */
function Gate({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return null
  return can(user, perm) ? children : <Navigate to={roleHome[user.role]} replace />
}

/** Rolün ana sayfası: panosu olanlarda Genel bakış, diğerlerinde Bugünüm. */
function HomeIndex() {
  const { user } = useAuth()
  if (!user) return null
  return can(user, 'dashboard.view') ? <LiveDashboardPage /> : <TodayPage />
}

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/giris" element={<LoginPage />} />
        <Route path="/kayit" element={<RegisterPage />} />
        <Route path="/sifre-degistir" element={<RequireRole><ChangePasswordPage /></RequireRole>} />
        <Route path="/kvkk" element={<PrivacyNoticePage />} />
        <Route path="/aydinlatma" element={<RequireRole><PrivacyConsentPage /></RequireRole>} />
        <Route path="/profil-tamamla" element={<RequireRole><ProfileSetupPage /></RequireRole>} />

        {/* Her rolün sayfaları kendi önekinde; hangi sayfanın açılacağını yetkiler belirler (docs/YETKILER.md). */}
        {staffRoles.map((role) => (
          <Route key={role} path={basePath[role]} element={<RequireRole roles={[role]}><AppShell /></RequireRole>}>
            <Route index element={<HomeIndex />} />
            <Route path="pano" element={<Gate perm="dashboard.view"><LiveDashboardPage /></Gate>} />
            <Route path="bugunum" element={<Gate perm="attendance.self"><TodayPage /></Gate>} />
            <Route path="vardiyalarim" element={<Gate perm="attendance.self"><MyShiftsPage /></Gate>} />
            <Route path="taleplerim" element={<Gate perm="attendance.self"><MyRequestsPage /></Gate>} />
            <Route path="ayim" element={<Gate perm="attendance.self"><MyMonthPage /></Gate>} />
            <Route path="talepler" element={<Gate perm="requests.review"><RequestsPage /></Gate>} />
            <Route path="vardiyalar" element={<Gate perm="shifts.plan"><ShiftPlannerPage /></Gate>} />
            <Route path="izinler" element={<Gate perm="requests.review"><LeavePage /></Gate>} />
            <Route path="sureler" element={<Gate perm="reports.view"><TeamReportPage /></Gate>} />
            <Route path="puantaj" element={<Gate perm="timesheet.view"><TimesheetPage /></Gate>} />
            <Route path="personel" element={<Gate perm="staff.view"><UsersPage /></Gate>} />
            <Route path="ekip" element={<Navigate to="../personel" replace />} />
            <Route path="kurallar" element={<Gate perm="rules.view"><WorkRulesPage /></Gate>} />
            <Route path="firma" element={<Gate perm="company.manage"><CompanySettingsPage /></Gate>} />
            <Route path="denetim" element={<Gate perm="audit.view"><AuditPage /></Gate>} />
            <Route path="duyurular" element={<AnnouncementsPage />} />
            <Route path="profil" element={<ProfilePage />} />
          </Route>
        ))}

        {/* Telefonun kendi kamerasıyla kiosk QR'ı okutulunca açılan sayfa */}
        <Route path="/okut" element={<RequireRole roles={staffRoles}><ScanLinkPage /></RequireRole>} />
        <Route path="/kiosk" element={<RequireRole roles={['Kiosk']}><KioskPage /></RequireRole>} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Suspense>
  )
}
