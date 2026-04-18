import { supabaseGet } from '../../../_utils/supabase.js';

export async function onRequestGet(context) {
  console.log('[Status] ===== 查询VIP状态 =====');
  
  try {
    const { device_id } = context.params;
    console.log('[Status] 查询设备:', device_id);
    
    console.log('[Status] 查询VIP订单...');
    const orders = await supabaseGet('vip_orders', 
      { device_id, status: 'success' },
      { 
        orderBy: 'paid_at', 
        ascending: false, 
        limit: 1,
        columns: 'package_type, paid_at'
      }
    );
    
    console.log('[Status] 查询结果:', orders);
    
    let isVip = false;
    let expireDate = null;
    
    if (orders && orders.length > 0) {
      const order = orders[0];
      const paidAt = new Date(order.paid_at);
      let expireAt;
      
      switch (order.package_type) {
        case 'permanent':
          expireAt = new Date(paidAt);
          expireAt.setFullYear(expireAt.getFullYear() + 100);
          break;
        case 'year':
          expireAt = new Date(paidAt);
          expireAt.setFullYear(expireAt.getFullYear() + 1);
          break;
        case 'quarter':
          expireAt = new Date(paidAt);
          expireAt.setMonth(expireAt.getMonth() + 3);
          break;
        case 'month':
        default:
          expireAt = new Date(paidAt);
          expireAt.setMonth(expireAt.getMonth() + 1);
          break;
      }
      
      isVip = new Date() < expireAt;
      expireDate = isVip ? expireAt.toISOString() : null;
      
      console.log('[Status] VIP状态:', isVip);
      if (isVip) {
        console.log('[Status] 过期时间:', expireDate);
      }
    }
    
    console.log('[Status] ===== 查询VIP状态成功 =====');
    
    return jsonResponse({
      success: true,
      is_vip: isVip,
      expire_date: expireDate
    });
  } catch (error) {
    console.error('[Status] ===== 查询VIP状态失败 =====');
    console.error('[Status] 错误信息:', error);
    console.error('[Status] 错误堆栈:', error.stack);
    
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
      'Access-Control-Allow-Origin': '*'
    }
  });
}
