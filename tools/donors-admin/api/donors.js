/**
 * Vercel Serverless Function: /api/donors
 *   GET   - 读取 KV 中的名单（默认按金额降序，并过滤 < 1 元的条目；
 *           传 ?all=1 拿原始全量数据，供管理端 / 手表 app 用）
 *   PUT   - 整体覆盖写入（需要 admin token；会同步更新 updatedAt）
 */
import { readDonors, writeDonors, getMeta } from '../lib/store.js'
import { checkAdminToken } from '../lib/auth.js'
import { validateAndNormalize, sortAndFilterDonors } from '../lib/donors.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    try {
      const [raw, meta] = await Promise.all([readDonors(), getMeta()])
      const includeAll =
        req.query.all === '1' ||
        req.query.all === 'true' ||
        req.query.raw === '1'
      const minAmount =
        req.query.minAmount !== undefined
          ? Number(req.query.minAmount)
          : 1
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
