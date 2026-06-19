/**
 * donors.json 存储抽象
 * 仅使用 Vercel KV（基于 Upstash Redis）
 *
 * 数据布局：
 *   donors:data   → 主数据（Array<{ a, n }>）
 *   donors:meta   → 元信息 { updatedAt, count }
 */
import { kv } from '@vercel/kv'

const KV_KEY = 'donors:data'
const KV_META_KEY = 'donors:meta'

// ── 读取主数据 ──────────────────────────────────
export async function readDonors() {
  const data = await kv.get(KV_KEY)
  return Array.isArray(data) ? data : []
}

// ── 读取元信息（含 updatedAt） ────────────────
export async function getMeta() {
  const meta = await kv.get(KV_META_KEY)
  return meta && typeof meta === 'object' ? meta : {}
}

// ── 写入主数据 + 元信息 ─────────────────────────
export async function writeDonors(list) {
  const now = new Date().toISOString()
  await kv.set(KV_KEY, list)
  await kv.set(KV_META_KEY, {
    updatedAt: now,
    count: list.length,
  })
  return {
    source: 'kv',
    key: KV_KEY,
    count: list.length,
    updatedAt: now,
  }
}

// ── 探活 / 存储信息 ──────────────────────────────
export function getStorageInfo() {
  return {
    mode: 'kv',
    key: KV_KEY,
    metaKey: KV_META_KEY,
  }
}
