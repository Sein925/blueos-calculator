import { supabaseGet, supabaseInsert, supabaseUpdate } from '../../_utils/supabase.js';

const PLAN_TYPES = {
  'month': { type: 'month', months: 1 },
  'quarter': { type: 'quarter', months: 3 },
  'year': { type: 'year', months: 12 },
  'permanent': { type: 'permanent', months: 999 }
};

export const onRequestPost = async ({ request }) => {
  console.log('========================================');
  console.log('[Order] 创建订单/更新VIP');
  console.log('========================================');
  console.log('[Order] 请求时间:', new Date().toISOString());
  console.log('[Order] 请求方法:', request.method);
  console.log('[Order] 请求路径:', request.url);

  try {
    // 读取请求体
    const bodyText = await request.text();
    console.log('[Order] 原始请求体 (body):');
    console.log(bodyText);

    let body;
    try {
      body = JSON.parse(bodyText);
      console.log('[Order] 解析为JSON');
    } catch (e) {
      // 尝试解析为 form data
      const searchParams = new URLSearchParams(bodyText);
      body = Object.fromEntries(searchParams.entries());
      console.log('[Order] 解析为Form');
    }

    console.log('[Order] 解析后的参数 (body):');
    console.log(body);

    const deviceId = body.device_id || body['device_id'];
    const packageType = body.package_type || body['package_type'];

    console.log('[Order] 设备ID (device_id):', deviceId);
    console.log('[Order] 套餐类型 (package_type):', packageType);

    if (!deviceId || !packageType) {
      console.log('[Order] ❌ 参数不完整');
      return jsonResponse({
        success: false,
        message: '参数不完整',
        error_code: 'PARAMS_MISSING'
      }, 400);
    }

    if (!PLAN_TYPES[packageType]) {
      console.log('[Order] ❌ 套餐类型错误');
      return jsonResponse({
        success: false,
        message: '套餐类型错误',
        error_code: 'PACKAGE_TYPE_INVALID'
      }, 400);
    }

    console.log('[Order] 查询users表...');
    let users = await supabaseGet('users', { device_id: deviceId });
    console.log('[Order] 查询结果:', users);

    if (!users || users.length === 0) {
      console.log('[Order] 用户不存在，创建新用户...');
      await supabaseInsert('users', { device_id: deviceId });
      users = await supabaseGet('users', { device_id: deviceId });
      console.log('[Order] 创建用户后的结果:', users);
    }

    const user = users[0];
    console.log('[Order] 当前用户:', user);

    const selectedPlan = PLAN_TYPES[packageType];
    const now = new Date();
    let expireDate;

    if (selectedPlan.type === 'permanent') {
      expireDate = new Date(2099, 11, 31);
      console.log('[Order] 永久会员，到期时间:', expireDate);
    } else {
      expireDate = new Date(now);
      expireDate.setMonth(expireDate.getMonth() + selectedPlan.months);
      console.log('[Order] 普通会员，新增', selectedPlan.months, '个月，到期时间:', expireDate);
    }

    if (user.is_vip && user.vip_expire_date) {
      const currentExpire = new Date(user.vip_expire_date);
      console.log('[Order] 用户已经是VIP，当前到期时间:', currentExpire);

      if (currentExpire > now) {
        console.log('[Order] VIP未过期，在现有基础上延长');
        if (selectedPlan.type === 'permanent') {
          expireDate = new Date(2099, 11, 31);
        } else {
          expireDate = new Date(currentExpire);
          expireDate.setMonth(expireDate.getMonth() + selectedPlan.months);
        }
        console.log('[Order] 延长后的到期时间:', expireDate);
      }
    }

    console.log('[Order] 准备更新users表...');
    await supabaseUpdate('users', { device_id: deviceId }, {
      is_vip: true,
      vip_expire_date: expireDate.toISOString(),
      vip_updated_at: now.toISOString()
    });

    console.log('========================================');
    console.log('[Order] 更新成功');
    console.log('========================================');

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
    console.log('========================================');
    console.log('[Order] 更新失败');
    console.log('========================================');
    console.error('[Order] 错误信息:', error.message);
    console.error('[Order] 错误堆栈:', error.stack);

    return jsonResponse({
      success: false,
      message: '服务器错误',
      error_code: 'SERVER_ERROR',
      error_details: error.message
    }, 500);
  }
};

function jsonResponse(data, status = 200) {
  console.log('[Order] 返回响应:', JSON.stringify(data), '状态码:', status);
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
