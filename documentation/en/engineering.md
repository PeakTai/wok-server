# Engineering Practices

As the program grows in size, we need to split and better organize code files to manage large projects conveniently.

The following are recommended practices.

## Directory Structure

The recommended approach is to organize by feature rather than by traditional layers (service layer, controller layer). This keeps highly related files together, making them easier to find and better for encapsulation.

Suppose there are two business functions: user and tag. Here is the project structure:

```
Root Directory
  ├── db-migration  Database migration files, only needed when using MySQL
  ├── src Source directory
  │   ├── auth Authorization
  │   │   ├── auth.ts Authorization entity configuration
  │   │   ├── auth-interceptor.ts Authorization interceptor
  │   │   ├── create-auth.ts Create authorization endpoint (/auth/create)
  │   │   ├── ccu-task.ts Online user count task
  │   │   └── index.ts Package entry file, exports needed modules
  │   ├── user User business function directory
  │   │   ├── user.ts User entity configuration
  │   │   ├── create-user.ts Create user endpoint (/user/create)
  │   │   ├── delete-user.ts Delete user endpoint (/user/delete)
  │   │   ├── update-user.ts Update user endpoint (/user/update)
  │   │   └── index.ts Package entry file, exports needed modules
  │   ├── tag Tag business function directory
  │   │   ├── tag.ts Tag entity configuration
  │   │   ├── create-tag.ts Create tag endpoint (/tag/create)
  │   │   ├── delete-tag.ts Delete tag endpoint (/tag/delete)
  │   │   └── index.ts Package entry file, exports needed modules
  │   ├── exception.ts Global exceptions
  │   └── main.ts Entry file, starts server, configures routes
  ├── .env Development environment variable configuration
  ├── package.json
  ├── tsconfig.json
  └── .gitignore
```

## File Description

The exception.ts file contains custom business exceptions and exception handling interceptors.

```ts
/**
 * Custom business exception.
 */
export class BusinessException {
  constructor(
    /**
     * Message.
     */
    readonly message: string,
    /**
     * Custom status code, default 400
     */
    readonly status?: number
  ) {}
}

/**
 * Global exception interceptor that handles specific exceptions and provides appropriate response messages.
 * @param exchange
 * @param next
 */
export async function globalErrorInterceptor(
  exchange: ServerExchange,
  next: () => Promise<void>
): Promise<void> {
  try {
    await next()
  } catch (e) {
    // Handle custom business exceptions
    if (e instanceof BusinessException) {
      const status = typeof e.status === 'number' ? e.status : 400
      const message = e.message || ''
      exchange.respondErrMsg(message, status)
      return
    }
    // Handle validation exceptions
    if (e instanceof ValidationException) {
      exchange.respondErrMsg(`${e.propertyPath}: ${e.errMsg}`, 400)
      return
    }
    // Other exceptions are thrown directly, framework responds with 500 status code by default
    throw e
  }
}
```

Using custom business exceptions to abort request processing when business logic cannot proceed. Transactions will also rollback when exceptions occur during processing. This is the recommended approach.

main.ts example:

```ts
import { createAuth, authInterceptor, ccuTask } from './auth'
import { createUser, updateUser, deleteUser } from './user'
import { createTag, deleteTag } from './tag'
import { globalErrorInterceptor } from './exception'

async function main() {
  // Override Date prototype to serialize dates as numbers
  // Optional, typically done for internationalization
  Date.prototype.toJSON = function () {
    return this.getTime() as any
  }
  // Activate MySQL
  await enableMysql()
  // Start server
  await startWebServer({
    // Static file configuration
    static: {
      // Frontend files
      '/': { dir: 'fe', cacheAge: 600 }
    },
    // If there are many endpoints, it's recommended to write this configuration separately
    // or split further into a separate router directory
    // However, route configuration must be centralized and cannot be placed in individual business function directories
    // Centralization makes it easier to find
    routers: {
      '/auth/create': createAuth,
      '/user/create': createUser,
      '/user/update': updateUser,
      '/user/delete': deleteUser,
      '/tag/create': createTag,
      '/tag/delete': deleteTag
    },
    // Interceptors
    interceptors: [globalErrorInterceptor, authInterceptor]
  })
  // Periodic task
  // Count online users every 60 seconds
  scheduleWithFixedDelay(60, 60, ccuTask)
}

main().catch(console.error)
```

Taking the user function as an example, let's explain entity configuration and endpoint writing.

user/user.ts file example:

```ts
import { Table } from 'wok-server'

/**
 * User
 */
export interface User {
  id: string
  /**
   * Code.
   */
  code: string
  /**
   * Nickname
   */
  nickname: string
  /**
   * Password
   */
  pwd: string
  /**
   * Status.
   */
  status: 'ACTIVATED' | 'DISABLED'
  /**
   * Create time.
   */
  create_at?: Date
  /**
   * Update time.
   */
  update_at?: Date
}

/**
 * User table
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

The user.ts file contains the entity type declaration and table configuration information. The example above is for MySQL; MongoDB is slightly different.

Our recommendation is to write each endpoint in a separate file, putting all request and response information related to the endpoint in the file, and only exporting the endpoint handler function.

user/create-user.ts example:

```ts
import { createJsonHandler, getMysqlManager, notBlank, length } from 'wok-server'
import { User, tableUser } from './user'

/**
 * Request form information
 */
interface Form {
  /**
   * Code.
   */
  code: string
  /**
   * Nickname
   */
  nickname: string
  /**
   * Password
   */
  pwd: string
}
/**
 * Response information
 */
interface Resp {
  /**
   * User id
   */
  id: string
}

/**
 * Create user endpoint /user/create
 */
export const createUser = createJsonHandler<Form, Resp>({
  // Validation
  validation: {
    code: [notBlank(), length({ max: 64 })],
    nickname: [notBlank(), length({ max: 64 })],
    pwd: [notBlank(), length({ max: 20 })]
  },
  // Business handling
  async handle(body, exchange) {
    const manager = getMysqlManager()
    if (await manager.existsBy(tableUser, { code: body.code })) {
      // Throw exception to abort processing
      // Exception will be handled by interceptor and responded
      throw new BusinessException('Code already exists')
    }
    const newUser = await manager.insert(tableUser, body)
    return { id: newUser.id }
  }
})
```