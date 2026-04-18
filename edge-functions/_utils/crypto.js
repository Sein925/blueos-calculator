import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadMerchantPrivateKey() {
  const privateKeyPath = join(__dirname, '../../payment_keys/merchant_private.pem');
  return readFileSync(privateKeyPath, 'utf8');
}

function loadPlatformPublicKey() {
  const publicKeyPath = join(__dirname, '../../payment_keys/platform_public.pem');
  return readFileSync(publicKeyPath, 'utf8');
}

async function importPrivateKey(pem) {
  const keyData = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const keyBuffer = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );
}

async function importPublicKey(pem) {
  const keyData = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');
  const keyBuffer = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'spki',
    keyBuffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['verify']
  );
}

export async function generateSign(params, keyOrPem) {
  console.log('[Crypto] 使用商户私钥生成RSA签名，参数:', params);
  
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
  
  console.log('[Crypto] 签名字符串:', signStr);
  
  try {
    const privateKey = await importPrivateKey(loadMerchantPrivateKey());
    const encoder = new TextEncoder();
    const data = encoder.encode(signStr);
    
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      data
    );
    
    const signatureArray = Array.from(new Uint8Array(signature));
    const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
    
    console.log('[Crypto] RSA签名成功');
    return signatureBase64;
  } catch (error) {
    console.error('[Crypto] RSA签名失败:', error);
    throw error;
  }
}

export async function verifySign(params, keyOrPem, sign) {
  console.log('[Crypto] 使用平台公钥验证RSA签名');
  
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
  
  console.log('[Crypto] 待验证字符串:', signStr);
  
  try {
    const publicKey = await importPublicKey(loadPlatformPublicKey());
    const encoder = new TextEncoder();
    const data = encoder.encode(signStr);
    const signatureBuffer = Uint8Array.from(atob(sign), c => c.charCodeAt(0));
    
    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signatureBuffer,
      data
    );
    
    console.log('[Crypto] RSA签名验证结果:', isValid);
    return isValid;
  } catch (error) {
    console.error('[Crypto] RSA签名验证失败:', error);
    return false;
  }
}

export function generateOrderId() {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const orderId = `CAL${timestamp}${random}`;
  console.log('[Crypto] 生成订单号:', orderId);
  return orderId;
}
