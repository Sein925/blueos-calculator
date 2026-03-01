const cors = require('cors')
const { query } = require('./_lib/db')

const corsHandler = cors()

module.exports = async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const deviceId = req.query.deviceId
      if (!deviceId) {
        return res.status(400).json({ error: '缺少设备ID' })
      }

      const result = await query(
        'SELECT is_paid FROM users WHERE device_id = $1',
        [deviceId]
      )

      if (result.rows.length === 0) {
        return res.json({ isPaid: false })
      }

      res.json({ isPaid: !!result.rows[0].is_paid })
    } catch (err) {
      console.error('查询错误:', err)
      res.status(500).json({ error: '服务器错误' })
    }
  })
}
