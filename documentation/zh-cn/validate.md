# 校验

校验组件提供了 validate 函数来校验对象，内置了很多通用的校验规则。
组件是支持国际化的，提示信息与当前的语言有关，详细可以参考国际化部分。

下面是简单的使用示例：

```ts
validate(
  // 校验对象
  { name: 'tom' },
  // 校验规则，每个属性可设置多个规则
  {
    name: [notNull(), length({ min: 2, max: 16 })]
  }
)
```

自带的校验规则函数。

| 函数        | 作用                                                 |
| :---------- | :--------------------------------------------------- |
| notNull     | 非空校验，不能是 null 或 undefined                    |
| notBlank    | 字符非空校验，不能是 null 或 undefined 或空白字符串 |
| min         | 校验数字最小值                                       |
| max         | 校验数字最大值                                       |
| length      | 校验长度，适用于字符串和数组                         |
| maxLength   | 检查长度最大值，适用于字符串和数组                   |
| minLength   | 检查长度最小值，适用于字符串和数组                   |
| regexp      | 正则校验                                             |
| enumerate   | 枚举校验，验证值必须是指定列表中的某一个             |
| array       | 数组校验,设置元素对象的校验规则来校验每一个元素      |
| plainObject | 对象校验,如果属性是对象可进一步校验属性值的属性      |

下面是对象和数组嵌套的校验示例。

```ts
interface Tag {
  id: string
  name: string
  permissinos: { edit?: boolean; read?: boolean }
}
interface User {
  profile: {
    theme: string
  }
  tags: Tag[]
}
validate<User>(
  {
    profile: {
      theme: 'light'
    },
    tags: [
      { id: '001', name: 'basketball', permissinos: { edit: true, read: true } },
      { id: '002', name: 'soccer', permissinos: { edit: true } }
    ]
  },
  {
    profile: [
      notNull(),
      plainObject({
        theme: [notBlank()]
      })
    ],
    tags: [
      // 标签不得超过5个
      maxLength(5),
      // 标签列表不能为空
      notNull(),
      // 校验标签数组的元素
      array([
        // 元素不能为空
        notNull(),
        // 元素的属性校验
        plainObject({
          id: [notBlank()],
          name: [notBlank()],
          permissinos: [
            notNull(),
            plainObject({
              edit: [notNull()],
              read: [notNull()]
            })
          ]
        })
      ])
    ]
  }
)
```

在实际开发中，建议最好只有一层，不要嵌套，否则程序将难以维护。

## 自定义校验规则

如果自带的校验规则无法满足需要，也可以编写自定义的校验规则。

```ts
/**
 * 自定义校验
 * @returns 属性校验器
 */
function customValidate(): PropValidator {
  // 校验器名称，用于跟踪信息
  const validator = 'custom'
  const message = '不能以 t 开头'
  return val => {
    // 不校验空
    if (!val) {
      return { ok: true }
    }
    if (typeof val !== 'string') {
      return { ok: false, validator, message: '值不是字符串' }
    }
    if (val.startsWith('t')) {
      return { ok: false, validator, message }
    }
    return { ok: true }
  }
}

validate(
  { name: 'tim' },
  {
    name: [customValidate()]
  }
)
```

内置的校验规则函数都做了国际化的支持，自定义的校验规则如有国际化的要求，需要自行处理，详细可以参考国际化章节。
