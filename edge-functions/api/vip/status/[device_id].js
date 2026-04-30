import { supabaseGet } from '../../../_utils/supabase.js';

export async function onRequestGet(context) {
  console.log('========================================');
  console.log('[Status] 查询VIP状态');
  console.log('========================================');
  
  try {
    const { device_id } = context.params;
    console.log('[Status] 查询设备ID:', device_id);
    
    console.log('[Status] 查询users表...');
    const users = await supabaseGet('users', { device_id: device_id });
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
