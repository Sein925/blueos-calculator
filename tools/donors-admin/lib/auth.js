/**
 * Token 鉴权工具（同时供 server.js 和 api/*.js 使用）
 */
import crypto from 'node:crypto'

export function resolveAdminToken() {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN
  if (process.env.DONORS_ADMIN_TOKEN) return process.env.DONORS_ADMIN_TOKEN
  return crypto.randomBytes(8).toString('hex')
}

export function checkAdminToken(req) {
  const headerToken = req.headers['x-token']
  const bodyToken = req.body && req.body.token
  const token = headerToken || bodyToken
  const expected = resolveAdminToken()
  if (!token || token !== expected) return false
  return true
}
