/**
 * donors.json 存储抽象
 * 使用 @upstash/redis SDK，兼容：
 *   1) 新版 Vercel Marketplace Upstash 集成（重命名后的变量）
 *      → KV_REST_API_URL / KV_REST_API_TOKEN
 *   2) 标准 Upstash 变量名
 *      → UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 *
 * 数据布局：
 *   donors:data   → 主数据（Array<{ a, n }>）
 *   donors:meta   → 元信息：
 *                    { updatedAt, count, totalCount, totalAmount, smallNames, visible }
 *   visible/smallNames 在写入时预计算，GET 请求直接返回，避免每次重复计算
 */
import { Redis } from '@upstash/redis'
import { computeView } from './donors.js'

// 延迟初始化客户端
let _client = null
function client() {
  if (_client) return _client
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    ''
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    ''
  if (!url || !token) {
    throw new Error(
      'Redis 未配置：请在 Vercel 项目环境变量中设置 ' +
        'KV_REST_API_URL / KV_REST_API_TOKEN ' +
        '（或 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN）'
    )
  }
  _client = new Redis({ url, token })
  return _client
}

const KV_KEY = 'donors:data'
const KV_META_KEY = 'donors:meta'

// ── 读取主数据 ──────────────────────────────────
export async function readDonors() {
  const data = await client().get(KV_KEY)
  return Array.isArray(data) ? data : []
}

// ── 读取元信息（含 precomputed view）───────────
export async function getMeta() {
  const meta = await client().get(KV_META_KEY)
  return meta && typeof meta === 'object' ? meta : {}
}

// ── 写入主数据 + 元信息（预计算）─────────────────
export async function writeDonors(list) {
  const now = new Date().toISOString()
  const safeList = Array.isArray(list) ? list : []

  const view = computeView(safeList)

  const meta = {
    updatedAt: now,
    count: safeList.length,
    totalCount: view.totalCount,
    totalAmount: view.totalAmount,
    visibleCount: view.visible.length,
    smallCount: view.smallNames.length,
    // 以下两个即为前端展示用数据，由后端预计算
    visible: view.visible,
    smallNames: view.smallNames,
  }

  const c = client()
  const pipe = c.pipeline()
  pipe.set(KV_KEY, safeList)
  pipe.set(KV_META_KEY, meta)
  await pipe.exec()
  return {
    source: process.env.KV_REST_API_URL ? 'upstash-redis' : 'upstash-redis-std',
    key: KV_KEY,
    count: safeList.length,
    updatedAt: now,
    totalAmount: view.totalAmount,
    totalCount: view.totalCount,
  }
}

// ── 探活 / 存储信息 ──────────────────────────────
export function getStorageInfo() {
  const hasNew =
    !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN
  const hasStd =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN
  return {
    mode: hasNew ? 'upstash-redis' : hasStd ? 'upstash-redis-std' : 'not-configured',
    key: KV_KEY,
    metaKey: KV_META_KEY,
    hasUrl: hasNew || hasStd,
    hasToken: hasNew || hasStd,
  }
}
