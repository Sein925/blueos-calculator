/**
 * Vercel Serverless Function: /api/donors
 *   GET   - 读取 donors.json
 *   PUT   - 整体覆盖写入（需要 admin token）
 */
import { readDonors, writeDonors } from '../lib/store.js'
import { checkAdminToken } from '../lib/auth.js'
import { validateAndNormalize } from '../lib/donors.js'

export default async function handler(req, res) {
  // CORS / 通用头
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    try {
      const data = await readDonors()
      return res.status(200).json({ ok: true, data })
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, message: '读取失败：' + e.message })
    }
  }

  if (req.method === 'PUT') {
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
      return res
        .status(500)
        .json({ ok: false, message: '写入失败：' + e.message })
    }
  }

  res.setHeader('Allow', 'GET, PUT')
  return res.status(405).json({ ok: false, message: 'Method Not Allowed' })
}
