import { Check, Languages, Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { languages } from '../i18n'
import { useTheme, type ThemeChoice } from '../theme/ThemeProvider'
import { Menu } from './ui/Menu'
import { Segmented } from './ui/Segmented'

/** Tema seçimi (açık / koyu / sistem). */
export function ThemeSwitch({ size = 'sm', compact = false }: { size?: 'sm' | 'md'; compact?: boolean }) {
  const { t } = useTranslation()
  const { choice, setChoice } = useTheme()
  const icon = 'size-3.5'
  return (
    <Segmented<ThemeChoice>
      label={t('prefs.theme')}
      size={size}
      value={choice}
      onChange={setChoice}
      options={[
        { value: 'light', label: <span className={compact ? 'sr-only' : 'sr-only sm:not-sr-only'}>{t('prefs.light')}</span>, icon: <Sun className={icon} /> },
        { value: 'dark', label: <span className={compact ? 'sr-only' : 'sr-only sm:not-sr-only'}>{t('prefs.dark')}</span>, icon: <Moon className={icon} /> },
        { value: 'system', label: <span className={compact ? 'sr-only' : 'sr-only sm:not-sr-only'}>{t('prefs.system')}</span>, icon: <Monitor className={icon} /> },
      ]}
    />
  )
}

/** Dil seçimi. */
export function LanguageMenu({ tone = 'default' }: { tone?: 'default' | 'onBrand' }) {
  const { t, i18n } = useTranslation()
  const current = languages.find((l) => l.code === i18n.language) ?? languages[0]
  return (
    <Menu
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={t('prefs.language')}
          className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${tone === 'onBrand' ? 'text-on-brand/80 hover:bg-on-brand/10 hover:text-on-brand' : 'text-ink-soft hover:bg-panel-2 hover:text-ink'}`}
        >
          <Languages className="size-4" />
          {current.short}
        </button>
      )}
    >
      {(close) =>
        languages.map((lang) => (
          <button
            key={lang.code}
            type="button"
            role="menuitemradio"
            aria-checked={lang.code === current.code}
            onClick={() => {
              void i18n.changeLanguage(lang.code)
              close()
            }}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-panel-2"
          >
            {lang.label}
            {lang.code === current.code && <Check className="size-4 text-signal" />}
          </button>
        ))
      }
    </Menu>
  )
}
