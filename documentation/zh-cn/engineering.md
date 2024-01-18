# 工程化

当程序的规模大起来以后，我们就需要进行拆分，更好的组织代码文件，
可以方便的管理大型项目。

以下是推荐的做法。

## 目录结构

推荐的划分方式是按功能来划分，而不是传统的按层（service 层，controller 层）来划分，
因为这样可以将相关性高的文件放在一起，查找更方便，也更利于封装。

假设有用户（user）和标签（tag）两个业务功能，下面是项目的大致结构。

```
根目录
  ├──db-migration 数据库迁移文件，使用 mysql 时才有
  ├──src 源码目录
  │   ├──auth 授权
  │   │   ├──auth.ts 授权信实体配置
  │   │   ├──auth-interceptor.ts 授权拦截器
  │   │   ├──create-auth.ts 创建授权接口（/auth/create）
  │   │   ├──ccu-task.ts 在线人数统计任务
  │   │   └──index.ts 包入口文件，导出需要导出的模块
  │   ├──user 用户业务功能目录
  │   │   ├──user.ts 用户实体配置
  │   │   ├──create-user.ts 创建用户接口（/user/create）
  │   │   ├──delete-user.ts 删除用户接口（/user/delete）
  │   │   ├──update-user.ts 更新用户接口（/user/update）
  │   │   └──index.ts 包入口文件，导出需要导出的模块
  │   ├──tag 标签业务功能目录
  │   │   ├──tag.ts  标签实体配置
  │   │   ├──create-tag.ts 创建标签接口（/tag/create）
  │   │   ├──delete-tag.ts 删除标签接口（/tag/delete）
  │   │   └──index.ts 包入口文件，导出需要导出的模块
  │   └──main.ts 入口文件，启动服务，配置路由
  ├──.env 开发环境变量配置
  ├──package.json
  ├──tsconfig.json
  └──.gitignore
```

## 文件说明

main.ts 示例：

```ts
import { createAuth, authInterceptor, ccuTask } from './auth'
import { createUser, updateUser, deleteUser } from './user'
import { createTag, deleteTag } from './tag'

async function main() {
  // 改写 date 原型，将日期序列化为数字
  // 可选，一般来说为了国际化才会这样处理
  Date.prototype.toJSON = function () {
    return this.getTime() as any
  }
  // 激活 mysql
  await enableMysql()
  // 启动服务
  await startWebServer({
    // 静态文件配置
    static: {
      // 前端文件
      '/': { dir: 'fe', cacheAge: 600 }
    },
    // 如果接口非常多，建议将这里的配置单独写文件
    // 或再进行拆分，放入单独的 router 目录中
    // 但是路由的配置必须集中起来，不能放在业务功能各自的目录下
    // 集中起来是为了方便查找
    routers: {
      '/auth/create': createAuth,
      '/user/create': createUser,
      '/user/update': updateUser,
      '/user/delete': deleteUser,
      '/tag/create': createTag,
      '/tag/delete': deleteTag
    },
    // 拦截器
    interceptors: [authInterceptor]
  })
  // 周期性任务
  // 每60秒统计一次在线人数
  scheduleWithFixedDelay(60, 60, ccuTask)
}

main().catch(console.error)
```

下面以用户功能为例，来说明实体的配置和接口的编写。

user/user.ts 文件示例：

```ts
import { Table } from 'wok-server'

/**
 * 用户
 */
export interface User {
  id: string
  /**
   * 编号.
   */
  code: string
  /**
   * 昵称
   */
  nickname: string
  /**
   * 密码
   */
  pwd: string
  /**
   * 状态.
   */
  status: 'ACTIVATED' | 'DISABLED'
  /**
   * 创建时间.
   */
  create_at?: Date
  /**
   * 更新时间.
   */
  update_at?: Date
}

/**
 * 用户表
 */
export const tableUser: Table<User> = {
  tableName: 'user',
  id: 'id',
  columns: ['code', 'nickname', 'pwd', 'status'],
  createdDate: {
    type: 'date',
    column: 'create_at'
  },
  updatedDate: {
    type: 'date',
    column: 'update_at'
  }
}
```

user.ts 这个文件中是实体类的类型申明和表的配置信息，这里的示例是 mysql 的，mongo 略有区别。

我们的建议是每个接口单独写一个文件，将接口相关的请求和响应信息都放入文件中，仅导出接口的请求处理函数。

user/create-user.ts 示例：

```ts
import { createJsonHandler, getMysqlManager, notBlank, length } from 'wok-server'
import { User, tableUser } from './user.ts'

/**
 * 请求发送的表单信息
 */
interface Form {
  /**
   * 编号.
   */
  code: string
  /**
   * 昵称
   */
  nickname: string
  /**
   * 密码
   */
  pwd: string
}
/**
 * 响应信息
 */
interface Resp {
  /**
   * 用户id
   */
  id: string
}

/**
 * 创建用户接口 /user/create
 */
export const createUser = createJsonHandler<Form, Resp>({
  // 校验
  validation: {
    code: [notBlank(), length({ max: 64 })],
    nickname: [notBlank(), length({ max: 64 })],
    pwd: [notBlank(), length({ max: 20 })]
  },
  // 业务处理
  async handle(body, exchange) {
    const manager = getMysqlManager()
    if (await manager.existsBy(tableUser, { code: body.code })) {
      // 错误信息的响应也可以自定义异常，然后通过拦截器来统一处理，这里仅仅是简单的示例
      exchage.respondErrMsg('编号已经存在')
      return
    }
    const newUser = await manager.insert(tableUser, body)
    return { id: newUser.id }
  }
})
```
