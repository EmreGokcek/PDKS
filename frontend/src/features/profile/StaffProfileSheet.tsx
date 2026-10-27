import { useTranslation } from 'react-i18next'
import { Sheet } from '../../components/ui/Overlay'
import { Spinner } from '../../components/ui/Spinner'
import { useStaffProfile } from './api'
import { ProfileSections } from './ProfileView'

/** Yöneticinin bir personelin profilini (iletişim, acil durum kişisi, kan grubu) görmesi. */
export function StaffProfileSheet({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { t } = useTranslation()
  const profile = useStaffProfile(userId)
  return (
    <Sheet open={!!userId} onClose={onClose} closeLabel={t('common.close')} title={profile.data?.fullName ?? ''} description={profile.data?.position ?? undefined}>
      {profile.isPending || !profile.data ? (
        <div className="grid place-items-center py-16 text-ink-soft">
          <Spinner />
        </div>
      ) : (
        <ProfileSections profile={profile.data} single />
      )}
    </Sheet>
  )
}
