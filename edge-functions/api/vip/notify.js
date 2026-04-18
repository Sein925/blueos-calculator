import { getDBPool } from '../../_utils/db.js';
import { verifySign } from '../../_utils/crypto.js';
import { KUAIZHIFU_CONFIG } from '../../_utils/kuaizhifu.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const params = Object.fromEntries(url.searchParams);
    
    console.log('收到支付通知:', params);
    
    const signValid = await verifySign(params, KUAIZHIFU_CONFIG.key, params.sign);
    
    if (!signValid) {
      console.log('签名验证失败');
      return new Response('fail');
    }
    
    const { trade_no, out_trade_no, trade_status, money, param } = params;
    
    if (trade_status !== 'TRADE_SUCCESS') {
      console.log('支付状态不是成功:', trade_status);
      return new Response('success');
    }
    
    const pool = await getDBPool();
    const connection = await pool.getConnection();
    
    const [orderResult] = await connection.query(
      'SELECT * FROM vip_orders WHERE out_trade_no = ?',
      [out_trade_no]
    );
    
    if (orderResult.length === 0) {
      connection.release();
      console.log('订单不存在:', out_trade_no);
      return new Response('success');
    }
    
    const order = orderResult[0];
    
    if (order.status === 'success') {
      connection.release();
      console.log('订单已处理:', out_trade_no);
      return new Response('success');
    }
    
    if (parseFloat(order.amount) !== parseFloat(money)) {
      connection.release();
      console.log('金额不匹配:', order.amount, money);
      return new Response('success');
    }
    
    await connection.query(
      'UPDATE vip_orders SET status = ?, kuaizhifu_trade_no = ?, paid_at = NOW() WHERE out_trade_no = ?',
      ['success', trade_no, out_trade_no]
    );
    
    connection.release();
    
    console.log('订单处理成功:', out_trade_no);
    return new Response('success');
  } catch (error) {
    console.error('处理支付通知错误:', error);
    return new Response('fail');
  }
}
