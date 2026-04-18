let dbPool = null;

export async function getDBPool() {
  console.log('[DB] getDBPool 被调用');
  
  if (dbPool) {
    console.log('[DB] 使用已有的数据库连接池');
    return dbPool;
  }
  
  try {
    console.log('[DB] 尝试导入 mysql2');
    const mysql = await import('mysql2/promise');
    console.log('[DB] mysql2 导入成功');
    
    const dbConfig = {
      host: 'mysql6.sqlpub.com',
      port: 3311,
      user: 'dasein',
      password: 'NiGrg1RNwfsybSx4',
      database: 'blueos_calculator',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
    
    console.log('[DB] 数据库配置:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database
    });
    
    dbPool = mysql.createPool(dbConfig);
    console.log('[DB] 数据库连接池创建成功');
    
    console.log('[DB] 测试数据库连接...');
    const connection = await dbPool.getConnection();
    console.log('[DB] 数据库连接成功！');
    
    console.log('[DB] 初始化数据表...');
    await initTables(connection);
    
    connection.release();
    console.log('[DB] 数据库初始化完成');
    
    return dbPool;
  } catch (error) {
    console.error('[DB] 数据库连接失败:', error);
    console.error('[DB] 错误堆栈:', error.stack);
    throw new Error(`数据库连接失败: ${error.message}`);
  }
}

async function initTables(connection) {
  try {
    console.log('[DB] 创建 users 表...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        device_id VARCHAR(255) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    console.log('[DB] users 表创建成功');

    console.log('[DB] 创建 vip_orders 表...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS vip_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        out_trade_no VARCHAR(64) NOT NULL UNIQUE,
        package_type ENUM('month', 'quarter', 'year', 'permanent') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('pending', 'success', 'cancelled') DEFAULT 'pending',
        kuaizhifu_trade_no VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        paid_at TIMESTAMP NULL,
        INDEX idx_device_id (device_id),
        INDEX idx_out_trade_no (out_trade_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    console.log('[DB] vip_orders 表创建成功');

  } catch (error) {
    console.error('[DB] 创建表失败:', error);
    throw error;
  }
}
