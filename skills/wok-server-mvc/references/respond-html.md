# 响应 HTML

MVC 组件提供了两种 HTML 响应方式：框架内置的结构化 HTML 构建和第三方模板引擎。

## 内置 HTML 构建

`ServerExchange.respondHtml()` 接收 `HtmlStuct` 对象或 HTML 字符串，自动渲染并设置 `Content-Type: text/html; charset=utf-8`。

### HtmlStuct 结构

```ts
interface HtmlStuct {
  lang?: string          // <html lang="zh">
  head: SubElementsOpt   // <head> 子元素
  body: SubElementsOpt | { attrs?: HtmlAttrs; children: SubElementsOpt }  // <body> 子元素及属性
}

type SubElementsOpt = Array<HtmlTag | string> | ((add: (...child) => void) => void)
```

`SubElementsOpt` 既可以是静态数组，也可以是一个函数，通过回调参数 `add` 动态添加子元素，配合循环和分支语句实现动态渲染。

### HtmlTag 标签定义

```ts
interface HtmlTag {
  tag: string             // 标签名，如 'div'、'span'、'h1'
  selfClosing?: boolean   // 是否自闭合，如 <br/>、<img/>
  attrs?: HtmlAttrs        // 属性（有类型推断，支持 id、class、style 等全局属性）
  children?: SubElementsOpt // 子元素
}
```

### 完整示例

```ts
await startWebServer({
  routers: {
    '/profile': async exchange => {
      const user = await getUser(exchange.headers.authorization)
      exchange.respondHtml({
        lang: 'zh',
        head: [
          { tag: 'title', children: ['个人中心'] },
          { tag: 'script', attrs: { type: 'module', src: 'main.js' } }
        ],
        body: {
          attrs: { style: { 'background-color': 'white' } },
          children: add => {
            add({ tag: 'h1', children: ['个人中心'] })
            if (user) {
              add({ tag: 'p', children: [`用户名：${user.account}`] })
            } else {
              add({
                tag: 'p',
                children: [
                  '请登录后查看',
                  { tag: 'a', attrs: { href: '/login' }, children: ['点击进行登录'] }
                ]
              })
            }
            add(footer())
          }
        }
      })
    }
  }
})
```

### 提取可复用组件

常用的标签组合可封装为函数，返回 `HtmlTag` 类型：

```ts
function footer(): HtmlTag {
  return {
    tag: 'div',
    attrs: { class: 'footer' },
    children: [
      { tag: 'a', attrs: { href: '/about' }, children: ['关于我们'] },
      { tag: 'a', attrs: { href: '/call' }, children: ['联系我们'] },
      { tag: 'a', attrs: { href: '/privacy' }, children: ['隐私协议'] }
    ]
  }
}
```

### 快捷方法

除了 `respondHtml()`，也可直接传入 HTML 字符串：

```ts
exchange.respondHtml('<h1>Hello World</h1>')
```

等价于设置 `Content-Type: text/html` 并输出给定字符串。

---

## 第三方模板引擎

如果不喜欢内置的结构化构建方式，也可以使用第三方模板库，渲染后将 HTML 字符串传给 `respondHtml()`。

### Handlebars

```ts
import { compile } from 'handlebars'

await startWebServer({
  routers: {
    '/html': async exchange => {
      const template = compile(`
        <!DOCTYPE html>
        <html>
        <head><title>Handlebars Example</title></head>
        <body>
          <p>Hello, my name is {{name}}.</p>
          <ul>{{#kids}}<li>{{name}} is {{age}}</li>{{/kids}}</ul>
        </body>
        </html>
      `)
      const data = {
        name: 'Alan',
        kids: [{ name: 'Jimmy', age: '12' }, { name: 'Sally', age: '4' }]
      }
      exchange.respondHtml(template(data))
    }
  }
})
```

### Vue 3.x SSR

```ts
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

await startWebServer({
  routers: {
    '/html': async exchange => {
      const app = createSSRApp({
        data: () => ({ count: 1 }),
        template: `<button>{{ count }}</button>`
      })
      const html = await renderToString(app)
      exchange.respondHtml(`<!DOCTYPE html>
<html>
  <head><title>Vue SSR</title></head>
  <body><div id="app">${html}</div></body>
</html>`)
    }
  }
})
```

> **提示：** 无论使用哪种方式，最终调用 `exchange.respondHtml()` 即可正确设置响应头与状态码。
