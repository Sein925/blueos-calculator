const cors = require('cors')
const { verifySign, YI_PAY_CONFIG } = require('../_lib/utils')

const corsHandler = cors()

module.exports = async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const params = req.query

      if (!verifySign(params, YI_PAY_CONFIG.key)) {
        return res.send('签名验证失败')
      }

      res.send('支付成功！请返回应用查看。')
    } catch (err) {
      console.error('返回处理失败:', err)
      res.send('处理失败')
    }
  })
}
