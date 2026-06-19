/**
 * 本地开发服务器（Express）
 * 生产部署请使用 Vercel，会自动加载 api/*.js 作为 Serverless Functions
 *
 * 启动：pnpm start
 * 浏览器访问 http://localhost:4310
 */
import express from 'express'
import { readDonors, writeDonors, getStorageInfo } from './lib/store.js'
import { checkAdminToken, resolveAdminToken } from './lib/auth.js'
import { validateAndNormalize } from './lib/donors.js'

const app = express()
const PORT = process.env.PORT || 4310

app.use(express.json({ limit: '1mb' }))
app.use(express.static('public'))

app.get('/api/donors', async (_req, res) => {
  try {
    res.json({ ok: true, data: await readDonors() })
  } catch (e) {
    res.status(500).json({ ok: false, message: '读取失败：' + e.message })
  }
})

app.put('/api/donors', async (req, res) => {
  if (!checkAdminToken(req)) {
    return res.status(401).json({ ok: false, message: '未授权：Token 无效' })
  }
  const result = validateAndNormalize(req.body && req.body.data)
  if (!result.ok) {
    return res.status(400).json({ ok: false, message: result.error })
  }
  try {
    const info = await writeDonors(result.data)
    res.json({
      ok: true,
      message: '保存成功',
      count: result.data.length,
      storage: info,
    })
  } catch (e) {
    res.status(500).json({ ok: false, message: '写入失败：' + e.message })
  }
})

app.post('/api/auth', (req, res) => {
  if (checkAdminToken(req)) return res.json({ ok: true })
  res.status(401).json({ ok: false, message: 'Token 错误' })
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, storage: getStorageInfo() })
})

app.listen(PORT, () => {
  const token = resolveAdminToken()
  const storage = getStorageInfo()
  const location =
    storage.mode === 'github'
      ? `${storage.repo}@${storage.branch}:${storage.path}`
      : storage.mode === 'kv'
        ? `Vercel KV (key: ${storage.key})` +
          (storage.githubSync ? ' + GitHub 同步' : '')
        : storage.path
  console.log('────────────────────────────────────────')
  console.log('  打赏名单管理后台已启动')
  console.log(`  访问地址: http://localhost:${PORT}`)
  console.log(`  存储模式: ${storage.mode}`)
  console.log(`  数据位置: ${location}`)
  console.log(`  Token   : ${token}`)
  console.log('  （可通过环境变量 ADMIN_TOKEN 自定义）')
  console.log('────────────────────────────────────────')
})
