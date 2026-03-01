const cors = require('cors')
const QRCode = require('qrcode')

const corsHandler = cors()

module.exports = async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { url } = req.query

      if (!url) {
        return res.status(400).json({ error: '缺少URL参数' })
      }

      const qrcodeDataUrl = await QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
      res.json({ qrcode: qrcodeDataUrl })
    } catch (err) {
      console.error('生成二维码失败:', err)
      res.status(500).json({ error: '生成二维码失败' })
    }
  })
}
