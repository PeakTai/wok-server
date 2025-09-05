import { after } from 'mocha'

// 测试用的环境变量设置

// 日志
process.env.LOG_LEVEL = 'info'
process.env.LOG_FILE = 'true'
process.env.LOG_FILE_MAX_DAYS = '10'
process.env.LOG_FILE_DIR = 'logs'
process.env.LOG_CONSOLE = 'true'
process.env.LOG_FORMAT = 'text'

// mvc
process.env.SERVER_PORT = '8080'
process.env.SERVER_TIMEOUT = '5000'
process.env.SERVER_ACCESS_LOG = 'true'
process.env.SERVER_CORS_ALLOW_ORIGIN = '*'
process.env.SERVER_CORS_ALLOW_HEADERS = '*'
process.env.SERVER_CORS_ALLOW_METHODS = '*'
// mongod 的配置变量设置
process.env.MONGO_URI = 'mongodb://test:abc123@127.0.0.1/test?replicaSet=rs0'
process.env.MONGO_MAX_POOL_SIZE = '1'
process.env.MONGO_MIN_POOL_SIZE = '1'
process.env.MONGO_MAX_CONNECTING = '1'
process.env.MONGO_SLOW_QUERY_WARN = '1'
process.env.MONGO_SLOW_QUERY_MS = '1'
process.env.MONGO_TRANSACTION_TIMEOUT = '2000'
process.env.MONGO_TRANSACTION_STRICT = 'true'
process.env.MONGO_SLOW_QUERY_WARN = 'true'
process.env.MONGO_SLOW_QUERY_MS = '1'
// mysql
process.env.MYSQL_HOST = 'localhost'
process.env.MYSQL_PORT = '3306'
process.env.MYSQL_USER = 'root'
process.env.MYSQL_PASSWORD = 'abc123'
process.env.MYSQL_DATABASE = 'test'
process.env.MYSQL_VERSION_CONTROL_ENABLED = 'true'
process.env.MYSQL_VERSION_CONTROL_DIR = 'test/db_migration'
process.env.MYSQL_DEBUG = 'false'
process.env.MYSQL_CONNECTION_LIMIT = '1'
process.env.MYSQL_MAX_IDLE = '1'
process.env.MYSQL_IDLE_TIMEOUT = '60000'
process.env.MYSQL_SLOW_SQL_WARN = 'true'
process.env.MYSQL_MAX_OPS_IN_STRICT_TX = '10'
// 将慢日志时间设置到很短，用于验证功能和测试时观察 sql
process.env.MYSQL_SLOW_SQL_MS = '1'
process.env.MYSQL_TRANSACTION_TIMEOUT = '2000'
process.env.MYSQL_TRANSACTION_STRICT = 'true'
// cache
process.env.CACHE_DEFAULT_EXPIRE_IN_SECONDS = '5'
process.env.CACHE_STAT_TASK_ENABLED = 'true'
process.env.CACHE_STAT_INTERVAL = '8'
process.env.CACHE_MAX_ELEMENTS = '100'
process.env.CACHE_CLEANING_INTERVAL = '5'

after(() => {
  console.log('测试已经结束！')
  // 测试完成后主动退出进程，否则的话由于有周期性任务，程序不会退出
  process.exit(0)
})
