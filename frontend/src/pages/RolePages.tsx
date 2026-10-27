import { useAuth } from '../auth/AuthContext'
import { AppShell, ComingSoon } from '../components/AppShell'
import { LiveClock } from '../components/LiveClock'

export function AdminPage() {
  return (
    <AppShell title="Yönetim paneli">
      <ComingSoon
        items={[
          'Personel ekleme, düzenleme, pasife alma',
          'Çalışma kuralları: haftalık süre, mola hakkı, geç kalma toleransı',
          'Kiosk cihazlarını yönetme',
        ]}
      />
    </AppShell>
  )
}

export function ManagerPage() {
  return (
    <AppShell title="Ekip paneli">
      <ComingSoon
        items={[
          'Canlı durum: kim içeride, kim molada, kim gelmedi',
          'Haftalık vardiya planlama',
          'Personel bazlı çalışma ve mola süreleri',
        ]}
      />
    </AppShell>
  )
}

export function EmployeePage() {
  const { user } = useAuth()
  return (
    <AppShell title={`Merhaba, ${user?.firstName ?? ''}`}>
      <ComingSoon
        items={[
          'QR okutarak giriş, çıkış ve mola',
          'Kalan mola süresi',
          'Günlük ve haftalık çalışma, fazla mesai',
          'Haftalık vardiyalarım',
        ]}
      />
    </AppShell>
  )
}

/** Kiosk ekranı: Adım 3'te burada 30 saniyede bir yenilenen QR kod gösterilecek. */
export function KioskPage() {
  const { logout } = useAuth()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-ink px-4 text-paper">
      <LiveClock className="text-center" />
      <div className="grid size-64 place-items-center rounded-2xl border-2 border-dashed border-paper/30 text-paper/60">
        QR kod burada olacak
      </div>
      <button type="button" onClick={logout} className="text-sm text-paper/50 underline">
        Kiosk oturumunu kapat
      </button>
    </div>
  )
}
