export function generateSign(params, key) {
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
  
  const encoder = new TextEncoder();
  const data = encoder.encode(signStr);
  
  return crypto.subtle.digest('MD5', data)
    .then(hash => {
      const hashArray = Array.from(new Uint8Array(hash));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    });
}

export function verifySign(params, key, sign) {
  return generateSign(params, key).then(calculatedSign => {
    return calculatedSign.toLowerCase() === sign.toLowerCase();
  });
}

export function generateOrderId() {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CAL${timestamp}${random}`;
}
