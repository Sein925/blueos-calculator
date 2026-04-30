import { kvGetUser, kvInsertUser, kvUpdateUser } from '../../_utils/kv.js';

const PLAN_CONFIG = {
  // 'your-month-plan-id': { type: 'month', months: 1 },
  // 'your-quarter-plan-id': { type: 'quarter', months: 3 },
  // 'your-year-plan-id': { type: 'year', months: 12 },
  // 'your-permanent-plan-id': { type: 'permanent', months: 999 }
};

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

  if (!user) {
    throw new Error('Failed to create user, KV not configured');
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

  await kvUpdateUser(context, deviceId, {
    is_vip: true,
    vip_expire_date: expireDate.toISOString(),
    vip_updated_at: now.toISOString()
  });
}

export async function onRequestPost(context) {
  try {
    const bodyText = await context.request.text();

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (e) {
      return new Response(JSON.stringify({ ec: 400, em: 'Invalid JSON' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (data.ec !== 200) {
      return new Response(JSON.stringify({ ec: 200, em: 'Received but error' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const order = data?.data?.order;

    if (!order) {
      return new Response(JSON.stringify({ ec: 200, em: 'No order data' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const orderStatus = order.status;

    if (orderStatus !== 2) {
      return new Response(JSON.stringify({ ec: 200, em: 'Status not success' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const planId = order.plan_id || '';

    if (!planId) {
      return new Response(JSON.stringify({ ec: 200, em: 'No plan_id' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (!PLAN_CONFIG[planId]) {
      return new Response(JSON.stringify({ ec: 200, em: 'Plan not configured' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
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
      return new Response(JSON.stringify({ ec: 200, em: 'No device ID' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    await updateVip(context, deviceId, selectedPlan);

    return new Response(JSON.stringify({ ec: 200, em: 'ok' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ ec: 200, em: 'Error but received' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const deviceId = url.searchParams.get('device_id');
    const planType = url.searchParams.get('plan') || 'month';

    if (!deviceId) {
      return new Response(JSON.stringify({ ec: 400, em: 'Need device_id' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    let selectedPlan = null;
    for (const plan of Object.values(PLAN_CONFIG)) {
      if (plan.type === planType) {
        selectedPlan = plan;
        break;
      }
    }

    if (!selectedPlan) {
      const fallbackPlans = {
        'month': { type: 'month', months: 1 },
        'quarter': { type: 'quarter', months: 3 },
        'year': { type: 'year', months: 12 },
        'permanent': { type: 'permanent', months: 999 }
      };
      selectedPlan = fallbackPlans[planType];
    }

    if (!selectedPlan) {
      return new Response(JSON.stringify({ ec: 400, em: 'Plan type not found' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    await updateVip(context, deviceId, selectedPlan);

    return new Response(JSON.stringify({ ec: 200, em: 'Test success' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ ec: 500, em: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
