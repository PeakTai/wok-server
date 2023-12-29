import { deepStrictEqual, equal, ok } from 'assert'
import { IncomingHttpHeaders } from 'http'
import { getI18n } from '../src'
import { runTestAsync } from './utils'

describe('国际化测试', () => {
  it(
    '内置的国际化消息测试',
    runTestAsync(async () => {
      const i18n = getI18n()
      ok(i18n.getLang())
      // 自带中英文支持
      ok(i18n.setLang('en'))
      ok(i18n.setLang('zh'))
      equal(i18n.getLang(), 'zh')
      equal(i18n.buildMsg('validate-err-array'), '值不是数组')
      // 切换成英文再测试
      ok(i18n.setLang('en-us'))
      equal(i18n.buildMsg('validate-err-array'), 'Value is not a array type.')
      // 带参数测试
      equal(i18n.buildMsg('validate-err-max', '7'), 'Not greater than 7.')
      equal(i18n.buildMsg('validate-err-max', '13'), 'Not greater than 13.')
      equal(
        i18n.buildMsg('validate-err-min-length', '11'),
        'The length should not be less than 11.'
      )
      // 切换成中文再对部分消息进行测试
      ok(i18n.setLang('zh-cn'))
      equal(i18n.buildMsg('validate-err-min', '7'), '不得小于 7')
      equal(i18n.buildMsg('validate-err-max-length', '7'), '长度不得大于 7')

      let tags = i18n.getSupportedLanguageTags('tibt', 'xj')
      // 无匹配成功的语言
      ok(!tags.length)
      tags = i18n.getSupportedLanguageTags('zh', 'zh-tw', 'zh-HK')
      // 凡是中文，应该都可以支持
      deepStrictEqual(tags, ['zh', 'zh-tw', 'zh-HK'])
      tags = i18n.getSupportedLanguageTags('en-US', 'en-uk', 'en-gb')
      deepStrictEqual(tags, ['en-US', 'en-uk', 'en-gb'])
    })
  )
  it(
    '消息绑定语言测试',
    runTestAsync(async () => {
      const i18n = getI18n()
      ok(i18n.setLang('zh'))
      // 绑定当前语言
      const zh = i18n.bindLang()
      equal('zh', zh.getLang())
      // 指定语言
      const en = i18n.bindLang('en')
      equal('en', en.getLang())
      // i18n 自身语言不会变化
      equal(i18n.getLang(), 'zh')

      equal(zh.buildMsg('validate-err-numer'), '值不是数字')
      equal(en.buildMsg('validate-err-numer'), 'Value is not a number type.')

      // i18n 切换语言，也不会影响已经绑定语言的对象
      ok(i18n.setLang('en-us'))
      equal('zh', zh.getLang())
      equal('en', en.getLang())
    })
  )
  it(
    '添加自定义语言测试',
    runTestAsync(async () => {
      const i18n = getI18n()
      // 现在不支持切换到日语
      ok(!i18n.setLang('tibt'))
      // 设置过日语后就可以切换了
      i18n.setMsgs('tibt', {
        'validate-err-array': 'གྱུར་མའི་ཁྱོད་ཀྱི་སྐོར་གྱི་མུ་དགོས་མ་བྱུང་།',
        'validate-err-enum': 'གྱུར་མའི་རིམ་པ་{}ི་མི་དགའ་ནི་གི་བརྩིས་ཅན་རེད། ',
        'validate-err-numer': 'གྱུར་མའི་ཁྱོད་ཀྱི་སྐོར་གྱི་རྩ་གཉིས་མ་བྱུང་།',
        'validate-err-max': '{}ཐོག་མར་ལྕོག་གི་མཉམ་དུ་མི་དགའ་བས་མ་བྱུང་།',
        'validate-err-min': '{}ཞག་མི་དགའ་བས་མ་བྱུང་།',
        'validate-err-empty': 'སོན་མ་ཚུགས་པའི་སྐོར་མ་བྱུང་།',
        'validate-err-string': 'གྱུར་མའི་ཁྱོད་ཀྱི་སྐོར་གྱི་སྐོར་རྩ་མ་བྱུང་།',
        'validate-err-incorrect-format': 'དམིགས་བསྒྱུར་འབད་མི་འདུག',
        'validate-err-no-length': 'lengthའདིར་བརྒྱུད་མ་ཚུགས་པའི་སྐོར་མ་བྱུང་།',
        'validate-err-length-not-number': 'lengthལྕོག་བྱུང་མི་རེད་མ་བྱུང་།',
        'validate-err-min-length': 'ཞག{}གི་སྐོར་བར་མ་བྱུང་། ',
        'validate-err-max-length': 'རྩ་སྒྲིགས{}གི་སྐོར་མཉམམ་བྱུང་།'
      })
      const tag = i18n.getSupportedLanguageTags('tibt', 'zh', 'en')
      deepStrictEqual(tag, ['tibt', 'zh', 'en'])
      ok(i18n.setLang('tibt'))
      equal(i18n.getLang(), 'tibt')
      equal(i18n.buildMsg('validate-err-array'), 'གྱུར་མའི་ཁྱོད་ཀྱི་སྐོར་གྱི་མུ་དགོས་མ་བྱུང་།')
      equal(i18n.buildMsg('validate-err-max-length', '9'), 'རྩ་སྒྲིགས9གི་སྐོར་མཉམམ་བྱུང་།')
    })
  )
  it(
    '扩展新的国际化消息测试',
    runTestAsync(async () => {
      interface ExtI18n {
        hello: string
        world: string
      }
      const i18n = getI18n()
      const extI18n = i18n.extend<ExtI18n>({ hello: 'hello', world: 'world' })
      // 切换语言切换
      i18n.setLang('en')
      equal(i18n.getLang(), 'en')
      equal(extI18n.getLang(), 'en')
      equal(extI18n.buildMsg('hello'), 'hello')
      // exti18n 没有设置中文，所以 i18n 切换成中文，exti18n 仍然是英文
      i18n.setLang('zh')
      equal(i18n.getLang(), 'zh')
      equal(extI18n.getLang(), 'en')
      let tags = extI18n.getSupportedLanguageTags('en', 'zh')
      deepStrictEqual(tags, ['en'])

      // 添加中文
      extI18n.setMsgs('zh-cn', { hello: '你好', world: '世界' })
      i18n.setLang('zh-cn')
      equal(i18n.getLang(), 'zh-cn')
      equal(extI18n.getLang(), 'zh-cn')
      equal(extI18n.buildMsg('hello'), '你好')
      tags = extI18n.getSupportedLanguageTags('en', 'zh')
      deepStrictEqual(tags, ['en', 'zh'])
    })
  )
  it(
    '测试对请求的支持',
    runTestAsync(async () => {
      const i18n = getI18n()
      const headers: IncomingHttpHeaders = {
        'accept-language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2'
      }
      i18n.switchByRequest(headers)
      equal(i18n.getLang(), 'zh-CN')
      const boundI18n = i18n.bindByRequest(headers)
      equal(boundI18n.getLang(), 'zh-CN')
      equal(boundI18n.buildMsg('validate-err-array'), '值不是数组')
    })
  )
})
