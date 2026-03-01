# EdgeOne Workers 部署指南

## 前置准备

1. 注册并登录 [腾讯云 EdgeOne 控制台](https://console.cloud.tencent.com/edgeone)
2. 确保您的域名 `calculator.666-114514.eu.org` 已接入 EdgeOne

## 第一步：安装 Wrangler CLI

在本地电脑上安装 EdgeOne 的命令行工具：

```bash
# 使用 npm 安装
npm install -g @tencentedgeone/wrangler

# 或使用 pnpm
pnpm add -g @tencentedgeone/wrangler
```

## 第二步：登录 EdgeOne 账号

```bash
cd edgeone-backend
wrangler login
```

按照提示完成登录认证。

## 第三步：创建 KV 命名空间

1. 登录 [EdgeOne 控制台](https://console.cloud.tencent.com/edgeone)
2. 进入您的站点
3. 选择 "Workers" → "KV 存储"
4. 点击 "创建命名空间"
5. 填写以下信息：
   - 命名空间名称：`KV_CALCULATOR`
   - 备注：科学计算器数据存储
6. 点击确定创建

创建后，复制命名空间的 ID，我们会在下一步用到。

## 第四步：配置 wrangler.toml

编辑 `wrangler.toml` 文件，填入您的 KV 命名空间 ID：

```toml
[[kv_namespaces]]
binding = "KV_CALCULATOR"
id = "您的KV命名空间ID"  # 替换为您刚创建的命名空间ID
```

同时检查环境变量配置是否正确（默认已配置好）：

```toml
[vars]
YI_PAY_PID = "2134"
YI_PAY_KEY = "t6rrhSHssQohmRbsPsoPgS66GH60D60O"
YI_PAY_GATEWAY = "https://www.kuaizhifu.cn/submit.php"
YI_PAY_NOTIFY_URL = "https://calculator.666-114514.eu.org/api/payment/notify"
YI_PAY_RETURN_URL = "https://calculator.666-114514.eu.org/api/payment/return"
```

## 第五步：部署 Worker

在 `edgeone-backend` 目录下执行：

```bash
# 先安装依赖
npm install

# 或使用 pnpm
pnpm install

# 部署到 EdgeOne
wrangler deploy
```

部署成功后，您会看到类似这样的输出：
```
✨ Successfully published your script to calculator-backend.你的域名.workers.dev
```

## 第六步：配置自定义域名路由

1. 进入 EdgeOne 控制台 → 您的站点 → Workers
2. 找到刚部署的 `calculator-backend` Worker
3. 点击 "触发器" → "添加路由"
4. 配置路由：
   - 域名：`calculator.666-114514.eu.org`
   - 路径：`/*`
   - Worker：选择 `calculator-backend`
5. 点击确定保存

## 第七步：验证部署

访问以下地址验证部署是否成功：

- 首页：https://calculator.666-114514.eu.org/
- 支付页面：https://calculator.666-114514.eu.org/pay
- 检查支付状态（替换为您的设备ID）：https://calculator.666-114514.eu.org/api/check-payment?deviceId=test123

## 本地开发调试

如果需要在本地调试：

```bash
# 启动本地开发服务器
wrangler dev
```

然后访问 http://localhost:8787 进行测试。

## 查看日志

部署后如果遇到问题，可以查看实时日志：

```bash
wrangler tail
```

## API 端点说明

| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 首页，显示服务状态 |
| `/pay` | GET | 支付页面 |
| `/api/check-payment` | GET | 检查支付状态 |
| `/api/create-order` | POST | 创建订单 |
| `/api/payment/notify` | POST | 支付回调通知 |
| `/api/payment/return` | GET | 支付成功返回页 |
| `/api/order-status` | GET | 查询订单状态 |

## KV 数据结构

### 用户数据
- Key: `user:{deviceId}`
- Value:
  ```json
  {
    "deviceId": "设备ID",
    "isPaid": true,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
  ```

### 订单数据
- Key: `order:{orderNo}`
- Value:
  ```json
  {
    "orderNo": "CALC12345678901234",
    "deviceId": "设备ID",
    "amount": 1.00,
    "payType": "wxpay",
    "status": "paid",
    "tradeNo": "支付平台交易号",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
  ```

## 常见问题

### Q: 部署失败怎么办？
A: 检查：
1. Wrangler 是否正确登录
2. KV 命名空间 ID 是否正确
3. 网络连接是否正常

### Q: 如何更新环境变量？
A: 可以在 EdgeOne 控制台 → Worker → 设置 → 环境变量中修改，或修改 `wrangler.toml` 后重新部署。

### Q: KV 数据可以备份吗？
A: 可以在 EdgeOne 控制台的 KV 存储中查看和导出数据。
