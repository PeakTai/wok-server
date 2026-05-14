---
name: wok-server-config
description: wok-server 配置组件使用指南，将配置对象与环境变量映射，支持类型转换和校验。
license: MIT
metadata:
  author: Peak Tai
  email: peaktai@qq.com
---

# wok-server 配置组件

## 概述

配置组件将配置对象与环境变量映射，并提供给其他模块使用。结合校验组件可实现配置的合法性校验。

配置对象的属性仅支持三种类型：`string`、`number`、`boolean`。

提供三个函数：`registerConfig`、`getConfig`、`generateConfig`。

## 源码与类型定义

安装 `wok-server` 后，可通过以下路径查看源码与类型定义：

- 源码目录：`node_modules/wok-server/src/config/`
- 类型定义：`node_modules/wok-server/types/` （引用 config 组件的 `.d.ts` 文件）

核心源码文件：

| 文件            | 说明                               |
| :-------------- | :--------------------------------- |
| `index.ts`      | 模块入口，导出三个配置函数          |
| `convert.ts`    | 环境变量值类型转换逻辑              |
| `exception.ts`  | `ConfigException` 异常类            |

---

## 配置类型与映射规则

### 类型要求

> **⚠️ 重要：配置类型的所有属性绝对不可为空（不能是 `undefined`）。**

配置组件在**运行时**通过 `for...in` 遍历 `defaultConfig` 的属性来匹配环境变量，如果某个属性的值为 `undefined`，该属性的类型将无法判断（`typeof undefined` 为 `"undefined"`），导致 `convert` 抛出 `ConfigException`。

以下写法在真实开发中是不允许的，非常容易出现 bug：

```ts
// ❌ 错误：属性可空
interface XxxConfig {
  name?: string
}
// 如果 defaultConfig 初始化时 name 的值为 undefined，运行时匹配会失败
```

正确做法是所有属性保持必填并给出有意义的默认值：

```ts
// ✅ 正确：属性必填，必须有默认值
interface XxxConfig {
  name: string
}
```

配置对象的属性仅支持三种类型：

| TypeScript 类型 | 环境变量值转换方式                       |
| :-------------- | :--------------------------------------- |
| `string`        | 直接使用字符串值                         |
| `number`        | 通过 `parseFloat` 转换，NaN 则抛异常      |
| `boolean`       | `'true'` → true, `'false'` → false，其他抛异常 |

### 环境变量名映射

环境变量名 = `前缀(大写)_属性名转换(大写)`。属性名中的大写字母前会插入下划线。

例如：前缀 `custom`，属性 `appId` → 环境变量 `CUSTOM_APP_ID`。

每次调用 `registerConfig` 或 `generateConfig` 都会输出日志，包含前缀、环境变量名、当前值、映射属性名，便于调试。

---

## registerConfig — 注册配置（推荐）

```ts
function registerConfig<T extends {}>(
  defaultConfig: T,
  envPrefix: string,
  validation?: ValidationOpts<T>
): T
```

- `defaultConfig`：默认配置对象，**所有属性必须有值（不能为 `undefined`）**。运行时通过遍历该对象的属性来匹配环境变量，属性值为 `undefined` 会导致类型无法识别而抛出异常
- `envPrefix`：环境变量前缀
- `validation`：可选的校验规则
- 返回映射后的配置对象

**特点**：同一前缀只能注册一次，重复注册会抛出 `ConfigException`。推荐将返回的配置对象导出供其他模块使用。

```ts
import { registerConfig, notBlank, notNull, min, max } from 'wok-server'

interface CustomConfig {
  appId: string
  appSecret: string
  ssl: boolean
  timeout: number
}

const config = registerConfig<CustomConfig>(
  { appId: '', appSecret: '', ssl: true, timeout: 5000 },
  'custom',
  {
    appId: [notBlank()],
    appSecret: [notBlank()],
    timeout: [notNull(), min(1000), max(3600)]
  }
)
```

也可以不显式定义类型，让 TypeScript 自动推断：

```ts
const config = registerConfig(
  { url: 'http://localhost/api', account: 'Jack' },
  'c2',
  { url: [notBlank()] }
)
```

---

## generateConfig — 生成配置（可重复）

```ts
function generateConfig<T extends {}>(
  defaultConfig: T,
  envPrefix: string,
  validation?: ValidationOpts<T>
): T
```

参数与 `registerConfig` 完全一致。区别在于 `generateConfig` **不注册**，可多次调用，适合以下场景：
- 运行时更改环境变量后重新生成配置
- 测试中模拟不同环境
- 其他需要动态生成配置的特殊需求

```ts
const config1 = generateConfig(defaults, 'myapp')
// 修改环境变量后
process.env.MYAPP_TIMEOUT = '8000'
const config2 = generateConfig(defaults, 'myapp')
```

---

## getConfig — 获取已注册配置

```ts
function getConfig<T>(envPrefix: string): T | undefined
```

通过前缀获取已注册的配置对象。一般不需要使用，推荐在 `registerConfig` 调用后直接导出返回的配置对象。

```ts
const config = getConfig<CustomConfig>('custom')
```

---

## 内部实现要点

### 类型转换 (`convert.ts`)

```ts
function convert(val: string, defaultVal: any): string | number | boolean
```

- 根据 `defaultVal` 的类型决定转换策略
- `string`：直接返回原值
- `number`：`parseFloat` 转换，失败抛出 `ConfigException`
- `boolean`：仅接受 `'true'` / `'false'`，大小写敏感
- 其他类型不支持，抛出 `ConfigException`

### 环境变量名构建

```ts
function buildEnvName(envPrefix: string, propName: string): string
```

将驼峰属性名转换为下划线大写格式：
- `appId` → `APP_ID`
- 前缀 `custom` + `appId` → `CUSTOM_APP_ID`

### 全局注册表

`registerConfig` 内部维护一个 `configEnvMap`（`Map<string, any>`），以前缀为 key 存储配置。重复注册相同前缀直接抛异常，保证配置唯一性。

### 模块初始化

模块顶层调用 `dotenv` 的 `config()` 加载 `.env` 文件，确保环境变量在配置映射前已就绪。
