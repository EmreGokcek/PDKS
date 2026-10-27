import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from './auth/AuthContext'
import { FullPageMessage, RequireRole } from './auth/RequireRole'
import { roleHome } from './auth/types'
import { LoginPage } from './pages/LoginPage'
import { AdminPage, EmployeePage, KioskPage, ManagerPage } from './pages/RolePages'

function HomeRedirect() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <FullPageMessage text="Yükleniyor…" />
  return <Navigate to={user ? roleHome[user.role] : '/giris'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/giris" element={<LoginPage />} />
      <Route path="/admin" element={<RequireRole roles={['Admin']}><AdminPage /></RequireRole>} />
      <Route path="/mudur" element={<RequireRole roles={['Admin', 'Manager']}><ManagerPage /></RequireRole>} />
      <Route path="/personel" element={<RequireRole roles={['Employee', 'Manager']}><EmployeePage /></RequireRole>} />
      <Route path="/kiosk" element={<RequireRole roles={['Kiosk']}><KioskPage /></RequireRole>} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
