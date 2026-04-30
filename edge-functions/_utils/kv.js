const KV_NAMESPACE = 'KV_CALCULATOR';

function getKV(context) {
  if (!context.env) {
    throw new Error('context.env is not available');
  }
  if (!context.env[KV_NAMESPACE]) {
    throw new Error(`${KV_NAMESPACE} KV namespace is not configured`);
  }
  return context.env[KV_NAMESPACE];
}

export async function kvGetUser(context, deviceId) {
  const kv = getKV(context);
  const key = `user:${deviceId}`;
  const value = await kv.get(key);
  
  if (!value) {
    return null;
  }
  
  try {
    const user = JSON.parse(value);
    return user;
  } catch (error) {
    return null;
  }
}

export async function kvInsertUser(context, deviceId) {
  const kv = getKV(context);
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
}

export async function kvUpdateUser(context, deviceId, data) {
  const kv = getKV(context);
  const key = `user:${deviceId}`;
  
  let user = await kvGetUser(context, deviceId);
  
  if (!user) {
    user = await kvInsertUser(context, deviceId);
  }
  
  const updatedUser = {
    ...user,
    ...data,
    updated_at: new Date().toISOString()
  };
  
  await kv.put(key, JSON.stringify(updatedUser));
  return updatedUser;
}

export async function kvSetVip(context, deviceId, isVip, expireDate) {
  return await kvUpdateUser(context, deviceId, {
    is_vip: isVip,
    vip_expire_date: expireDate,
    vip_updated_at: new Date().toISOString()
  });
}
