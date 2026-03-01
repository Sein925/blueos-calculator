const crypto = require('crypto')

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

module.exports = {
  generateOrderNo,
  generateSign,
  verifySign,
  YI_PAY_CONFIG
}
