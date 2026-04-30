const { supabaseGet } = require('./utils/supabase');

exports.main = async (event, context) => {
  const now = new Date();
  const timestamp = now.toISOString();
  
  // 记录详细的请求日志
  console.log('========================================');
  console.log('[Health] 收到健康检查请求');
  console.log('========================================');
  console.log('[Health] 请求时间:', timestamp);
  console.log('[Health] 请求方法:', event.httpMethod);
  console.log('[Health] 请求路径:', event.path);
  console.log('[Health] 请求头:', JSON.stringify(event.headers, null, 2));
  console.log('[Health] 查询参数:', JSON.stringify(event.queryString, null, 2));
  console.log('[Health] 客户端IP:', event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown');
  console.log('[Health] User-Agent:', event.headers['user-agent'] || 'unknown');
  
  // 测试数据库连接
  let dbStatus = 'unknown';
  try {
    const users = await supabaseGet('users', {}, { limit: 1 });
    dbStatus = 'connected';
    console.log('[Health] 数据库连接正常');
  } catch (error) {
    dbStatus = 'error';
    console.log('[Health] 数据库连接失败:', error.message);
  }
  
  const responseData = {
    status: 'ok',
    message: '服务正常',
    timestamp: timestamp,
    version: '1.0.0',
    dbStatus: dbStatus,
    requestInfo: {
      method: event.httpMethod,
      path: event.path,
      query: event.queryString,
      headers: {
        'user-agent': event.headers['user-agent'],
        'x-forwarded-for': event.headers['x-forwarded-for']
      }
    }
  };
  
  console.log('[Health] 响应数据:', JSON.stringify(responseData, null, 2));
  console.log('[Health] 响应状态码: 200');
  console.log('========================================');
  console.log('[Health] 请求处理完成');
  console.log('========================================');
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(responseData)
  };
};
