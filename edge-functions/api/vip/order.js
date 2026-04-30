import { supabaseGet, supabaseInsert, supabaseUpdate } from '../../_utils/supabase.js';

export async function onRequestPost(context) {
  console.log('[Order] ===== 创建订单/更新VIP =====');
  
  try {
    const bodyText = await context.request.text();
    console.log('[Order] 原始请求体:', bodyText);
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      const searchParams = new URLSearchParams(bodyText);
      body = Object.fromEntries(searchParams.entries());
    }
    
    console.log('[Order] 解析后的参数:', body);
    
    const deviceId = body.device_id || body['device_id'];
    const packageType = body.package_type || body['package_type'];
    
    console.log('[Order] 设备ID:', deviceId, '套餐:', packageType);
    
    if (!deviceId || !packageType) {
      console.log('[Order] 参数不完整');
      return jsonResponse({
        success: false,
        message: '参数不完整',
        error_code: 'PARAMS_MISSING'
      }, 400);
    }
    
    const packagePrices = {
      'month': 1,
      'quarter': 3,
      'year': 12,
      'permanent': 999
    };
    
    if (!packagePrices[packageType]) {
      console.log('[Order] 套餐类型错误:', packageType);
      return jsonResponse({
        success: false,
        message: '套餐类型错误',
        error_code: 'PACKAGE_TYPE_INVALID'
      }, 400);
    }
    
    console.log('[Order] 查询用户是否存在...');
    let users = await supabaseGet('users', { device_id: deviceId });
    
    if (!users || users.length === 0) {
      console.log('[Order] 创建新用户...');
      await supabaseInsert('users', { device_id: deviceId });
      users = await supabaseGet('users', { device_id: deviceId });
    }
    
    const user = users[0];
    
    // 计算VIP过期时间
    let expireDate;
    const now = new Date();
    
    if (packageType === 'permanent') {
      // 永久会员，设置到2099年
      expireDate = new Date(2099, 11, 31);
    } else {
      // 普通套餐
      const addMonths = packagePrices[packageType];
      expireDate = new Date(now);
      expireDate.setMonth(expireDate.getMonth() + addMonths);
    }
    
    // 如果用户已经是VIP，在现有基础上延长
    if (user.is_vip && user.vip_expire_date) {
      const currentExpire = new Date(user.vip_expire_date);
      if (currentExpire > now) {
        // 现有VIP还没过期，从过期时间延长
        if (packageType === 'permanent') {
          expireDate = new Date(2099, 11, 31);
        } else {
          expireDate = new Date(currentExpire);
          expireDate.setMonth(expireDate.getMonth() + packagePrices[packageType]);
        }
      }
    }
    
    console.log('[Order] 更新用户VIP状态...');
    await supabaseUpdate('users', { device_id: deviceId }, {
      is_vip: true,
      vip_expire_date: expireDate.toISOString(),
      vip_updated_at: now.toISOString()
    });
    
    console.log('[Order] ===== 更新成功 =====');
    
    return jsonResponse({
      success: true,
      message: 'VIP更新成功',
      data: {
        device_id: deviceId,
        is_vip: true,
        expire_date: expireDate.toISOString()
      }
    });
    
  } catch (error) {
    console.error('[Order] ===== 更新失败 =====');
    console.error('[Order] 错误信息:', error);
    console.error('[Order] 错误堆栈:', error.stack);
    
    return jsonResponse({
      success: false,
      message: '服务器错误',
      error_code: 'SERVER_ERROR',
      error_details: error.message,
      error_stack: error.stack
    }, 500);
  }
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
  });
}
