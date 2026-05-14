# 静态文件

通过 `startWebServer` 的 `static` 参数设置静态文件目录映射，将文件系统目录映射到请求路径。

## 基本配置

```ts
await startWebServer({
  static: {
    '/a': { dir: '/path/to/files', cacheAge: 300 },
    '/a/b': { dir: '/path/to/other', cacheAge: 150 },
    '/b': { dir: 'static', cacheAge: 0 }
  },
  routers: {}
})
```

| 参数      | 说明                                             |
| :-------- | :----------------------------------------------- |
| `dir`     | 映射的文件目录，支持绝对路径和相对路径（相对进程当前目录） |
| `cacheAge` | 缓存时间（秒），大于 0 则生成 `Cache-Control` 消息头   |

## 路径匹配规则

- 仅支持**前缀匹配**，不支持通配符。例如 `/a/demo.html` 匹配 `/a` 路径配置。
- 路径配置有**优先级**：更详细的路径优先匹配。例如访问 `/a/b/music.mp3` 会匹配 `/a/b` 而非 `/a`。
- 匹配失败不会降级尝试：如果 `/a/b` 目录下找不到文件，不会再去 `/a` 目录查找。
- 支持**主页自动映射**：访问 `/a/b/c` 时，会先找文件 `c`，找不到则尝试目录 `c` 下的 `index.html`。

## 服务器端缓存

从 0.3.0 版本开始，支持静态文件服务器端缓存。通过以下环境变量配置：

| 环境变量                           | 说明                                          | 默认值 |
| :--------------------------------- | :-------------------------------------------- | :----- |
| `SERVER_STATIC_CACHE_ENABLE`       | 是否启用服务器缓存                            | false  |
| `SERVER_STATIC_CACHE_MAX_AGE`      | 服务器缓存时间（秒）                          | 600    |
| `SERVER_STATIC_CACHE_MAX_FILE_SIZE` | 最大可缓存的文件大小，支持语义化格式（如 10m、100k） | 10m    |
| `SERVER_STATIC_CACHE_MAX_SIZE`     | 缓存最大空间，超出后清理，支持语义化格式      | 100m   |

0.3.2 版本新增 `removeServerStaticCache` 函数，可主动清除指定路径的静态文件缓存：

```ts
import { removeServerStaticCache } from 'wok-server'

removeServerStaticCache('/assets/index.js')
```
