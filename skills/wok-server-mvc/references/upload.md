# 文件上传

## 二进制（Binary）上传

二进制上传即 `application/octet-stream` 格式的上传，请求正文仅为文件内容，不包含其他信息。由 `createUploadHandler` 函数创建路由处理器，响应 JSON 格式。

这种形式的优势是简单、性能高——服务器端拿到请求正文即是文件，无需解析。但额外参数只能通过 QueryString 或 Header 传递，且一次只能传一个文件。

```ts
import { createUploadHandler } from 'wok-server'

interface Resp {
  url: string
}

export const uploadAvatar = createUploadHandler<Resp>({
  async handle(body, exchange) {
    const userId = exchange.query.getStr('userId') as string
    if (body.byteLength > 2 * 1024 * 1024) {
      throw new BusinessException('文件大小不得超过 2MB')
    }
    const key = `users/${userId}/avatar`
    await oss.putObject(key, body)
    return { url: oss.getUrl(key) }
  }
})
```

如需更高自由度（如不返回 JSON），使用普通路由处理器，通过 `exchange.bodyBuffer()` 读取请求正文：

```ts
export const uploadAvatar: RouterHandler = async exchange => {
  const file = await exchange.bodyBuffer()
  const query = exchange.parseQueryString()
  const userId = query.getStr('userId')
  // 校验参数和存储文件等流程省略...
}
```

## multipart/form-data 格式上传

组件目前尚未内置对 multipart/form-data 类型请求的处理，可通过第三方库（如 formidable）解析。

```ts
import formidable from 'formidable'

await startWebServer({
  routers: {
    '/cover': async exchange => {
      const form = formidable({})
      const [fields, files] = await form.parse(exchange.request)
      // todo 继续业务处理
    }
  }
})
```

### 注意事项

- 使用了第三方库读取 `request` 内容后，不能再使用 `exchange` 中的 `bodyXxx` 系列方法，调用时会抛出异常。
- 同样，调用了 `bodyXxx` 系列方法后也不能再用第三方库读取内容，否则将读取不到完整内容或引发异常。
- `bodyXxx` 系列方法之间可以重复调用，不会产生错误。例如调用 `bodyText()` 后再调用 `bodyJson()` 是允许的。
