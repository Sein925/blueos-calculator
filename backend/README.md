# 计算器后端服务

## 部署说明

### 1. 安装依赖
```bash
cd backend
npm install
```

### 2. 配置易支付

在 `index.js` 文件中，找到 `YI_PAY_CONFIG` 配置项，填入你的易支付信息：

```javascript
const YI_PAY_CONFIG = {
  pid: '你的商户ID',                    // 易支付商户ID
  key: '你的商户密钥',                  // 易支付商户密钥
  gateway: 'https://www.kuaizhifu.cn/submit.php',
  notifyUrl: 'http://你的服务器地址/api/payment/notify',   // 支付回调地址
  returnUrl: 'http://你的服务器地址/api/payment/return'    // 支付返回地址
}
```

**重要提示：**
- 请将 `你的服务器地址` 替换为你实际的服务器域名或IP
- 在易支付商户后台设置回调地址为：`http://你的服务器地址/api/payment/notify`

### 3. 数据库配置

数据库已配置为：
- 主机：mysql6.sqlpub.com
- 端口：3311
- 用户：yikang666
- 数据库：blueos_calculator

如需修改，请编辑 `index.js` 中的数据库连接配置。

### 4. 启动服务
```bash
npm start
```

服务将在 `http://0.0.0.0:3000` 启动。

## API 接口

### 检查付费状态
- 接口：`GET /api/check-payment`
- 参数：`deviceId` (设备ID)
- 响应：
  ```json
  {
    "isPaid": true/false
  }
  ```

### 创建订单
- 接口：`POST /api/create-order`
- 参数：
  ```json
  {
    "deviceId": "设备ID",
    "amount": 1.00,
    "payType": "alipay"
  }
  ```
- 响应：
  ```json
  {
    "success": true,
    "orderNo": "订单号",
    "payUrl": "支付链接",
    "qrcode": "支付二维码链接"
  }
  ```

### 支付回调
- 接口：`POST /api/payment/notify`
- 说明：易支付异步回调，自动更新订单状态和用户付费状态

### 支付返回
- 接口：`GET /api/payment/return`
- 说明：支付成功后的同步返回页面

### 查询订单状态
- 接口：`GET /api/order-status`
- 参数：`orderNo` (订单号)
- 响应：
  ```json
  {
    "status": "pending/paid/not_found"
  }
  ```

## 数据库表结构

服务启动时会自动创建以下表：

### users 表
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL UNIQUE,
  is_paid TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```

### orders 表
```sql
CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(64) NOT NULL UNIQUE,
  device_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  pay_type VARCHAR(20),
  trade_no VARCHAR(128),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_no (order_no),
  INDEX idx_device_id (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```

## 前端配置

在 `src/global.js` 中修改后端地址：
```javascript
global.backendUrl = 'http://你的服务器地址:3000'
```

## 支付流程

1. 用户在应用中点击"立即开通"
2. 前端调用 `/api/create-order` 创建订单
3. 后端返回支付链接
4. 用户复制链接在浏览器中打开完成支付
5. 易支付异步回调 `/api/payment/notify`
6. 后端更新订单状态和用户付费状态
7. 用户在应用中点击"查询支付状态"确认开通
