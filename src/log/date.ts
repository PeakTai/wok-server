export function currentDateTimeStr() {
  return formatDateTime(new Date())
}

export function formatDateTime(date: Date) {
  return (
    date.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    }) + `.${date.getMilliseconds()}`
  )
}
