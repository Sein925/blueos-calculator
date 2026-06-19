/**
 * 共享：donors 数据校验与金额归一化
 */

// 金额展示阈值：低于此值的条目会被归并到 smallNames，前端不再单独分组
export const SMALL_AMOUNT_THRESHOLD = 1

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
  return (Math.round(num * 100) / 100).toFixed(2)
}

/**
 * 把列表按金额聚合：相同金额的人合并到同一组
 *   list: [{ a, n: [...] }, ...]
 *   return: [{ a: 'x.xx', n: [...] }]  按金额从高到低排序
 */
function groupByAmount(list) {
  const map = new Map()
  const arr = Array.isArray(list) ? list : []
  for (const g of arr) {
    if (!g) continue
    const aNum = parseFloat(g.a)
    if (isNaN(aNum) || aNum < 0) continue
    const aStr = aNum.toFixed(2)
    const names = Array.isArray(g.n) ? g.n : []
    const cleaned = names
      .map((n) => String(n).trim())
      .filter((n) => n.length > 0)
    if (cleaned.length === 0) continue
    const existing = map.get(aStr)
    if (existing) {
      for (const n of cleaned) existing.push(n)
    } else {
      map.set(aStr, cleaned)
    }
  }
  // 按金额从高到低
  const groups = Array.from(map.entries())
    .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
    .map(([a, n]) => ({ a, n }))
  return groups
}

/**
 * 写入前统一计算的「显示层」。
 * 返回：
 *   { visible: [{a, n}], smallNames: [...], totalCount, totalAmount }
 */
export function computeView(list, { threshold = SMALL_AMOUNT_THRESHOLD } = {}) {
  const t = Number(threshold)
  const safeT = !isNaN(t) && t > 0 ? t : 1

  // 先按金额合并分组
  const groups = groupByAmount(list)

  const visible = []
  const smallNames = []
  let totalCount = 0
  let totalCents = 0

  for (const g of groups) {
    const a = parseFloat(g.a)
    const count = g.n.length
    totalCount += count
    if (!isNaN(a) && a > 0) totalCents += Math.round(a * 100) * count
    if (a >= safeT) visible.push(g)
    else for (const n of g.n) smallNames.push(n)
  }

  return {
    visible,
    smallNames,
    totalCount,
    totalAmount: (totalCents / 100).toFixed(2),
  }
}

/**
 * 过滤 + 排序（已由 computeView 预计算，这里保留兼容函数供管理端 all=1 时原样返回 raw）
 */
export function sortAndFilterDonors(list, { minAmount = SMALL_AMOUNT_THRESHOLD } = {}) {
  const result = computeView(list, { threshold: minAmount })
  return result.visible
}

/**
 * 校验并归一化整个 donors 列表
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
    if (amount === null) return { ok: false, error: `第 ${i + 1} 条：金额无效` }
    const names = item.n
      .map((n) => String(n).trim())
      .filter((n) => n.length > 0)
    if (names.length === 0)
      return { ok: false, error: `第 ${i + 1} 条：姓名不能为空` }
    normalized.push({ a: amount, n: names })
  }
  return { ok: true, data: normalized }
}
