import { CSSStyleDeclaration } from './style'

/**
 * 全局属性.
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes
 */
export interface GlobalAttrs {
  accesskey?: string
  id?: string
  autocapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters'
  autofocus?: boolean
  class?: string
  contenteditable?: boolean | 'plaintext-only'
  dir?: 'ltr' | 'rtl' | 'auto'
  draggable?: boolean
  enterkeyhint?: string
  hidden?: string
  inert?: boolean
  inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
  is?: string
  itemid?: string
  itemprop?: string
  itemref?: string
  itemscope?: string
  itemtype?: string
  lang?: string
  nonce?: string
  part?: string
  popover?: string
  role?: string
  slot?: string
  spellcheck?: string
  style?: CSSStyleDeclaration | string
  tabindex?: string
  title?: string
  translate?: 'yes' | 'no'
  virtualkeyboardpolicy?: 'auto' | 'manual'
}
/**
 * 子元素选项，子元素可以是一个标签也可以是字符串（表示文本，对应 TextNode）。子元素列表
 * 可以传一个数组，也可以传一个函数，函数的参数是一个添加函数，通过这个添加函数来
 * 动态添加子元素.
 */
export type SubElementsOpt =
  | Array<HtmlTag | string>
  | ((add: (...child: Array<HtmlTag | string>) => void) => void)

export interface HtmlAttrs extends GlobalAttrs {
  [key: string]: any
}
/**
 * 标签定义
 */
export interface HtmlTag {
  /**
   * 标签名称
   */
  tag: string
  /**
   * 是否自闭合标签，自闭合符合是不渲染子元素内容的，如 <br/>
   */
  selfClosing?: boolean
  /**
   * 属性
   */
  attrs?: HtmlAttrs
  /**
   * 子元素.
   */
  children?: SubElementsOpt
}

function encodeAttrs(attrs: HtmlAttrs) {
  return Object.entries(attrs)
    .map(entry => {
      const [name, value] = entry
      return { name, value }
    })
    .filter(attr => attr.value !== undefined)
    .map(attr => {
      const { name } = attr
      const value = attr.value as any
      if (name === 'style') {
        if (typeof value === 'string') {
          return value
        }
        const style = value as CSSStyleDeclaration
        return Object.entries(style)
          .map<string>(entry => `${entry[0]}:${entry[1]}`)
          .join(';')
      }
      if (typeof value === 'boolean' && value) {
        return `${name}`
      }
      if (typeof value === 'string') {
        return `${name}="${value.replace(/"/g, '&quot;')}"`
      }
      return `${name}="${value}"`
    })
    .join(' ')
}
/**
 * 将标签编码
 */
function encodeTag(tag: HtmlTag) {
  if (tag.selfClosing) {
    if (tag.attrs) {
      return `<${tag.tag} ${encodeAttrs(tag.attrs)}/>`
    }
    return `<${tag.tag}/>`
  }
  let html = ''
  html += `<${tag.tag}`
  if (tag.attrs) {
    html += ` ${encodeAttrs(tag.attrs)}>`
  } else {
    html += '>'
  }
  if (tag.children) {
    if (Array.isArray(tag.children)) {
      html += tag.children
        .map(subTag => (typeof subTag === 'string' ? subTag : encodeTag(subTag)))
        .join('')
    } else {
      const children: Array<HtmlTag | string> = []
      tag.children((...child) => {
        children.push(...child)
      })
      html += children
        .map(subTag => (typeof subTag === 'string' ? subTag : encodeTag(subTag)))
        .join('')
    }
  }
  html += `</${tag.tag}>`
  return html
}

/**
 * html 结构
 */
export interface HtmlStuct {
  /**
   * 语言，根元素上的属性 lang ，示例：<html lang="zh">
   */
  lang?: string
  /**
   * head 标签内容
   */
  head: SubElementsOpt
  /**
   * body 标签内容
   */
  body:
    | {
        /**
         * 属性
         */
        attrs?: HtmlAttrs
        /**
         * 子元素.
         */
        children: SubElementsOpt
      }
    | SubElementsOpt
}
/**
 * 生成 html 代码
 * @param html
 */
export function generateHtmlCode(html: HtmlStuct): string {
  return encodeTag({
    tag: 'html',
    attrs: { lang: html.lang },
    children: [
      { tag: 'head', children: html.head },
      {
        tag: 'body',
        attrs:
          Array.isArray(html.body) || typeof html.body === 'function' ? undefined : html.body.attrs,
        children:
          Array.isArray(html.body) || typeof html.body === 'function'
            ? html.body
            : html.body.children
      }
    ]
  })
}
