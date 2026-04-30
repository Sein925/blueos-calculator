import { kvGetUser, kvInsertUser, kvUpdateUser } from '../../_utils/kv.js';

const PLAN_CONFIG = {
  '71c57764449711f1b8db5254001e7c00': { type: 'month', months: 1 },
  '87d5beba449c11f1931852540025c377': { type: 'quarter', months: 3 },
  'a997babc449c11f1984452540025c377': { type: 'year', months: 12 },
  'd0bd3360449c11f1928c52540025c377': { type: 'permanent', months: 999 }
};

export async function onRequestPost(context) {
  try {
    const bodyText = await context.request.text();

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (e) {
      return jsonResponse({ ec: 400, em: 'Invalid JSON' }, 400);
    }

    if (data.ec !== 200) {
      return jsonResponse({ ec: 200, em: 'Received but error' });
    }

    const order = data?.data?.order;

    if (!order) {
      return jsonResponse({ ec: 200, em: 'No order data' });
    }

    const orderStatus = order.status;

    if (orderStatus !== 2) {
      return jsonResponse({ ec: 200, em: 'Status not success' });
    }

    const planId = order.plan_id || '';

    if (!planId) {
      return jsonResponse({ ec: 200, em: 'No plan_id' });
    }

    if (!PLAN_CONFIG[planId]) {
      return jsonResponse({ ec: 200, em: 'Plan not configured' });
    }

    const selectedPlan = PLAN_CONFIG[planId];

    let deviceId = '';
    const remark = order.remark || '';
    const customOrderId = order.custom_order_id || '';

    const deviceIdMatch = remark.match(/device_id[=:]\s*([^\s&]+)/i);

    if (deviceIdMatch) {
      deviceId = deviceIdMatch[1].trim();
    } else if (remark.trim()) {
      deviceId = remark.trim();
    } else if (customOrderId) {
      deviceId = customOrderId;
    }

    if (!deviceId) {
      return jsonResponse({ ec: 200, em: 'No device ID' });
    }

    await updateVip(context, deviceId, selectedPlan);

    return jsonResponse({ ec: 200, em: 'ok' });

  } catch (error) {
    return jsonResponse({ ec: 200, em: 'Error but received' });
  }
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const deviceId = url.searchParams.get('device_id');
    const planType = url.searchParams.get('plan') || 'month';

    if (!deviceId) {
      return jsonResponse({ ec: 400, em: 'Need device_id' }, 400);
    }

    let selectedPlan = null;
    for (const plan of Object.values(PLAN_CONFIG)) {
      if (plan.type === planType) {
        selectedPlan = plan;
        break;
      }
    }

    if (!selectedPlan) {
      return jsonResponse({ ec: 400, em: 'Plan type not found' }, 400);
    }

    await updateVip(context, deviceId, selectedPlan);

    return jsonResponse({ ec: 200, em: 'Test success' });
  } catch (error) {
    return jsonResponse({ ec: 500, em: error.message }, 500);
  }
}

async function updateVip(context, deviceId, plan) {
  if (!deviceId) {
    throw new Error('deviceId is required');
  }

  if (!plan || !plan.type) {
    throw new Error('plan is required');
  }

  let user = await kvGetUser(context, deviceId);

  if (!user) {
    user = await kvInsertUser(context, deviceId);
  }

  const now = new Date();
  let expireDate;

  if (plan.type === 'permanent') {
    expireDate = new Date(2099, 11, 31);
  } else {
    expireDate = new Date(now);
    expireDate.setMonth(expireDate.getMonth() + plan.months);
  }

  if (user.is_vip && user.vip_expire_date) {
    const currentExpire = new Date(user.vip_expire_date);

    if (currentExpire > now) {
      if (plan.type === 'permanent') {
        expireDate = new Date(2099, 11, 31);
      } else {
        expireDate = new Date(currentExpire);
        expireDate.setMonth(expireDate.getMonth() + plan.months);
      }
    }
  }

  try {
    await kvUpdateUser(context, deviceId, {
      is_vip: true,
      vip_expire_date: expireDate.toISOString(),
      vip_updated_at: now.toISOString()
    });
  } catch (error) {
    throw error;
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
