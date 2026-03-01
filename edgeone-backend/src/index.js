import { createHash } from 'crypto'

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
  return createHash('md5').update(sortedParams + key).digest('hex')
}

function verifySign(params, key) {
  const sign = params.sign
  const generatedSign = generateSign(params, key)
  return sign === generatedSign
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url)
  const path = url.pathname

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  }

  if (path === '/') {
    return htmlResponse(getIndexHtml())
  }

  if (path === '/pay') {
    return htmlResponse(getPayHtml())
  }

  if (path === '/api/check-payment') {
    return handleCheckPayment(url, env)
  }

  if (path === '/api/create-order' && request.method === 'POST') {
    return handleCreateOrder(request, env)
  }

  if (path === '/api/payment/notify' && request.method === 'POST') {
    return handlePaymentNotify(request, env)
  }

  if (path === '/api/payment/return') {
    return handlePaymentReturn(url, env)
  }

  if (path === '/api/order-status') {
    return handleOrderStatus(url, env)
  }

  return jsonResponse({ error: 'Not Found' }, 404)
}

async function handleCheckPayment(url, env) {
  const deviceId = url.searchParams.get('deviceId')
  if (!deviceId) {
    return jsonResponse({ error: '缺少设备ID' }, 400)
  }

  const userKey = `user:${deviceId}`
  const userData = await env.KV_CALCULATOR.get(userKey, { type: 'json' })

  if (!userData) {
    return jsonResponse({ isPaid: false })
  }

  return jsonResponse({ isPaid: !!userData.isPaid })
}

async function handleCreateOrder(request, env) {
  try {
    const body = await request.json()
    const { deviceId, amount = 1.00, payType = 'wxpay' } = body

    if (!deviceId) {
      return jsonResponse({ error: '缺少设备ID' }, 400)
    }

    const orderNo = generateOrderNo()

    const orderParams = {
      pid: env.YI_PAY_PID,
      type: payType,
      out_trade_no: orderNo,
      notify_url: env.YI_PAY_NOTIFY_URL,
      return_url: env.YI_PAY_RETURN_URL,
      name: '科学计算器开通',
      money: amount.toFixed(2),
      device_id: deviceId
    }

    orderParams.sign = generateSign(orderParams, env.YI_PAY_KEY)
    orderParams.sign_type = 'MD5'

    const orderData = {
      orderNo,
      deviceId,
      amount,
      payType,
      status: 'pending',
      createdAt: new Date().toISOString()
    }

    await env.KV_CALCULATOR.put(`order:${orderNo}`, JSON.stringify(orderData))

    const longPayUrl = env.YI_PAY_GATEWAY + '?' + new URLSearchParams(orderParams).toString()

    let shortPayUrl = longPayUrl
    try {
      const dwzResponse = await fetch('https://api.mmp.cc/api/dwz?longurl=' + encodeURIComponent(longPayUrl))
      const dwzData = await dwzResponse.json()
      if (dwzData && dwzData.status === 200 && dwzData.shorturl) {
        shortPayUrl = dwzData.shorturl
      }
    } catch (dwzErr) {
      console.error('短网址生成失败，使用原链接:', dwzErr)
    }

    return jsonResponse({
      success: true,
      orderNo: orderNo,
      payUrl: shortPayUrl,
      originalPayUrl: longPayUrl
    })
  } catch (err) {
    console.error('创建订单失败:', err)
    return jsonResponse({ error: '创建订单失败' }, 500)
  }
}

async function handlePaymentNotify(request, env) {
  try {
    const formData = await request.formData()
    const params = Object.fromEntries(formData.entries())

    console.log('收到支付回调:', params)

    if (!verifySign(params, env.YI_PAY_KEY)) {
      return new Response('fail')
    }

    const { out_trade_no, trade_no, trade_status } = params

    if (trade_status !== 'TRADE_SUCCESS') {
      return new Response('fail')
    }

    const orderKey = `order:${out_trade_no}`
    const orderData = await env.KV_CALCULATOR.get(orderKey, { type: 'json' })

    if (!orderData || orderData.status !== 'pending') {
      return new Response('success')
    }

    const deviceId = orderData.deviceId

    orderData.status = 'paid'
    orderData.tradeNo = trade_no
    orderData.updatedAt = new Date().toISOString()
    await env.KV_CALCULATOR.put(orderKey, JSON.stringify(orderData))

    const userKey = `user:${deviceId}`
    const userData = {
      deviceId,
      isPaid: true,
      updatedAt: new Date().toISOString()
    }
    await env.KV_CALCULATOR.put(userKey, JSON.stringify(userData))

    return new Response('success')
  } catch (err) {
    console.error('回调处理失败:', err)
    return new Response('fail')
  }
}

async function handlePaymentReturn(url, env) {
  try {
    const params = Object.fromEntries(url.searchParams.entries())

    if (!verifySign(params, env.YI_PAY_KEY)) {
      return htmlResponse('<h1>签名验证失败</h1>')
    }

    return htmlResponse(getSuccessHtml())
  } catch (err) {
    console.error('返回处理失败:', err)
    return htmlResponse('<h1>处理失败</h1>')
  }
}

async function handleOrderStatus(url, env) {
  const orderNo = url.searchParams.get('orderNo')

  if (!orderNo) {
    return jsonResponse({ error: '缺少订单号' }, 400)
  }

  const orderKey = `order:${orderNo}`
  const orderData = await env.KV_CALCULATOR.get(orderKey, { type: 'json' })

  if (!orderData) {
    return jsonResponse({ status: 'not_found' })
  }

  return jsonResponse({ status: orderData.status })
}

function getIndexHtml() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>科学计算器后端</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 60px 40px;
      max-width: 500px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    h1 {
      color: #333;
      font-size: 32px;
      margin-bottom: 20px;
    }
    .icon {
      font-size: 80px;
      margin-bottom: 20px;
    }
    p {
      color: #666;
      font-size: 16px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔢</div>
    <h1>科学计算器</h1>
    <p>后端服务运行正常</p>
  </div>
</body>
</html>
`
}

function getPayHtml() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>科学计算器 - 开通支付</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 60px 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .icon {
      font-size: 80px;
      margin-bottom: 20px;
    }
    h1 {
      color: #333;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .subtitle {
      color: #666;
      font-size: 16px;
      margin-bottom: 30px;
    }
    .price {
      font-size: 48px;
      font-weight: bold;
      color: #07c160;
      margin-bottom: 30px;
    }
    .price small {
      font-size: 24px;
    }
    .success-section {
      display: none;
    }
    .success-section.show {
      display: block;
    }
    .success-icon {
      font-size: 80px;
      margin-bottom: 20px;
    }
    .success-title {
      color: #27ae60;
      font-size: 28px;
      margin-bottom: 15px;
    }
    .success-desc {
      color: #666;
      font-size: 16px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="main-section">
      <div class="icon">🔢</div>
      <h1>科学计算器</h1>
      <p class="subtitle">开通完整功能，解锁高级计算</p>
      <div class="price"><small>¥</small>1.00</div>
      <p>请返回手表应用扫码支付</p>
    </div>
    <div class="success-section">
      <div class="success-icon">✅</div>
      <div class="success-title">支付成功！</div>
      <p class="success-desc">请返回手表应用查看</p>
    </div>
  </div>
</body>
</html>
`
}

function getSuccessHtml() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>支付成功</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 60px 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .icon {
      font-size: 80px;
      margin-bottom: 20px;
    }
    h1 {
      color: #27ae60;
      font-size: 28px;
      margin-bottom: 15px;
    }
    .description {
      color: #666;
      font-size: 16px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✅</div>
    <h1>支付成功！</h1>
    <p class="description">请返回手表应用，计算器功能已解锁</p>
  </div>
</body>
</html>
`
}

export default {
  fetch: handleRequest
}
