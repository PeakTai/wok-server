# HTTP Client

The HTTP client is an HTTP request tool built on top of Node.js's built-in http and https modules, providing three functions.

| Function   | Description                                     |
| :--------- | :---------------------------------------------- |
| doRequest  | Generic HTTP request with customizable options |
| postJson   | Send POST request and get JSON response         |
| getJson    | Send GET request and get JSON response          |

## Usage Examples

```ts
// GET request for JSON
const list = await getJson<User[]>({
  url: '/users'
})

// POST request for JSON
const res = await postJson<Result>({
  url: '/data/save',
  body: { name: 'jack', age: 33 }
})

// Use doRequest with more custom options
await doRequest({
  url: '/users/001',
  method: 'DELETE',
  timeout: 5000,
  followRedirect: true
})
```