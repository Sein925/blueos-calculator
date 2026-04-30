// EdgeOne Pages KV 存储工具
// 参考文档：https://pages.edgeone.ai/zh/document/kv-storage

// 默认的 KV 命名空间变量名（可在 EdgeOne Pages 控制台绑定时设置）
const DEFAULT_KV_VAR_NAME = 'KV_CALCULATOR';

// 所有可能的 KV 变量名（用于自动检测）
const POSSIBLE_KV_NAMES = [
  'KV_CALCULATOR',
  'KV',
  'CALCULATOR',
  'STORAGE',
  'DB',
  'KV_STORAGE'
];

/**
 * 检查所有可能的 KV 访问方式
 */
export function checkKVConfig(context) {
  const result = {
    ok: false,
    namespace: null,
    message: '',
    contextKeys: [],
    envKeys: [],
    attempts: []
  };

  try {
    // 记录 context 的所有键
    if (context) {
      result.contextKeys = Object.keys(context);
      
      // 记录 env 的所有键
      if (context.env) {
        result.envKeys = Object.keys(context.env);
      }

      // 方法 1: 优先使用 context.env 查找
      if (context.env) {
        result.attempts.push('Checking context.env for KV bindings...');
        
        // 首先尝试 DEFAULT_KV_VAR_NAME
        if (context.env[DEFAULT_KV_VAR_NAME] && typeof context.env[DEFAULT_KV_VAR_NAME] === 'object') {
          result.ok = true;
          result.namespace = context.env[DEFAULT_KV_VAR_NAME];
          result.message = 'Found via context.env.' + DEFAULT_KV_VAR_NAME;
          return result;
        }

        // 尝试所有可能的 KV 变量名
        for (const name of POSSIBLE_KV_NAMES) {
          if (name !== DEFAULT_KV_VAR_NAME && context.env[name] && typeof context.env[name] === 'object') {
            result.ok = true;
            result.namespace = context.env[name];
            result.message = 'Found via context.env.' + name;
            return result;
          }
        }

        // 遍历 env 的所有键，查找类型为 object 的可能是 KV 的键
        for (const key of Object.keys(context.env)) {
          if (typeof context.env[key] === 'object' && context.env[key] !== null) {
            result.attempts.push('Found possible object in env: ' + key);
            // 检查是否有 KV 的典型方法（get, put, delete, list）
            const val = context.env[key];
            if (val.get && val.put && val.delete && val.list) {
              result.ok = true;
              result.namespace = val;
              result.message = 'Found KV via context.env.' + key + ' (has KV methods)';
              return result;
            }
          }
        }
      }

      // 方法 2: 尝试直接从 context 查找
      for (const name of POSSIBLE_KV_NAMES) {
        if (context[name] && typeof context[name] === 'object') {
          result.attempts.push('Checking context.' + name);
          const val = context[name];
          if (val.get && val.put && val.delete && val.list) {
            result.ok = true;
            result.namespace = val;
            result.message = 'Found KV via context.' + name;
            return result;
          }
        }
      }

      result.message = 'KV not found. Please ensure KV is bound to the project in EdgeOne Pages console.';
    } else {
      result.message = 'Context is null or undefined';
    }
  } catch (error) {
    result.message = 'Error checking KV: ' + error.message;
    result.error = error.stack;
  }

  return result;
}

/**
 * 获取 KV 命名空间实例
 */
function getKV(context) {
  const check = checkKVConfig(context);
  if (!check.ok) {
    console.error(check.message);
    console.error('Available context keys:', check.contextKeys);
    return null;
  }
  return check.namespace;
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
