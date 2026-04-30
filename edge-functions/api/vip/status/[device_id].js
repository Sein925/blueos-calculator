import { kvGetUser } from '../../../_utils/kv.js';

export async function onRequestGet(context) {
  try {
    const deviceId = context.params.device_id;

    if (!deviceId) {
      return jsonResponse({
        success: false,
        message: '缺少 device_id 参数',
        error_code: 'MISSING_DEVICE_ID'
      }, 400);
    }

    const user = await kvGetUser(context, deviceId);

    let isVip = false;
    let expireDate = null;

    if (user) {
      isVip = user.is_vip === true;

      if (isVip && user.vip_expire_date) {
        expireDate = user.vip_expire_date;

        const now = new Date();
        const expireDateObj = new Date(expireDate);
        if (now > expireDateObj) {
          isVip = false;
          expireDate = null;
        }
      }
    }

    return jsonResponse({
      success: true,
      is_vip: isVip,
      expire_date: expireDate
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      message: '服务器错误',
      error_code: 'SERVER_ERROR',
      error_details: error.message
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
