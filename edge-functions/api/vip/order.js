import { kvGetUser, kvInsertUser, kvUpdateUser } from '../../_utils/kv.js';

const PLAN_TYPES = {
  'month': { type: 'month', months: 1 },
  'quarter': { type: 'quarter', months: 3 },
  'year': { type: 'year', months: 12 },
  'permanent': { type: 'permanent', months: 999 }
};

export async function onRequestPost(context) {
  try {
    const bodyText = await context.request.text();

    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      const searchParams = new URLSearchParams(bodyText);
      body = Object.fromEntries(searchParams.entries());
    }

    const deviceId = body.device_id || body['device_id'];
    const packageType = body.package_type || body['package_type'];

    if (!deviceId || !packageType) {
      return new Response(JSON.stringify({
        success: false,
        message: '参数不完整',
        error_code: 'PARAMS_MISSING'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (!PLAN_TYPES[packageType]) {
      return new Response(JSON.stringify({
        success: false,
        message: '套餐类型错误',
        error_code: 'PACKAGE_TYPE_INVALID'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    let user = await kvGetUser(context, deviceId);

    if (!user) {
      user = await kvInsertUser(context, deviceId);
    }

    const selectedPlan = PLAN_TYPES[packageType];
    const now = new Date();
    let expireDate;

    if (selectedPlan.type === 'permanent') {
      expireDate = new Date(2099, 11, 31);
    } else {
      expireDate = new Date(now);
      expireDate.setMonth(expireDate.getMonth() + selectedPlan.months);
    }

    if (user && user.is_vip && user.vip_expire_date) {
      const currentExpire = new Date(user.vip_expire_date);
      
      if (currentExpire > now) {
        if (selectedPlan.type === 'permanent') {
          expireDate = new Date(2099, 11, 31);
        } else {
          expireDate = new Date(currentExpire);
          expireDate.setMonth(expireDate.getMonth() + selectedPlan.months);
        }
      }
    }

    const updatedUser = await kvUpdateUser(context, deviceId, {
      is_vip: true,
      vip_expire_date: expireDate.toISOString(),
      vip_updated_at: now.toISOString()
    });

    if (!updatedUser) {
      return new Response(JSON.stringify({
        success: false,
        message: '数据存储失败，请确保KV已配置',
        error_code: 'STORAGE_ERROR'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'VIP更新成功',
      data: {
        device_id: deviceId,
        is_vip: true,
        expire_date: expireDate.toISOString()
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: '服务器错误',
      error_code: 'SERVER_ERROR',
      error_details: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
