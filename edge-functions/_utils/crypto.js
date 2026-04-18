export async function generateSign(params, key) {
  console.log('[Crypto] 生成签名，参数:', params);
  
  const sortedKeys = Object.keys(params).sort();
  let signStr = '';
  
  for (const k of sortedKeys) {
    if (k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] !== null && params[k] !== undefined) {
      if (signStr) {
        signStr += '&';
      }
      signStr += `${k}=${params[k]}`;
    }
  }
  
  signStr += key;
  console.log('[Crypto] 签名字符串:', signStr);
  
  const encoder = new TextEncoder();
  const data = encoder.encode(signStr);
  
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  console.log('[Crypto] 生成的签名:', hashHex);
  return hashHex;
}

export async function verifySign(params, key, sign) {
  console.log('[Crypto] 验证签名');
  
  const calculatedSign = await generateSign(params, key);
  const isValid = calculatedSign.toLowerCase() === sign.toLowerCase();
  
  console.log('[Crypto] 签名验证结果:', isValid);
  return isValid;
}

export function generateOrderId() {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const orderId = `CAL${timestamp}${random}`;
  console.log('[Crypto] 生成订单号:', orderId);
  return orderId;
}
