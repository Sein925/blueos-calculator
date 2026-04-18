import { getDBPool } from '../../../_utils/db.js';

export async function onRequestGet(context) {
  console.log('[Status] ===== 查询VIP状态 =====');
  
  try {
    const { device_id } = context.params;
    console.log('[Status] 查询设备:', device_id);
    
    const pool = await getDBPool();
    console.log('[Status] 数据库连接成功');
    
    const connection = await pool.getConnection();
    
    try {
      console.log('[Status] 查询VIP订单...');
      const [result] = await connection.query(
        `SELECT 
            vo.*,
            CASE 
              WHEN vo.package_type = 'permanent' THEN DATE_ADD(vo.paid_at, INTERVAL 100 YEAR)
              WHEN vo.package_type = 'year' THEN DATE_ADD(vo.paid_at, INTERVAL 1 YEAR)
              WHEN vo.package_type = 'quarter' THEN DATE_ADD(vo.paid_at, INTERVAL 3 MONTH)
              ELSE DATE_ADD(vo.paid_at, INTERVAL 1 MONTH)
            END as expire_date
         FROM vip_orders vo
         WHERE vo.device_id = ? AND vo.status = 'success'
         ORDER BY vo.paid_at DESC
         LIMIT 1`,
        [device_id]
      );
      
      console.log('[Status] 查询结果:', result.length);
      
      const isVip = result.length > 0 && new Date(result[0].expire_date) > new Date();
      console.log('[Status] VIP状态:', isVip);
      
      if (isVip) {
        console.log('[Status] 过期时间:', result[0].expire_date);
      }
      
      console.log('[Status] ===== 查询VIP状态成功 =====');
      
      return jsonResponse({
        success: true,
        is_vip: isVip,
        expire_date: isVip ? result[0].expire_date : null
      });
    } finally {
      connection.release();
      console.log('[Status] 数据库连接已释放');
    }
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
