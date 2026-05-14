# Logging

Logging is used to record information, supporting simple level control and file writing functionality.

## Environment Variables

| Environment Variable   | Default | Description                                                                 |
| :--------------------- | :------ | :-------------------------------------------------------------------------- |
| LOG_LEVEL              | info    | Log level. Logs below the set level will not be output. Values: DEBUG, INFO, WARN, ERROR |
| LOG_FILE               | false   | true or false, indicating whether to enable file logging                     |
| LOG_FILE_MAX_DAYS      | 30      | Number of days to keep log files                                            |
| LOG_FILE_DIR           | logs    | Log file storage path, supports relative and absolute paths. Relative paths are relative to the process execution directory |
| LOG_CONSOLE            | true    | Whether to output logs to console, added in version 0.5                     |
| LOG_FORMAT             | text    | Output log format, can be set to json or text, added in version 0.5. Note: console always outputs text |

## Usage

Get the logger object through getLogger() function, then call its methods to output logs.

```ts
const logger = getLogger()

logger.info('Normal log message')

const err = new Error('Error message test')
logger.error('Error log output', err)

if (logger.isDebugEnabled()) {
  logger.debug(`Debug log output, args: ${JSON.stringify(args)}`)
}
```

## Check if a Log Level is Supported

The logger object provides isDebugEnabled, isInfoEnabled, isWarnEnabled, and isErrorEnabled methods to check if a log level is supported.

```ts
if (logger.isDebugEnabled()) {
  logger.debug('Debug log output')
}
```

These methods determine whether the current level is supported before processing. If not supported, the log content is not built. In some cases, this avoids unnecessary overhead of building log messages.

## Add Prefix to Logs

Starting from version 0.5, the getLogger function supports adding a prefix. For example:

```ts
const logger = getLogger('my-module')
```

This adds the prefix `[my-module]` to output logs, making it easier to distinguish logs from different modules.

For example, the default log without prefix is:

```
[2024/08/19 16:27:18.214][INFO]Mysql migration
```

With prefix added:

```
[2024/08/19 16:27:18.214][INFO][my-module]Mysql migration
```

## Custom Log Storage

The setLogStore function allows customizing log storage. Once set, it overrides file storage. Even if file logging is enabled, logs will not be output to files.

Starting from version 0.5, logs are structured. The storage function parameters are log objects and configuration information, rather than a string.

```ts
setLogStore((log: Log, config: LogConfig) => {
  // log type is Log
  // config type is LogConfig
  // You can store log content in message queues or independent file storage systems as needed
  messageQueue.push(log)
})
```

Log definition:

```ts
export interface Log {
  /**
   * Log time
   */
  time: Date
  /**
   * Log level
   */
  level: LogLevel
  /**
   * Log content
   */
  content: string
  /**
   * Error information
   */
  error?: any
  /**
   * Prefix information
   */
  prefix?: string
}
```

LogConfig type contains the environment variable configuration information mentioned earlier, used to determine how to handle logs.