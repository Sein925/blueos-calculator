export function onRequest(context) {
  const now = new Date();
  const timestamp = now.toISOString();
  const request = context.request;
  
  // 记录详细的请求日志
  console.log('========================================');
  console.log('[Health] 收到健康检查请求');
  console.log('========================================');
  console.log('[Health] 请求时间:', timestamp);
  console.log('[Health] 请求方法:', request.method);
  console.log('[Health] 请求路径:', request.url);
  console.log('[Health] 请求头:', JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));
  console.log('[Health] 客户端IP:', request.headers.get('cf-connecting-ip') || 'unknown');
  console.log('[Health] User-Agent:', request.headers.get('user-agent') || 'unknown');
  
  const responseData = {
    status: 'ok',
    message: '服务正常',
    timestamp: timestamp,
    version: '1.0.0'
  };
  
  console.log('[Health] 响应数据:', JSON.stringify(responseData, null, 2));
  console.log('[Health] 响应状态码: 200');
  console.log('========================================');
  console.log('[Health] 请求处理完成');
  console.log('========================================');
  
  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
