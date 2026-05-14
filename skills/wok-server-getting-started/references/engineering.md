# 工程化实践

当程序规模变大后，需要对代码文件进行合理组织。

## 目录结构

推荐按功能划分目录，而非传统的按层（service 层、controller 层）划分，这样相关性高的文件放在一起，查找更方便，也更利于封装。

假设有用户（user）和标签（tag）两个业务功能，项目大致结构如下：

```
根目录
  ├── db_migration/          # MySQL 数据库迁移文件
  ├── src/
  │   ├── auth/              # 授权业务
  │   │   ├── auth.ts               # 实体配置
  │   │   ├── auth-interceptor.ts   # 授权拦截器
  │   │   ├── create-auth.ts        # 创建授权接口
  │   │   ├── ccu-task.ts           # 在线人数统计任务
  │   │   └── index.ts              # 包入口，导出模块
  │   ├── user/              # 用户业务
  │   │   ├── user.ts               # 实体配置
  │   │   ├── create-user.ts        # 创建用户接口
  │   │   ├── delete-user.ts        # 删除用户接口
  │   │   ├── update-user.ts        # 更新用户接口
  │   │   └── index.ts
  │   ├── tag/               # 标签业务
  │   │   ├── tag.ts                # 实体配置
  │   │   ├── create-tag.ts         # 创建标签接口
  │   │   ├── delete-tag.ts         # 删除标签接口
  │   │   └── index.ts
  │   ├── exception.ts       # 全局异常与异常拦截器
  │   ├── router.ts          # 全局路由配置，规模较大的项目，需要将路由配置单独放到一个文件中，或者创建一个单独的目录
  │   └── main.ts            # 入口文件，启动服务，配置路由
  ├── .env                    # 开发环境变量配置
  ├── package.json
  └── tsconfig.json
```

## 核心原则

1. **按功能划分目录**，相关性高的文件放在一起
2. **每个接口单独一个文件**，仅导出处理函数
3. **路由配置集中管理**，不可分散到各业务目录
4. **通过异常中断处理流程**，由拦截器统一响应

## 异常处理

定义业务异常，在流程无法继续时抛出，由拦截器统一处理：

```ts
export class BusinessException {
  constructor(
    readonly message: string,
    readonly status?: number
  ) {}
}

export async function globalErrorInterceptor(
  exchange: ServerExchange,
  next: () => Promise<void>
): Promise<void> {
  try {
    await next()
  } catch (e) {
    if (e instanceof BusinessException) {
      exchange.respondErrMsg(e.message, e.status ?? 400)
      return
    }
    if (e instanceof ValidationException) {
      exchange.respondErrMsg(`${e.propertyPath}：${e.errMsg}`, 400)
      return
    }
    throw e  // 框架默认响应 500
  }
}
```

## 入口文件示例

```ts
import { enableMysql, startWebServer, scheduleWithFixedDelay } from 'wok-server'
import { createAuth, authInterceptor, ccuTask } from './auth'
import { createUser, updateUser, deleteUser } from './user'
import { createTag, deleteTag } from './tag'
import { globalErrorInterceptor } from './exception'

async function main() {
  Date.prototype.toJSON = function () {
    return this.getTime() as any
  }

  await enableMysql()

  await startWebServer({
    routers: {
      '/auth/create': createAuth,
      '/user/create': createUser,
      '/user/update': updateUser,
      '/user/delete': deleteUser,
      '/tag/create': createTag,
      '/tag/delete': deleteTag
    },
    interceptors: [globalErrorInterceptor, authInterceptor]
  })

  scheduleWithFixedDelay(60, 60, ccuTask)
}

main().catch(console.error)
```

## 实体与接口示例

`user/user.ts` — 实体类型与表配置：

```ts
import { Table } from 'wok-server'

export interface User {
  id: string
  code: string
  nickname: string
  pwd: string
  status: 'ACTIVATED' | 'DISABLED'
  create_at?: Date
  update_at?: Date
}

export const tableUser: Table<User> = {
  tableName: 'user',
  id: 'id',
  columns: ['code', 'nickname', 'pwd', 'status'],
  createdDate: { type: 'date', column: 'create_at' },
  updatedDate: { type: 'date', column: 'update_at' }
}
```

`user/create-user.ts` — 接口处理：

```ts
import { createJsonHandler, getMysqlManager, notBlank, length } from 'wok-server'
import { tableUser } from './user'

interface Form {
  code: string
  nickname: string
  pwd: string
}
interface Resp {
  id: string
}

export const createUser = createJsonHandler<Form, Resp>({
  validation: {
    code: [notBlank(), length({ max: 64 })],
    nickname: [notBlank(), length({ max: 64 })],
    pwd: [notBlank(), length({ max: 20 })]
  },
  async handle(body) {
    const manager = getMysqlManager()
    if (await manager.existsBy(tableUser, { code: body.code })) {
      throw new BusinessException('编号已存在')
    }
    const newUser = await manager.insert(tableUser, body)
    return { id: newUser.id }
  }
})
```
