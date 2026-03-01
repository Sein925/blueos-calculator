# Vercel + Neon 部署指南

## 一、准备工作

### 1. 创建 Neon 数据库
1. 访问 [https://neon.tech/](https://neon.tech/)
2. 注册/登录账号
3. 创建新项目，选择 PostgreSQL 数据库
4. 创建完成后，复制 `Connection String`（连接字符串）

### 2. 准备 Vercel 账号
1. 访问 [https://vercel.com/](https://vercel.com/)
2. 注册/登录账号
3. 安装 Vercel CLI（可选）：`npm i -g vercel`

## 二、部署步骤

### 方式一：通过 Vercel 网站部署（推荐）

1. **将代码推送到 GitHub/GitLab**
   - 确保你的项目已推送到 Git 仓库

2. **在 Vercel 导入项目**
   - 登录 Vercel，点击 "Add New" → "Project"
   - 选择你的 Git 仓库
   - **重要**：将 "Root Directory" 设置为 `backend`
   - 点击 "Deploy"

3. **配置环境变量**
   - 部署完成后，进入项目 Settings → Environment Variables
   - 添加以下环境变量：
     - `DATABASE_URL`：你的 Neon 数据库连接字符串
     - `YI_PAY_PID`：易支付商户号
     - `YI_PAY_KEY`：易支付密钥
     - `YI_PAY_GATEWAY`：易支付网关地址
     - `YI_PAY_NOTIFY_URL`：`https://你的域名.vercel.app/api/payment/notify`
     - `YI_PAY_RETURN_URL`：`https://你的域名.vercel.app/api/payment/return`

4. **重新部署**
   - 添加完环境变量后，需要重新部署一次：
     - 进入项目 Overview → 点击 "Deployments"
     - 找到最新的部署，点击右侧三个点 → "Redeploy"

### 方式二：通过 Vercel CLI 部署

1. **安装依赖**
   ```bash
   cd backend
   npm install
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **部署项目**
   ```bash
   vercel
   ```
   - 按提示选择配置，确认后等待部署完成

4. **配置环境变量**
   - 部署到生产环境：
     ```bash
     vercel --prod
     ```
   - 在 Vercel 网站的项目设置中添加环境变量（同上）

## 三、初始化数据库表

首次部署后，需要初始化数据库表。有两种方式：

### 方式一：通过临时 API 初始化（可选）
在首次部署后，可以临时创建一个初始化 API 来创建表，或者：

### 方式二：使用 Neon SQL Editor
1. 登录 Neon 控制台
2. 进入你的数据库
3. 点击 "SQL Editor"
4. 执行以下 SQL：

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL UNIQUE,
  is_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_no VARCHAR(64) NOT NULL UNIQUE,
  device_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  pay_type VARCHAR(20),
  trade_no VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_no ON orders(order_no);
CREATE INDEX IF NOT EXISTS idx_device_id ON orders(device_id);
```

## 四、更新易支付回调地址

部署完成后，记得：

1. 登录易支付商户后台
2. 更新回调地址为你的 Vercel 域名：
   - 异步通知地址：`https://你的域名.vercel.app/api/payment/notify`
   - 同步跳转地址：`https://你的域名.vercel.app/api/payment/return`

## 五、API 端点说明

部署后，你的 API 端点如下：

- `GET /api/check-payment?deviceId=xxx` - 检查支付状态
- `POST /api/create-order` - 创建订单
- `POST /api/payment/notify` - 支付回调（异步）
- `GET /api/payment/return` - 支付返回（同步）
- `GET /api/order-status?orderNo=xxx` - 查询订单状态
- `GET /api/qrcode?url=xxx` - 生成二维码

## 六、常见问题

### 1. 数据库连接失败
- 检查 `DATABASE_URL` 是否正确
- 确保 Neon 数据库处于 active 状态

### 2. CORS 问题
- 代码中已配置 CORS，如仍有问题检查请求来源

### 3. 回调收不到
- 检查易支付后台的回调地址是否正确
- 确保 Vercel 域名可以正常访问
