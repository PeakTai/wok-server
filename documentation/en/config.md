# Configuration

The configuration module maps configuration objects to environment variables and provides them to other modules. It can be combined with the validation component to extend new features.

Three functions are provided:

| Function        | Description                                                                 |
| :-------------- | :-------------------------------------------------------------------------- |
| registerConfig  | Register configuration, which immediately matches environment variables and returns the mapped configuration object |
| getConfig       | Get configuration                                                           |
| generateConfig  | Generate configuration from environment variables without registering       |

## Configuration Types and Instance Objects

To perform configuration mapping, you must first define a configuration type. Here is an example:

```ts
/**
 * Configuration definition
 */
interface CustomConfig {
  appId: string
  appSecret: string
}
```

**All properties of the configuration type must be non-nullable and must have values for mapping to work.**

You can also skip defining a type and directly declare an object, then call registerConfig to complete automatic type inference. See the registerConfig description below for details.

Currently, configuration objects only support the following types: string, number, boolean.

## registerConfig

Environment variable mapping requires a prefix. The object's properties are concatenated with the prefix and then converted to match environment variables. For example, if the configuration object has a property `appId` and the prefix is `cus`, the matching environment variable would be `CUS_APP_ID`.

Each call to registerConfig outputs logs showing the matching status for debugging purposes.

Example usage of registerConfig:

```ts
/**
 * Configuration definition
 */
interface CustomConfig {
  appId: string
  appSecret: string
  ssl: boolean
  timeout: number
}

// Call registerConfig to map with environment variables
// Returns the mapped configuration object
const config = registerConfig<CustomConfig>(
  // First parameter: default configuration object, must have defaults for fallback
  { appId: '', appSecret: '', ssl: true, timeout: 5000 },
  // Second parameter: configuration prefix
  'custom',
  // Third parameter: validation rules, optional, see validation component for details
  {
    appId: [notBlank()],
    appSecret: [notBlank()],
    ssl: [notNull()],
    timeout: [notNull(), min(1000), max(3600)]
  }
)
```

You can also skip defining the configuration object and directly write the default configuration object. Automatic type inference is done through the default configuration object in the first parameter, which is more concise.

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

The getConfig function takes only one parameter, the prefix, and returns the configuration object.

This is rarely needed. It is recommended to export the configuration object returned by registerConfig for use by other modules.

```ts
const config2 = getConfig('c2')
```

## generateConfig

Generates a configuration object from environment variables with the same parameters as registerConfig. Unlike registerConfig, generateConfig can be called multiple times, making it convenient to regenerate configuration after changing environment variables at runtime. registerConfig locks the configuration once registered and cannot be changed. This design facilitates program testing, simulating program execution in different environments, and other special requirements.