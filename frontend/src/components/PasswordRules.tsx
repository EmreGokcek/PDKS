import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Şifre kuralları (sunucudaki PasswordPolicy ile aynı). confirm verilirse "iki şifre aynı" kuralı da eklenir. */
export function usePasswordRules(password: string, confirm?: string) {
  const { t } = useTranslation()
  const rules = [
    { ok: password.length >= 8, label: t('changePassword.ruleLength') },
    { ok: /\p{L}/u.test(password), label: t('changePassword.ruleLetter') },
    { ok: /\d/.test(password), label: t('changePassword.ruleDigit') },
  ]
  if (confirm !== undefined) rules.push({ ok: password.length > 0 && password === confirm, label: t('changePassword.ruleMatch') })
  return rules
}

/** Kuralların tek tek yeşile döndüğü liste. */
export function PasswordRules({ rules, className = 'grid grid-cols-2 gap-x-4 gap-y-2' }: { rules: { ok: boolean; label: string }[]; className?: string }) {
  return (
    <ul className={`text-sm ${className}`}>
      {rules.map((r) => (
        <li key={r.label} className={`flex items-center gap-2 transition-colors ${r.ok ? 'text-signal' : 'text-ink-soft'}`}>
          <span className={`grid size-4 place-items-center rounded-full transition-colors ${r.ok ? 'bg-signal text-white' : 'ring-1 ring-line'}`}>
            <AnimatePresence>
              {r.ok && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 25 }}>
                  <Check className="size-3" strokeWidth={3} />
                </motion.span>
              )}
            </AnimatePresence>
          </span>
          {r.label}
        </li>
      ))}
    </ul>
  )
}
