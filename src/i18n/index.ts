import { ar } from './ar'
import { de } from './de'
import { enUS } from './en-us'
import { es } from './es'
import { fr } from './fr'
import { ExtensibleI18n } from './i18n'
import { ja } from './ja'
import { ko } from './ko'
import { I18nMsgs } from './msg'
import { pt } from './pt'
import { ru } from './ru'
import { zhHK } from './zh-HK'
import { zhTW } from './zh-TW'
import { zhCN } from './zh-cn'

let I18N: ExtensibleI18n<I18nMsgs> | undefined

/**
 * 获取 i18n 对象
 * @returns
 */
export function getI18n(): ExtensibleI18n<I18nMsgs> {
  if (I18N) {
    return I18N
  }
  // 如果 i18n 对象不存在，则创建，并进行初始化
  I18N = new ExtensibleI18n(enUS)
  I18N.setMsgs('zh-CN', zhCN)
  I18N.setMsgs('zh-TW', zhTW)
  I18N.setMsgs('zh-HK', zhHK)
  I18N.setMsgs('ja', ja)
  I18N.setMsgs('ko', ko)
  I18N.setMsgs('es', es)
  I18N.setMsgs('de', de)
  I18N.setMsgs('fr', fr)
  I18N.setMsgs('ar', ar)
  I18N.setMsgs('pt', pt)
  I18N.setMsgs('ru', ru)
  // 当前语言
  if (process.env.LANG) {
    I18N.setLang(process.env.LANG)
  } else if (process.env.LC_CTYPE) {
    const [tag] = process.env.LC_CTYPE.split('.')
    I18N.setLang(tag)
  }
  return I18N
}

export * from './i18n'
export * from './msg'
