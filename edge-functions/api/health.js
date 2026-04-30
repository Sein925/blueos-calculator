import { kvGetUser } from '../_utils/kv.js';

export async function onRequestGet(context) {
  const now = new Date();
  const timestamp = now.toISOString();
  
  let dbStatus = 'unknown';
  let dbMessage = '';
  
  try {
    await kvGetUser(context, 'test_health_check');
    dbStatus = 'connected';
    dbMessage = 'KV storage is working';
  } catch (error) {
    dbStatus = 'error';
    dbMessage = 'KV not configured or error: ' + error.message;
  }
  
  const responseData = {
    status: 'ok',
    message: '服务正常',
    timestamp: timestamp,
    version: '1.0.0',
    db: {
      type: 'KV',
      status: dbStatus,
      message: dbMessage
    }
  };
  
  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
