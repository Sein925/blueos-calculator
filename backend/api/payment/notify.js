const cors = require('cors')
const { query, getPool } = require('../_lib/db')
const { verifySign, YI_PAY_CONFIG } = require('../_lib/utils')

const corsHandler = cors()

module.exports = async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const params = req.body

      console.log('收到支付回调:', params)

      if (!verifySign(params, YI_PAY_CONFIG.key)) {
        return res.send('fail')
      }

      const { out_trade_no, trade_no, trade_status } = params

      if (trade_status !== 'TRADE_SUCCESS') {
        return res.send('fail')
      }

      const client = await getPool().connect()

      try {
        await client.query('BEGIN')

        const checkResult = await client.query(
          'SELECT * FROM orders WHERE order_no = $1 AND status = $2',
          [out_trade_no, 'pending']
        )

        if (checkResult.rows.length === 0) {
          await client.query('COMMIT')
          return res.send('success')
        }

        const deviceId = checkResult.rows[0].device_id

        await client.query(
          'UPDATE orders SET status = $1, trade_no = $2, updated_at = CURRENT_TIMESTAMP WHERE order_no = $3',
          ['paid', trade_no, out_trade_no]
        )

        await client.query(
          `INSERT INTO users (device_id, is_paid) 
           VALUES ($1, true) 
           ON CONFLICT (device_id) 
           DO UPDATE SET is_paid = true, updated_at = CURRENT_TIMESTAMP`,
          [deviceId]
        )

        await client.query('COMMIT')
        res.send('success')
      } catch (err) {
        await client.query('ROLLBACK')
        console.error('事务处理失败:', err)
        res.send('fail')
      } finally {
        client.release()
      }
    } catch (err) {
      console.error('回调处理失败:', err)
      res.send('fail')
    }
  })
}
