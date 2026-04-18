import { getDBPool } from '../../../_utils/db.js';

export async function onRequestGet(context) {
  try {
    const { device_id } = context.params;
    const pool = await getDBPool();
    const connection = await pool.getConnection();
    
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
    
    connection.release();
    
    const isVip = result.length > 0 && new Date(result[0].expire_date) > new Date();
    
    return jsonResponse({
      success: true,
      is_vip: isVip,
      expire_date: isVip ? result[0].expire_date : null
    });
  } catch (error) {
    console.error('查询VIP状态错误:', error);
    return jsonResponse({
      success: false,
      message: '服务器错误'
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
