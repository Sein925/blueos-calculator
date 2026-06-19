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
import { validateAndNormalize, sortAndFilterDonors } from './lib/donors.js'

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
app.get('/api/donors', async (req, res) => {
  try {
    const [raw, meta] = await Promise.all([readDonors(), getMeta()])
    const includeAll =
      req.query.all === '1' || req.query.all === 'true' || req.query.raw === '1'
    const minAmount =
      req.query.minAmount !== undefined ? Number(req.query.minAmount) : 1
    const data = includeAll ? raw : sortAndFilterDonors(raw, { minAmount })
    return res.status(200).json({
      ok: true,
      data,
      meta: {
        total: raw.length,
        returned: data.length,
        filtered: raw.length - data.length,
        minAmount: includeAll ? 0 : minAmount,
        updatedAt: meta.updatedAt || null,
      },
    })
  } catch (e) {
    return res.status(500).json({ ok: false, message: '读取失败：' + e.message })
  }
})

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
