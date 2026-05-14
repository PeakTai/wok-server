# Validation

The validation component provides a validate function to validate objects with many built-in validation rules. The component supports internationalization, and error messages depend on the current language. See the internationalization section for details.

Here is a simple usage example:

```ts
validate(
  // Object to validate
  { name: 'tom' },
  // Validation rules, multiple rules per property
  {
    name: [notNull(), length({ min: 2, max: 16 })]
  }
)
```

Built-in validation rule functions:

| Function      | Description                                                              |
| :------------ | :----------------------------------------------------------------------- |
| notNull       | Not null validation, cannot be null or undefined                         |
| notBlank      | Not blank validation, cannot be null, undefined, or blank string         |
| min           | Validate minimum number value                                             |
| max           | Validate maximum number value                                             |
| length        | Validate length, applicable to strings and arrays                         |
| maxLength     | Check maximum length, applicable to strings and arrays                   |
| minLength     | Check minimum length, applicable to strings and arrays                   |
| regexp        | Regular expression validation                                             |
| enumerate     | Enumeration validation, value must be one of the specified list          |
| array         | Array validation, set element validation rules to validate each element  |
| plainObject   | Object validation, validate nested object properties                      |

Here is an example of nested object and array validation:

```ts
interface Tag {
  id: string
  name: string
  permissinos: { edit?: boolean; read?: boolean }
}
interface User {
  profile: {
    theme: string
  }
  tags: Tag[]
}
validate<User>(
  {
    profile: {
      theme: 'light'
    },
    tags: [
      { id: '001', name: 'basketball', permissinos: { edit: true, read: true } },
      { id: '002', name: 'soccer', permissinos: { edit: true } }
    ]
  },
  {
    profile: [
      notNull(),
      plainObject({
        theme: [notBlank()]
      })
    ],
    tags: [
      // Maximum 5 tags
      maxLength(5),
      // Tags list cannot be null
      notNull(),
      // Validate tag array elements
      array([
        // Element cannot be null
        notNull(),
        // Element property validation
        plainObject({
          id: [notBlank()],
          name: [notBlank()],
          permissinos: [
            notNull(),
            plainObject({
              edit: [notNull()],
              read: [notNull()]
            })
          ]
        })
      ])
    ]
  }
)
```

In actual development, it's recommended to keep validation at most one level deep, without nesting, otherwise the program will be difficult to maintain.

## Custom Validation Rules

If the built-in validation rules cannot meet your needs, you can write custom validation rules.

```ts
/**
 * Custom validation
 * @returns Property validator
 */
function customValidate(): PropValidator {
  // Validator name for tracking
  const validator = 'custom'
  const message = 'Cannot start with t'
  return val => {
    // Skip null validation
    if (!val) {
      return { ok: true }
    }
    if (typeof val !== 'string') {
      return { ok: false, validator, message: 'Value is not a string' }
    }
    if (val.startsWith('t')) {
      return { ok: false, validator, message }
    }
    return { ok: true }
  }
}

validate(
  { name: 'tim' },
  {
    name: [customValidate()]
  }
)
```

Built-in validation rules have internationalization support. If you need internationalization for custom validation rules, you need to handle it yourself. See the internationalization chapter for details.