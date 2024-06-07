import { equal, ok } from 'assert'
import { Server } from 'socket.io'
import { io } from 'socket.io-client'
import { doRequest, startWebServer, stopWebServer } from '../../src'
import { runTestAsync, sleep } from '../utils'

describe('websocket.io 测试', async () => {
  before(
    runTestAsync(async () => {
      process.env.SERVER_TLS_ENABLE = 'false'
      process.env.SERVER_STATIC_CACHE_ENABLE = 'false'
      await startWebServer({
        async preHandler(server) {
          const io = new Server(server, {
            cors: { origin: '*', allowedHeaders: '*', methods: '*' }
          })
          io.of('/ws').on('connection', socket => {
            console.log('服务器端建立连接')
            socket.on('message', data => {
              console.log('服务器端　message：', data)
              socket.emit('echo', data)
            })
            socket.on('disconnect', reason => {
              console.log('服务器端连接断开', reason)
              io.close()
            })
          })
        },
        routers: {
          '/demo': async ex => ex.respondText('test'),
          '/ws': async ex => ex.respondText('router /ws')
        }
      })
    })
  )
  after(
    runTestAsync(async () => {
      await stopWebServer()
    })
  )
  it(
    '简单的消息发送',
    runTestAsync(async () => {
      // 先测试接口
      const res = await doRequest({ url: 'http://localhost:8080/demo', method: 'GET' })
      equal(res.status, 200)
      equal(res.body.toString('utf-8'), 'test')

      const res2 = await doRequest({ url: 'http://localhost:8080/ws', method: 'GET' })
      equal(res2.status, 200)
      equal(res2.body.toString('utf-8'), 'router /ws')

      const socket = io('ws://localhost:8080/ws')
      let connected = false
      let disconnected = false
      let recivedDataArr: any[] = []
      socket.on('connect', () => {
        console.log('客户端建立连接')
        connected = true
      })
      socket.on('disconnect', resaon => {
        console.log('客户端断开连接', resaon)
        disconnected = true
      })
      socket.on('echo', data => {
        console.log('客户端 echo 事件：', data)
        recivedDataArr.push(data)
      })
      socket.emit('message', '内容一')
      await sleep(100)
      socket.emit('message', '内容二')
      // 等待一段时间接收消息
      await sleep(500)

      ok(connected)
      ok(socket.connected)
      equal(recivedDataArr.length, 2)
      equal(recivedDataArr[0], '内容一')
      equal(recivedDataArr[1], '内容二')
      // 关闭
      socket.close()
      await sleep(500)

      ok(disconnected)
      ok(!socket.connected)
    })
  )
})
