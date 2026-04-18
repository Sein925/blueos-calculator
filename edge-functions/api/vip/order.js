import { getDBPool } from '../../_utils/db.js';
import { generateOrderId, generateSign } from '../../_utils/crypto.js';
import { KUAIZHIFU_CONFIG, packageNames, packagePrices, requestKuaizhifuApi } from '../../_utils/kuaizhifu.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { device_id, package_type } = body;
    
    if (!device_id || !package_type) {
      return jsonResponse({
        success: false,
        message: '参数不完整'
      }, 400);
    }
    
    if (!packagePrices[package_type]) {
      return jsonResponse({
        success: false,
        message: '套餐类型错误'
      }, 400);
    }
    
    const pool = await getDBPool();
    const out_trade_no = generateOrderId();
    const amount = packagePrices[package_type];
    const name = packageNames[package_type];
    
    const connection = await pool.getConnection();
    
    const [userResult] = await connection.query(
      'SELECT * FROM users WHERE device_id = ?',
      [device_id]
    );
    
    if (userResult.length === 0) {
      await connection.query(
        'INSERT INTO users (device_id) VALUES (?)',
        [device_id]
      );
    }
    
    await connection.query(
      'INSERT INTO vip_orders (device_id, out_trade_no, package_type, amount, status) VALUES (?, ?, ?, ?, ?)',
      [device_id, out_trade_no, package_type, amount, 'pending']
    );
    
    connection.release();
    
    const notify_url = `${new URL(context.request.url).origin}/api/vip/notify`;
    
    const payParams = {
      pid: KUAIZHIFU_CONFIG.pid,
      type: 'alipay',
      out_trade_no: out_trade_no,
      name: name,
      money: amount.toFixed(2),
      notify_url: notify_url,
      clientip: context.request.headers.get('x-forwarded-for') || '127.0.0.1',
      device: 'mobile',
      param: device_id,
      sign_type: 'MD5'
    };
    
    payParams.sign = await generateSign(payParams, KUAIZHIFU_CONFIG.key);
    
    try {
      const kuaizhifuResult = await requestKuaizhifuApi(payParams);
      
      console.log('快支付返回:', kuaizhifuResult);
      
      if (kuaizhifuResult.code === 1) {
        let payUrl = kuaizhifuResult.payurl || kuaizhifuResult.qrcode || kuaizhifuResult.urlscheme;
        
        return jsonResponse({
          success: true,
          order_id: out_trade_no,
          pay_url: payUrl,
          message: '订单创建成功'
        });
      } else {
        return jsonResponse({
          success: false,
          message: kuaizhifuResult.msg || '创建支付失败'
        });
      }
    } catch (apiError) {
      console.error('调用快支付API错误:', apiError);
      return jsonResponse({
        success: false,
        message: '调用支付接口失败'
      }, 500);
    }
  } catch (error) {
    console.error('创建订单错误:', error);
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
