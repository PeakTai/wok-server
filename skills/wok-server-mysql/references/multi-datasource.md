# MySQL 多数据源

## 启用多数据源

```ts
await enableMysql()          // 默认，以 MYSQL_ 为前缀
await enableMysql('d2')      // 自定义，以 D2_ 为前缀

const mgr1 = getMysqlManager()      // 默认
const mgr2 = getMysqlManager('d2')  // d2
```

名称必须以英文字母开头，由字母数字下划线组成，不超过 32 位。环境变量前缀自动转换为大写。

环境变量配置示例：

```bash
# 默认 enableMysql()，前缀 MYSQL_
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=test
MYSQL_PASSWORD=abc123
MYSQL_DATABASE=test1

# enableMysql('d2')，前缀 D2_
D2_HOST=localhost
D2_PORT=3306
D2_USER=test2
D2_PASSWORD=abcdefg
D2_DATABASE=test2
```

---

## 技巧：读写分离

实体类的表配置（`Table<T>`）与数据库实例没有强制绑定关系，同一套表配置可以给多个 `MysqlManager` 使用。利用这个特性和多数据源，可以实现读写分离。

```ts
import { enableMysql, getMysqlManager } from 'wok-server'
import { tableUser } from './user'

// 主库（读写）
await enableMysql('master')
// 只读库
await enableMysql('slave')

const masterMgr = getMysqlManager('master')
const slaveMgr = getMysqlManager('slave')

// 写操作使用主库
const newUser = await masterMgr.insert(tableUser, { id: '001', nickname: 'jack' })

// 读操作使用只读库
const user = await slaveMgr.findById(tableUser, '001')
```

环境变量分别配置两个源：

```bash
# 主库
MASTER_HOST=master-db.example.com
MASTER_PORT=3306
MASTER_USER=writer
MASTER_PASSWORD=xxx
MASTER_DATABASE=mydb

# 只读库
SLAVE_HOST=slave-db.example.com
SLAVE_PORT=3306
SLAVE_USER=reader
SLAVE_PASSWORD=xxx
SLAVE_DATABASE=mydb
```

在 `main.ts` 入口中分别初始化后，将两个 manager 导出，业务模块按读写需求选择使用即可。
