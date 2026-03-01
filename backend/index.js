const express = require('express')
const mysql = require('mysql2')
const cors = require('cors')
const axios = require('axios')
const crypto = require('crypto')
const QRCode = require('qrcode')
const app = express()
const port = 3000

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const db = mysql.createConnection({
  host: 'mysql6.sqlpub.com',
  port: 3311,
  user: 'yikang666',
  password: 'TnNPu22ZC6lkFxKb',
  database: 'blueos_calculator'
})

const YI_PAY_CONFIG = {
  pid: '2134',
  key: 't6rrhSHssQohmRbsPsoPgS66GH60D60O',
  gateway: 'https://www.kuaizhifu.cn/submit.php',
  notifyUrl: 'http://你的服务器地址/api/payment/notify',
  returnUrl: 'http://你的服务器地址/api/payment/return'
}

db.connect((err) => {
  if (err) {
    console.error('数据库连接失败:', err)
    return
  }
  console.log('数据库连接成功')
  initTables()
})

function initTables() {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL UNIQUE,
      is_paid TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  
  const createOrdersTable = `
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_no VARCHAR(64) NOT NULL UNIQUE,
      device_id VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      pay_type VARCHAR(20),
      trade_no VARCHAR(128),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_order_no (order_no),
      INDEX idx_device_id (device_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  
  db.query(createUsersTable, (err) => {
    if (err) console.error('创建users表失败:', err)
  })
  
  db.query(createOrdersTable, (err) => {
    if (err) console.error('创建orders表失败:', err)
  })
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

app.get('/api/check-payment', (req, res) => {
  const deviceId = req.query.deviceId
  if (!deviceId) {
    return res.status(400).json({ error: '缺少设备ID' })
  }

  const query = 'SELECT is_paid FROM users WHERE device_id = ?'
  db.query(query, [deviceId], (err, results) => {
    if (err) {
      console.error('查询错误:', err)
      return res.status(500).json({ error: '服务器错误' })
    }

    if (results.length === 0) {
      return res.json({ isPaid: false })
    }

    res.json({ isPaid: !!results[0].is_paid })
  })
})

app.post('/api/create-order', async (req, res) => {
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

  const insertOrder = 'INSERT INTO orders (order_no, device_id, amount, pay_type, status) VALUES (?, ?, ?, ?, ?)'
  db.query(insertOrder, [orderNo, deviceId, amount, payType, 'pending'], async (err) => {
    if (err) {
      console.error('创建订单失败:', err)
      return res.status(500).json({ error: '创建订单失败' })
    }

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
  })
})

app.post('/api/payment/notify', (req, res) => {
  const params = req.body
  
  console.log('收到支付回调:', params)

  if (!verifySign(params, YI_PAY_CONFIG.key)) {
    return res.send('fail')
  }

  const { out_trade_no, trade_no, trade_status, money } = params

  if (trade_status !== 'TRADE_SUCCESS') {
    return res.send('fail')
  }

  db.beginTransaction((err) => {
    if (err) {
      console.error('事务开始失败:', err)
      return res.send('fail')
    }

    const checkOrder = 'SELECT * FROM orders WHERE order_no = ? AND status = ?'
    db.query(checkOrder, [out_trade_no, 'pending'], (err, results) => {
      if (err) {
        return db.rollback(() => res.send('fail'))
      }

      if (results.length === 0) {
        return db.commit(() => res.send('success'))
      }

      const deviceId = results[0].device_id

      const updateOrder = 'UPDATE orders SET status = ?, trade_no = ? WHERE order_no = ?'
      db.query(updateOrder, ['paid', trade_no, out_trade_no], (err) => {
        if (err) {
          return db.rollback(() => res.send('fail'))
        }

        const upsertUser = `
          INSERT INTO users (device_id, is_paid) 
          VALUES (?, 1) 
          ON DUPLICATE KEY UPDATE is_paid = 1, updated_at = CURRENT_TIMESTAMP
        `
        db.query(upsertUser, [deviceId], (err) => {
          if (err) {
            return db.rollback(() => res.send('fail'))
          }

          db.commit(() => res.send('success'))
        })
      })
    })
  })
})

app.get('/api/payment/return', (req, res) => {
  const params = req.query

  if (!verifySign(params, YI_PAY_CONFIG.key)) {
    return res.send('签名验证失败')
  }

  res.send('支付成功！请返回应用查看。')
})

app.get('/api/order-status', (req, res) => {
  const { orderNo } = req.query
  
  if (!orderNo) {
    return res.status(400).json({ error: '缺少订单号' })
  }

  const query = 'SELECT status FROM orders WHERE order_no = ?'
  db.query(query, [orderNo], (err, results) => {
    if (err) {
      console.error('查询订单失败:', err)
      return res.status(500).json({ error: '查询订单失败' })
    }

    if (results.length === 0) {
      return res.json({ status: 'not_found' })
    }

    res.json({ status: results[0].status })
  })
})

app.get('/api/qrcode', async (req, res) => {
  const { url } = req.query
  
  if (!url) {
    return res.status(400).json({ error: '缺少URL参数' })
  }

  try {
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

app.listen(port, '0.0.0.0', () => {
  console.log(`后端服务运行在 http://0.0.0.0:${port}`)
})
