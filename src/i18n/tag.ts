export interface LangTag {
  lang: string
  region?: string
}
/**
 * 解析语言标签，语言标签格式非常多，这里仅支持语言加地区的形式，如 zh-CN。
 * 更多信息可以查看 https://www.rfc-editor.org/rfc/bcp/bcp47.txt 。
 * @param tag
 * @returns 语言和地区信息，为了方便匹配，全转小写
 */
export function parseLangTag(tag: string): LangTag {
  const [lang, region] = tag.split('-')
  // 解析失败，抛出错误
  if (!lang) {
    throw new Error(`Unable to parse lang tag：${tag}`)
  }
  return { lang: lang.toLowerCase(), region: region ? region.toLowerCase() : undefined }
}
