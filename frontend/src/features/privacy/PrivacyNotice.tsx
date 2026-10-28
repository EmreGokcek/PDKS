import { useTranslation } from 'react-i18next'
import { noticeSections } from './notice'

/** Aydınlatma metninin gövdesi; hem herkese açık sayfada hem ilk giriş onayında kullanılır. */
export function PrivacyNoticeBody({ company }: { company: string | null }) {
  const { i18n } = useTranslation()
  return (
    <div className="space-y-6">
      {noticeSections(i18n.language, company).map((s) => (
        <section key={s.title}>
          <h2 className="font-semibold">{s.title}</h2>
          {s.body.length === 1 ? (
            <p className="mt-2 text-ink-soft">{s.body[0]}</p>
          ) : (
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-soft marker:text-line">
              {s.body.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
