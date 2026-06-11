# MySQL

The MySQL component is built on top of [mysql2](https://www.npmjs.com/package/mysql2), providing convenient single-table operations with support for multiple data sources and version management.

Use the enableMysql function to enable MySQL. The configuration name parameter is optional, defaulting to MYSQL.

## Environment Variables

Below are all environment variable configurations using the default name MYSQL. If using multiple data sources, replace the MYSQL prefix with a custom name. See initialization section for details.

| Environment Variable              | Description                                                                 |
| :-------------------------------- | :-------------------------------------------------------------------------- |
| MYSQL_HOST                        | Hostname                                                                    |
| MYSQL_PORT                        | Port number                                                                 |
| MYSQL_USER                        | Username                                                                    |
| MYSQL_PASSWORD                    | Password                                                                    |
| MYSQL_CHARSET                     | Character set, default utf8mb4                                              |
| MYSQL_DATABASE                    | Database name                                                               |
| MYSQL_VERSION_CONTROL_ENABLED     | Enable version control                                                      |
| MYSQL_VERSION_CONTROL_DIR         | Version control directory, default db_migration                             |
| MYSQL_TIMEZONE                    | Timezone, default +08:00                                                   |
| MYSQL_CONNECT_TIMEOUT             | Connection timeout in milliseconds, default 10000                           |
| MYSQL_DEBUG                       | Debug mode. Set to true to output executed SQL                              |
| MYSQL_CONNECTION_LIMIT            | Maximum connections                                                         |
| MYSQL_MAX_IDLE                    | Maximum idle connections                                                    |
| MYSQL_IDLE_TIMEOUT                | Idle timeout in milliseconds (when a connection becomes idle)               |
| MYSQL_SLOW_SQL_WARN               | Slow SQL warning. When enabled, warning logs are output for slow queries    |
| MYSQL_SLOW_SQL_MS                 | Slow SQL threshold in milliseconds, default 200                             |
| MYSQL_TRANSACTION_TIMEOUT         | Transaction timeout in milliseconds, default 5000                           |
| MYSQL_TRANSACTION_STRICT          | Transaction strict mode, default true. Set to false to disable             |
| MYSQL_MAX_OPS_IN_STRICT_TX        | Maximum operations allowed in strict transaction, default 10                |

## Initialization

First use the enableMysql function to enable the MySQL component, then use related features.

```ts
await enableMysql()
```

The above call to enableMysql passes no parameters, using the default name "mysql" and searching for environment variables prefixed with `MYSQL_`.

If multiple databases need to be connected, call enableMysql multiple times with different names.

```ts
// Custom configuration name d2
await enableMysql('d2')
```

After executing the above, environment variables prefixed with `D2_` will be mapped automatically.

Here is an example of environment variables for multiple data sources:

```bash
# enableMysql() default, prefixed with MYSQL_
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=test
MYSQL_PASSWORD=abc123
MYSQL_DATABASE=test1
# enableMysql('d2') custom D2, prefixed with D2_
D2_HOST=localhost
D2_PORT=3306
D2_USER=test2
D2_PASSWORD=abcdefg
D2_DATABASE=test2
```

Use the getMysqlManager function to get a MysqlManager for entity operations. It takes one optional parameter, the name configured in the previous step.

```ts
// Default, name is mysql
const mysqlManager = getMysqlManager()
// Specify name d2, corresponds to enableMysql('d2')
const d2Manager = getMysqlManager('d2')
```

### Entity Configuration

Entity mapping configuration must be done before operations. Each entity class must have corresponding table information. Here is an example configuration for a user table:

```ts
/**
 * User, maps to user table. All field names must match column names. Custom field name mapping is not supported.
 */
export interface User {
  /**
   * id, maps to column id.
   */
  id: string
  nickname: string
  /**
   * Entry date, maps to column entry_date.
   */
  entry_date?: Date
  hobby?: string
  /**
   * Create and update times are managed automatically by the component,
   * so they are defined as optional in the type definition.
   * These fields don't need to be filled when calling component methods.
   */
  createAt?: Date
  updateAt?: Date
}

/**
 * User table configuration, used to automatically generate SQL statements.
 */
export const tableUser: Table<User> = {
  /**
   * Table name
   */
  tableName: 'user',
  /**
   * Primary key name. Only single-column primary keys are supported, composite keys are not.
   */
  id: 'id',
  /**
   * Column names, excluding automatically managed time columns and primary key.
   */
  columns: ['nickname', 'hobby'],
  /**
   * Creation time. If set, it will be managed automatically during component operations.
   */
  createdDate: {
    /**
     * Column name
     */
    column: 'createAt',
    /**
     * Type, supports date and number
     */
    type: 'date'
  },
  /**
   * Update time. If set, it will be managed automatically during component operations.
   */
  updatedDate: {
    column: 'updateAt',
    type: 'date'
  }
}
```

It is recommended that all table configurations start with "table" for better editor autocompletion. When table configuration is needed, just type "table" and the editor will show all table configurations.

Entity configuration is not bound to the database configuration initialized earlier, meaning one entity configuration can be used by multiple databases. In read-write separation scenarios, primary and read-only databases can share entities.

### Type Mapping

Entity field types and query method return object field types follow a type mapping rule that must be followed: **the database type must match the corresponding JavaScript native type**.

The type mapping logic cannot be modified. Here is the mapping table:

| JavaScript Type   | MySQL Field Type                                                          |
| :---------------- | :------------------------------------------------------------------------ |
| Boolean           | TINYINT                                                                   |
| Number            | TINYINT, SMALLINT, INT, MEDIUMINT, YEAR, FLOAT, DOUBLE, BIGINT           |
| Date              | TIMESTAMP, DATE, DATETIME                                                 |
| Buffer            | TINYBLOB, MEDIUMBLOB, LONGBLOB, BLOB, BINARY, VARBINARY, BIT             |
| String            | CHAR, VARCHAR, TINYTEXT, MEDIUMTEXT, LONGTEXT, TEXT, ENUM, SET, DECIMAL, TIME |
| Object or Array   | JSON                                                                      |

For nullable fields, define them as nullable in TypeScript:

```ts
export interface User {
  /**
   * Avatar file key in object storage, nullable
   */
  avatar_oss_key?: string
}
```

Enum types can also be mapped, but note that it's value mapping. For example:

```ts
enum Type {
  COURSE,
  EXAM
}
// Entity class
class Entity {
  type: Type
}
```

In the above enum, Type.COURSE maps to 0 and Type.EXAM maps to 1. If you need Type.COURSE to map to the string "COURSE", handle it like this:

```ts
enum Type {
  COURSE = 'COURSE',
  EXAM = 'EXAM'
}
```

For convenience, union types are generally recommended:

```ts
class Entity {
  type: 'course' | 'exam'
}
```

## CRUD Operations

Now you can perform CRUD operations through the MysqlManager instance. All methods take table information as the first parameter.

Below are some CRUD operation examples. For more method details, refer to the MysqlManager type definition. All methods and parameters have comments.

```ts
// Get MysqlManager instance
const manager = getMysqlManager()
// Query by id
const admin = await manager.findById(tableUser, 'admin001')
// Query multiple records by id list
const users = await manager.findByIdIn(tableUser, ['admin001', 't001', 't002'])
// Check if id exists
const res = await manager.existsById(tableUser, 'admin001')
// Delete record with id d0001
await manager.deleteById(tableUser, 'd0001')
// Query all records in table, dangerous operation, use with caution
const list = await manager.findAll(tableUser)
// Insert record
await manager.insert(tableUser, {
  id: 'in001',
  nickname: '小明',
  balance: 1
})
// Insert with expressions
await manager.insert(tableUser, {
  id: 'in002',
  nickname: '小红',
  balance: ['expr', '?? * ?', ['score', 2]],
  createAt: ['now']
})
// Batch insert
await manager.insertMany(tableUser, [
  { id: 'im001', nickname: '张飞', balance: 0 },
  { id: 'im002', nickname: '关羽', balance: 2 },
  { id: 'im003', nickname: '刘备', balance: 5 }
])
// Upsert single record, update on conflict
await manager.upsert(tableUser, { id: 'us001', nickname: '赵云', balance: 10 })
// Batch upsert
await manager.upsertMany(tableUser, [
  { id: 'us002', nickname: '马超', balance: 20 },
  { id: 'us003', nickname: '黄忠', balance: 30 }
])
// Upsert with custom updater (e.g., increment balance on conflict)
await manager.upsertWithUpdater(
  tableUser,
  { id: 'us001', nickname: '赵云', balance: 10 },
  { balance: ['inc', 5], nickname: '赵云-updated' }
)
// Query first matching record by condition
const user = await manager.findFirst(tableUser, c =>
  c.like('nickname', 'ff0%').gt('balance', 75).lt('balance', 77)
)
// Update record, full update
await manager.update(tableUser, { id: 'xxxxxxx', nickname: '王五', balance: 44 })
// Partial update, supports nulling and increment operations
await manager.partialUpdate(tableUser, { id: 'pu000', balance: ['inc', 22] })
// Batch update, partial update all matching records
await manager.updateMany(tableUser, c => c.like('nickname', 'um%').between('balance', 23, 24), {
  balance: ['inc', 2]
})
// Find all matching records
await manager.find({
  table: tableUser,
  criteria: c => c.between('balance', 700, 800).like('id', 'find%'),
  offset: 1,
  limit: 10,
  orderBy: [['balance', 'asc']]
})
// Custom order by expression: balance * 2 desc
await manager.find({
  table: tableUser,
  criteria: c => c.like('nickname', 'ff0%'),
  orderBy: [['expr', '?? * ?', ['balance', 2], 'desc']]
})
// Custom criteria expression: balance * 2 > 50
await manager.find({
  table: tableUser,
  criteria: c => c.like('id', 'critex%').expr('?? * ? > ?', ['balance', 2, 50]),
  orderBy: [['balance', 'asc']]
})
// Count matching records
const count = await manager.count(tableUser, c => c.like('id', 'c00%').like('nickname', '李%'))
// Paginated query
await manager.paginate({
  table: tableUser,
  criteria: c => c.like('id', 'pg0%'),
  pn: 2,
  pz: 5,
  orderBy: [
    ['balance', 'asc'],
    ['id', 'asc']
  ]
})
// Custom query, write SQL manually
interface QueryResult {
  author: string
  book: string
}
const list = await manager.query<QueryResult>(
  'select u.nickname as author,b.name as book ' +
    ' from ?? u left join ?? b on u.id=b.author_id ' +
    ' where b.id is not null',
  ['user', 'book']
)
// Custom modification, write SQL manually
await manager.modify(`update user set nickname='无名' where nickname='佚名'`)
```

### All Operation Methods

| Method          | Description                                                                 |
| :-------------- | :-------------------------------------------------------------------------- |
| findById        | Query by id                                                                 |
| findByIdIn      | Query multiple records by id list                                           |
| existsBy        | Check if records exist by condition                                         |
| existsById      | Check if id exists                                                          |
| deleteById      | Delete by id                                                                |
| deleteMany      | Delete by condition. Dangerous operation, recommend setting limit parameter |
| findAll         | Query all records in table. Dangerous operation, only for small tables      |
| findFirst       | Query first matching record                                                 |
| insert          | Insert record                                                               |
| insertMany      | Insert multiple records at once                                             |
| upsert          | Insert record, update on duplicate key                                      |
| upsertMany      | Batch upsert                                                                |
| upsertWithUpdater | Upsert single record with custom updater for conflicts                      |
| update          | Update record, requires complete information                                 |
| partialUpdate   | Partial update, only provide id and fields to update                        |
| updateOne       | Update only first matching record, only supports equality conditions        |
| updateMany      | Update all matching records. Dangerous operation, restrict conditions       |
| find            | Query all matching records. Dangerous operation, recommend limit parameter  |
| findSelect      | Conditional query with specified fields. Same as find but with select param |
| count           | Count matching records. Dangerous operation, use strict conditions          |
| paginate        | Paginated query. Dangerous operation, based on find and count               |
| paginateSelect  | Paginated query with specified fields, based on findSelect and count        |
| query           | Custom SQL query, returns record list, supports prepared statements         |
| modify          | Execute custom SQL, returns affected rows, supports prepared statements     |

### Insert Expressions

Starting from version 0.7.0, `insert`, `insertMany`, `upsert` and other insert methods accept `InsertValue` type,
allowing expressions in the VALUES clause:

```ts
await manager.insert(tableUser, {
  id: 'in001',
  nickname: '小明',
  // Set to NOW()
  createAt: ['now'],
  // Resolve conflict: set field to the array ['setNull'] (not the setNull operation)
  extra: ['set', ['setNull']],
  // Custom expression: balance = score * 2
  balance: ['expr', '?? * ?', ['score', 2]],
  // Expression without parameters
  balance2: ['expr', 'RAND() * 100']
})
```

### Order By Expressions

Starting from version 0.7.0, the `orderBy` parameter is upgraded to `OrderBy<T>` type, supporting custom
expression-based ordering in addition to regular column ordering. This type is backward-compatible.

```ts
await manager.find({
  table: tableUser,
  criteria: c => c.like('nickname', 'ob%'),
  // Regular column ordering (backward-compatible)
  orderBy: [['balance', 'asc']]
})

// Custom expression ordering: balance * 2 desc
// SQL: ORDER BY `balance` * 2 desc
await manager.find({
  table: tableUser,
  criteria: c => c.like('nickname', 'ob%'),
  orderBy: [['expr', '?? * ?', ['balance', 2], 'desc']]
})

// Order by name length: CHAR_LENGTH(name) desc
// SQL: ORDER BY CHAR_LENGTH(`name`) desc
await manager.find({
  table: tableBook,
  criteria: c => c.like('name', 'ob%'),
  orderBy: [['expr', 'CHAR_LENGTH(??)', ['name'], 'desc']]
})

// Mixed: regular column + expression
orderBy: [
  ['active', 'asc'],
  ['expr', '?? * ?', ['balance', 2], 'desc']
]
// SQL: ORDER BY `active` asc , `balance` * 2 desc
```

### Criteria Expressions

Starting from version 0.7.0, `MysqlCriteria` adds an `expr()` method for inserting custom SQL expressions
in the WHERE clause:

```ts
// balance * 2 > 50
// SQL: where ... and `balance` * 2 > 50
await manager.find({
  table: tableUser,
  criteria: c => c.like('id', 'critex%').expr('?? * ? > ?', ['balance', 2, 50])
})

// Full-text search
// SQL: where ... and MATCH(`title`, `content`) AGAINST (? IN BOOLEAN MODE)
await manager.find({
  table: tableBook,
  criteria: c => c.expr('MATCH(??, ??) AGAINST(? IN BOOLEAN MODE)', ['title', 'content', keyword])
})
```

### JSON Type

Version 0.2.0 adds limited support for JSON types. You can insert and query normally, and filtering conditions partially support MySQL's JSON-related functions.

Compared to storing JSON as strings and deserializing in the program, using JSON format is much more convenient and efficient for development. Here is a complete example.

Database table creation statement with JSON type field:

```sql
CREATE TABLE
  question (
    id VARCHAR(32) PRIMARY KEY,
    title VARCHAR(256) NOT NULL COMMENT '标题',
    options json NOT NULL COMMENT '选项列表，json 数组',
    question_setter json NOT NULL COMMENT '出题人信息，json 对象',
    create_at BIGINT UNSIGNED NOT NULL COMMENT '创建时间',
    update_at BIGINT UNSIGNED NOT NULL COMMENT '更新时间'
  ) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '试题';
```

Table mapping configuration. JSON type fields can be declared as custom types:

```ts
// Option
export interface QuesOption {
  title: string
  correct?: boolean
}
// Question setter
export interface QuestionSetter {
  id: string
  name: string
}
// Question
export interface Question {
  id: string
  title: string
  // Options
  options: QuesOption[]
  // Question setter
  question_setter: QuestionSetter
  create_at?: number
  update_at?: number
}

export const tableQuestion: Table<Question> = {
  tableName: 'question',
  id: 'id',
  columns: ['title', 'options', 'question_setter'],
  createdDate: {
    type: 'number',
    column: 'create_at'
  },
  updatedDate: {
    type: 'number',
    column: 'update_at'
  }
}
```

Common methods work the same way. JSON data is passed according to the field definition format:

```ts
await getMysqlManager().insert(tableQuestion, {
  id: '003',
  title: '下面哪个类型是 Mysql 不支持的',
  options: [
    { title: 'TINYINT' },
    { title: 'BOOLEAN', correct: true },
    { title: 'CHAR' },
    { title: 'TEXT' }
  ],
  question_setter: { id: 'x333', name: '小李老师' }
})
// Queried data is complete, no further processing needed. JSON fields are typed correctly
const q1 = await getMysqlManager().findById(tableQuestion, '003')
q1.question_setter.name // 小李老师
```

Query conditions support json_extract and json_length, which can be used wherever query conditions are supported. Instead of passing column names, pass a tuple:

```ts
await manager.findFirst(tableQuestion, c =>
  // Query records where question_setter.id = 'x333'
  c.eq(['json_extract', 'question_setter', '$.id'], 'x333')
)
await manager.findFirst(tableQuestion, c =>
  // Query records where options[0].title = '地球'
  c.eq(['json_extract', 'options', '$[0].title'], '地球')
)
await manager.find({
  table: tableQuestion,
  // Query records where options array has >= 5 elements
  criteria: c => c.gte(['json_length', 'options'], 5)
})
```

Both json_extract and json_length queries require passing a tuple. The first parameter is the query type, the second is the field name, and json_extract has a third parameter for the property path. The property path format is the same as JavaScript property access syntax, using $ to refer to the field's value.

```ts
// Batch update records where question_setter.id = 'x333'
await manager.updateMany({
  table: tableQuestion,
  query: c => c.eq(['json_extract', 'question_setter', '$.id'], 'x333'),
  updater: {
    // Update question_setter info
    question_setter: { id: 'x333', name: '李帅' }
  }
})
```

Updates do not currently support json_set and other functions. You cannot update only part of a JSON field; you must update the entire field. This type of operation is rarely used and may be considered in future versions.

### Special Modification Operations

The partialUpdate and updateMany methods support partial field modifications and special operations like increment and nulling.

```ts
await manager.updateMany(tableUser, c => c.between('balance', 23, 24), {
  // Increase balance by 2
  balance: ['inc', 2],
  // Increase visits by 1 (default increment)
  visits: ['inc'],
  // Set consume_type to null
  consume_type: ['setNull'],
  // Set to NOW()
  last_login_at: ['now'],
  // NULL-safe string concatenation: col = CONCAT(IFNULL(col, ''), ?)
  nickname: ['concat', '-suffix'],
  // Custom expression: score = score * 2
  score: ['expr', '?? * ?', ['score', 2]]
})
```

> **Note**: `['func']` has been removed in 0.7.0. Use `['expr']` instead.
> E.g., `['func', 'NOW()']` → `['expr', 'NOW()']`.

**Starting from version 0.7.0**, `null` is treated the same as `undefined` and will be ignored during updates. **To set a field to NULL, you must use `['setNull']`**.

```ts
interface User {
  id: string
  role: string | null
}

// Correct: Use ['setNull'] to set field to NULL
await manager.partialUpdate(tableUser, {
  id: '001',
  role: ['setNull']
})

// Wrong: Starting from 0.7.0, null is ignored and won't update the field
await manager.partialUpdate(tableUser, {
  id: '001',
  role: null  // This operation will not take effect
})
```

The special array syntax is used for convenience, avoiding the need to introduce new types. **However, after introducing JSON types, if a JSON field is an array, it may conflict with special modification operations**. For example, setting a JSON field to `['setNull']` would be interpreted as a nulling operation.

```ts
// Record entity definition
interface Record {
  id: string
  // extra field is a JSON array
  extra: string[]
}
await manager.partialUpdate(tableRecord, {
  id: '001',
  // This would be interpreted as nulling extra
  extra: ['setNull']
})
```

The component provides a set operation to resolve conflicts. It's also a special array where the first element is 'set' and the second is the value to set:

```ts
await manager.partialUpdate(tableRecord, {
  id: '001',
  // This correctly sets extra to ['setNull']
  extra: ['set', ['setNull']]
})
```

### Prepared SQL

When using query or modify methods with custom SQL, prepared statements are supported. Use ? (question mark) for parameter values and ?? (double question mark) for table and column names.

```sql
update ?? set ?? = ? where ?? = ?
```

Parameters for the above prepared SQL:

```ts
const values = ['user', 'name', 'tom', 'id', '001']
```

Final compiled SQL:

```sql
update `user` set `name` = 'tom' where `id` = '001'
```

In actual development, table and column names don't necessarily need to be parameterized, as it may reduce code readability. However, for special or dynamic names, prepared statements are recommended for security compared to string concatenation.

## Version Control

As introduced in environment variables, MYSQL_VERSION_CONTROL_ENABLED enables version management, and MYSQL_VERSION_CONTROL_DIR sets the version directory. Currently, absolute paths or relative paths from the process working directory are supported.

In the version directory, all files follow the format "numeric version number.sql".

Example version directory file listing:

```
1.sql
2.sql
3.sql
```

Version numbers start from 1 and increment sequentially. **For program iterations, new versions must add new files, not modify existing ones.** The component does not have file validation to prevent modification of old files, nor does it support version comments. These need to be handled through project code version control.

**Note: Do not execute time-consuming SQL in version management. Each version's SQL should be as short as possible.** This is mainly because version management executes within a transaction. Too long execution times may cause transaction timeout and failure, and program startup time will be very long. For time-consuming operations like creating indexes on large tables, manual database operations are required and cannot be completed through version management.

## Transactions

Use the MysqlManager object's tx method to execute transaction operations. The method accepts a function parameter whose parameter is a session object. **All operations in the transaction must call session methods, which are the same as manager methods**.

```ts
mysqlManager.tx(
  async session => {
    // Update order and account balance in transaction
    // orderId Order ID
    // accountId Account ID
    // amount Order amount
    await session.partialUpdate(tableOrder, { id: orderId, status: 'finished' })
    await session.partialUpdate(tableAccount, { id: accountId, balance: ['inc', -amount] })
  },
  // Set isolation level and timeout, optional
  { isolationLevel: 'READ UNCOMMITTED', timeout: 1000 }
)
```

**Note: Don't forget to await asynchronous calls in transactions. They must complete before the transaction commits, otherwise the operations won't participate in the transaction.**

### Strict Mode

Transactions have strict mode enabled by default. Many operations are prohibited in strict mode. Set the environment variable MYSQL_TRANSACTION_STRICT (default variable name, use corresponding name for multiple instances) to false to disable it.

In strict mode, the following operations are prohibited in transactions:

1. Bulk insert insertMany
2. Bulk update updateMany
3. Bulk delete deleteMany
4. Bulk query and count find, count, paginate
5. findByIdIn with more than 100 parameters
6. Execute custom SQL with query and modify
7. Any operation called via session exceeding 10 times. The MYSQL_MAX_OPS_IN_STRICT_TX variable can modify this limit

Long transactions are risky. In production environments, strict transactions are recommended with the shortest possible timeout.