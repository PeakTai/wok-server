# 配置

配置模块的主要作用是将配置对象与环境变量映射，提供给其它的模块来使用，
可以和校验组件相结合用于扩展新功能。

提供了两个函数：

| 函数           | 功能说明                                                         |
| :------------- | :--------------------------------------------------------------- |
| registerConfig | 注册配置信息，注册会立即匹配环境变量并返回映射了属性后的配置对象 |
| getConfig      | 获取配置信息                                                     |
| registerConfig | 根据环境变量生成配置信息，但是不注册                             |

## 配置类型和实例对象

要进行配置映射，首先要定义一个配置类型，下面是一个例子：

```ts
/**
 * 配置定义
 */
interface CustomConfig {
  appId: string
  appSecret: string
}
```

**配置类型的所有属性都不能是可空的，必须有值，这样才可以映射。**
当然也可以不定义类型，直接申明一个对象，调用 registerConfig 也可以完成类型的自动推断，见后面 registerConfig 的说明。

配置对象的目前仅支持下列类型：string、number、boolean。

## registerConfig

环境变量的映射需要有一个前缀，然后将对象的属性拼接前缀，再进行转换，去匹配环境变量。
比如配置对象有个属性是 appId，设置的前缀是 cus ，那么匹配的环境变量就是 CUS_APP_ID。
每次调用 registerConfig 函数会有日志输出，可以查看到匹配的情况，用于程序调试。

registerConfig 函数使用示例：

```ts
/**
 * 配置定义
 */
interface CustomConfig {
  appId: string
  appSecret: string
  ssl: boolean
  timeout: number
}

// 调用 registerConfig 与环境变量映射
// 返回映射后的配置对象
const config = registerConfig<CustomConfig>(
  // 第一个参数是默认的配置对象，必须要有默认，在匹配不成功的情况下可以使用
  { appId: '', appSecret: '', ssl: true, timeout: 5000 },
  // 第二个参数是配置前缀
  'custom',
  // 第三个参数是校验规则，可选，详细可以参照校验组件
  {
    appId: [notBlank()],
    appSecret: [notBlank()],
    ssl: [notNull()],
    timeout: [notNull(), min(1000), max(3600)]
  }
)
```

也可以不定义配置对象，直接写默认配置对象，通过第一个参数的默认配置对象可以完成自动类型推断，
更简洁一些。

```ts
const config2 = registerConfig(
  {
    url: 'http://localhost/api',
    account: 'Jack'
  },
  'c2',
  {
    url: [notBlank()]
  }
)
```

## getConfig

getConfig 函数仅一个参数，传递前缀，可以获取到配置对象。
一般很少需要使用，推荐调用 registerConfig 时将返回的配置对象导出以供其它程序模块使用。

```ts
const config2 = getConfig('c2')
```

## generateConfig

根据环境变量来生成配置对象，与 registerConfig 的参数是一致的，和 registerConfig 不同的是
generateConfig 可以多次重复使用，方便在运行时更改环境变量后再生成配置，而调用 registerConfig
一旦注册后不能再被更改。之所以这样设计是为了方便程序的测试，模拟在不同的环境下运行程序，
和其它的一些特殊需求。