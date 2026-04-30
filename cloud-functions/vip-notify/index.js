const { supabaseGet, supabaseInsert, supabaseUpdate } = require('./utils/supabase');

// 套餐配置：通过爱发电的 plan_id 匹配
const PLAN_CONFIG = {
  // 将爱发电商品的 plan_id 填在这里
  // 'your_plan_id': { type: 'month', months: 1 }
};

exports.main = async (event, context) => {
  const requestStartTime = Date.now();
  console.log('========================================');
  console.log('[Notify] 收到爱发电Webhook请求');
  console.log('========================================');
  console.log('[Notify] 请求时间:', new Date().toISOString());
  console.log('[Notify] 请求方法:', event.httpMethod);
  console.log('[Notify] 请求路径:', event.path);
  console.log('[Notify] 请求头:', JSON.stringify(event.headers, null, 2));
  console.log('[Notify] 查询参数:', JSON.stringify(event.queryString, null, 2));

  try {
    // 读取请求体
    let bodyText = '';
    if (event.body) {
      bodyText = Buffer.isBuffer(event.body) ? event.body.toString() : event.body;
    }
    console.log('[Notify] 原始请求体 (body):');
    console.log(bodyText);

    // 尝试解析JSON
    let data;
    try {
      data = JSON.parse(bodyText);
      console.log('[Notify] JSON解析成功');
    } catch (e) {
      console.log('[Notify] JSON解析失败:', e.message);
      return jsonResponse({ ec: 400, em: 'Invalid JSON' }, 400);
    }

    console.log('[Notify] 完整数据 (data):');
    console.log(JSON.stringify(data, null, 2));

    // 检查爱发电响应码
    if (data.ec !== 200) {
      console.log('[Notify] 爱发电返回错误 ec:', data.ec, ', em:', data.em);
      return jsonResponse({ ec: 200, em: 'Received but error' });
    }

    // 获取订单对象
    const order = data?.data?.order;
    console.log('[Notify] 订单对象 (data.data.order):', order ? '存在' : '不存在');

    if (!order) {
      console.log('[Notify] ❌ 没有找到订单信息');
      return jsonResponse({ ec: 200, em: 'No order data' });
    }

    console.log('[Notify] 订单详情 (order):');
    console.log(JSON.stringify(order, null, 2));

    // 检查订单状态
    const orderStatus = order.status;
    console.log('[Notify] 订单状态 (status):', orderStatus);

    if (orderStatus !== 2) {
      console.log('[Notify] ⚠️  订单状态不是成功（2），忽略此通知');
      return jsonResponse({ ec: 200, em: 'Status not success' });
    }

    // 提取 plan_id
    const planId = order.plan_id || '';
    console.log('[Notify] 商品 plan_id:', planId);

    // 通过 plan_id 获取套餐配置
    if (!planId) {
      console.log('[Notify] ❌ 订单中没有 plan_id');
      return jsonResponse({ ec: 200, em: 'No plan_id' });
    }

    if (!PLAN_CONFIG[planId]) {
      console.log('[Notify] ❌ plan_id 未配置:', planId);
      console.log('[Notify] 当前配置的 plan_id:', Object.keys(PLAN_CONFIG));
      return jsonResponse({ ec: 200, em: 'Plan not configured' });
    }

    const selectedPlan = PLAN_CONFIG[planId];
    console.log('[Notify] ✅ 通过 plan_id 匹配到套餐:', selectedPlan);

    // 提取 device_id
    let deviceId = '';
    const remark = order.remark || '';
    const customOrderId = order.custom_order_id || '';

    console.log('[Notify] 备注内容 (remark):', remark);
    console.log('[Notify] 自定义订单ID (custom_order_id):', customOrderId);

    const deviceIdMatch = remark.match(/device_id[=:]\s*([^\s&]+)/i);

    if (deviceIdMatch) {
      deviceId = deviceIdMatch[1].trim();
      console.log('[Notify] ✅ 从备注中找到 device_id:', deviceId);
    } else if (remark.trim()) {
      deviceId = remark.trim();
      console.log('[Notify] ⚠️  没有找到 device_id，直接使用备注内容:', deviceId);
    } else if (customOrderId) {
      deviceId = customOrderId;
      console.log('[Notify] ⚠️  从 custom_order_id 获取 device_id:', deviceId);
    } else {
      console.log('[Notify] ❌ 没有找到任何设备ID');
    }

    console.log('[Notify] 最终的 device_id:', deviceId);

    if (!deviceId) {
      console.log('[Notify] ❌ 设备ID为空，无法处理');
      return jsonResponse({ ec: 200, em: 'No device ID' });
    }

    // 更新VIP
    console.log('[Notify] 开始更新VIP...');
    await updateVip(deviceId, selectedPlan);

    const requestEndTime = Date.now();
    console.log('[Notify] 请求处理耗时:', requestEndTime - requestStartTime, 'ms');
    console.log('========================================');
    console.log('[Notify] Webhook处理完成，返回成功');
    console.log('========================================');

    return jsonResponse({ ec: 200, em: 'ok' });

  } catch (error) {
    console.log('========================================');
    console.log('[Notify] Webhook处理发生错误');
    console.log('========================================');
    console.error('[Notify] 错误信息 (message):', error.message);
    console.error('[Notify] 错误堆栈 (stack):', error.stack);

    return jsonResponse({ ec: 200, em: 'Error but received' });
  }
};

async function updateVip(deviceId, plan) {
  console.log('  [UpdateVip] 开始更新VIP');
  console.log('  [UpdateVip] device_id:', deviceId);
  console.log('  [UpdateVip] plan:', plan);

  if (!deviceId) {
    console.log('  [UpdateVip] ❌ deviceId为空，无法更新');
    throw new Error('deviceId is required');
  }

  if (!plan || !plan.type) {
    console.log('  [UpdateVip] ❌ plan配置无效，无法更新');
    throw new Error('plan is required');
  }

  // 查找用户
  console.log('  [UpdateVip] 查询数据库中的用户...');
  let users;
  try {
    users = await supabaseGet('users', { device_id: deviceId });
    console.log('  [UpdateVip] 查询结果 (users):', users);
  } catch (error) {
    console.log('  [UpdateVip] ❌ 查询用户失败:', error.message);
    throw error;
  }

  // 如果用户不存在，创建用户
  if (!users || users.length === 0) {
    console.log('  [UpdateVip] 用户不存在，创建新用户...');
    try {
      await supabaseInsert('users', { device_id: deviceId });
      users = await supabaseGet('users', { device_id: deviceId });
      console.log('  [UpdateVip] 创建用户后的结果:', users);
    } catch (error) {
      console.log('  [UpdateVip] ❌ 创建用户失败:', error.message);
      throw error;
    }
  }

  if (!users || users.length === 0) {
    console.log('  [UpdateVip] ❌ 无法获取或创建用户');
    throw new Error('Failed to get or create user');
  }

  const user = users[0];
  console.log('  [UpdateVip] 当前用户 (user):', user);

  const now = new Date();
  let expireDate;

  // 计算新的到期时间
  if (plan.type === 'permanent') {
    expireDate = new Date(2099, 11, 31);
    console.log('  [UpdateVip] 永久会员，到期时间:', expireDate);
  } else {
    expireDate = new Date(now);
    expireDate.setMonth(expireDate.getMonth() + plan.months);
    console.log('  [UpdateVip] 普通会员，新增', plan.months, '个月，到期时间:', expireDate);
  }

  // 如果用户已经是VIP，并且VIP还没过期，在现有基础上延长
  if (user.is_vip && user.vip_expire_date) {
    const currentExpire = new Date(user.vip_expire_date);
    console.log('  [UpdateVip] 用户已经是VIP，当前到期时间:', currentExpire);

    if (currentExpire > now) {
      console.log('  [UpdateVip] VIP未过期，在现有基础上延长');
      if (plan.type === 'permanent') {
        expireDate = new Date(2099, 11, 31);
      } else {
        expireDate = new Date(currentExpire);
        expireDate.setMonth(expireDate.getMonth() + plan.months);
      }
      console.log('  [UpdateVip] 延长后的到期时间:', expireDate);
    }
  }

  console.log('  [UpdateVip] 准备更新数据库...');
  try {
    await supabaseUpdate('users', { device_id: deviceId }, {
      is_vip: true,
      vip_expire_date: expireDate.toISOString(),
      vip_updated_at: now.toISOString()
    });
    console.log('  [UpdateVip] ✅ VIP更新完成');
  } catch (error) {
    console.log('  [UpdateVip] ❌ 更新数据库失败:', error.message);
    throw error;
  }
}

function jsonResponse(data, status = 200) {
  console.log('[Notify] 返回响应:', JSON.stringify(data), '状态码:', status);
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(data)
  };
}
