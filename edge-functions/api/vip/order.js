import { generateOrderId, generateSign } from '../../_utils/crypto.js';
import { KUAIZHIFU_CONFIG, packageNames, packagePrices, requestKuaizhifuApi } from '../../_utils/kuaizhifu.js';
import { supabaseGet, supabaseInsert } from '../../_utils/supabase.js';

export async function onRequestPost(context) {
  console.log('[Order] ===== 创建订单开始 =====');
  
  try {
    const bodyText = await context.request.text();
    console.log('[Order] 原始请求体:', bodyText);
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      const searchParams = new URLSearchParams(bodyText);
      body = Object.fromEntries(searchParams.entries());
    }
    
    console.log('[Order] 解析后的参数:', body);
    
    const deviceId = body.device_id || body['device_id'];
    const packageType = body.package_type || body['package_type'];
    const payMethod = body.pay_method || body['pay_method'] || 'alipay';
    
    console.log('[Order] 支付方式:', payMethod);
    
    if (!deviceId || !packageType) {
      console.log('[Order] 参数不完整');
      return jsonResponse({
        success: false,
        message: '参数不完整',
        error_code: 'PARAMS_MISSING'
      }, 400);
    }
    
    if (!packagePrices[packageType]) {
      console.log('[Order] 套餐类型错误:', packageType);
      return jsonResponse({
        success: false,
        message: '套餐类型错误',
        error_code: 'PACKAGE_TYPE_INVALID'
      }, 400);
    }
    
    const outTradeNo = generateOrderId();
    const amount = packagePrices[packageType];
    const name = packageNames[packageType];
    
    console.log('[Order] 订单信息:', { out_trade_no: outTradeNo, package_type: packageType, amount, name, device_id: deviceId });
    
    console.log('[Order] 查询用户是否存在...');
    const users = await supabaseGet('users', { device_id: deviceId });
    
    if (!users || users.length === 0) {
      console.log('[Order] 创建新用户...');
      await supabaseInsert('users', { device_id: deviceId });
    }
    
    console.log('[Order] 创建订单...');
    await supabaseInsert('vip_orders', {
      device_id: deviceId,
      out_trade_no: outTradeNo,
      package_type: packageType,
      amount: amount,
      status: 'pending'
    });
    
    console.log('[Order] 订单创建成功');
    
    const notifyUrl = `${new URL(context.request.url).origin}/api/vip/notify`;
    console.log('[Order] 回调地址:', notifyUrl);
    
    const payType = payMethod === 'wechat' ? 'wxpay' : 'alipay';
    
    const payParams = {
      pid: KUAIZHIFU_CONFIG.pid,
      type: payType,
      out_trade_no: outTradeNo,
      name: name,
      money: amount.toFixed(2),
      notify_url: notifyUrl,
      clientip: context.request.headers.get('x-forwarded-for') || '127.0.0.1',
      device: 'mobile',
      param: deviceId,
      timestamp: Math.floor(Date.now() / 1000).toString(),
      sign_type: 'RSA'
    };
    
    console.log('[Order] V2支付参数:', payParams);
    
    console.log('[Order] 生成RSA签名...');
    payParams.sign = await generateSign(payParams, KUAIZHIFU_CONFIG.key);
    console.log('[Order] RSA签名生成完成');
    
    console.log('[Order] ===== 创建订单成功 =====');
    
    console.log('[Order] 调用快支付API...');
    const kuaizhifuResult = await requestKuaizhifuApi(payParams);
    console.log('[Order] 快支付返回:', kuaizhifuResult);
    
    if (kuaizhifuResult.code === 1) {
      let payUrl = kuaizhifuResult.payurl || kuaizhifuResult.qrcode || kuaizhifuResult.urlscheme;
      console.log('[Order] 支付链接:', payUrl);
      
      return jsonResponse({
        success: true,
        order_id: outTradeNo,
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