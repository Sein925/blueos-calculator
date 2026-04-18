import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import crypto from 'crypto';
import querystring from 'querystring';
import https from 'https';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

const KUAIZHIFU_CONFIG = {
  pid: '2134',
  key: 't6rrhSHssQohmRbsPsoPgS66GH60D60O',
  submitUrl: 'https://www.kuaizhifu.cn/submit.php',
  apiUrl: 'https://www.kuaizhifu.cn/mapi.php'
};

let pool;

async function initDB() {
  try {
    pool = mysql.createPool(dbConfig);
    
    const connection = await pool.getConnection();
    console.log('✅ 数据库连接成功');
    connection.release();
    
    await createTables();
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
  }
}

async function createTables() {
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

function generateSign(params, key) {
  const sortedKeys = Object.keys(params).sort();
  let signStr = '';
  
  for (const k of sortedKeys) {
    if (k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] !== null && params[k] !== undefined) {
      if (signStr) {
        signStr += '&';
      }
      signStr += `${k}=${params[k]}`;
    }
  }
  
  signStr += key;
  return crypto.createHash('md5').update(signStr, 'utf8').digest('hex').toLowerCase();
}

function verifySign(params, key) {
  const sign = params.sign;
  const calculatedSign = generateSign(params, key);
  return sign === calculatedSign;
}

function generateOrderId() {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CAL${timestamp}${random}`;
}

function requestKuaizhifuApi(params) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify(params);
    
    const url = new URL(KUAIZHIFU_CONFIG.apiUrl);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
}

const packageNames = {
  'month': '月卡',
  'quarter': '季卡',
  'year': '年卡',
  'permanent': '永久卡'
};

const packagePrices = {
  'month': 1.00,
  'quarter': 2.00,
  'year': 6.00,
  'permanent': 9.00
};

app.post('/api/vip/order', async (req, res) => {
  try {
    const { device_id, package_type } = req.body;
    
    if (!device_id || !package_type) {
      return res.json({
        success: false,
        message: '参数不完整'
      });
    }
    
    if (!packagePrices[package_type]) {
      return res.json({
        success: false,
        message: '套餐类型错误'
      });
    }
    
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
    
    const notify_url = `${req.protocol}://${req.get('host')}/api/vip/notify`;
    
    const payParams = {
      pid: KUAIZHIFU_CONFIG.pid,
      type: 'alipay',
      out_trade_no: out_trade_no,
      name: name,
      money: amount.toFixed(2),
      notify_url: notify_url,
      clientip: req.ip || '127.0.0.1',
      device: 'mobile',
      param: device_id,
      sign_type: 'MD5'
    };
    
    payParams.sign = generateSign(payParams, KUAIZHIFU_CONFIG.key);
    
    try {
      const kuaizhifuResult = await requestKuaizhifuApi(payParams);
      
      console.log('快支付返回:', kuaizhifuResult);
      
      if (kuaizhifuResult.code === 1) {
        let payUrl = kuaizhifuResult.payurl || kuaizhifuResult.qrcode || kuaizhifuResult.urlscheme;
        
        res.json({
          success: true,
          order_id: out_trade_no,
          pay_url: payUrl,
          message: '订单创建成功'
        });
      } else {
        res.json({
          success: false,
          message: kuaizhifuResult.msg || '创建支付失败'
        });
      }
    } catch (apiError) {
      console.error('调用快支付API错误:', apiError);
      res.json({
        success: false,
        message: '调用支付接口失败'
      });
    }
  } catch (error) {
    console.error('创建订单错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

app.get('/api/vip/notify', async (req, res) => {
  try {
    const params = req.query;
    
    console.log('收到支付通知:', params);
    
    if (!verifySign(params, KUAIZHIFU_CONFIG.key)) {
      console.log('签名验证失败');
      return res.send('fail');
    }
    
    const { trade_no, out_trade_no, trade_status, money, param } = params;
    
    if (trade_status !== 'TRADE_SUCCESS') {
      console.log('支付状态不是成功:', trade_status);
      return res.send('success');
    }
    
    const connection = await pool.getConnection();
    
    const [orderResult] = await connection.query(
      'SELECT * FROM vip_orders WHERE out_trade_no = ?',
      [out_trade_no]
    );
    
    if (orderResult.length === 0) {
      connection.release();
      console.log('订单不存在:', out_trade_no);
      return res.send('success');
    }
    
    const order = orderResult[0];
    
    if (order.status === 'success') {
      connection.release();
      console.log('订单已处理:', out_trade_no);
      return res.send('success');
    }
    
    if (parseFloat(order.amount) !== parseFloat(money)) {
      connection.release();
      console.log('金额不匹配:', order.amount, money);
      return res.send('success');
    }
    
    await connection.query(
      'UPDATE vip_orders SET status = ?, kuaizhifu_trade_no = ?, paid_at = NOW() WHERE out_trade_no = ?',
      ['success', trade_no, out_trade_no]
    );
    
    connection.release();
    
    console.log('订单处理成功:', out_trade_no);
    res.send('success');
  } catch (error) {
    console.error('处理支付通知错误:', error);
    res.send('fail');
  }
});

app.get('/api/vip/return', async (req, res) => {
  try {
    const params = req.query;
    
    console.log('收到同步通知:', params);
    
    if (!verifySign(params, KUAIZHIFU_CONFIG.key)) {
      return res.json({
        success: false,
        message: '签名验证失败'
      });
    }
    
    const { out_trade_no, trade_status } = params;
    
    if (trade_status !== 'TRADE_SUCCESS') {
      return res.json({
        success: false,
        message: '支付未成功'
      });
    }
    
    res.json({
      success: true,
      message: '支付成功',
      order_id: out_trade_no
    });
  } catch (error) {
    console.error('处理同步通知错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

app.get('/api/vip/status/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;
    const connection = await pool.getConnection();
    
    const [result] = await connection.query(
      `SELECT 
          vo.*,
          CASE 
            WHEN vo.package_type = 'permanent' THEN DATE_ADD(vo.paid_at, INTERVAL 100 YEAR)
            WHEN vo.package_type = 'year' THEN DATE_ADD(vo.paid_at, INTERVAL 1 YEAR)
            WHEN vo.package_type = 'quarter' THEN DATE_ADD(vo.paid_at, INTERVAL 3 MONTH)
            ELSE DATE_ADD(vo.paid_at, INTERVAL 1 MONTH)
          END as expire_date
       FROM vip_orders vo
       WHERE vo.device_id = ? AND vo.status = 'success'
       ORDER BY vo.paid_at DESC
       LIMIT 1`,
      [device_id]
    );
    
    connection.release();
    
    const isVip = result.length > 0 && new Date(result[0].expire_date) > new Date();
    
    res.json({
      success: true,
      is_vip: isVip,
      expire_date: isVip ? result[0].expire_date : null
    });
  } catch (error) {
    console.error('查询VIP状态错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '服务正常'
  });
});

initDB();

export default app;
