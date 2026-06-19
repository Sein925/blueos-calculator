/**
 * donors.json 存储抽象
 * 使用 Upstash Redis（Vercel Marketplace 集成会自动注入环境变量）
 *
 * 数据布局：
 *   donors:data   → 主数据（Array<{ a, n }>）
 *   donors:meta   → 元信息 { updatedAt, count }
 */
import { Redis } from '@upstash/redis'

// 延迟初始化客户端（避免模块加载时环境变量还没注入）
let _client = null
function client() {
  if (_client) return _client
  _client = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
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
  // Pipeline 减少 2 次 RTT
  const pipe = c.pipeline()
  pipe.set(KV_KEY, list)
  pipe.set(KV_META_KEY, { updatedAt: now, count: list.length })
  await pipe.exec()
  return {
    source: 'upstash-redis',
    key: KV_KEY,
    count: list.length,
    updatedAt: now,
  }
}

// ── 探活 / 存储信息 ──────────────────────────────
export function getStorageInfo() {
  return {
    mode: 'upstash-redis',
    key: KV_KEY,
    metaKey: KV_META_KEY,
    hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
    hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
  }
}
