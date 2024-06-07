import { equal, ok } from 'assert'
import { X509Certificate } from 'crypto'
import { request } from 'https'
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http'
import { TLSSocket } from 'tls'
import { startWebServer, stopWebServer } from '../../src'
import { runTestAsync } from '../utils'

function getCert(): Promise<X509Certificate> {
  return new Promise<X509Certificate>((resolve, reject) => {
    const req = request(
      {
        hostname: 'localhost',
        port: 8080,
        path: '/',
        method: 'get',
        timeout: 5000,
        rejectUnauthorized: false
      },
      res => {
        const socket = res.socket as TLSSocket
        const x509 = socket.getPeerX509Certificate()
        if (!x509) {
          reject('无法获取证书信息')
          return
        }
        resolve(x509)
      }
    )
    req.on('error', e => reject(e))
    req.on('timeout', () => reject('请求超时'))
    req.end()
  })
}

interface RespInfo {
  status: number
  headers: IncomingHttpHeaders
  buffer: Buffer
}
/**
 * get 请求
 * @param path
 */
async function get(path: string, headers?: OutgoingHttpHeaders): Promise<RespInfo> {
  return new Promise<RespInfo>((resolve, rej) => {
    const req = request(
      {
        hostname: 'localhost',
        port: 8080,
        path,
        method: 'GET',
        headers,
        rejectUnauthorized: false
      },
      res => {
        const bfs: any[] = []
        res.on('data', chunk => bfs.push(chunk))
        res.on('end', () =>
          resolve({ headers: res.headers, buffer: Buffer.concat(bfs), status: res.statusCode || 0 })
        )
      }
    )
    req.on('error', err => rej(err))
    req.end()
  })
}

describe('web安全层证书测试', () => {
  before(
    runTestAsync(async () => {
      process.env.SERVER_TLS_ENABLE = 'true'
      process.env.SERVER_TLS_KEY = 'test/mvc/cert/test.key'
      process.env.SERVER_TLS_CERT = 'test/mvc/cert/test.pem'
      // 环境变量配置证书信息
      await startWebServer({
        routers: {
          '/': async ex => ex.respondText('https测试')
        }
      })
      console.log('启动服务完成')
    })
  )
  after(
    runTestAsync(async () => {
      await stopWebServer()
    })
  )

  it(
    '证书信息测试',
    runTestAsync(async () => {
      const cert = await getCert()

      console.log(cert.validFrom)
      console.log(cert.validTo)

      // 2022-08-31  2023-09-06
      const validTo = new Date(cert.validTo)
      equal(validTo.getFullYear(), 2023)
      equal(validTo.getUTCMonth(), 8)
      equal(validTo.getUTCDate(), 6)
      const validaFrom = new Date(cert.validFrom)
      equal(validaFrom.getFullYear(), 2022)
      equal(validaFrom.getUTCMonth(), 7)
      equal(validaFrom.getUTCDate(), 31)

      // 请求信息
      const res = await get('/')
      equal(res.status, 200)
      const text = res.buffer.toString('utf-8')
      equal(text, 'https测试')
    })
  )
})
