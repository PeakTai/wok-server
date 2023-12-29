import { PropValidator } from '..'
import { getI18n } from '../../i18n'

/**
 * 字符串非空校验，以下的情况不会通过校验：undefined，null，非 string 类型，空白字符串.
 * @param message
 * @returns
 */
export function notBlank<T>(message?: string): PropValidator<T> {
  const validator = 'notBlank'
  return val => {
    if (val === undefined || val === null) {
      return {
        ok: false,
        validator,
        message: message || getI18n().buildMsg('validate-err-empty')
      }
    }
    if (typeof val !== 'string') {
      return { ok: false, validator, message: getI18n().buildMsg('validate-err-string') }
    }
    if (!val.trim()) {
      return {
        ok: false,
        validator,
        message: message || getI18n().buildMsg('validate-err-empty')
      }
    }
    return { ok: true }
  }
}
