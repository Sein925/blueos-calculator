const cors = require('cors')
const { query } = require('./_lib/db')

const corsHandler = cors()

module.exports = async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { orderNo } = req.query

      if (!orderNo) {
        return res.status(400).json({ error: '缺少订单号' })
      }

      const result = await query(
        'SELECT status FROM orders WHERE order_no = $1',
        [orderNo]
      )

      if (result.rows.length === 0) {
        return res.json({ status: 'not_found' })
      }

      res.json({ status: result.rows[0].status })
    } catch (err) {
      console.error('查询订单失败:', err)
      res.status(500).json({ error: '查询订单失败' })
    }
  })
}
