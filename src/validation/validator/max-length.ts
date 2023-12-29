import { PropValidator } from '..'
import { getI18n } from '../../i18n'

/**
 * 最大长度校验，可用于字符串或数组.
 * @param maxLength
 * @param message
 * @returns
 */
export function maxLength<T>(maxLength: number, message?: string): PropValidator<T> {
  const validator = 'maxLength'
  return val => {
    // 不校验空
    if (!val) {
      return { ok: true }
    }
    if (typeof (val as any).length !== 'number') {
      return { ok: false, validator, message: getI18n().buildMsg('validate-err-no-length') }
    }
    const { length } = val as any
    if (typeof length !== 'number') {
      return { ok: false, validator, message: getI18n().buildMsg('validate-err-length-not-number') }
    }
    if (length > maxLength) {
      return {
        ok: false,
        validator,
        message: message || getI18n().buildMsg('validate-err-max-length', `${maxLength}`)
      }
    }
    return { ok: true }
  }
}
