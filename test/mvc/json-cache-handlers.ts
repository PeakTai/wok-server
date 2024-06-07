import { createJsonHandler, getCache, notBlank, notNull } from '../../src'

let data = {
  id: '007',
  name: '测试数据',
  createBy: '纪老师',
  createAt: new Date()
}

// 无缓存的详情
export const getJsonData = createJsonHandler<{}, typeof data>({
  async handle(body, exchange) {
    return data
  }
})

// 有缓存的详情
export const getCacheJsonData = createJsonHandler<{}, typeof data>({
  cache(body, exchange) {
    return { key: 'json-data', expiresInSeconds: 60 }
  },
  async handle(body, exchange) {
    return data
  }
})

// 更新
export const updateJsonData = createJsonHandler<{ name: string; clearCache?: boolean }>({
  validation: {
    name: [notBlank()]
  },
  async handle(body, exchange) {
    data.name = body.name
    if (body.clearCache) {
      getCache().remove('json-data')
    }
  }
})
