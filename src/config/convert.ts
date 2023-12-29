import { ConfigException } from './exception'
/**
 * 转换值.
 * @param val
 * @param defaultVal
 */
export function convert(val: string, defaultVal: any): string | number | boolean {
  if (typeof defaultVal === 'string') {
    return val
  } else if (typeof defaultVal === 'number') {
    const num = parseFloat(val)
    if (isNaN(num)) {
      throw new ConfigException(`Unable to convert value to number ：${val}`)
    }
    return num
  } else if (typeof defaultVal === 'boolean') {
    if (val === 'true') {
      return true
    } else if (val === 'false') {
      return false
    } else {
      throw new ConfigException(`Cannot convert value to a boolean type：${val}`)
    }
  } else {
    throw new ConfigException(`Unsupported conversion type ：${typeof defaultVal}`)
  }
}
