# MVC

mvc 组件基于 Nodejs 自带的 http 模块，让搭建 http 服务，处理请求更方便。

### 环境变量

| 环境变量                  | 说明                                             |
| :------------------------ | :----------------------------------------------- |
| SERVER_PORT               | 端口号                                           |
| SERVER_TIMEOUT            | 超时时间，单位毫秒，默认 30000                   |
| SERVER_ACCESS_LOG         | 是否启用访问日志，默认不启用，值为 true 表示启用 |
| SERVER_CORS_ALLOW_ORIGIN  | 跨域允许的源域名，默认 \*                        |
| SERVER_CORS_ALLOW_HEADERS | 跨域允许的消息头，默认 \*                        |
| SERVER_CORS_ALLOW_METHODS | 跨域允许的请求方法，默认 \*                      |

### 开始使用

```ts
// 启动服务
await startWebServer({
  // 路由，实际开发中页面很多的情况下，可以将每个路由处理函数单独写在一个文件中
  routers: {
    '/': async exchange => exchange.respondText('Hello world !')
  },
  // 拦截器，可以做授权校验、异常处理等
  interceptors: [
    async (exchange, next) => {
      // 示例场景： http 基本认证
      if (!validateAuth(exchange.request.headers.authorization)) {
        // 校验失败响应信息提示浏览器用户需要登录
        exchange.respond({
          statusCode: 401,
          headers: { 'www-Authenticate': 'Basic realm= "family"' }
        })
        return
      }
      // 调用 next 函数继续后面的流程
      await next()
    }
  ]
})
```

启动服务主要需要设置两个参数，一个是路由，一个是拦截器。路由用于处理具体的请求，拦截器可以在路由执行前执行，
对请求进行拦截，下面会细说。

在有需要的时候，也可以停止服务。

```ts
// 停止服务
await stopWebServer()
```

### 路由

路由的配置是键值对，键是路径，值是异步处理函数，函数接收一个一个参数 exchange ，类型是 ServerExchange,
提供了读取请求信息和一些响应常见格式的方法。

```ts
await startWebServer({
  // 路由
  routers: {
    '/': async exchange => {
      // 通过 exchage 获取请求信息
      const url = exchange.request.url
      const method = exchange.request.method
      const referer = exchange.request.headers.referer
      // 读取正文
      const body = await exchange.bodyJson()
      // 响应信息
      exchange.respondJson({ ok: true })
    },
    '/users': async exchange => {
      const list = await listUser()
      exchange.respondJson(list)
    },
    '*': async exchange => {
      exchage.respondText(`404 Not Found`, 404)
    }
  }
})
```

`*` 是一个特殊的路径，用于自定义 404 页面，可以处理所有匹配路径失败的请求。
在未设置 404 页面的情况下，默认返回一个 json 格式的错误提示。

**路由的路径目前仅支持明确地址，不支持模糊路径，不能在路径上绑定变量**，比如 `/users/:id` 这种将用户 id
作为路径的一部分，是无法处理的。出于程序的开销方面的考虑，没有支持，后续的版本有可能会考虑。

### 拦截器

拦截器的配置是一个列表，每个拦截器都是一个异步函数，函数接收两个参数：exchange 和 next 。
exchange 是 ServerExchange 类型，与上面路由中的 exchage 是一样的。
next 是一个无参异步函数，调用 next 执行后面的流程（下一个拦截器或路由）。

```ts
// 启动服务
await startWebServer({
  // 路由
  routers: {
    // 省略路由配置代码
  },
  // 拦截器，可以做授权校验、异常处理等
  interceptors: [
    async (exchange, next) => {
      // 获取原生的请求和响应对象
      const { request, response } = exchange
      const url = request.url
      const userAgent = request.headers['user-agent']
      const ip = request.socket.remoteAddr
      try {
        // 调用 next 函数继续后面的流程
        await next()
      } catch (e) {
        // 演示场景：在拦截器里统一处理校验失败发生的异常
        if (e instanceof ValidationException) {
          // 调用 exchange 上的工具方法，快速完成一个响应
          exchange.respondErrMsg(e.errMsg, 400)
          return
        }
        // 对于不能处理的异常，可直接抛出
        // 框架最终会响应 500 状态码，并记录错误信息到日志里以便于线上排查
        throw e
      }
    }
  ]
})
```

### 异常处理

对于业务处理失败的情况下，推荐的做法是抛出异常来中止处理流程，然后由拦截器来统一处理进行响应。
但是这并非是强制的，框架也没有预置任何相关的类型或函数，需要自己根据实际情况来扩展，下面是一个例子。

```ts
/**
 * 自定义业务异常.
 */
export class BusinessException {
  constructor(
    /**
     * 提示信息.
     */
    readonly message: string,
    /**
     * 自定义状态码，默认 400
     */
    readonly status?: number
  ) {}
}

/**
 * 全局异常拦截器，对一些特定的异常做处理，给予合适的响应信息.
 * @param exchange
 * @param next
 */
export async function globalErrorInterceptor(
  exchange: ServerExchange,
  next: () => Promise<void>
): Promise<void> {
  try {
    await next()
  } catch (e) {
    // 处理自定义业务异常
    if (e instanceof BusinessException) {
      const status = typeof e.status === 'number' ? e.status : 400
      const message = e.message || ''
      exchange.respondErrMsg(message, status)
      return
    }
    // 处理校验异常
    if (e instanceof ValidationException) {
      exchange.respondErrMsg(e.errMsg, 400)
      return
    }
    // 其它异常不需要处理的直接抛出，框架默认会响应 500 状态码
    throw e
  }
}
```

实际开发中可根据情况设置多个业务异常，分别响应不同的 JSON 格式，
respondErrMsg 方法响应的 json 格式是框架预设的，可通过 respondJson 方法响应自定义的格式。

将错误处理拦截器设置为第一个拦截器，在使用请求处理过程中使用自定义异常。

```ts
// 启动服务
await startWebServer({
  interceptors: [
    // 将错误处理拦截器设置为第一个拦截器
    globalErrorInterceptor,
    // 接下来是其它的拦截器
    authInterceptor
  ],
  // 路由
  routers: {
    '/order/cancel': createJsonHandler<{ id: string }>({
      validation: { id: [notBlank()] },
      async handle(body, exchange) {
        const order = await findOrderById(body.id)
        if (!order) {
          // 使用自定义业务异常来中断处理流程
          throw new BusinessException('找不到订单')
        }
        // 继续处理 ...
      }
    })
    // 省略路由配置代码
  }
})
```

### 针对不同的方法进行处理

组件提供了 restful 函数，可以在配置路由时按请求方法进行分发。

```ts
// 启动服务
await startWebServer({
  // 路由
  routers: {
    '/users': restful({
      get: async exchange => {
        // 处理 get 请求
      },
      post: async exchange => {
        // 处理 post 请求
      },
      delete: async exchange => {
        // 处理 delete 请求
      }
    })
  }
})
```

注意：路由目前并不支持 restful 风格的动态路径，前面已经有说明。

### json 请求处理

框架自带了函数 createJsonHandler 可以方便的创建一个处理 json 请求的的 RouterHandler，
请求和响应都是 json 格式，响应和请求都可以为空。请求为空可以填入类型 {} 来表示空对象，响应为空可以填入类型 void 。

```ts
// json 格式请求正文定义
interface Form {
  name: string
  age: number
}
// json 格式响应信息定义
interface Resp {
  id: string
}

export const userCreateHandler = createJsonHandler<Form, Resp>({
  /**
   * 请求正文映射对象校验规则，可选.
   */
  validation: {
    name: [notBlank('名称不能为空'), length({ min: 2, max: 16, message: '名称必须是2-16个字' })],
    age: [notNull('年龄必填'), min(2), max(16)]
  },
  async handle(body, exchange) {
    // 获取授权信息
    const { authorization } = exchange.headers
    const currentUser = await findUserByAuth(authorization)
    console.log(`姓名是：${body.name}`)
    console.log(`年龄是：${body.age}`)
    const newUser = await createUser(body)
    return { id: newUser.id }
  }
})
```

校验时会自动根据消息头 `accept-language` 切换校验器的语言，对于没有自定义错误信息的校验使用切换后的语言给予默认的提示。

从 0.3.0 版本开始，createJsonHandler 支持了通过 cache 选项来设置使用缓存组件将响应结果进行缓存，
在可以复用缓存的情况下，避免再次执行整个 handle 方法的流程，从而提升性能。

```ts
export const userGetHandler = createJsonHandler<Form, User>({
  // 设置缓存，参数和 handle 方法一样的
  // 只能缓存有效的响应信息，如果没有响应正文则不会进行缓存
  async cache(body, exchange) {
    // 使用参数 id 来构建缓存的 key
    const key = `get-user-${body.id}`
    // 返回缓存的 key 和有效时间，有效时间是可选的
    return { key, expiresInSeconds: 60 }
  },
  async handle(body, exchange) {
    // handle 流程省略 ...
  }
})
```

由于缓存是基于缓存组件，那么也可以通过缓存组件来清理缓存。

```ts
export const userUpdateHandler = createJsonHandler<Form>({
  async handle(body, exchange) {
    // handle 部分流程省略 ...
    // 将用户详情接口的缓存清理掉
    getCache().remove(`get-user-${body.id}`)
  }
})
```

但是不要使用缓存组件来获取缓存内容，因为为了提升性能，缓存的内容是 Buffer，
当使用缓存时避免再次执行对象序列化，并不是 handle 方法返回的对象。

### 二进制（Binary）上传

二制进上传也就是将文件以二进制的形式写入请求正文，请求正文仅存储文件内容没有别的信息，
请求的格式（Content-type）是 application/octet-stream 。

这种形式带来的好处就是简单，性能更好，因为服务器端拿到请求正文就是文件，不像 multipart/form-data 格式过需要解析内容来获取信息。
但是由于请求正文仅存储了文件，其它的业务参数只能通过查询字符串（Query String）带入。

框架提供了 createUploadHandler 函数带创建处理二进制格式请求的路由处理器，响应 JSON 格式，下面是示例。

```ts
interface Resp {
  /**
   * 新头像访问地址
   */
  url: string
}

/**
 * 演示场景: 上传头像
 */
export const uploadAvatar = createUploadHandler<Resp>({
  async handle(body, exchange) {
    // 通过 Query String 获取用户id参数
    const userId = exchange.query.getStr('userId') as string
    // 校验参数
    validate(
      { userId },
      {
        userId: [notBlank(), maxLength(64)]
      }
    )
    // 判定文件大小
    if (body.byteLength > 2 * 1024 * 1024) {
      // BusinessException 是自定义的业务异常，抛出后由拦截器统一处理
      throw new BusinessException('文件大小不得超过 2MB')
    }
    const user = await getMysqlManager().findById(tableUser, userId)
    if (!user) {
      throw new BusinessException('找不到用户')
    }
    // 模拟上传到文件服务器的场景，oss 是对象存储服务 sdk
    const key = `users/${userId}/avatar`
    await oss.putObject(key, body)
    await getMysqlManager().partialUpdate(tableUser, { id: userId, avatar_key: key })
    return { url: oss.getUrl(key) }
  }
})
```

如果需要更高的自由度，比如不想返回 json 格式，定义普通的路由处理器即可，通过 exchage 上的 bodyBuffer 方法即可获取请求正文内容。

```ts
export const uploadAvatar: RouterHandler = async exchange => {
  // 读取文件
  const file = await exchange.bodyBuffer()
  // 获取 Query String 上的参数
  const query = exchange.parseQueryString()
  const userId = query.getStr('userId')

  // 校验参数和存储文件等流程省略...
}
```

### multipart/form-data 格式上传文件处理

组件目前尚未实现对 multipart/form-data 类型请求的处理，如有需要可通一些第三方库来解析文件上传的请求内容。

下面是通过 formidable 这个库来解析请求的示例：

```ts
// 启动服务
import formidable from 'formidable'

await startWebServer({
  // 路由
  routers: {
    '/cover': async exchange => {
      const form = formidable({})
      // 解析请求内容
      const [fields, files] = await form.parse(exchage.request)
      // todo 继续业务处理
    }
  }
})
```

如果使用了其它的库来读取 request 内容，则不能再使用 exchange 中的 bodyXxx 系列方法，调用时会抛出异常。
同时在调用了 bodyXxx 系列方法后也不能再调用其它的库来读取内容，否则将读取不到完整内容或引发异常。
但是 bodyXxx 系列方法是可以重复调用的，不会产生错误，调用过 bodyText 方法后再调用 bodyJson 是可以的。

### 响应 html

ServerExchange 类型提供了 respondHtml 方法，用于渲染 html，简单的组织标签层级和进行动态的结构构建。

```ts
// 启动服务
await startWebServer({
  // 路由
  routers: {
    '/profile': async exchange => {
      // 获取用户信息
      const user = await getUser(exchange.headers.authorization)
      // html 结构组织的逻辑可能会很长，复杂业务可以提取成为单独的函数
      exchange.respondHtml({
        lang: 'zh',
        head: [
          // 为 head 添加标签，这里添加一个 title
          // children 中直接写字符串代表 TextNode
          { tag: 'title', children: ['个人中心'] },
          { tag: 'script', attrs: { type: 'module', src: 'main.js' } }
        ],
        body: {
          // 属性，属性是有类型推断的，可以对 html 的全局属性进行提示, 如 style、id、class 等
          attrs: {
            // style 是有类型推断的
            style: { 'background-color': 'white' }
          },
          // children 也可以接收一个函数，函数的参数是一个添加子元素的函数
          // 这样可以结合循环和分支控制来实现动态渲染效果
          children: add => {
            add({ tag: 'h1', children: ['个人中心'] })
            // 在 user 有值和无值的情况下分别渲染不同的元素
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
            // 对于一些常用的组合，可以封装成一个函数，返回 HtmlTag 类型
            // 这里的 footer 就是这样一个例子
            add(footer())
          }
        }
      })
    }
  }
})
```

footer 函数示例：

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

如果不喜欢框架自带的 html 渲染模式，也可以使用一些第三方的模板渲染组件。

下面是使用库 handlebars 来渲染的的示例：

```ts
import { compile } from 'handlebars'

await startWebServer({
  // 路由
  routers: {
    '/html': async exchange => {
      const source =
        '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<title>Handlebars Example</title>' +
        '</head>' +
        '<body>' +
        '<p>Hello, my name is {{name}}. I am from {{hometown}}. I have ' +
        '{{kids.length}} kids:</p>' +
        '<ul>{{#kids}}<li>{{name}} is {{age}}</li>{{/kids}}</ul>' +
        '</body>' +
        '</html>'
      // 编译模板
      const template = compile(source)
      // 数据
      const data = {
        name: 'Alan',
        hometown: 'Somewhere, TX',
        kids: [
          { name: 'Jimmy', age: '12' },
          { name: 'Sally', age: '4' }
        ]
      }
      // 构建内容
      const result = template(data)
      // 渲染构建好的 html 字符串
      exchange.respondHtml(result)
    }
  }
})
```

下面是使用库 vue 3.x 的 ssr 来渲染 html 的示例，

```ts
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

await startWebServer({
  // 路由
  routers: {
    '/html': async exchange => {
      const app = createSSRApp({
        data: () => ({ count: 1 }),
        template: `<button>{{ count }}</button>`
      })
      const html = await renderToString(app)
      // 渲染页面，将生成的 html 嵌入页面
      exchange.respondHtml(`<!DOCTYPE html>
    <html>
      <head>
        <title>Vue SSR Example</title>
      </head>
      <body>
        <div id="app">${html}</div>
      </body>
    </html>`)
    }
  }
})
```

### 静态文件

通过 static 参数可以设置静态文件目录映射，将一个目录映射到请求路径。

```ts
await startWebServer({
  static: {
    '/a': { dir: 'D:\\Download', cacheAge: 300 },
    '/a/b': { dir: 'E:\\Dowload', cacheAge: 150 },
    '/b': { dir: 'static', cacheAge: 0 }
  },
  routers: {}
})
```

dir 参数是映射文件目录的地址，可以是绝对路径，也可以是相对路径，相对路径会从进程的当前目录下找。cacheAge 参数
是缓存时间，如果设置了大于０的值，则会根据设定生成消息头 Cache-Control。

请求路径仅支持前缀匹配，不支持通配符，比如 /a/demo.html 可以匹配 /a 路径，响应配置的文件目录下的 demo.html 文件。
路径配置是有优先级的，如果访问 /a/b/music.mp3 则会匹配到 /a/b 的配置，而不是 /a ，因为 /a/b 的配置更详细，优先级也更高，
并且如果从 /a/b 配置的目录下没有找到文件，也不会再尝试 /a 的配置。

静态文件同时也支持主页自动映射，比如访问 /a/b/c ，会匹配到 /a/b 的配置，然后在配置的文件目录下寻找文件 c ，
如果找不到则尝试寻找目录 c 下的 index.html 文件。

#### 静态文件服务器缓存

从 0.3.0 版本开始，支持服务器端缓存静态文件。要启用静态文件缓存，需要配置以下的环境变量：

| 环境变量                          | 说明                                                              |
| :-------------------------------- | :---------------------------------------------------------------- |
| SERVER_STATIC_CACHE_ENABLE        | 是否启用服务器缓存，默认 false                                    |
| SERVER_STATIC_CACHE_MAX_AGE       | 服务器缓存时间，单位秒，默认 600                                  |
| SERVER_STATIC_CACHE_MAX_FILE_SIZE | 最大可缓存的文件大小，支持语义化格式，如 10m 和 100k 等，默认 10m |
| SERVER_STATIC_CACHE_MAX_SIZE      | 缓存最大空间，一旦超出将执行清理，同上支持语义化格式，默认 100m   |

0.3.2 版本新增加了 removeServerStaticCache 函数，可以主动删除指定的服务器端静态缓存。

```ts
import {removeServerStaticCache} from 'wok-server'

removeServerStaticCache('/assets/index.js')
```

### 请求日志

通过将环境变量 SERVER_ACCESS_LOG 设置为 true 可以开启请求日志，开启后会在每次响应完成后输出请求和响应信息到日志里，默认是关闭的。

```
[2023/10/25 17:09:47.872][INFO][access-log]{"method":"GET","url":"/html?tab=%E6%9C%8D%E8%A3%85","ip":"::ffff:127.0.0.1","start":"2023/10/25 17:09:47.871","rt":1,"status":200}
```

组件仅提供了简单的 json 格式信息输出，不支持配置格式。如有请求统计的需要，可考虑自定义拦截器
将请求信息存入消息队列或数据库再做计算，也可以分析日志提取请求信息。

### websocket

组件本身没有提供 websocket 处理的功能，但是 startWebServer 函数提供了参数 preHandler
可以对服务进行前置处理，在服务没有启动前完成一些额外的操作，这样可以整合其它支持原生 http 模块的库。

可通过整合 socket.io 这个库来实现对 websocket 的处理。

```ts
import { Server } from 'socket.io'
await startWebServer({
  routers: {
    // 路由配置省略...
  },
  // 前置处理，连接 socket.io
  preHandler: async server => {
    const io = new Server(server)
    // 适配 /chat 路径，如果路由中也有 /chat 路径，不会冲突
    // 客户端用 http 协议请求会被路由处理
    // 当然，肯定不推荐这么做
    io.of('/chat').on('connection', socket => {
      // 建立连接后在回调中完成会话的管理和业务处理
      socket.on('message', data => {
        /* 处理自定义事件*/
      })
      socket.on('disconnect', () => {
        /* 连接断开处理 */
      })
    })
  }
})
```
