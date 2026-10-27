import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en'
import tr from './tr'

export const languages = [
  { code: 'tr', label: 'Türkçe', short: 'TR' },
  { code: 'en', label: 'English', short: 'EN' },
] as const
export type Language = (typeof languages)[number]['code']

const STORAGE_KEY = 'pdks.lang'

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'tr' || saved === 'en') return saved
  } catch {
    /* depolama kapalıysa varsayılan dil */
  }
  return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

void i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en } },
  lng: initialLanguage(),
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
  returnObjects: true,
})

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    /* yok say */
  }
})
document.documentElement.lang = i18n.language

/** Tarih ve sayı biçimlendirmede kullanılacak yerel ayar. */
export const locale = () => (i18n.language === 'en' ? 'en-GB' : 'tr-TR')

export default i18n
