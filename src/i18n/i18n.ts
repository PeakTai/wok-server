import { IncomingHttpHeaders } from 'http'
import { parseLangTag } from './tag'

/**
 * 绑定语言的 i18n 类型，不可切换语言.
 */
export class BoundI18n<T> {
  constructor(private readonly lang: string, private readonly msgs: T) {}
  /**
   * 获取当前语言
   */
  getLang(): string {
    return this.lang
  }

  /**
   * 构建国际化消息.
   * @param key 消息模板的 key
   * @param args 参数，如果 key 对应的消息模板有占位符号（{}）可以使用参数来填充
   */
  buildMsg(key: keyof T, ...args: string[]): string {
    const template = this.msgs[key] as unknown as string
    if (!args || !args.length) {
      return template
    }
    let idx = 0
    return template.replace(/\{\}/g, () => `${args[idx++]}`)
  }
}
/**
 * 国际化，提供不同语言消息构建的功能，默认英文.
 */
export class I18n<T> {
  /**
   * 当前语言
   */
  private lang: string
  /**
   * 消息模板表，与当前语言是对应的
   */
  private msgs: T

  /**
   * 消息表，key 是语言，value 是一个 key 为地区，value 为 消息模板的 map，两层 map 为的是能够快速匹配.
   * 地区为空的情况下，缺省值为 - 。语言和地区的 key 全转成小写存储。
   */
  private msgsMap: Map<string, Map<string, T>>

  /**
   * 构造 i18n 对象，必须指定英文的消息模板作为默认。
   * @param enMsgs 英文的消息模板
   */
  constructor(readonly enMsgs: T) {
    const regionMap = new Map<string, T>()
    regionMap.set('-', enMsgs)
    this.msgsMap = new Map<string, Map<string, T>>()
    this.msgsMap.set('en', regionMap)
    this.lang = 'en'
    this.msgs = enMsgs
  }

  protected findMsgsByLang(langTag: string): T | undefined {
    // 检查表中是否支持指定语言，如果不支持则使用默认语言
    const tag = parseLangTag(langTag)
    const regionMap = this.msgsMap.get(tag.lang)
    if (!regionMap) {
      return undefined
    }
    // 查找顺序：
    // 1. 如果有地区信息，查找地区标签对应的消息
    // 2. 上一步没有找到，则查找默认地区标签对应的消息
    // 3. 前面都没有找到，则取语言下的第一个地区的消息
    let msgs: T | undefined = undefined
    if (tag.region) {
      msgs = regionMap.get(tag.region)
    }
    if (!msgs) {
      msgs = regionMap.get('-')
    }
    if (!msgs) {
      msgs = regionMap.values().next().value
    }
    return msgs
  }
  /**
   * 设置一种语言对应的消息模板，支持异步，可以做动态加载
   * @param langTag
   * @param msgs
   */
  setMsgs(langTag: string, msgs: T) {
    const tag = parseLangTag(langTag)
    let regionMap = this.msgsMap.get(tag.lang)
    if (!regionMap) {
      regionMap = new Map<string, T>()
      this.msgsMap.set(tag.lang, regionMap)
    }
    regionMap.set(tag.region || '-', msgs)
  }

  /**
   * 给定一个语言标签列表，获得可以被支持的标签列表
   * @param tags
   */
  getSupportedLanguageTags(...tags: string[]): string[] {
    return tags.filter(tag => {
      const langTag = parseLangTag(tag)
      return this.msgsMap.get(langTag.lang)
    })
  }

  /**
   * 设置当前语言，如果指定的语言不被支持，则修改无效
   * @param lang 语言本标签，如 en-US
   * @returns 是否成功，如果语言不支持则返回 false，不会改变现有语言
   */
  setLang(lang: string): boolean {
    const msgs = this.findMsgsByLang(lang)
    if (!msgs) {
      return false
    }
    this.lang = lang
    this.msgs = msgs
    return true
  }

  /**
   * 获取当前语言
   */
  getLang(): string {
    return this.lang
  }

  /**
   * 构建国际化消息.
   * @param key 消息模板的 key
   * @param args 参数，如果 key 对应的消息模板有占位符号（{}）可以使用参数来填充
   */
  buildMsg(key: keyof T, ...args: string[]): string {
    const template = this.msgs[key] as unknown as string
    if (!args || !args.length) {
      return template
    }
    let idx = 0
    return template.replace(/\{\}/g, () => `${args[idx++]}`)
  }
  /**
   * 绑定一种语言，生成新的 i18n 对象，该对象仅能使用某一种语言.
   * @param langTag 语言标签，无值则表示绑定当前语言
   * @returns 返回一个语言受限的 i18n 对象.
   */
  bindLang(langTag?: string): BoundI18n<T> {
    if (!langTag) {
      return new BoundI18n(this.lang, this.msgs)
    }
    const msgs = this.findMsgsByLang(langTag)
    if (!msgs) {
      throw new Error(`Unsupported language : ${langTag}`)
    }
    return new BoundI18n(langTag, msgs)
  }
  /**
   * 根据请求进行语言切换，解析消息头 'accept-language' ，如果 'accept-language' 中没有包含能够支持的语言则使用默认的英文.
   * @param headers 消息头
   */
  switchByRequest(headers: IncomingHttpHeaders) {
    const langs = this.parseAcceptLanguage(headers)
    const tags = this.getSupportedLanguageTags(...langs)
    if (tags.length) {
      this.setLang(tags[0])
    } else {
      this.setLang('en')
    }
  }

  private parseAcceptLanguage(headers: IncomingHttpHeaders): string[] {
    const acceptLang = headers['accept-language']
    if (!acceptLang) {
      return []
    }
    // zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2
    // 为了性能考虑，暂不支持 q 参数设定的优先级，否则还要排序
    const tags = acceptLang.split(',')
    const langs: string[] = []
    for (const tag of tags) {
      const [t, q] = tag.split(';')
      if ('*' !== t) {
        langs.push(t)
      }
    }
    return langs
  }
  /**
   * 根据请求进行语言绑定，解析消息头 'accept-language'，绑定受支持的第一个语言，如果没有可以被支持的语言，则使用默认的英文.
   * @param headers 消息头
   */
  bindByRequest(headers: IncomingHttpHeaders): BoundI18n<T> {
    const langs = this.parseAcceptLanguage(headers)
    const tags = this.getSupportedLanguageTags(...langs)
    if (tags.length) {
      return this.bindLang(tags[0])
    } else {
      return this.bindLang('en')
    }
  }
}

/**
 * 可扩展的 i18n ，增加扩展新 i18n 对象的功能，记录扩展的新对象，同步 setLang 操作
 */
export class ExtensibleI18n<T extends object> extends I18n<T> {
  private extendedI18ns: I18n<any>[] = []

  setLang(lang: string): boolean {
    for (const ex of this.extendedI18ns) {
      ex.setLang(lang)
    }
    return super.setLang(lang)
  }

  /**
   * 扩展国际化内容，生成一个新的 i18n 对象，与当前的 i18n 对象语言保持一致，可在新对象中设置扩展部分的语言。
   * <K> 新的消息模板类型
   * @param enMsgs
   */
  extend<K extends object>(enMsgs: K): I18n<K> {
    const extendedI18n = new I18n<K>(enMsgs)
    this.extendedI18ns.push(extendedI18n)
    return extendedI18n
  }
}
