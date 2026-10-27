import { useTranslation } from 'react-i18next'
import { ComingSoon, PageHeader } from '../components/AppShell'

export function ManagerHomePage() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t('nav.dashboard')} />
      <ComingSoon items={t('placeholder.manager', { returnObjects: true }) as unknown as string[]} />
    </>
  )
}
