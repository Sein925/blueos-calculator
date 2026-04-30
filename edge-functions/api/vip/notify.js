import { supabaseGet, supabaseInsert, supabaseUpdate } from '../../_utils/supabase.js';

// 套餐配置：优先通过爱发电的 plan_id 匹配
const PLAN_CONFIG = {
  // 将爱发电商品的 plan_id 填在这里，例如：
  '71c57764449711f1b8db5254001e7c00': { type: 'month', months: 1 },
  '87d5beba449c11f1931852540025c377': { type: 'quarter', months: 3 },
  'a997babc449c11f1984452540025c377': { type: 'year', months: 12 },
  'd0bd3360449c11f1928c52540025c377': { type: 'permanent', months: 999 }
};

// 备用配置：如果没有配置 plan_id，通过商品名匹配
const FALLBACK_PLAN_CONFIG = {
  '月卡': { type: 'month', months: 1 },
  '季卡': { type: 'quarter', months: 3 },
  '年卡': { type: 'year', months: 12 },
  '永久': { type: 'permanent', months: 999 }
};

export async function onRequestPost(context) {
  console.log('========================================');
  console.log('[Notify] 收到爱发电Webhook请求');
  console.log('========================================');
  
  try {
    // 读取请求体
    const bodyText = await context.request.text();
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
    
    // 提取信息
    let deviceId = '';
    let selectedPlan = null;
    const planId = order.plan_id || '';
    const remark = order.remark || '';
    const customOrderId = order.custom_order_id || '';
    const orderTitle = order.title || '';
    const skuDetail = order.sku_detail || [];
    
    console.log('[Notify] 商品plan_id:', planId);
    console.log('[Notify] 备注内容 (remark):', remark);
    console.log('[Notify] 自定义订单ID (custom_order_id):', customOrderId);
    console.log('[Notify] 订单标题 (title):', orderTitle);
    console.log('[Notify] SKU详情 (sku_detail):', skuDetail);
    
    // 1. 优先通过 plan_id 匹配套餐
    if (planId && PLAN_CONFIG[planId]) {
      selectedPlan = PLAN_CONFIG[planId];
      console.log('[Notify] ✅ 通过plan_id匹配到套餐:', selectedPlan);
    } else {
      console.log('[Notify] ⚠️ plan_id未配置或匹配失败');
      
      // 2. 尝试通过商品标题匹配
      for (const [planName, planInfo] of Object.entries(FALLBACK_PLAN_CONFIG)) {
        if (orderTitle.includes(planName)) {
          selectedPlan = planInfo;
          console.log('[Notify] ✅ 通过标题匹配到套餐:', planName);
          break;
        }
      }
      
      // 3. 尝试通过SKU匹配
      if (!selectedPlan && skuDetail.length > 0) {
        for (const sku of skuDetail) {
          const skuName = sku.name || sku.title || '';
          for (const [planName, planInfo] of Object.entries(FALLBACK_PLAN_CONFIG)) {
            if (skuName.includes(planName)) {
              selectedPlan = planInfo;
              console.log('[Notify] ✅ 通过SKU匹配到套餐:', planName);
              break;
            }
          }
          if (selectedPlan) break;
        }
      }
    }
    
    // 4. 默认月卡
    if (!selectedPlan) {
      selectedPlan = FALLBACK_PLAN_CONFIG['月卡'];
      console.log('[Notify] ⚠️ 没有匹配到套餐，使用默认月卡');
    }
    
    // 提取device_id
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
    console.log('[Notify] 最终选择的套餐:', selectedPlan);
    
    if (!deviceId) {
      console.log('[Notify] ❌ 设备ID为空，无法处理');
      return jsonResponse({ ec: 200, em: 'No device ID' });
    }
    
    // 更新VIP
    console.log('[Notify] 开始更新VIP...');
    await updateVip(deviceId, selectedPlan);
    
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
}

export async function onRequestGet(context) {
  console.log('========================================');
  console.log('[Notify] 收到GET测试请求');
  console.log('========================================');
  
  try {
    const url = new URL(context.request.url);
    const deviceId = url.searchParams.get('device_id');
    const planType = url.searchParams.get('plan') || 'month';
    
    console.log('[Notify] 查询参数 (query params):');
    console.log('  device_id:', deviceId);
    console.log('  plan:', planType);
    
    if (!deviceId) {
      console.log('[Notify] ❌ 缺少 device_id');
      return jsonResponse({ ec: 400, em: 'Need device_id' }, 400);
    }
    
    let selectedPlan = null;
    for (const info of Object.values(FALLBACK_PLAN_CONFIG)) {
      if (info.type === planType) {
        selectedPlan = info;
        break;
      }
    }
    
    if (!selectedPlan) {
      selectedPlan = FALLBACK_PLAN_CONFIG['月卡'];
    }
    
    console.log('[Notify] 开始测试更新VIP...');
    await updateVip(deviceId, selectedPlan);
    
    console.log('========================================');
    console.log('[Notify] GET测试请求处理完成');
    console.log('========================================');
    
    return jsonResponse({ ec: 200, em: 'Test success' });
  } catch (error) {
    console.log('========================================');
    console.log('[Notify] GET测试请求处理发生错误');
    console.log('========================================');
    console.error('[Notify] 错误信息 (message):', error.message);
    console.error('[Notify] 错误堆栈 (stack):', error.stack);
    
    return jsonResponse({ ec: 500, em: error.message }, 500);
  }
}

async function updateVip(deviceId, plan) {
  console.log('  [UpdateVip] 开始更新VIP');
  console.log('  [UpdateVip] device_id:', deviceId);
  console.log('  [UpdateVip] plan:', plan);
  
  // 查找用户
  console.log('  [UpdateVip] 查询数据库中的用户...');
  let users = await supabaseGet('users', { device_id: deviceId });
  console.log('  [UpdateVip] 查询结果 (users):', users);
  
  // 如果用户不存在，创建用户
  if (!users || users.length === 0) {
    console.log('  [UpdateVip] 用户不存在，创建新用户...');
    await supabaseInsert('users', { device_id: deviceId });
    users = await supabaseGet('users', { device_id: deviceId });
    console.log('  [UpdateVip] 创建用户后的结果:', users);
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
  await supabaseUpdate('users', { device_id: deviceId }, {
    is_vip: true,
    vip_expire_date: expireDate.toISOString(),
    vip_updated_at: now.toISOString()
  });
  
  console.log('  [UpdateVip] ✅ VIP更新完成');
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
