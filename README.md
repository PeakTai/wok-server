# Wok Server

一个简洁易用的 Nodejs 后端框架，使用 Typescript 开发，有完整的类型约束和定义，注释详细，文档齐全，支持国际化。

主要功能：配置，日志，国际化，校验，缓存，MVC，mysql，mongodb ，周期任务 。

[查看文档](./documentation/zh-cn/index.md)

## 优点

- 学习成本较低，函数式为主，少量面向对象，未使用代理和装饰器等增强技术
- 功能简单，使用方便，保持克制，不引入太多特性
- 轻量封装，最大限度兼容已有生态，支持集成第三方 http 相关的库来处理请求
- 支持国际化，自带多种语言的支持，国际化内容支持扩展
- 有完整的类型约束和定义，结合 IDE 的代码补全功能，开发效率高
- 注释详细，文档就在代码中，方法和参数都有详细说明，可在 IDE 的辅助下方便查看

## Hello world

安装：

```
npm i wok-server --save
```

入口文件：

```ts
import { startWebServer } from 'wok-server'

startWebServer({
  routers: {
    '/': async exchange => exchange.respondText('Hello world !')
  }
}).catch(e => {
  console.error('Start server failed', e)
})
```

上面的代码启动了 web 服务，访问路径 `http://localhost:8080` 将输出文本 “Hello world !”。

相关的设置可以通过环境变量来修改，查看[完整文档](./documentation/zh-cn/index.md)了解细节。

## 一些问题的说明

### 为什么直接集成依赖库

项目中对 mysql 客户端和 mongodb 的驱动直接打包集成了，也没有将这两个组件
单独拆分成一个独立的包以供按需引入。这样做是为了方便，不需要安装那么多包，安装的包多了
之后，还有可能需要解决依赖冲突问题，找到版本匹配的包，使用和维护都麻烦。对于后端程序来说，
体积大一些问题也不大。

### 为什么部分可选功能需要第三方库，而又没有集成

对于 wesocket 和文件上传等功能，框架没有实现，而是需要使用者引入第三方库，框架没有集成这些库。
这些库是基于 Nodejs 内置的模块 http，不用担心与框架的兼容性问题，框架只要保持支持即可，
也可以充分利用已有的生态，不需要专门为框架编写扩展。
