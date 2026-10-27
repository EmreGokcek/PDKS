import 'i18next'
import type { Translations } from './tr'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: Translations }
  }
}
