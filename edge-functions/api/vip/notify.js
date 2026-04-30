import { supabaseGet, supabaseInsert, supabaseUpdate } from '../../_utils/supabase.js';

// 套餐配置：plan_id -> 类型和时长
// 在爱发电后台可以看到每个商品的plan_id
const PLAN_CONFIG = {
  // 把爱发电的plan_id填在这里
  // 例如：'xxxxxx': { type: 'month', months: 1 }
  // 月卡plan_id:
  '71c57764449711f1b8db5254001e7c00': { type: 'month', months: 1 },
  // 季卡plan_id:
  '87d5beba449c11f1931852540025c377': { type: 'quarter', months: 3 },
  // 年卡plan_id:
  'a997babc449c11f1984452540025c377': { type: 'year', months: 12 },
  // 永久plan_id:
  'd0bd3360449c11f1928c52540025c377': { type: 'permanent', months: 999 }
};

// 备用配置：通过商品名判断
const FALLBACK_PLAN_CONFIG = {
  '月卡': { type: 'month', months: 1 },
  '季卡': { type: 'quarter', months: 3 },
  '年卡': { type: 'year', months: 12 },
  '永久': { type: 'permanent', months: 999 }
};

export async function onRequestPost(context) {
  console.log('[Notify] ===== 收到爱发电Webhook =====');
  
  try {
    const bodyText = await context.request.text();
    console.log('[Notify] 原始请求体:', bodyText);
    
    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (e) {
      console.log('[Notify] JSON解析失败');
      return jsonResponse({ ec: 400, em: 'Invalid JSON' }, 400);
    }
    
    console.log('[Notify] 解析后的数据:', JSON.stringify(data, null, 2));
    
    // 检查爱发电响应
    if (data.ec !== 200) {
      console.log('[Notify] 爱发电返回错误:', data.ec, data.em);
      return jsonResponse({ ec: 200, em: 'Received but error' });
    }
    
    // 获取订单信息
    const order = data?.data?.order;
    if (!order) {
      console.log('[Notify] 没有找到订单信息');
      return jsonResponse({ ec: 200, em: 'No order data' });
    }
    
    console.log('[Notify] 订单信息:', order);
    
    // 检查订单状态 (2表示交易成功)
    if (order.status !== 2) {
      console.log('[Notify] 订单状态不是成功，忽略:', order.status);
      return jsonResponse({ ec: 200, em: 'Status not success' });
    }
    
    // 解析产品类型：0=常规方案，1=售卖方案
    const productType = order.product_type;
    console.log('[Notify] 产品类型:', productType);
    
    // 获取plan_id，这是最准确的
    const planId = order.plan_id || '';
    console.log('[Notify] 套餐ID:', planId);
    
    // 从remark中提取设备ID
    let deviceId = '';
    const remark = order.remark || '';
    console.log('[Notify] 备注内容:', remark);
    
    // 尝试从备注中提取 device_id=xxx 格式
    const deviceIdMatch = remark.match(/device_id[=:]\s*([^\s&]+)/i);
    if (deviceIdMatch) {
      deviceId = deviceIdMatch[1].trim();
    } else if (remark.trim()) {
      // 如果备注里有内容，直接认为是设备ID
      deviceId = remark.trim();
    }
    
    // 也尝试从 custom_order_id 中获取
    if (!deviceId && order.custom_order_id) {
      deviceId = order.custom_order_id;
    }
    
    console.log('[Notify] 提取到的设备ID:', deviceId);
    
    if (!deviceId) {
      console.log('[Notify] 没有设备ID，无法处理');
      return jsonResponse({ ec: 200, em: 'No device ID' });
    }
    
    // 识别套餐类型，优先用plan_id
    let selectedPlan = null;
    
    // 1. 通过plan_id查找（最准确）
    if (planId && PLAN_CONFIG[planId]) {
      selectedPlan = PLAN_CONFIG[planId];
      console.log('[Notify] 通过plan_id匹配到套餐:', planId);
    } else {
      console.log('[Notify] plan_id未配置或匹配失败，尝试通过商品名匹配');
      
      // 2. 通过商品标题/sku识别
      const orderTitle = order.title || '';
      const skuDetail = order.sku_detail || [];
      
      console.log('[Notify] 订单标题:', orderTitle);
      console.log('[Notify] SKU详情:', skuDetail);
      
      // 检查订单标题中有没有套餐关键词
      for (const [planName, planInfo] of Object.entries(FALLBACK_PLAN_CONFIG)) {
        if (orderTitle.includes(planName)) {
          selectedPlan = planInfo;
          console.log('[Notify] 通过标题匹配到套餐:', planName);
          break;
        }
      }
      
      // 如果标题里没有，检查SKU详情
      if (!selectedPlan && skuDetail.length > 0) {
        for (const sku of skuDetail) {
          const skuName = sku.name || sku.title || '';
          for (const [planName, planInfo] of Object.entries(FALLBACK_PLAN_CONFIG)) {
            if (skuName.includes(planName)) {
              selectedPlan = planInfo;
              console.log('[Notify] 通过SKU匹配到套餐:', planName);
              break;
            }
          }
          if (selectedPlan) break;
        }
      }
    }
    
    // 如果还是没有，默认月卡
    if (!selectedPlan) {
      console.log('[Notify] 没有匹配到套餐，默认月卡');
      selectedPlan = FALLBACK_PLAN_CONFIG['月卡'];
    }
    
    // 更新VIP
    console.log('[Notify] 开始更新VIP');
    await updateVip(deviceId, selectedPlan);
    
    console.log('[Notify] ===== Webhook处理成功 =====');
    return jsonResponse({ ec: 200, em: 'ok' });
    
  } catch (error) {
    console.error('[Notify] ===== Webhook处理失败 =====');
    console.error('[Notify] 错误信息:', error);
    console.error('[Notify] 错误堆栈:', error.stack);
    
    // 即使出错也要返回ec:200，避免爱发电重发
    return jsonResponse({ ec: 200, em: 'Error but received' });
  }
}

// 也支持GET请求（测试用）
export async function onRequestGet(context) {
  console.log('[Notify] ===== 收到GET测试请求 =====');
  
  try {
    const url = new URL(context.request.url);
    const deviceId = url.searchParams.get('device_id');
    const planType = url.searchParams.get('plan') || 'month';
    
    if (!deviceId) {
      return jsonResponse({ ec: 400, em: 'Need device_id' }, 400);
    }
    
    // 找到对应的套餐配置
    let selectedPlan = null;
    for (const [name, info] of Object.entries(FALLBACK_PLAN_CONFIG)) {
      if (info.type === planType || name.includes(planType)) {
        selectedPlan = info;
        break;
      }
    }
    
    if (!selectedPlan) {
      selectedPlan = FALLBACK_PLAN_CONFIG['月卡'];
    }
    
    console.log('[Notify] 测试更新VIP:', deviceId, selectedPlan);
    await updateVip(deviceId, selectedPlan);
    
    return jsonResponse({ ec: 200, em: 'Test success' });
  } catch (error) {
    return jsonResponse({ ec: 500, em: error.message }, 500);
  }
}

async function updateVip(deviceId, plan) {
  console.log('[UpdateVip] 开始更新VIP');
  console.log('[UpdateVip] 设备ID:', deviceId);
  console.log('[UpdateVip] 套餐:', plan);
  
  // 查找或创建用户
  let users = await supabaseGet('users', { device_id: deviceId });
  
  if (!users || users.length === 0) {
    console.log('[UpdateVip] 创建新用户');
    await supabaseInsert('users', { device_id: deviceId });
    users = await supabaseGet('users', { device_id: deviceId });
  }
  
  const user = users[0];
  const now = new Date();
  
  // 计算过期时间
  let expireDate;
  if (plan.type === 'permanent') {
    expireDate = new Date(2099, 11, 31); // 永久会员
  } else {
    // 普通套餐，计算到期时间
    expireDate = new Date(now);
    expireDate.setMonth(expireDate.getMonth() + plan.months);
  }
  
  // 如果用户已经是VIP，在现有基础上延长
  if (user.is_vip && user.vip_expire_date) {
    const currentExpire = new Date(user.vip_expire_date);
    if (currentExpire > now) {
      // 现有VIP还没过期
      if (plan.type === 'permanent') {
        expireDate = new Date(2099, 11, 31);
      } else {
        expireDate = new Date(currentExpire);
        expireDate.setMonth(expireDate.getMonth() + plan.months);
      }
    }
  }
  
  console.log('[UpdateVip] 更新用户VIP状态');
  console.log('[UpdateVip] 到期时间:', expireDate);
  
  await supabaseUpdate('users', { device_id: deviceId }, {
    is_vip: true,
    vip_expire_date: expireDate.toISOString(),
    vip_updated_at: now.toISOString()
  });
  
  console.log('[UpdateVip] VIP更新成功');
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
