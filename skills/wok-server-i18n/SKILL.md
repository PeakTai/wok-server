---
name: wok-server-i18n
description: wok-server 国际化组件使用指南，支持多语言消息构建、语言绑定、扩展业务国际化内容。
license: MIT
metadata:
  author: Peak Tai
  email: peaktai@qq.com
---

# wok-server 国际化组件

## 概述

国际化组件提供多语言消息构建能力，内置 12 种语言，支持扩展新语言和业务国际化内容。`getI18n()` 返回全局单例。

注意：全局 i18n 对象是共享的，异步请求中可能出现语言被其他请求串改的问题——请使用绑定功能（`bindByRequest` / `bindLang`）解决。

## 源码与类型定义

安装 `wok-server` 后，可通过以下路径查看源码与类型定义：

- 源码目录：`node_modules/wok-server/src/i18n/`
- 类型定义：`node_modules/wok-server/types/` （引用 i18n 组件的 `.d.ts` 文件）

核心源码文件：

| 文件            | 说明                               |
| :-------------- | :--------------------------------- |
| `i18n.ts`       | `I18n`、`BoundI18n`、`ExtensibleI18n` 三个类 |
| `index.ts`      | 模块入口，`getI18n()` 初始化 12 种语言 |
| `tag.ts`        | 语言标签解析（`zh-CN` → `{lang, region}`） |
| `msg.ts`        | 内置消息模板类型定义 `I18nMsgs`     |
| `zh-cn.ts` 等   | 各语言的消息模板文件               |

---

## 获取实例

```ts
import { getI18n } from 'wok-server'
const i18n = getI18n()
```

首次调用完成初始化后始终返回同一实例。初始化时会根据环境变量 `LANG` 或 `LC_CTYPE` 自动切换语言。

---

## 基本操作

### 获取 / 切换语言

```ts
const lang = i18n.getLang()        // 'zh-CN'
const ok = i18n.setLang('en')      // true 成功，false 不支持
```

### 构建消息

```ts
const msg = i18n.buildMsg('validate-err-max', '7')
// zh-CN: "7 以下である必要があります" → 实际看当前语言
```

`buildMsg(key, ...args)` 中 `key` 有类型约束（`I18nMsgs`），模板中用 `{}` 占位，按顺序替换。

### 支持的语言标签检测

```ts
const supported = i18n.getSupportedLanguageTags('zh-CN', 'xx', 'ja')
// ['zh-CN', 'ja']  — 过滤掉不支持的
```

---

## 内置语言

| 语言标签 | 语言         |
| :------- | :----------- |
| en       | 英语（默认） |
| zh-CN    | 简体中文     |
| zh-TW    | 繁体中文     |
| zh-HK    | 香港繁体     |
| ja       | 日语         |
| ko       | 韩语         |
| ru       | 俄语         |
| es       | 西班牙语     |
| de       | 德语         |
| fr       | 法语         |
| ar       | 阿拉伯语     |
| pt       | 葡萄牙语     |

---

## 语言匹配规则

`setLang` 的匹配逻辑（实现在 `findMsgsByLang`）：

1. 解析语言标签为 `{lang, region}`
2. 查 `lang` 下的 region → 精确匹配 region
3. 未命中查默认区域 `-`
4. 仍未命中取该语言下第一个 region
5. 全部未命中返回 `undefined`，`setLang` 返回 `false`，语言不变

**注意**：匹配失败不会回退到英文默认语言，而是保持原有语言不变。

---

## 配置新语言

如果需要的语言未内置，通过 `setMsgs` 添加消息模板后即可切换：

```ts
i18n.setMsgs('ja', {
  'validate-err-array': '値が配列ではありません',
  'validate-err-max': '{} 以下である必要があります',
  'validate-err-min': '{} 以上である必要があります',
  'validate-err-empty': '空であってはいけません',
  'validate-err-string': '値が文字列のタイプではありません',
  // ... 其他 key 来自 I18nMsgs
})
i18n.setLang('ja')
```

---

## 扩展业务国际化内容

通过 `extend` 创建独立的 i18n 对象，与全局 i18n 自动保持语言同步：

```ts
interface ExtMsgs { hello: string; world: string }

const extI18n = i18n.extend<ExtMsgs>({ hello: 'hello', world: 'world' })
extI18n.setMsgs('zh-CN', { hello: '你好', world: '世界' })

i18n.setLang('zh-CN')
extI18n.buildMsg('hello')  // "你好"
```

**约束**：所有消息模板 value 必须是 `string`，模板支持 `{}` 占位。扩展对象的 `setLang` 会自动被全局 i18n 的 `setLang` 同步调用（`ExtensibleI18n` 覆写了 `setLang`，遍历 `extendedI18ns` 逐个同步）。

---

## 绑定语言 — 解决异步串扰

由于全局 i18n 共享，请求 A 切换语言后执行异步操作，请求 B 可能在此期间切换语言，导致 A 的消息构建语言错误。解决方案：

### bindByRequest — 根据请求头绑定

```ts
async function handleReq(exchange: RouterExchange): Promise<void> {
  const boundI18n = extI18n.bindByRequest(exchange.headers)
  await query1()
  await query2()
  const hello = boundI18n.buildMsg('hello')  // 语言固定，不受其他请求影响
}
```

解析 `accept-language` 头，取第一个支持的语言，生成 `BoundI18n`。`BoundI18n` 没有 `setLang` 方法，语言不可变。

### bindLang — 手动绑定

```ts
const bound = i18n.bindLang('zh-CN')   // 绑定指定语言
const bound2 = i18n.bindLang()          // 绑定当前语言
bound.buildMsg('validate-err-empty')
```

`bindLang` 不传参时绑定当前语言，传参且语言不支持时抛出 `Error`。

### switchByRequest — 直接切换

```ts
i18n.switchByRequest(exchange.headers)
```

根据 `accept-language` 直接切换全局语言（不创建绑定对象）。适合没有异步串扰风险的场景。

---

## 无国际化需求时固定中文

在 import 框架之前设置：

```ts
process.env.LANG = 'zh-CN'
import { startWebServer } from 'wok-server'
```

或者在容器中设置 `LANG=zh-CN` 环境变量。

---

## 内部实现要点

### 类层次

```
I18n<T>                    — 核心类：setLang/getLang/buildMsg/bindLang/bindByRequest/switchByRequest
  └── ExtensibleI18n<T>    — 增加 extend 方法，覆写 setLang 同步扩展子对象
BoundI18n<T>               — 轻量只读绑定对象，仅 getLang/buildMsg
```

### 消息存储结构

`msgsMap: Map<lang, Map<region, T>>`。两层 Map：第一层 key 为语言（`en`），第二层 key 为地区（`us` 或 `-` 表示默认）。全小写存储。

### 语言标签解析 (`tag.ts`)

仅支持 `语言-地区` 格式（如 `zh-CN`），不支持完整 BCP 47。统一转小写后匹配。

### 初始化 (`index.ts`)

`getI18n()` 首次调用：创建 `ExtensibleI18n(enUS)` → 注册 11 种语言（不含默认 en）→ 根据 `LANG`/`LC_CTYPE` 环境变量自动切换语言。
