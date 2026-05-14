[简体中文](./README.md) | English

# Wok Server

[![npm version](https://img.shields.io/npm/v/wok-server)](https://www.npmjs.com/package/wok-server)
[![license](https://img.shields.io/npm/l/wok-server)](https://github.com/nicepkg/wok-server/blob/master/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

A lightweight, restrained backend framework for Node.js and TypeScript.

## Features

- **Infrastructure** — Configuration, Logging, i18n, Caching
- **Web Layer** — Routing, Validation, MVC
- **Database** — MySQL, MongoDB
- **Others** — Scheduled Tasks

## Why Wok Server

- Functional-first with minimal OOP, low learning curve
- Deliberately restrained — no decorators, proxies, or metaprogramming
- Lightweight wrapper, compatible with the broader HTTP ecosystem
- Full TypeScript definitions with IDE IntelliSense support
- Self-documenting code with detailed method and parameter annotations
- Built-in i18n with extensible language support

## Quick Start

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

Visit `http://localhost:8080` to see the output.

For more configuration via environment variables, see the [full documentation](https://gitee.com/tai/wok-server/blob/master/documentation/en/index.md).

### Install AI Skills

wok-server provides AI skills that help AI coding assistants better understand and use wok-server components.

```bash
npx skills add peaktai/wok-server --all
```

If GitHub access is slow, use the Gitee mirror:

```bash
npx skills add https://gitee.com/tai/wok-server.git --all
```
