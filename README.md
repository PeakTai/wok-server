[English](./README.en.md) | 简体中文

# Wok Server

[![npm version](https://img.shields.io/npm/v/wok-server)](https://www.npmjs.com/package/wok-server)
[![license](https://img.shields.io/npm/l/wok-server)](https://github.com/nicepkg/wok-server/blob/master/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

一个基于 Node.js 和 TypeScript 的后端框架，轻量、克制、简洁。

## 功能概览

- **基础设施** — 配置管理、日志、国际化、缓存
- **Web 层** — 路由、参数校验、MVC
- **数据库** — MySQL、MongoDB
- **其他** — 周期任务

## 为什么选择 Wok Server

- 函数式为主，少量面向对象，学习成本低
- 保持克制，不引入代理、装饰器等增强技术
- 轻量封装，兼容第三方 HTTP 生态
- 完整的类型定义，配合 IDE 智能补全，开发效率高
- 注释即文档，方法及参数均有详细说明
- 内置国际化支持，可扩展多语言

## 快速开始

```bash
npm i wok-server
```

```ts
import { startWebServer } from 'wok-server'

startWebServer({
  routers: {
    '/': async exchange => exchange.respondText('Hello world!')
  }
}).catch(e => {
  console.error('Start server failed', e)
})
```

启动后访问 `http://localhost:8080` 即可看到输出。

更多配置通过环境变量设置，详见[完整文档](https://gitee.com/tai/wok-server/blob/master/documentation/zh-cn/index.md)。

### AI 技能安装

wok-server 提供了 AI 技能，安装后可以让 AI 编程助手更好地理解和使用 wok-server 组件。


```bash
npx skills add peaktai/wok-server --all
```

国内用户访问 github 速度慢，可以使用 gitee 仓库地址来安装。

```bash
npx skills add https://gitee.com/tai/wok-server.git --all
```

## FAQ

### 为什么内置 MySQL 和 MongoDB 驱动？

mysql2 和 mongodb 驱动已直接集成，安装一个包即可使用，避免多个包的版本冲突和维护成本。对于后端应用，包体积的增加影响有限。

### 为什么 WebSocket、文件上传等功能需要自行引入？

这些功能基于 Node.js 原生 `http` 模块，天然兼容框架，无需专门适配。由用户按需引入第三方库，可以充分利用社区生态，同时减少框架的维护负担。
