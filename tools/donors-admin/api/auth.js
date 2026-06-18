/**
 * Vercel Serverless Function: /api/auth
 *   POST - 校验 admin token
 */
import { checkAdminToken } from '../lib/auth.js'

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' })
  }
  if (checkAdminToken(req)) {
    return res.status(200).json({ ok: true })
  }
  return res.status(401).json({ ok: false, message: 'Token 错误' })
}
