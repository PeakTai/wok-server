import assert, { doesNotThrow, equal, throws } from 'assert'
import {
  ValidationException,
  array,
  getI18n,
  length,
  max,
  maxLength,
  min,
  minLength,
  notBlank,
  notNull,
  plainObject,
  validate
} from '../src'
import { runTestAsync } from './utils'

describe('校验', () => {
  it(
    '非空校验',
    runTestAsync(async () => {
      // 切换成中文进行测试
      getI18n().setLang('zh')
      interface User {
        name?: string
      }
      throws(
        () => validate<User>({}, { name: [notNull()] }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '不能为空')
          equal(err.validator, 'notNull')
          equal(err.propertyPath, 'name')
          return true
        }
      )
      doesNotThrow(() => validate<User>({ name: '' }, { name: [notNull()] }))
      // notBlank 不能通过
      throws(
        () => validate<User>({ name: '' }, { name: [notBlank()] }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '不能为空')
          equal(err.validator, 'notBlank')
          equal(err.propertyPath, 'name')
          return true
        }
      )
      // 有值 notBlank 才可以通过
      doesNotThrow(() => validate<User>({ name: 'tom' }, { name: [notBlank()] }))

      // 自定义消息验证
      throws(
        () => validate({ name: null }, { name: [notNull('姓名必须填写')] }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '姓名必须填写')
          equal(err.validator, 'notNull')
          equal(err.propertyPath, 'name')
          return true
        }
      )
      throws(
        () => validate({ name: '' }, { name: [notBlank('姓名必须填写')] }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '姓名必须填写')
          equal(err.validator, 'notBlank')
          equal(err.propertyPath, 'name')
          return true
        }
      )
    })
  )
  it(
    '数字校验',
    runTestAsync(async () => {
      // 切换成中文进行测试
      getI18n().setLang('zh')
      const obj = {
        age: 23
      }
      // 校验可以通过
      doesNotThrow(() =>
        validate(obj, {
          age: [notNull(), min(0), max(50)]
        })
      )
      // min 校验失败
      throws(
        () => validate(obj, { age: [notNull(), min(30), max(50)] }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '不得小于 30')
          equal(err.validator, 'min')
          equal(err.propertyPath, 'age')
          return true
        }
      )

      // max 失败
      throws(
        () => validate(obj, { age: [notNull(), min(10), max(20)] }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '不得大于 20')
          equal(err.validator, 'max')
          equal(err.propertyPath, 'age')
          return true
        }
      )

      // 如果设置了多个规则都不满足，那么第一个失败后停止，异常记录的是第一个规则的信息
      throws(
        () => validate(obj, { age: [notNull(), max(20), min(30)] }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '不得大于 20')
          equal(err.validator, 'max')
          equal(err.propertyPath, 'age')
          return true
        }
      )

      // 不加 notNull ,则只会在有值时才进行校验
      // 值是 null 或 undefined 不会进行校验
      doesNotThrow(() => validate({ age: null }, { age: [min(1), max(5)] }))
      // 如果有值则会被校验
      throws(
        () => validate({ age: 0 }, { age: [min(1), max(5)] }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '不得小于 1')
          equal(err.validator, 'min')
          equal(err.propertyPath, 'age')
          return true
        }
      )

      // 自定义提示消息
      throws(
        () => validate(obj, { age: [min(30, '小于30岁不得参加活动')] }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '小于30岁不得参加活动')
          equal(err.validator, 'min')
          equal(err.propertyPath, 'age')
          return true
        }
      )
      throws(
        () => validate({ age: 28 }, { age: [max(20, '超过20不要')] }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '超过20不要')
          equal(err.validator, 'max')
          equal(err.propertyPath, 'age')
          return true
        }
      )
    })
  )
  it(
    '字符串校验',
    runTestAsync(async () => {
      // 切换成英文来测试，与前面使用的语言不同，顺便验证国际化
      getI18n().setLang('en')
      const user = { name: 'jack', intro: 'I am Chinese and I love my motherland' }

      doesNotThrow(() =>
        validate(user, {
          name: [notBlank(), minLength(1), maxLength(5)],
          intro: [length({ min: 10, max: 500 })]
        })
      )

      throws(
        () =>
          validate(user, {
            name: [minLength(7)]
          }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, 'The length should not be less than 7.')
          equal(err.validator, 'minLength')
          equal(err.propertyPath, 'name')
          return true
        }
      )
      throws(
        () =>
          validate(user, {
            name: [minLength(1), maxLength(3)]
          }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, 'The length must not exceed 3.')
          equal(err.validator, 'maxLength')
          equal(err.propertyPath, 'name')
          return true
        }
      )
      throws(
        () =>
          validate(user, {
            name: [length({ min: 1, max: 3 })]
          }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, 'The length must not exceed 3.')
          equal(err.validator, 'length')
          equal(err.propertyPath, 'name')
          return true
        }
      )
      // 自定义消息测试
      throws(
        () =>
          validate(user, {
            name: [minLength(7, '名称不得小于7个字符')]
          }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '名称不得小于7个字符')
          equal(err.validator, 'minLength')
          equal(err.propertyPath, 'name')
          return true
        }
      )
      throws(
        () =>
          validate(user, {
            name: [minLength(1), maxLength(3, '不得多于3个字符')]
          }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '不得多于3个字符')
          equal(err.validator, 'maxLength')
          equal(err.propertyPath, 'name')
          return true
        }
      )
      throws(
        () =>
          validate(user, {
            name: [length({ min: 1, max: 3, message: '名称不必须在1-3个字符之间' })]
          }),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '名称不必须在1-3个字符之间')
          equal(err.validator, 'length')
          equal(err.propertyPath, 'name')
          return true
        }
      )
    })
  )
  it(
    '数组校验',
    runTestAsync(async () => {
      getI18n().setLang('zh')
      throws(
        () =>
          validate(
            { skills: ['java'] },
            {
              skills: [notNull(), minLength(3)]
            }
          ),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '长度不得小于 3')
          equal(err.validator, 'minLength'), equal(err.propertyPath, 'skills')
          return true
        }
      )
      throws(
        () =>
          validate(
            { skills: ['java', 'php', 'golang'] },
            {
              skills: [notNull(), maxLength(2)]
            }
          ),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '长度不得大于 2')
          equal(err.validator, 'maxLength'), equal(err.propertyPath, 'skills')
          return true
        }
      )
      throws(
        () =>
          validate(
            { skills: ['java', 'php', 'golang'] },
            {
              skills: [notNull(), length({ min: 4, max: 10 })]
            }
          ),
        err => {
          assert(err instanceof ValidationException)
          equal(err.errMsg, '长度不得小于 4')
          equal(err.validator, 'length'), equal(err.propertyPath, 'skills')
          return true
        }
      )
    })
  )
  it(
    '嵌套对象属性校验',
    runTestAsync(async () => {
      getI18n().setLang('zh')
      const obj = {
        group: 'g1',
        user: {
          id: '001',
          name: {
            firstname: '',
            surname: 'Franklin'
          }
        }
      }
      // 凡是有嵌套的，泛型必须明确指定，层级深了就无法根据对象的值来推断类型
      // 如果没有定义类型，可以像下面这样使用 typeof obj 来指定类型
      throws(
        () =>
          validate<typeof obj>(obj, {
            group: [notBlank()],
            user: [
              notNull(),
              plainObject({
                id: [notNull()],
                name: [
                  notNull(),
                  plainObject({
                    firstname: [notBlank()],
                    surname: [notBlank()]
                  })
                ]
              })
            ]
          }),
        e => {
          assert(e instanceof ValidationException)
          // name 校验错误
          equal('plainObject', e.validator)
          equal('user.name.firstname', e.propertyPath)
          equal('不能为空', e.errMsg)
          return true
        }
      )
      // 对象与数组相互嵌套
      interface Tag {
        id: string
        name: string
        permissinos: { edit?: boolean; read?: boolean }
      }
      interface User {
        profile: {
          theme: string
        }
        tags?: Tag[]
      }
      throws(
        () =>
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
                // 校验元素
                array([
                  // 元素不能为空
                  notNull(),
                  // 元素属性校验
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
          ),
        e => {
          assert(e instanceof ValidationException)
          // name 校验错误
          equal('array', e.validator)
          equal('tags[1].permissinos.read', e.propertyPath)
          equal('不能为空', e.errMsg)
          return true
        }
      )
      // 实际开发中，尽可能不要做层级很深的嵌套对象校验
    })
  )
})
