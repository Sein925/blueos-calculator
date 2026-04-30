// EdgeOne Pages KV 存储工具
// 参考文档：https://pages.edgeone.ai/zh/document/kv-storage

const KV_NAMESPACE_NAME = 'KV_CALCULATOR';

/**
 * 获取 KV 命名空间实例
 */
function getKV(context) {
  try {
    if (!context.env) {
      console.error('context.env is not available');
      return null;
    }
    
    if (!context.env[KV_NAMESPACE_NAME]) {
      console.error(`${KV_NAMESPACE_NAME} KV namespace is not configured`);
      console.error('Available namespaces in env:', Object.keys(context.env));
      return null;
    }
    
    return context.env[KV_NAMESPACE_NAME];
  } catch (error) {
    console.error('Error accessing KV:', error);
    return null;
  }
}

/**
 * 获取用户数据
 */
export async function kvGetUser(context, deviceId) {
  const kv = getKV(context);
  if (!kv) {
    return null;
  }

  try {
    const key = `user:${deviceId}`;
    const value = await kv.get(key, { type: "json" });
    
    return value || null;
  } catch (error) {
    console.error('Error getting user from KV:', error);
    return null;
  }
}

/**
 * 创建新用户
 */
export async function kvInsertUser(context, deviceId) {
  const kv = getKV(context);
  if (!kv) {
    return null;
  }

  try {
    const key = `user:${deviceId}`;
    const now = new Date().toISOString();
    
    const user = {
      device_id: deviceId,
      is_vip: false,
      vip_expire_date: null,
      vip_updated_at: null,
      created_at: now,
      updated_at: now
    };
    
    await kv.put(key, JSON.stringify(user));
    return user;
  } catch (error) {
    console.error('Error inserting user to KV:', error);
    return null;
  }
}

/**
 * 更新用户数据
 */
export async function kvUpdateUser(context, deviceId, data) {
  const kv = getKV(context);
  if (!kv) {
    return null;
  }

  try {
    let user = await kvGetUser(context, deviceId);
    if (!user) {
      user = await kvInsertUser(context, deviceId);
      if (!user) {
        return null;
      }
    }
    
    const updatedUser = {
      ...user,
      ...data,
      updated_at: new Date().toISOString()
    };
    
    const key = `user:${deviceId}`;
    await kv.put(key, JSON.stringify(updatedUser));
    return updatedUser;
  } catch (error) {
    console.error('Error updating user to KV:', error);
    return null;
  }
}

/**
 * 设置用户 VIP
 */
export async function kvSetVip(context, deviceId, isVip, expireDate) {
  return await kvUpdateUser(context, deviceId, {
    is_vip: isVip,
    vip_expire_date: expireDate,
    vip_updated_at: new Date().toISOString()
  });
}
