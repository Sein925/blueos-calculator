import { getDBPool } from '../../_utils/db.js';
import { generateOrderId, generateSign } from '../../_utils/crypto.js';
import { KUAIZHIFU_CONFIG, packageNames, packagePrices, requestKuaizhifuApi } from '../../_utils/kuaizhifu.js';

export async function onRequestPost(context) {
  console.log('[Order] ===== 创建订单开始 =====');
  
  try {
    const body = await context.request.json();
    console.log('[Order] 请求参数:', body);
    
    const { device_id, package_type } = body;
    
    if (!device_id || !package_type) {
      console.log('[Order] 参数不完整');
      return jsonResponse({
        success: false,
        message: '参数不完整',
        error_code: 'PARAMS_MISSING'
      }, 400);
    }
    
    if (!packagePrices[package_type]) {
      console.log('[Order] 套餐类型错误:', package_type);
      return jsonResponse({
        success: false,
        message: '套餐类型错误',
        error_code: 'PACKAGE_TYPE_INVALID'
      }, 400);
    }
    
    console.log('[Order] 尝试获取数据库连接...');
    const pool = await getDBPool();
    console.log('[Order] 数据库连接成功');
    
    const out_trade_no = generateOrderId();
    const amount = packagePrices[package_type];
    const name = packageNames[package_type];
    
    console.log('[Order] 订单信息:', { out_trade_no, package_type, amount, name });
    
    console.log('[Order] 获取数据库连接...');
    const connection = await pool.getConnection();
    console.log('[Order] 数据库连接获取成功');
    
    try {
      console.log('[Order] 查询用户是否存在...');
      const [userResult] = await connection.query(
        'SELECT * FROM users WHERE device_id = ?',
        [device_id]
      );
      
      console.log('[Order] 用户查询结果:', userResult.length);
      
      if (userResult.length === 0) {
        console.log('[Order] 创建新用户...');
        await connection.query(
          'INSERT INTO users (device_id) VALUES (?)',
          [device_id]
        );
        console.log('[Order] 新用户创建成功');
      }
      
      console.log('[Order] 创建订单...');
      await connection.query(
        'INSERT INTO vip_orders (device_id, out_trade_no, package_type, amount, status) VALUES (?, ?, ?, ?, ?)',
        [device_id, out_trade_no, package_type, amount, 'pending']
      );
      console.log('[Order] 订单创建成功');
      
    } finally {
      connection.release();
      console.log('[Order] 数据库连接已释放');
    }
    
    const notify_url = `${new URL(context.request.url).origin}/api/vip/notify`;
    console.log('[Order] 回调地址:', notify_url);
    
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
    
    console.log('[Order] 支付参数:', payParams);
    
    console.log('[Order] 生成签名...');
    payParams.sign = await generateSign(payParams, KUAIZHIFU_CONFIG.key);
    console.log('[Order] 签名生成完成');
    
    console.log('[Order] ===== 创建订单成功 =====');
    
    try {
      console.log('[Order] 调用快支付API...');
      const kuaizhifuResult = await requestKuaizhifuApi(payParams);
      console.log('[Order] 快支付返回:', kuaizhifuResult);
      
      if (kuaizhifuResult.code === 1) {
        let payUrl = kuaizhifuResult.payurl || kuaizhifuResult.qrcode || kuaizhifuResult.urlscheme;
        console.log('[Order] 支付链接:', payUrl);
        
        return jsonResponse({
          success: true,
          order_id: out_trade_no,
          pay_url: payUrl,
          message: '订单创建成功'
        });
      } else {
        return jsonResponse({
          success: false,
          message: kuaizhifuResult.msg || '创建支付失败',
          error_code: 'PAY_API_ERROR',
          kuaizhifu_error: kuaizhifuResult
        });
      }
    } catch (apiError) {
      console.error('[Order] 调用快支付API错误:', apiError);
      console.error('[Order] 错误堆栈:', apiError.stack);
      return jsonResponse({
        success: false,
        message: '调用支付接口失败',
        error_code: 'PAY_API_CALL_ERROR',
        error_details: apiError.message
      }, 500);
    }
  } catch (error) {
    console.error('[Order] ===== 创建订单失败 =====');
    console.error('[Order] 错误信息:', error);
    console.error('[Order] 错误堆栈:', error.stack);
    
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
