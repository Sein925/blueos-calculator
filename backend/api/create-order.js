const cors = require('cors')
const axios = require('axios')
const { query } = require('./_lib/db')
const { generateOrderNo, generateSign, YI_PAY_CONFIG } = require('./_lib/utils')

const corsHandler = cors()

module.exports = async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { deviceId, amount = 1.00, payType = 'wxpay' } = req.body

      if (!deviceId) {
        return res.status(400).json({ error: '缺少设备ID' })
      }

      const orderNo = generateOrderNo()

      const orderParams = {
        pid: YI_PAY_CONFIG.pid,
        type: payType,
        out_trade_no: orderNo,
        notify_url: YI_PAY_CONFIG.notifyUrl,
        return_url: YI_PAY_CONFIG.returnUrl,
        name: '科学计算器开通',
        money: amount.toFixed(2),
        device_id: deviceId
      }

      orderParams.sign = generateSign(orderParams, YI_PAY_CONFIG.key)
      orderParams.sign_type = 'MD5'

      await query(
        'INSERT INTO orders (order_no, device_id, amount, pay_type, status) VALUES ($1, $2, $3, $4, $5)',
        [orderNo, deviceId, amount, payType, 'pending']
      )

      const longPayUrl = YI_PAY_CONFIG.gateway + '?' + new URLSearchParams(orderParams).toString()

      let shortPayUrl = longPayUrl
      try {
        const dwzResponse = await axios.get('https://api.mmp.cc/api/dwz', {
          params: { longurl: longPayUrl }
        })
        if (dwzResponse.data && dwzResponse.data.status === 200 && dwzResponse.data.shorturl) {
          shortPayUrl = dwzResponse.data.shorturl
        }
      } catch (dwzErr) {
        console.error('短网址生成失败，使用原链接:', dwzErr.message)
      }

      res.json({
        success: true,
        orderNo: orderNo,
        payUrl: shortPayUrl,
        originalPayUrl: longPayUrl
      })
    } catch (err) {
      console.error('创建订单失败:', err)
      res.status(500).json({ error: '创建订单失败' })
    }
  })
}
