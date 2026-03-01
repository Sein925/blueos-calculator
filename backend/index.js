require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const axios = require('axios')
const crypto = require('crypto')
const QRCode = require('qrcode')
const app = express()
const port = 3000

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

let pool
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  })
}

async function query(text, params) {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    console.log('Executed query', { text, duration, rows: res.rowCount })
    return res
  } catch (err) {
    console.error('Database query error', { text, err })
    throw err
  }
}

async function initTables() {
  if (!pool) return

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL UNIQUE,
      is_paid BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `

  const createOrdersTable = `
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_no VARCHAR(64) NOT NULL UNIQUE,
      device_id VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      pay_type VARCHAR(20),
      trade_no VARCHAR(128),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `

  const createOrderNoIndex = `
    CREATE INDEX IF NOT EXISTS idx_order_no ON orders(order_no)
  `

  const createDeviceIdIndex = `
    CREATE INDEX IF NOT EXISTS idx_device_id ON orders(device_id)
  `

  try {
    await query(createUsersTable)
    await query(createOrdersTable)
    await query(createOrderNoIndex)
    await query(createDeviceIdIndex)
    console.log('Tables initialized successfully')
  } catch (err) {
    console.error('Error initializing tables:', err)
  }
}

function generateOrderNo() {
  const date = new Date()
  const timestamp = date.getTime().toString()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return 'CALC' + timestamp + random
}

function generateSign(params, key) {
  const sortedParams = Object.keys(params)
    .filter(key => params[key] !== '' && key !== 'sign' && key !== 'sign_type')
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&')
  return crypto.createHash('md5').update(sortedParams + key).digest('hex')
}

function verifySign(params, key) {
  const sign = params.sign
  const generatedSign = generateSign(params, key)
  return sign === generatedSign
}

const YI_PAY_CONFIG = {
  pid: process.env.YI_PAY_PID || '2134',
  key: process.env.YI_PAY_KEY || 't6rrhSHssQohmRbsPsoPgS66GH60D60O',
  gateway: process.env.YI_PAY_GATEWAY || 'https://www.kuaizhifu.cn/submit.php',
  notifyUrl: process.env.YI_PAY_NOTIFY_URL,
  returnUrl: process.env.YI_PAY_RETURN_URL
}

app.get('/api/check-payment', async (req, res) => {
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

app.post('/api/create-order', async (req, res) => {
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

app.post('/api/payment/notify', async (req, res) => {
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

    const client = await pool.connect()

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

app.get('/api/payment/return', (req, res) => {
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

app.get('/api/order-status', async (req, res) => {
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

app.get('/api/qrcode', async (req, res) => {
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

if (pool) {
  initTables().then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`后端服务运行在 http://localhost:${port}`)
    })
  })
} else {
  console.log('警告：未配置 DATABASE_URL，无法启动数据库连接')
  app.listen(port, '0.0.0.0', () => {
    console.log(`后端服务运行在 http://localhost:${port}（无数据库模式）`)
  })
}
