/**
 * Vercel 入口（仓库根 index.js）
 * Vercel 约定的 Serverless Function 入口文件名之一
 *
 * 路由表：
 *   GET  /              → public/index.html
 *   GET  /app           → public/app.js
 *   GET  /style         → public/style.css
 *   GET  /api/donors    → 名单（?all=1 拿全量）
 *   GET  /api/health    → 健康检查
 *   POST /api/auth      → 校验 token
 *   PUT  /api/donors    → 整体覆盖写入（需要 token）
 *
 * 其它路径 → 404
 */
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'

import { readDonors, writeDonors, getMeta, getStorageInfo } from './lib/store.js'
import { validateAndNormalize } from './lib/donors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.join(__dirname, 'public')

const app = express()
app.use(express.json({ limit: '1mb' }))

// ── 静态文件 ────────────────────────────────────
async function serveStatic(res, filename, contentType) {
  try {
    const buf = await readFile(path.join(PUBLIC_DIR, filename))
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send(buf)
  } catch (e) {
    return res.status(404).json({ ok: false, message: 'Not Found' })
  }
}

app.get('/', (_req, res) =>
  serveStatic(res, 'index.html', 'text/html; charset=utf-8')
)
app.get('/app', (_req, res) =>
  serveStatic(res, 'app.js', 'application/javascript; charset=utf-8')
)
app.get('/style', (_req, res) =>
  serveStatic(res, 'style.css', 'text/css; charset=utf-8')
)

// ── 工具：鉴权 ──────────────────────────────────
function getAdminToken() {
  return process.env.ADMIN_TOKEN || ''
}
function checkAdminToken(req) {
  const token = getAdminToken()
  if (!token) return true // 本地开发模式
  const headerToken = req.headers['x-token']
  const bodyToken = req.body && req.body.token
  return headerToken === token || bodyToken === token
}

// ── API：/api/health ───────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    const meta = await getMeta()
    return res.status(200).json({
      ok: true,
      storage: getStorageInfo(),
      meta: {
        updatedAt: meta.updatedAt || null,
        count: meta.count || 0,
      },
    })
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message })
  }
})

// ── API：/api/auth ─────────────────────────────
app.post('/api/auth', (req, res) => {
  const token = (req.body && req.body.token) || req.headers['x-token']
  const expected = getAdminToken()
  if (!expected) {
    return res.status(500).json({ ok: false, message: 'ADMIN_TOKEN 未配置' })
  }
  if (token === expected) {
    return res.status(200).json({ ok: true, message: 'Token 验证通过' })
  }
  return res.status(401).json({ ok: false, message: 'Token 无效' })
})

// ── API：/api/donors ───────────────────────────
// visible / smallNames / totalAmount / totalCount 都在 PUT 保存时
// 由 writeDonors 预计算并写入 donors:meta，此处 GET 直接读取 meta
app.get('/api/donors', async (req, res) => {
  try {
    const includeAll =
      req.query.all === '1' || req.query.all === 'true' || req.query.raw === '1'

    const [raw, meta] = await Promise.all([readDonors(), getMeta()])

    // visible / smallNames 已在 meta 里预计算好
    const visible = Array.isArray(meta.visible) ? meta.visible : []
    const smallNames = Array.isArray(meta.smallNames) ? meta.smallNames : []

    const totalCount =
      typeof meta.totalCount === 'number' ? meta.totalCount : safeCount(raw)
    const totalAmount =
      typeof meta.totalAmount === 'string'
        ? meta.totalAmount
        : typeof meta.totalAmount === 'number'
          ? meta.totalAmount.toFixed(2)
          : safeTotalAmount(raw)

    // 管理界面 ?all=1 时返回原始的、未经合并的 data，方便编辑
    const data = includeAll ? raw : visible

    return res.status(200).json({
      ok: true,
      data,
      smallNames: includeAll ? [] : smallNames,
      meta: {
        total: raw.length,
        returned: data.length,
        filtered: Math.max(0, raw.length - visible.length),
        minAmount: includeAll ? 0 : 1,
        totalCount: totalCount,
        totalAmount: totalAmount,
        visibleCount: typeof meta.visibleCount === 'number' ? meta.visibleCount : visible.length,
        smallCount: typeof meta.smallCount === 'number' ? meta.smallCount : smallNames.length,
        updatedAt: meta.updatedAt || null,
      },
    })
  } catch (e) {
    return res.status(500).json({ ok: false, message: '读取失败：' + e.message })
  }
})

// 兼容：meta 缺失时 fallback 在请求时即时计算（仅旧数据首次读取时触发）
function safeCount(list) {
  if (!Array.isArray(list)) return 0
  let n = 0
  for (const g of list) if (Array.isArray(g && g.n)) n += g.n.length
  return n
}

function safeTotalAmount(list) {
  if (!Array.isArray(list)) return '0.00'
  let cents = 0
  for (const g of list) {
    const a = parseFloat(g && g.a)
    if (isNaN(a) || a <= 0) continue
    const n = Array.isArray(g.n) ? g.n.length : 0
    cents += Math.round(a * 100) * n
  }
  return (cents / 100).toFixed(2)
}

app.put('/api/donors', async (req, res) => {
  if (!checkAdminToken(req)) {
    return res.status(401).json({ ok: false, message: '未授权：Token 无效' })
  }
  const list = req.body && req.body.data
  const result = validateAndNormalize(list)
  if (!result.ok) {
    return res.status(400).json({ ok: false, message: result.error })
  }
  try {
    const info = await writeDonors(result.data)
    return res.status(200).json({
      ok: true,
      message: '保存成功',
      count: result.data.length,
      storage: info,
    })
  } catch (e) {
    return res.status(500).json({ ok: false, message: '写入失败：' + e.message })
  }
})

// ── 404 ────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'Not Found', path: req.path })
})

export default app
