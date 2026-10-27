import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from './auth/AuthContext'
import { FullPageLoader, RequireRole } from './auth/RequireRole'
import { roleHome } from './auth/types'
import { AppShell } from './components/AppShell'
import { ChangePasswordPage } from './features/account/ChangePasswordPage'
import { WorkRulesPage } from './features/settings/WorkRulesPage'
import { MyShiftsPage } from './features/shifts/MyShiftsPage'
import { ShiftPlannerPage } from './features/shifts/ShiftPlannerPage'
import { UsersPage } from './features/users/UsersPage'
import { LoginPage } from './pages/LoginPage'
import { ScanLinkPage } from './features/attendance/ScanLinkPage'
import { TodayPage } from './features/attendance/TodayPage'
import { KioskPage } from './features/kiosk/KioskPage'
import { ManagerHomePage } from './pages/RolePages'

function HomeRedirect() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <FullPageLoader />
  return <Navigate to={user ? roleHome[user.role] : '/giris'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/giris" element={<LoginPage />} />
      <Route path="/sifre-degistir" element={<RequireRole><ChangePasswordPage /></RequireRole>} />

      <Route path="/admin" element={<RequireRole roles={['Admin']}><AppShell /></RequireRole>}>
        <Route index element={<Navigate to="personel" replace />} />
        <Route path="personel" element={<UsersPage />} />
        <Route path="vardiyalar" element={<ShiftPlannerPage />} />
        <Route path="kurallar" element={<WorkRulesPage />} />
      </Route>

      <Route path="/mudur" element={<RequireRole roles={['Manager']}><AppShell /></RequireRole>}>
        <Route index element={<ManagerHomePage />} />
        <Route path="bugunum" element={<TodayPage />} />
        <Route path="vardiyalar" element={<ShiftPlannerPage />} />
        <Route path="vardiyalarim" element={<MyShiftsPage />} />
        <Route path="ekip" element={<UsersPage readOnly />} />
        <Route path="kurallar" element={<WorkRulesPage readOnly />} />
      </Route>

      <Route path="/personel" element={<RequireRole roles={['Employee']}><AppShell /></RequireRole>}>
        <Route index element={<TodayPage />} />
        <Route path="vardiyalarim" element={<MyShiftsPage />} />
      </Route>

      {/* Telefonun kendi kamerasıyla kiosk QR'ı okutulunca açılan sayfa */}
      <Route path="/okut" element={<RequireRole roles={['Admin', 'Manager', 'Employee']}><ScanLinkPage /></RequireRole>} />
      <Route path="/kiosk" element={<RequireRole roles={['Kiosk']}><KioskPage /></RequireRole>} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
