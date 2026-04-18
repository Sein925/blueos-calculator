const dbConfig = {
  host: 'mysql6.sqlpub.com',
  port: 3311,
  user: 'dasein',
  password: 'NiGrg1RNwfsybSx4',
  database: 'blueos_calculator'
};

let pool = null;

export async function getDBPool() {
  if (pool) return pool;
  
  try {
    const mysql = await import('mysql2/promise');
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    const connection = await pool.getConnection();
    console.log('✅ 数据库连接成功');
    connection.release();
    
    await initTables(pool);
    
    return pool;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    throw error;
  }
}

async function initTables(pool) {
  try {
    const connection = await pool.getConnection();
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        device_id VARCHAR(255) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

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

    connection.release();
    console.log('✅ 数据表创建成功');
  } catch (error) {
    console.error('❌ 创建表失败:', error);
  }
}
