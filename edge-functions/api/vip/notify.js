import { getDBPool } from '../../_utils/db.js';
import { verifySign } from '../../_utils/crypto.js';
import { KUAIZHIFU_CONFIG } from '../../_utils/kuaizhifu.js';

export async function onRequestGet(context) {
  console.log('[Notify] ===== 收到支付通知 =====');
  
  try {
    const url = new URL(context.request.url);
    const params = Object.fromEntries(url.searchParams);
    
    console.log('[Notify] 通知参数:', params);
    
    const signValid = await verifySign(params, KUAIZHIFU_CONFIG.key, params.sign);
    
    if (!signValid) {
      console.log('[Notify] 签名验证失败');
      return new Response('fail');
    }
    
    console.log('[Notify] 签名验证成功');
    
    const { trade_no, out_trade_no, trade_status, money, param } = params;
    console.log('[Notify] 订单信息:', { trade_no, out_trade_no, trade_status, money, param });
    
    if (trade_status !== 'TRADE_SUCCESS') {
      console.log('[Notify] 支付状态不是成功:', trade_status);
      return new Response('success');
    }
    
    console.log('[Notify] 支付成功，更新订单状态...');
    
    const pool = await getDBPool();
    const connection = await pool.getConnection();
    
    try {
      console.log('[Notify] 查询订单...');
      const [orderResult] = await connection.query(
        'SELECT * FROM vip_orders WHERE out_trade_no = ?',
        [out_trade_no]
      );
      
      if (orderResult.length === 0) {
        console.log('[Notify] 订单不存在:', out_trade_no);
        return new Response('success');
      }
      
      const order = orderResult[0];
      console.log('[Notify] 订单信息:', order);
      
      if (order.status === 'success') {
        console.log('[Notify] 订单已处理:', out_trade_no);
        return new Response('success');
      }
      
      if (parseFloat(order.amount) !== parseFloat(money)) {
        console.log('[Notify] 金额不匹配:', order.amount, money);
        return new Response('success');
      }
      
      console.log('[Notify] 更新订单状态...');
      await connection.query(
        'UPDATE vip_orders SET status = ?, kuaizhifu_trade_no = ?, paid_at = NOW() WHERE out_trade_no = ?',
        ['success', trade_no, out_trade_no]
      );
      
      console.log('[Notify] 订单状态更新成功');
      
    } finally {
      connection.release();
      console.log('[Notify] 数据库连接已释放');
    }
    
    console.log('[Notify] ===== 支付通知处理成功 =====');
    return new Response('success');
  } catch (error) {
    console.error('[Notify] ===== 支付通知处理失败 =====');
    console.error('[Notify] 错误信息:', error);
    console.error('[Notify] 错误堆栈:', error.stack);
    return new Response('fail');
  }
}
