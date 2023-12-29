import { createJsonHandler, length, max, min, notBlank, notNull } from '../../src'

/**
 * 表单定义
 */
interface Form {
  nickname: string
  age?: number
  skills: string[]
}
/**
 * 响应JSON信息定义
 */
interface Res extends Form {
  id: string
}

export const jsonHandler = createJsonHandler<Form, Res>({
  validation: {
    nickname: [
      notBlank('昵称不能为空'),
      length({ min: 2, max: 16, message: '昵称必须在2-16个字符之间' })
    ],
    age: [min(25), max(38, '年龄不得超过38')],
    skills: [notNull(), length({ min: 1, max: 5 })]
  },
  async handle(body, exchange) {
    // 模拟一个异常
    if (body.nickname === 'Satan') {
      throw new Error('名字不可以叫 Satan')
    }
    const id = '001'
    return {
      ...body,
      id
    }
  }
})
