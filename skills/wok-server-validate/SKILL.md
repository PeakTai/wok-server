---
name: wok-server-validate
description: wok-server 校验组件使用指南，提供对象属性校验、内置规则和自定义规则的完整支持。
license: MIT
metadata:
  author: Peak Tai
  email: peaktai@qq.com
---

# wok-server 校验组件

## 概述

校验组件提供 `validate` 函数校验对象属性，内置 11 种通用校验规则，支持嵌套对象/数组校验和自定义规则。校验器通过国际化组件自动生成多语言错误提示。

## 源码与类型定义

安装 `wok-server` 后，可通过以下路径查看源码与类型定义：

- 源码目录：`node_modules/wok-server/src/validation/`
- 类型定义：`node_modules/wok-server/types/` （引用 validation 组件的 `.d.ts` 文件）

核心源码文件：

| 文件                | 说明                               |
| :------------------ | :--------------------------------- |
| `index.ts`          | 模块入口，`validate` 函数          |
| `exception.ts`      | `ValidationException` 异常类       |
| `validator/`        | 内置校验规则函数目录               |
| `validator/index.ts`| 导出所有内置校验器                 |

---

## 基本使用

```ts
import { validate, notNull, length } from 'wok-server'

validate(
  { name: 'tom' },
  { name: [notNull(), length({ min: 2, max: 16 })] }
)
```

- 校验通过无返回值
- 校验失败抛出 `ValidationException`（含 `errMsg`、`validator`、`propertyPath`、`val`）

```ts
try {
  validate(obj, rules)
} catch (e) {
  if (e instanceof ValidationException) {
    console.log(e.propertyPath)  // 如 "profile.theme"
    console.log(e.errMsg)        // 如 "不能为空"
  }
}
```

### 内置校验规则

| 函数          | 作用                                    | 空值行为         |
| :------------ | :-------------------------------------- | :--------------- |
| `notNull`     | 不能是 `null` 或 `undefined`            | —                |
| `notBlank`    | 不能是 `null`/`undefined`/空白字符串     | —                |
| `min(n)`      | 数字必须 ≥ n                            | 空值跳过         |
| `max(n)`      | 数字必须 ≤ n                            | 空值跳过         |
| `length`      | 字符串/数组长度必须在 [min, max] 之间   | 空值跳过         |
| `maxLength(n)`| 长度必须 ≤ n                            | 空值跳过         |
| `minLength(n)`| 长度必须 ≥ n                            | 空值跳过         |
| `regexp`      | 正则校验                                | 空值跳过         |
| `enumerate`   | 值必须在指定列表中                      | 空值跳过         |
| `array`       | 校验数组元素                            | —                |
| `plainObject` | 校验嵌套对象                            | —                |

**空值行为**：大部分较验器对空值（`null`/`undefined`）返回 `{ ok: true }` 跳过，需配合 `notNull` 使用。`notNull` 和 `notBlank` 本身才校验空。

### 国际化支持

所有内置校验器的默认错误消息通过 `getI18n().buildMsg(...)` 自动生成，支持多语言。也可以覆盖 `message` 参数。

```ts
notNull('名称不能为空')
length({ min: 2, max: 16, message: '名称必须是2到16个字' })
```

---

## 嵌套校验

```ts
import { array, plainObject } from 'wok-server'

interface Tag { id: string; name: string }
interface User { profile: { theme: string }; tags: Tag[] }

validate<User>(data, {
  profile: [notNull(), plainObject({
    theme: [notBlank()]
  })],
  tags: [notNull(), maxLength(5), array([
    notNull(),
    plainObject({
      id: [notBlank()],
      name: [notBlank()]
    })
  ])]
})
```

- `plainObject` 为嵌套对象定义子校验规则
- `array` 为数组元素定义校验规则（每个元素都校验）
- `ValidationException.propertyPath` 会记录完整路径（如 `tags[0].name`）

**⚠️ 建议嵌套不超过一层**，否则难以维护。

---

## 自定义校验规则

```ts
import { PropValidator } from 'wok-server'

function customValidate(): PropValidator<string> {
  const validator = 'custom'
  return val => {
    if (!val) return { ok: true }                    // 不校验空
    if (typeof val !== 'string') {
      return { ok: false, validator, message: '值不是字符串' }
    }
    if (val.startsWith('t')) {
      return { ok: false, validator, message: '不能以 t 开头' }
    }
    return { ok: true }
  }
}

validate({ name: 'tim' }, { name: [customValidate()] })
```

`PropValidator<T>` 定义为 `(val: T) => ValidationResult`。
- `ok: true` 校验通过
- `ok: false` 校验失败，需提供 `validator` 名称和 `message` 错误信息
- 可附带 `propPath` 字段（在被 `array`/`plainObject` 内部逐层拼接使用）

自定义校验器需要国际化时，自行调用 `getI18n().buildMsg()`。

---

## validate 函数实现

```ts
function validate<T>(obj: T, opts: ValidationOpts<T>): void
```

内部遍历 `opts` 的每个 key，取出对应的值，依次运行该 key 的所有校验器函数。第一个失败即抛出 `ValidationException`。属性路径通过 `propPath` 逐级拼接（嵌套时 `array`/`plainObject` 校验器内部会设置）。

---

## ValidationOpts 类型

```ts
type ValidationOpts<T> = Partial<{
  [key in keyof T]: PropValidator<T[key]>[]
}>
```

即对象的每个属性对应一个校验器函数数组。
