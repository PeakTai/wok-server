import { PropValidator } from '..'
import { getI18n } from '../../i18n'

/**
 * 正则校验
 * @param pattern 正则表达式
 * @param msg 错误消息
 * @returns
 */
export function regexp<T>(pattern: RegExp, msg?: string): PropValidator<T> {
  const validator = 'regexp'
  return val => {
    if (val === undefined || val === null) {
      return { ok: true }
    }
    if (typeof val !== 'string') {
      return { ok: false, validator, message: getI18n().buildMsg('validate-err-string') }
    }
    if (!pattern.test(val)) {
      return {
        ok: false,
        validator,
        message: msg || getI18n().buildMsg('validate-err-incorrect-format')
      }
    }
    return { ok: true }
  }
}
