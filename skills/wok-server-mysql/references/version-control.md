# MySQL 版本管理

开启 `MYSQL_VERSION_CONTROL_ENABLED=true`，在 `db_migration/` 目录下创建 SQL 文件，文件名为纯数字：

```
db_migration/
  1.sql        # 版本号从 1 开始，必须连续递增
  2.sql
  3.sql
```

文件名必须是纯数字 + `.sql` 后缀（如 `1.sql`、`2.sql`），非数字前缀会导致 `parseInt` 失败而抛异常。编号必须从 1 开始连续递增，不连续也会抛异常。

启动时自动在事务中检测当前版本，顺序执行未执行的 SQL 并更新版本号。

版本信息存储在 `db_version` 表（单行 `key='db_version'`，`version` 列）。

> **⚠️ 注意事项：开销非常高的 SQL 不能放在版本管理中执行。** 比如在大表上创建/修改索引这类操作，执行耗时长且会锁表，可能阻塞线上服务。此类操作应单独在线上手动执行，不要放入迁移文件。

## 实现细节

使用独立的 `multipleStatements` 连接在事务中执行：读取当前版本 → 筛选待执行版本 → 逐个执行 SQL 并更新 `db_version` → 提交。出错需手动在数据库中修复后重新启动。
