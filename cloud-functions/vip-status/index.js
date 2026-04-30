const { supabaseGet } = require('./utils/supabase');

exports.main = async (event, context) => {
  console.log('========================================');
  console.log('[Status] 查询VIP状态');
  console.log('========================================');
  console.log('[Status] 请求时间:', new Date().toISOString());
  console.log('[Status] 请求方法:', event.httpMethod);
  console.log('[Status] 请求路径:', event.path);
  console.log('[Status] 查询参数:', JSON.stringify(event.queryString, null, 2));

  try {
    // 从路径参数或查询参数获取 device_id
    let deviceId = '';
    
    // 尝试从路径获取（如 /vip-status/12345）
    if (event.pathParameters && event.pathParameters.device_id) {
      deviceId = event.pathParameters.device_id;
    }
    // 尝试从查询参数获取（如 /vip-status?device_id=12345）
    else if (event.queryString && event.queryString.device_id) {
      deviceId = event.queryString.device_id;
    }
    // 尝试从路径解析（Cloud Functions 可能将路径参数放在不同位置）
    else {
      const pathParts = event.path.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && lastPart !== 'vip-status') {
        deviceId = lastPart;
      }
    }

    console.log('[Status] 查询设备ID:', deviceId);

    if (!deviceId) {
      console.log('[Status] ❌ 缺少 device_id');
      return jsonResponse({
        success: false,
        message: '缺少 device_id 参数',
        error_code: 'MISSING_DEVICE_ID'
      }, 400);
    }

    console.log('[Status] 查询users表...');
    const users = await supabaseGet('users', { device_id: deviceId });
    console.log('[Status] 查询结果:', users);

    let isVip = false;
    let expireDate = null;

    if (users && users.length > 0) {
      const user = users[0];
      console.log('[Status] 用户信息:', user);

      isVip = user.is_vip === true;

      if (isVip && user.vip_expire_date) {
        expireDate = user.vip_expire_date;
        console.log('[Status] VIP过期时间:', expireDate);

        // 检查是否过期
        const now = new Date();
        const expireDateObj = new Date(expireDate);
        if (now > expireDateObj) {
          console.log('[Status] VIP已过期，设置为非VIP');
          isVip = false;
          expireDate = null;
        }
      }
    } else {
      console.log('[Status] 未找到用户');
    }

    console.log('[Status] 最终VIP状态:', isVip);
    console.log('[Status] 最终过期时间:', expireDate);
    console.log('========================================');
    console.log('[Status] 查询VIP状态成功');
    console.log('========================================');

    return jsonResponse({
      success: true,
      is_vip: isVip,
      expire_date: expireDate
    });

  } catch (error) {
    console.log('========================================');
    console.log('[Status] 查询VIP状态失败');
    console.log('========================================');
    console.error('[Status] 错误信息:', error.message);
    console.error('[Status] 错误堆栈:', error.stack);

    return jsonResponse({
      success: false,
      message: '服务器错误',
      error_code: 'SERVER_ERROR',
      error_details: error.message
    }, 500);
  }
};

function jsonResponse(data, status = 200) {
  console.log('[Status] 返回响应:', JSON.stringify(data), '状态码:', status);
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(data)
  };
}
