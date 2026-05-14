# MongoDB

The MongoDB component is built on top of the [official MongoDB driver](https://www.npmjs.com/package/mongodb), providing simple entity mapping and CRUD operations for ease of use.

## Environment Variables

The MongoDB component supports multiple instances. By default, it uses MONGO as the prefix.

| Variable Name               | Description                                                                 |
| :-------------------------- | :-------------------------------------------------------------------------- |
| MONGO_URI                   | MongoDB connection string. Example: mongodb+srv://<user>:<password>@<cluster-url> |
| MONGO_MAX_POOL_SIZE         | Maximum connection pool size, default 10                                    |
| MONGO_MIN_POOL_SIZE         | Minimum connection pool size, default 1                                     |
| MONGO_MAX_CONNECTING        | Maximum concurrent connections in pool, default 10                          |
| MONGO_MAX_IDLE_TIME_MS      | Maximum idle time for connections in milliseconds, default 60000            |
| MONGO_WAIT_QUEUE_TIMEOUT_MS | Maximum wait time for connections in milliseconds, default 60000            |
| MONGO_SLOW_QUERY_WARN       | Slow query warning. When enabled, warning logs are output for slow queries. Default enabled |
| MONGO_SLOW_QUERY_MS         | Slow query threshold in milliseconds, default 200                           |
| MONGO_TRANSACTION_TIMEOUT   | Transaction timeout in milliseconds, default 5000                           |
| MONGO_TRANSACTION_STRICT    | Transaction strict mode, default true. Set to false to disable             |

## Usage

### Initialization

First use the enableMongoDB function to enable MongoDB, then use related features.

```ts
await enableMongoDB()
```

The component supports multiple instances. If multiple databases need to be connected, you can specify a new name.

```ts
// Enable implementation with name md2
await enableMongoDB('md2')
```

By default, environment variables use MONGO as the prefix. For named instances, the uppercase name is used as the prefix. In the example above, the instance named md2 uses the MD2 prefix.

```
# Configure default connection
MONGO_URI=mongodb://test1:t1abcd@localhost/t1
MONGO_MAXPOOLSIZE=10
# Configure connection for md2 instance
MD2_URI=mongodb://test2:t2abcd@localhost/t2
MD2_MAXPOOLSIZE=10
```

Use the getMongoDBManager function to get a manager instance for operating MongoDB, with optional name parameter to get the corresponding instance.

```ts
// Default instance
const manager = getMongoDBManager()
// md2 instance
const md2 = getMongoDBManager('md2')
```

### Entity Mapping

Basic CRUD operations can be performed through the manager object's methods, but configuration is required before operation.

Configuration consists of two parts: collection data format definition and collection information settings. Here is an example:

```ts
/**
 * User collection data definition.
 * Primary key name is fixed as _id, mapping configuration not supported. Entity class should not have _id field.
 */
export interface User {
  nickname: string
  skills: string[]
  // Create and update fields can be set to be automatically managed by the component
  // Due to type constraints, set as optional for insertion and update without filling
  createAt?: Date
  updateAt?: Date
}
/**
 * User collection information. Type is MongoCollection with generic type as entity type.
 * Primary key name is fixed as _id, mapping configuration not supported.
 */
export const collUser: MongoCollection<User> = {
  /**
   * Collection name
   */
  collectionName: 'user',
  /**
   * Configure creation time field, automatically managed by component
   */
  createdDate: {
    type: 'date',
    field: 'createAt'
  },
  /**
   * Configure update time field, automatically managed by component
   */
  updatedDate: {
    type: 'date',
    field: 'updateAt'
  }
}
```

### CRUD Operations

Now you can perform CRUD operations. All manager operations take the collection information as the first parameter, which is the collUser configured earlier.

```ts
const manager = getMongoDBManager()
// Insert record. If _id has no value, database generates ObjectId as primary key
await manager.insert(collUser, { _id: '007', nickname: 'Spark', skills: [] })
// Find by id
const user1 = await manager.findById(collUser, '007')
// Update nickname
user1.nickname = 'ryan'
await manager.update(collUser, user1)
// Check if id exists
const exist = await manager.existsById(collUser, 'xyz')
// Check if record exists by condition
const exist2 = await manager.existsBy(collUser, { nickname: 'acute' })
// Delete by id
await manager.deleteById(collUser, '007')
// Delete by condition. Use with caution, deleting large amounts of data at once may cause high database load and online incidents
await manager.deleteMany(collUser, { nickname: 'smith' })
// Find first matching record
const jack = await manager.findFirst(collUser, { nickname: 'jack' })
// Find all records. Use with caution, querying large amounts of data at once may cause memory issues and take a long time to transfer
await manager.findAll(collUser)
// Count. Use with caution, count operation may have performance issues even with indexes for large data sets
const count = await manager.count(collUser, { nickname: 'Steve' })
// Find users with skills, return at most 2 results
const list = await manager.find(
  collUser,
  {
    skills: { $exists: true }
  },
  { offset: 0, limit: 2 }
)
// Pagination, sort by id, 20 items per page, query page 2
const page = await manager.paginate(
  collUser,
  {
    skills: { $exists: true }
  },
  { pn: 2, pz: 20, orderBy: ['_id', 'asc'] }
)
```

### Update Methods Description

The manager provides four update methods: update, partialUpdate, updateMany, updateOne.

| Method Name    | Description                                                                 |
| :------------- | :-------------------------------------------------------------------------- |
| update         | Full document update, requires complete document information, returns updated document, throws exception on failure |
| partialUpdate  | Partial update, only needs id and fields to update, returns whether update succeeded |
| updateMany     | Update all matching records, returns number of updated documents             |
| updateOne      | Update only one matching record, only supports equality conditions, does not support range conditions |

```ts
// update requires complete document, usually need to query first
const user = await manager.findById(collUser, '007')
user.nickname = 'ryan'
await manager.update(collUser, user)
// partialUpdate does not require querying first
// Update nickname of document with id 001 to lily
await manager.partialUpdate(collUser, '001', { $set: { nickname: 'lily' } })
// updateMany differs from partialUpdate only in that id parameter becomes condition
// Increment credit by 1 for all users with credit <= 10
await manager.updateMany(collUser, { credit: { $lte: 10 } }, { $inc: { credit: 1 } })
```

## Version Management

The enableMongoDB function supports a migration parameter for version management and automatic migration.

```ts
await enableMongoDB({
  migration: {
    versionList: versionList
  }
})
```

versionList is an array of MongoMigrationVersion (`(db: Db) => Promise<void>`) type elements. Db is the database provided by the MongoDB driver, which can perform various operations such as creating collections and indexes.

The version number is the index of the element, meaning each program update should add elements. Existing elements cannot be modified, and the program does not perform any validation. During startup, the program checks the already updated version number (index of version list), then finds subsequent versions from the version list, updates them one by one, and marks the completed version numbers.

Here is an example of the versionList parameter:

```ts
const versionList: MongoMigrationVersion[] = [
  // Version 1
  async db => {
    // Create a collection, insert some data, then create indexes
    await db.createCollection('user')
    await db
      .collection<User>('user')
      .createIndex({ nickname: 1 }, { unique: true, name: 'uk_nickname' })
    await db
      .collection<User>('user')
      .createIndex({ skills: 1 }, { unique: false, name: 'idx_skills' })
    // Preset data
    await db.collection<User>('user').insertOne({
      nickname: 'jack',
      skills: ['java'],
      createAt: new Date(),
      updateAt: new Date()
    })
  },
  // Version 2
  async db => {
    // Delete an index
    await db.collection<User>('user').dropIndex('idx_skills')
    // Preset data
    await db.collection<User>('user').insertOne({
      nickname: 'tom',
      skills: ['golang', 'rust'],
      createAt: new Date(),
      updateAt: new Date()
    })
  }
]
```

## Transactions

Use the manager object's tx method to execute transaction operations. The method accepts a function parameter whose parameter is a session object. **All operations in the transaction must call session methods, which are the same as manager methods**.

```ts
await manager.tx(
  async session => {
    // Update order and account balance in transaction
    // orderId Order ID
    // accountId Account ID
    // amount Order amount
    await session.partialUpdate(collOrder, orderId, { $set: { status: 'finished' } })
    await session.partialUpdate(collAccount, accountId, { $inc: { balance: -amount } })
  },
  // Additional options, can set timeout per transaction
  { timeout: 1000 }
)
```

### Strict Mode

Transactions have strict mode enabled by default. Many operations are prohibited in strict mode. Set the environment variable MONGO_TRANSACTION_STRICT (default variable name, use corresponding name for multiple instances) to false to disable it.

In strict mode, the following operations are prohibited in transactions:

1. Bulk insert insertMany
2. Bulk update updateMany
3. Bulk delete deleteMany
4. Bulk query and count find, count, paginate
5. findByIdIn with more than 100 parameters
6. Any operation called via session exceeding 10 times