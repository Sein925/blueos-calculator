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
 *   donors:meta   → 元信息 { updatedAt, count }
 */
import { Redis } from '@upstash/redis'

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

// ── 读取元信息（含 updatedAt） ────────────────
export async function getMeta() {
  const meta = await client().get(KV_META_KEY)
  return meta && typeof meta === 'object' ? meta : {}
}

// ── 写入主数据 + 元信息 ─────────────────────────
export async function writeDonors(list) {
  const now = new Date().toISOString()
  const c = client()
  const pipe = c.pipeline()
  pipe.set(KV_KEY, list)
  pipe.set(KV_META_KEY, { updatedAt: now, count: list.length })
  await pipe.exec()
  return {
    source: process.env.KV_REST_API_URL ? 'upstash-redis' : 'upstash-redis-std',
    key: KV_KEY,
    count: list.length,
    updatedAt: now,
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
