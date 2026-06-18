/**
 * Vercel Serverless Function: /api/health
 *   GET - 健康检查 + 当前存储信息
 */
import { getStorageInfo } from '../lib/store.js'

export default function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ ok: true, storage: getStorageInfo() })
}
