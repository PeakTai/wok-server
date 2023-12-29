import { ServerExchange } from '../../src'

export async function htmlHandler(exchange: ServerExchange) {
  const qs = exchange.parseQueryString()
  const tab = qs.getStr('tab')

  exchange.respondHtml({
    lang: 'zh',
    head: [{ tag: 'title', children: [`主页${tab ? '-' + tab : ''}`] }],
    body: [
      {
        tag: 'div',
        attrs: { class: 'layout' },
        children(add) {
          add({ tag: 'h1', children: ['各种商品，应有尽有'] })
          if (tab === '服装') {
            add({ tag: 'div', children: ['服装区'] })
            return
          }
          if (tab === '数码') {
            add({ tag: 'div', children: ['数码区'] })
            return
          }
          add({ tag: 'div', children: ['请选择种类'] })
        }
      }
    ]
  })
}
