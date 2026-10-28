import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from './auth/AuthContext'
import { FullPageLoader, RequireRole } from './auth/RequireRole'
import { roleHome } from './auth/types'
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
const AuditPage = named(() => import('./features/audit/AuditPage'), 'AuditPage')
const AnnouncementsPage = named(() => import('./features/announcements/AnnouncementsPage'), 'AnnouncementsPage')

function HomeRedirect() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <FullPageLoader />
  return <Navigate to={user ? roleHome[user.role] : '/giris'} replace />
}

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/giris" element={<LoginPage />} />
        <Route path="/sifre-degistir" element={<RequireRole><ChangePasswordPage /></RequireRole>} />
        <Route path="/kvkk" element={<PrivacyNoticePage />} />
        <Route path="/aydinlatma" element={<RequireRole><PrivacyConsentPage /></RequireRole>} />
        <Route path="/profil-tamamla" element={<RequireRole><ProfileSetupPage /></RequireRole>} />

        <Route path="/admin" element={<RequireRole roles={['Admin']}><AppShell /></RequireRole>}>
          <Route index element={<Navigate to="pano" replace />} />
          <Route path="pano" element={<LiveDashboardPage />} />
          <Route path="sureler" element={<TeamReportPage />} />
          <Route path="puantaj" element={<TimesheetPage />} />
          <Route path="talepler" element={<RequestsPage />} />
          <Route path="personel" element={<UsersPage />} />
          <Route path="vardiyalar" element={<ShiftPlannerPage />} />
          <Route path="kurallar" element={<WorkRulesPage />} />
          <Route path="denetim" element={<AuditPage />} />
          <Route path="profil" element={<ProfilePage />} />
          <Route path="duyurular" element={<AnnouncementsPage />} />
        </Route>

        <Route path="/mudur" element={<RequireRole roles={['Manager']}><AppShell /></RequireRole>}>
          <Route index element={<LiveDashboardPage />} />
          <Route path="sureler" element={<TeamReportPage />} />
          <Route path="puantaj" element={<TimesheetPage />} />
          <Route path="talepler" element={<RequestsPage />} />
          <Route path="taleplerim" element={<MyRequestsPage />} />
          <Route path="bugunum" element={<TodayPage />} />
          <Route path="vardiyalar" element={<ShiftPlannerPage />} />
          <Route path="vardiyalarim" element={<MyShiftsPage />} />
          <Route path="ekip" element={<UsersPage readOnly />} />
          <Route path="kurallar" element={<WorkRulesPage readOnly />} />
          <Route path="profil" element={<ProfilePage />} />
          <Route path="duyurular" element={<AnnouncementsPage />} />
        </Route>

        <Route path="/personel" element={<RequireRole roles={['Employee']}><AppShell /></RequireRole>}>
          <Route index element={<TodayPage />} />
          <Route path="vardiyalarim" element={<MyShiftsPage />} />
          <Route path="taleplerim" element={<MyRequestsPage />} />
          <Route path="profil" element={<ProfilePage />} />
          <Route path="duyurular" element={<AnnouncementsPage />} />
        </Route>

        {/* Telefonun kendi kamerasıyla kiosk QR'ı okutulunca açılan sayfa */}
        <Route path="/okut" element={<RequireRole roles={['Admin', 'Manager', 'Employee']}><ScanLinkPage /></RequireRole>} />
        <Route path="/kiosk" element={<RequireRole roles={['Kiosk']}><KioskPage /></RequireRole>} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Suspense>
  )
}
