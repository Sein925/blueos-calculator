/**
 * 共享：donors 数据校验与金额归一化
 */
export function validateDonor(d) {
  if (!d || typeof d !== 'object') return '条目必须为对象'
  if (typeof d.a !== 'string' && typeof d.a !== 'number')
    return '金额 (a) 必须是数字或数字字符串'
  if (!Array.isArray(d.n) || d.n.length === 0) return '姓名 (n) 必须是非空数组'
  for (const name of d.n) {
    if (typeof name !== 'string' || name.length === 0)
      return '姓名 (n) 数组元素必须是非空字符串'
  }
  return null
}

export function normalizeAmount(a) {
  const num = typeof a === 'number' ? a : parseFloat(a)
  if (isNaN(num) || num < 0) return null
  // 保留两位小数，输出为字符串以匹配现有数据格式
  return (Math.round(num * 100) / 100).toFixed(2)
}

/**
 * 排序 + 过滤
 *  - 按金额（a）从大到小
 *  - 过滤掉金额低于 minAmount 的条目
 */
export function sortAndFilterDonors(list, { minAmount = 1 } = {}) {
  if (!Array.isArray(list)) return []
  const threshold = Number(minAmount)
  const hasThreshold = !isNaN(threshold)
  return list
    .filter((item) => {
      if (!hasThreshold) return true
      const a = parseFloat(item && item.a)
      return !isNaN(a) && a >= threshold
    })
    .slice()
    .sort((a, b) => {
      const av = parseFloat(a && a.a) || 0
      const bv = parseFloat(b && b.a) || 0
      return bv - av
    })
}

/**
 * 校验并归一化整个 donors 列表，返回 { ok, data, error }
 */
export function validateAndNormalize(list) {
  if (!Array.isArray(list)) {
    return { ok: false, error: '请求体需要包含 data 数组' }
  }
  const normalized = []
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    const err = validateDonor(item)
    if (err) return { ok: false, error: `第 ${i + 1} 条：${err}` }
    const amount = normalizeAmount(item.a)
    if (amount === null)
      return { ok: false, error: `第 ${i + 1} 条：金额无效` }
    const names = item.n
      .map((n) => String(n).trim())
      .filter((n) => n.length > 0)
    if (names.length === 0)
      return { ok: false, error: `第 ${i + 1} 条：姓名不能为空` }
    normalized.push({ a: amount, n: names })
  }
  return { ok: true, data: normalized }
}
