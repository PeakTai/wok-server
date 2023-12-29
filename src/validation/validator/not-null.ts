import { PropValidator } from '..'
import { getI18n } from '../../i18n'

/**
 * 非空校验.
 * @param message
 */
export function notNull<T>(message?: string): PropValidator<T> {
  return val => {
    if (val === null || val === undefined) {
      return {
        ok: false,
        message: message || getI18n().buildMsg('validate-err-empty'),
        validator: 'notNull'
      }
    }
    return { ok: true }
  }
}
