# Cloud Functions 部署指南

## 概述

本项目提供 Cloud Functions 版本的后端 API，支持查看日志功能。

## 项目结构

```
cloud-functions/
├── health/                 # 健康检查
│   ├── index.js
│   └── utils/
│       └── supabase.js
├── vip-notify/            # 爱发电 Webhook 通知
│   ├── index.js
│   └── utils/
│       └── supabase.js
├── vip-status/            # 查询 VIP 状态
│   ├── index.js
│   └── utils/
│       └── supabase.js
├── vip-order/             # 创建 VIP 订单（测试用）
│   ├── index.js
│   └── utils/
│       └── supabase.js
└── CLOUD_FUNCTIONS_DEPLOY.md
```

## 部署到腾讯云 Cloud Functions

### 1. 创建函数

登录腾讯云控制台，进入云函数 SCF：

1. 点击"新建"
2. 选择"从头开始"
3. 配置如下：

**基础配置：**
- 函数名称：`calculator-health`（或其他名称）
- 运行环境：Node.js 18.15
- 内存：128MB
- 超时时间：10秒

**函数代码：**
- 提交方法：在线编辑 或 本地上传 zip
- 如果本地上传，将每个函数的代码打包成 zip

### 2. 配置触发器

创建 API 网关触发器：

1. 触发方式：API 网关
2. 请求方法：ANY（或根据需求选择 GET/POST）
3. 发布环境：发布
4. 鉴权方法：免鉴权

### 3. 环境变量（可选）

如果需要，可以在环境变量中配置：

| 变量名 | 说明 |
|--------|------|
| NODE_ENV | production |

### 4. 部署各个函数

#### Health 函数
- 函数名：`calculator-health`
- 代码路径：`cloud-functions/health/`
- 触发路径：`/health`

#### VIP Notify 函数
- 函数名：`calculator-vip-notify`
- 代码路径：`cloud-functions/vip-notify/`
- 触发路径：`/vip-notify`

#### VIP Status 函数
- 函数名：`calculator-vip-status`
- 代码路径：`cloud-functions/vip-status/`
- 触发路径：`/vip-status`

#### VIP Order 函数
- 函数名：`calculator-vip-order`
- 代码路径：`cloud-functions/vip-order/`
- 触发路径：`/vip-order`

### 5. 查看日志

部署完成后，可以在腾讯云控制台查看日志：

1. 进入云函数控制台
2. 点击函数名称
3. 选择"日志查询"标签
4. 可以看到所有 `console.log` 输出的日志

## API 接口说明

### Health Check
```
GET https://your-domain.tencentcloudapi.com/health
```

### VIP Notify (爱发电 Webhook)
```
POST https://your-domain.tencentcloudapi.com/vip-notify
```

### VIP Status
```
GET https://your-domain.tencentcloudapi.com/vip-status?device_id=xxx
GET https://your-domain.tencentcloudapi.com/vip-status/xxx
```

### VIP Order (测试用)
```
POST https://your-domain.tencentcloudapi.com/vip-order
Content-Type: application/json

{
  "device_id": "xxx",
  "package_type": "month"
}
```

## 日志内容说明

每个函数都会记录以下信息：

1. **请求信息**
   - 请求时间
   - 请求方法
   - 请求路径
   - 请求头
   - 查询参数

2. **处理过程**
   - 数据解析过程
   - 数据库操作
   - 业务逻辑处理

3. **响应信息**
   - 响应数据
   - 响应状态码
   - 处理耗时

## 注意事项

1. 确保 Supabase 数据库可以公网访问
2. 配置好 CORS 允许前端域名访问
3. 爱发电 Webhook 地址需要配置为公网可访问的地址
4. 建议开启日志投递到 CLS 进行长期存储和分析
