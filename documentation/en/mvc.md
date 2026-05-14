# MVC

The MVC component is built on Node.js's built-in http module, making it easier to build HTTP servers and handle requests.

### Environment Variables

| Environment Variable         | Description                                                                 |
| :--------------------------- | :-------------------------------------------------------------------------- |
| SERVER_PORT                  | Port number                                                                 |
| SERVER_TIMEOUT               | Timeout in milliseconds, default 30000                                      |
| SERVER_ACCESS_LOG            | Whether to enable access log, disabled by default. Set to true to enable    |
| SERVER_CORS_ALLOW_ORIGIN     | Allowed CORS origin, default *                                             |
| SERVER_CORS_ALLOW_HEADERS    | Allowed CORS headers, default *                                             |
| SERVER_CORS_ALLOW_METHODS    | Allowed CORS methods, default *                                             |

### Getting Started

```ts
// Start server
await startWebServer({
  // Routes. In actual development with many pages, each route handler can be written in a separate file
  routers: {
    '/': async exchange => exchange.respondText('Hello world!')
  },
  // Interceptors for authorization validation, exception handling, etc.
  interceptors: [
    async (exchange, next) => {
      // Example: HTTP Basic Authentication
      if (!validateAuth(exchange.request.headers.authorization)) {
        // Respond with authentication required
        exchange.respond({
          statusCode: 401,
          headers: { 'www-Authenticate': 'Basic realm="family"' }
        })
        return
      }
      // Call next to continue
      await next()
    }
  ]
})
```

Starting the server mainly requires two parameters: routes and interceptors. Routes handle specific requests, and interceptors execute before routes to intercept requests. These are detailed below.

The server can be stopped when needed.

```ts
// Stop server
await stopWebServer()
```

### Routes

Route configuration is key-value pairs where the key is the path and the value is an async handler function that receives an exchange parameter of type ServerExchange, providing methods to read request information and respond with common formats.

```ts
await startWebServer({
  // Routes
  routers: {
    '/': async exchange => {
      // Get request information via exchange
      const url = exchange.request.url
      const method = exchange.request.method
      const referer = exchange.request.headers.referer
      // Read body
      const body = await exchange.bodyJson()
      // Respond
      exchange.respondJson({ ok: true })
    },
    '/users': async exchange => {
      const list = await listUser()
      exchange.respondJson(list)
    },
    '*': async exchange => {
      exchange.respondText(`404 Not Found`, 404)
    }
  }
})
```

`*` is a special path for custom 404 pages, handling all requests that fail to match any path. If no 404 page is set, a JSON error message is returned by default.

**Currently, route paths only support exact addresses, not fuzzy paths or variable binding**, such as `/users/:id` where user id is part of the path. This is not supported due to performance considerations, but may be considered in future versions.

### Interceptors

Interceptor configuration is a list where each interceptor is an async function receiving two parameters: exchange and next. exchange is of type ServerExchange, same as in routes. next is a parameterless async function that calls the next interceptor or route.

```ts
// Start server
await startWebServer({
  // Routes
  routers: {
    // Route configuration omitted
  },
  // Interceptors for authorization validation, exception handling, etc.
  interceptors: [
    async (exchange, next) => {
      // Get native request and response objects
      const { request, response } = exchange
      const url = request.url
      const userAgent = request.headers['user-agent']
      const ip = request.socket.remoteAddr
      try {
        // Call next to continue
        await next()
      } catch (e) {
        // Example: Handle validation exceptions uniformly in interceptor
        if (e instanceof ValidationException) {
          // Use utility method on exchange for quick response
          exchange.respondErrMsg(e.errMsg, 400)
          return
        }
        // Throw unhandled exceptions directly
        // Framework responds with 500 status code and logs error for troubleshooting
        throw e
      }
    }
  ]
})
```

### Exception Handling

For business processing failures, the recommended approach is to throw exceptions to abort processing, then handle them uniformly by interceptors and respond. However, this is not mandatory. The framework does not provide any preset types or functions; you need to extend them according to actual needs. Here is an example:

```ts
/**
 * Custom business exception.
 */
export class BusinessException {
  constructor(
    /**
     * Message.
     */
    readonly message: string,
    /**
     * Custom status code, default 400
     */
    readonly status?: number
  ) {}
}

/**
 * Global exception interceptor that handles specific exceptions and provides appropriate response messages.
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
    // Handle custom business exceptions
    if (e instanceof BusinessException) {
      const status = typeof e.status === 'number' ? e.status : 400
      const message = e.message || ''
      exchange.respondErrMsg(message, status)
      return
    }
    // Handle validation exceptions
    if (e instanceof ValidationException) {
      exchange.respondErrMsg(e.errMsg, 400)
      return
    }
    // Other exceptions are thrown directly, framework responds with 500 status code by default
    throw e
  }
}
```

In actual development, multiple business exceptions can be set according to needs, responding with different JSON formats. The respondErrMsg method responds with a preset JSON format. Custom formats can be responded via respondJson method.

Set the error handling interceptor as the first interceptor, and use custom exceptions during request processing.

```ts
// Start server
await startWebServer({
  interceptors: [
    // Set error handling interceptor first
    globalErrorInterceptor,
    // Other interceptors follow
    authInterceptor
  ],
  // Routes
  routers: {
    '/order/cancel': createJsonHandler<{ id: string }>({
      validation: { id: [notBlank()] },
      async handle(body, exchange) {
        const order = await findOrderById(body.id)
        if (!order) {
          // Use custom business exception to interrupt processing
          throw new BusinessException('Order not found')
        }
        // Continue processing...
      }
    })
    // Route configuration omitted
  }
})
```

### Handle Different Methods

The component provides a restful function to dispatch by request method when configuring routes.

```ts
// Start server
await startWebServer({
  // Routes
  routers: {
    '/users': restful({
      get: async exchange => {
        // Handle GET request
      },
      post: async exchange => {
        // Handle POST request
      },
      delete: async exchange => {
        // Handle DELETE request
      }
    })
  }
})
```

Note: Routes do not support RESTful dynamic paths, as explained earlier.

### JSON Request Handling

The framework provides createJsonHandler function to easily create a RouterHandler for handling JSON requests. Both request and response are JSON format, and can be empty. Use type {} for empty request and void for empty response.

```ts
// JSON request body definition
interface Form {
  name: string
  age: number
}
// JSON response definition
interface Resp {
  id: string
}

export const userCreateHandler = createJsonHandler<Form, Resp>({
  /**
   * Request body mapping object validation rules, optional.
   */
  validation: {
    name: [notBlank('Name cannot be empty'), length({ min: 2, max: 16, message: 'Name must be 2-16 characters' })],
    age: [notNull('Age required'), min(2), max(16)]
  },
  async handle(body, exchange) {
    // Get authorization
    const { authorization } = exchange.headers
    const currentUser = await findUserByAuth(authorization)
    console.log(`Name: ${body.name}`)
    console.log(`Age: ${body.age}`)
    const newUser = await createUser(body)
    return { id: newUser.id }
  }
})
```

Validation automatically switches the validator's language based on the `accept-language` header. For validations without custom error messages, the switched language's default message is used.

Starting from version 0.3.0, createJsonHandler supports caching response results through the cache option. When the cache can be reused, it avoids executing the entire handle method flow, improving performance.

```ts
export const userGetHandler = createJsonHandler<Form, User>({
  // Set cache, same parameters as handle method
  // Only caches valid responses, no caching if no response body
  async cache(body, exchange) {
    // Build cache key using id parameter
    const key = `get-user-${body.id}`
    // Return cache key and optional expiration time
    return { key, expiresInSeconds: 60 }
  },
  async handle(body, exchange) {
    // Handle flow omitted...
  }
})
```

Since caching is based on the cache component, you can also clear the cache through the cache component.

```ts
export const userUpdateHandler = createJsonHandler<Form>({
  async handle(body, exchange) {
    // Handle flow omitted...
    // Clear user detail cache
    getCache().remove(`get-user-${body.id}`)
  }
})
```

However, do not use the cache component to retrieve cached content, as the cached content is stored as Buffer for performance reasons, avoiding re-serialization when using the cache. It is not the object returned by the handle method.

### Binary Upload

Binary upload means sending files as binary data in the request body. The request body contains only the file content without additional information. The Content-Type is application/octet-stream.

The advantage is simplicity and better performance, as the server receives the file directly without parsing like multipart/form-data. However, since the request body only contains the file, other business parameters must be passed through query strings.

The framework provides createUploadHandler function to create route handlers for binary format requests, responding with JSON format. Here is an example:

```ts
interface Resp {
  /**
   * New avatar URL
   */
  url: string
}

/**
 * Example: Upload avatar
 */
export const uploadAvatar = createUploadHandler<Resp>({
  async handle(body, exchange) {
    // Get userId parameter from Query String
    const userId = exchange.query.getStr('userId') as string
    // Validate parameters
    validate(
      { userId },
      {
        userId: [notBlank(), maxLength(64)]
      }
    )
    // Check file size
    if (body.byteLength > 2 * 1024 * 1024) {
      // BusinessException is a custom business exception, handled by interceptor
      throw new BusinessException('File size cannot exceed 2MB')
    }
    const user = await getMysqlManager().findById(tableUser, userId)
    if (!user) {
      throw new BusinessException('User not found')
    }
    // Simulate uploading to object storage, oss is object storage service SDK
    const key = `users/${userId}/avatar`
    await oss.putObject(key, body)
    await getMysqlManager().partialUpdate(tableUser, { id: userId, avatar_key: key })
    return { url: oss.getUrl(key) }
  }
})
```

For higher flexibility, such as not returning JSON format, define a regular route handler and use the bodyBuffer method on exchange to get the request body.

```ts
export const uploadAvatar: RouterHandler = async exchange => {
  // Read file
  const file = await exchange.bodyBuffer()
  // Get parameters from Query String
  const query = exchange.parseQueryString()
  const userId = query.getStr('userId')

  // Parameter validation and file storage omitted...
}
```

### multipart/form-data File Upload

The component does not currently handle multipart/form-data requests. Third-party libraries can be used to parse file upload requests.

Here is an example using formidable:

```ts
// Start server
import formidable from 'formidable'

await startWebServer({
  // Routes
  routers: {
    '/cover': async exchange => {
      const form = formidable({})
      // Parse request
      const [fields, files] = await form.parse(exchange.request)
      // TODO continue business processing
    }
  }
})
```

If other libraries are used to read the request content, the bodyXxx methods in exchange cannot be used, otherwise an exception is thrown. Similarly, after calling bodyXxx methods, other libraries cannot read the content, otherwise incomplete content will be read or exceptions will occur. However, bodyXxx methods can be called repeatedly without errors. Calling bodyText then bodyJson is allowed.

### Respond HTML

The ServerExchange type provides a respondHtml method for rendering HTML, easily organizing tag hierarchies and dynamically building structures.

```ts
// Start server
await startWebServer({
  // Routes
  routers: {
    '/profile': async exchange => {
      // Get user info
      const user = await getUser(exchange.headers.authorization)
      // HTML structure logic may be long, complex business can be extracted into separate functions
      exchange.respondHtml({
        lang: 'zh',
        head: [
          // Add tags to head, here add a title
          // Strings in children represent TextNode
          { tag: 'title', children: ['Profile'] },
          { tag: 'script', attrs: { type: 'module', src: 'main.js' } }
        ],
        body: {
          // Attributes with type inference for HTML global attributes like style, id, class
          attrs: {
            // Style has type inference
            style: { 'background-color': 'white' }
          },
          // children can also accept a function whose parameter is a function to add child elements
          // This allows dynamic rendering with loops and conditionals
          children: add => {
            add({ tag: 'h1', children: ['Profile'] })
            // Render different elements based on user presence
            if (user) {
              add({ tag: 'p', children: [`Username: ${user.account}`] })
            } else {
              add({
                tag: 'p',
                children: [
                  'Please login to view',
                  { tag: 'a', attrs: { href: '/login' }, children: ['Click to login'] }
                ]
              })
            }
            // Common combinations can be encapsulated into functions returning HtmlTag type
            // footer is such an example
            add(footer())
          }
        }
      })
    }
  }
})
```

footer function example:

```ts
function footer(): HtmlTag {
  return {
    tag: 'div',
    attrs: { class: 'footer' },
    children: [
      { tag: 'a', attrs: { href: '/about' }, children: ['About Us'] },
      { tag: 'a', attrs: { href: '/call' }, children: ['Contact Us'] },
      { tag: 'a', attrs: { href: '/privacy' }, children: ['Privacy Policy'] }
    ]
  }
}
```

If you don't like the framework's built-in HTML rendering, you can use third-party template rendering components.

Here is an example using handlebars:

```ts
import { compile } from 'handlebars'

await startWebServer({
  // Routes
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
      // Compile template
      const template = compile(source)
      // Data
      const data = {
        name: 'Alan',
        hometown: 'Somewhere, TX',
        kids: [
          { name: 'Jimmy', age: '12' },
          { name: 'Sally', age: '4' }
        ]
      }
      // Build content
      const result = template(data)
      // Render HTML string
      exchange.respondHtml(result)
    }
  }
})
```

Here is an example using Vue 3.x SSR to render HTML:

```ts
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

await startWebServer({
  // Routes
  routers: {
    '/html': async exchange => {
      const app = createSSRApp({
        data: () => ({ count: 1 }),
        template: `<button>{{ count }}</button>`
      })
      const html = await renderToString(app)
      // Render page with generated HTML
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

### Static Files

Static file directory mapping can be set via the static parameter, mapping a directory to a request path.

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

The dir parameter is the mapped directory path, which can be absolute or relative. Relative paths are resolved from the current working directory. The cacheAge parameter is the cache time. If set to a value greater than 0, a Cache-Control header is generated accordingly.

Request paths only support prefix matching, not wildcards. For example, /a/demo.html matches /a path and responds with the demo.html file from the configured directory. Path configurations have priority. Accessing /a/b/music.mp3 matches the /a/b configuration, not /a, because /a/b is more specific and has higher priority. If the file is not found in the /a/b directory, the /a configuration is not tried.

Static files also support automatic index page mapping. For example, accessing /a/b/c matches the /a/b configuration, then looks for file c in the configured directory. If not found, it tries to find index.html in directory c.

#### Static File Server Cache

Starting from version 0.3.0, server-side caching of static files is supported. To enable static file caching, configure the following environment variables:

| Environment Variable               | Description                                                                 |
| :--------------------------------- | :-------------------------------------------------------------------------- |
| SERVER_STATIC_CACHE_ENABLE         | Whether to enable server cache, default false                               |
| SERVER_STATIC_CACHE_MAX_AGE        | Server cache time in seconds, default 600                                   |
| SERVER_STATIC_CACHE_MAX_FILE_SIZE  | Maximum cacheable file size, supports semantic format like 10m and 100k, default 10m |
| SERVER_STATIC_CACHE_MAX_SIZE       | Maximum cache size, triggers cleanup when exceeded. Same semantic format support, default 100m |

Version 0.3.2 adds the removeServerStaticCache function to actively delete specified server-side static cache.

```ts
import { removeServerStaticCache } from 'wok-server'

removeServerStaticCache('/assets/index.js')
```

### Request Logs

Set the environment variable SERVER_ACCESS_LOG to true to enable request logging. When enabled, request and response information is output to the log after each response, disabled by default.

```
[2023/10/25 17:09:47.872][INFO][access-log]{"method":"GET","url":"/html?tab=%E6%9C%8D%E8%A3%85","ip":"::ffff:127.0.0.1","start":"2023/10/25 17:09:47.871","rt":1,"status":200}
```

The component only provides simple JSON format output and does not support format configuration. For request statistics, consider custom interceptors to store request information in message queues or databases for calculation, or analyze logs to extract request information.

### WebSocket

The component does not provide WebSocket functionality directly, but the startWebServer function provides a preHandler parameter for pre-processing the server, allowing additional operations before server startup to integrate other libraries that support the native http module.

WebSocket support can be implemented by integrating socket.io.

```ts
import { Server } from 'socket.io'
await startWebServer({
  routers: {
    // Route configuration omitted...
  },
  // Pre-handler to connect socket.io
  preHandler: async server => {
    const io = new Server(server)
    // Adapt /chat path. If /chat also exists in routes, there's no conflict
    // HTTP requests from clients are handled by routes
    // Of course, this is not recommended
    io.of('/chat').on('connection', socket => {
      // Manage sessions and handle business in callback after connection
      socket.on('message', data => {
        /* Handle custom events */
      })
      socket.on('disconnect', () => {
        /* Handle disconnection */
      })
    })
  }
})
```

### Server-Sent Events

Starting from version 0.4.0, the MVC component includes `createSseHandler`, which encapsulates SSE protocol details and greatly simplifies server push implementation.

```ts
import { createSseHandler } from 'wok-server'

await startWebServer({
  routers: {
    '/sse': createSseHandler({
      async handle(ctx) {
        let counter = 0
        for (let i = 0; i < 10; i++) {
          await new Promise<void>(resolve => setTimeout(resolve, 1000))
          counter++
          ctx.send({ message: 'Real-time update', count: counter })
          if (counter >= 10) {
            break
          }
        }
        ctx.close()
      }
    })
  }
})
```

The `handle` function receives an `SseContext` object with the following capabilities:

| Method/Property                          | Description                                                  |
| :--------------------------------------- | :----------------------------------------------------------- |
| `ctx.send(data, event?, id?)`           | Sends an SSE event. `data` is JSON serialized. `event` specifies the event name (use `addEventListener` on frontend), `id` sets the event ID (for `Last-Event-ID` on reconnection) |
| `ctx.close()`                            | Explicitly ends the SSE connection. The connection also closes automatically when `handle` returns or throws |
| `ctx.request`                            | The raw `IncomingMessage`, for reading request headers etc.  |
| `ctx.response`                           | The raw `ServerResponse`, for advanced scenarios             |

#### Named Events

Send named events via the `event` parameter, allowing the frontend to handle different event types separately:

```ts
createSseHandler({
  async handle(ctx) {
    ctx.send({ title: 'New message' }, 'notification')
    ctx.send({ progress: 50 }, 'progress')
  }
})
```

Frontend:

```ts
const es = new EventSource('/sse')
es.addEventListener('notification', e => {
  const data = JSON.parse(e.data)
  console.log('Notification:', data.title)
})
```

#### Reconnection

Set event IDs via the `id` parameter. On reconnection, the browser automatically sends the `Last-Event-ID` header:

```ts
createSseHandler({
  async handle(ctx) {
    const lastId = ctx.request.headers['last-event-id']
    // Determine where to resume based on lastId
  }
})
```

#### Connection Lifecycle

- SSE headers are sent and the connection is established when `handle` begins execution
- `ctx.send()` becomes a no-op when the client disconnects (automatically ignored)
- The connection closes automatically when `handle` returns or throws