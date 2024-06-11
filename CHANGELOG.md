# 0.3.2

## Features

- 支持主动删除服务器端静态资源缓存

# 0.3.1

## Bug Fixes

修复 mvc 不能正确处理超时时间问题

# 0.3

## Performance Improvements

- 日志文件的写入改为无阻塞模式

## Features

- mvc 支持 createJsonHandler 函数支持设置缓存响应结果
- mvc 支持设置静态资源服务器端缓存
- mvc 支持 https ，可配置证书文件

## Bug Fixes

- mysql 局部更新，字段设置为 undefined 全被执行更新
- mysql 局部更新，将 json 字段设置为数组，字段不会被更新

# 0.2

## Features

- mysql 组件增加对 json 类型的有限支持。

## Bug Fixes

- 缓存方法 computeIfAbsent 一旦执行发生异常再获取就永远异常

# 0.1

## Features

完成框架的基本功能：

- 配置
- 日志
- 国际化
- 校验
- 缓存
- MVC
- mysql
- mongodb
- 周期任务