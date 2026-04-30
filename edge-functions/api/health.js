import { kvGetUser, checkKVConfig } from '../_utils/kv.js';

export async function onRequestGet(context) {
  const now = new Date();
  const timestamp = now.toISOString();
  
  const kvCheck = checkKVConfig(context);
  let dbStatus = kvCheck.ok ? 'connected' : 'error';
  let dbMessage = kvCheck.ok ? 'KV storage is working' : kvCheck.message;
  let availableNamespaces = kvCheck.availableNamespaces || [];
  
  let testResult = 'not tested';
  
  if (kvCheck.ok) {
    try {
      await kvGetUser(context, 'test_health_check');
      testResult = 'ok';
    } catch (error) {
      testResult = 'error: ' + error.message;
    }
  }
  
  const responseData = {
    status: 'ok',
    message: '服务正常',
    timestamp: timestamp,
    version: '1.0.0',
    db: {
      type: 'KV',
      status: dbStatus,
      message: dbMessage,
      testResult: testResult,
      availableNamespaces: availableNamespaces
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
