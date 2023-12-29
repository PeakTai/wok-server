import { ParsedUrlQuery, parse } from 'querystring'

export class QueryString {
  private qs: ParsedUrlQuery
  constructor(url: string) {
    const idx = url.indexOf('?')
    this.qs = idx !== -1 ? parse(url.substring(idx + 1)) : {}
  }
  /**
   * 获取单个字符串值
   * @param name
   */
  getStr(name: string) {
    const res = this.qs[name]
    if (!res) {
      return undefined
    } else if (typeof res === 'string') {
      return res
    } else {
      return res[0]
    }
  }
  /**
   * 获取参数的所有值
   */
  getStrVals(name: string) {
    const res = this.qs[name]
    if (!res) {
      return undefined
    } else if (typeof res === 'string') {
      return [res]
    } else {
      return res
    }
  }
}
