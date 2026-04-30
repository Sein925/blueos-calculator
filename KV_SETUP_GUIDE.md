# EdgeOne Pages KV 存储配置指南

## 问题说明

当前应用无法访问 KV 存储，健康检查显示：
```json
{
  "db": {
    "type": "KV",
    "status": "error",
    "message": "KV not found. Please ensure KV is bound to the project in EdgeOne Pages console."
  }
}
```

## 解决步骤

### 第一步：创建 KV 命名空间

1. 登录 [EdgeOne Pages 控制台](https://edgeone.cloud.tencent.com/)
2. 进入「KV Storage」页面
3. 点击「创建命名空间」
4. 输入命名空间名称（例如：`calculator_db`）
5. 点击「创建」

### 第二步：绑定 KV 命名空间到项目

#### 方法一：在 KV Storage 页面绑定
1. 进入刚创建的命名空间详情页
2. 点击「绑定项目」标签
3. 点击「绑定项目」按钮
4. 选择你的项目
5. **重要**：设置变量名为 `KV_CALCULATOR`（必须完全匹配）
6. 点击「确认」

#### 方法二：在项目页面绑定
1. 进入你的项目详情页
2. 点击「KV Storage」菜单
3. 点击「绑定命名空间」
4. 选择刚创建的命名空间
5. **重要**：设置变量名为 `KV_CALCULATOR`（必须完全匹配）
6. 点击「确认」

### 第三步：重新部署项目

绑定 KV 后，必须重新部署项目才能生效：
1. 在项目页面，点击「部署」或「重新构建」
2. 等待部署完成
3. 访问 `/health` 检查是否正常

## 验证配置

部署完成后，访问 `/health` 端点，应该看到类似以下响应：

```json
{
  "status": "ok",
  "message": "服务正常",
  "db": {
    "type": "KV",
    "status": "connected",
    "message": "Found via context.env.KV_CALCULATOR",
    "testResult": "ok"
  }
}
```

## 如果仍然有问题

1. **检查变量名**：确保绑定的变量名确实是 `KV_CALCULATOR`（大小写敏感）
2. **查看健康检查详情**：访问 `/health` 查看 `envKeys` 和 `attempts` 字段，了解当前可用的环境变量
3. **使用其他变量名**：如果无法修改为 `KV_CALCULATOR`，可以使用其他名字（如 `KV`），代码会自动检测
4. **检查是否有 KV 方法**：健康检查会查找有 `get`、`put`、`delete`、`list` 方法的对象

## 添加自己手表为会员

配置好 KV 后，可以通过以下方式添加手表为会员：

1. 获取手表的设备 ID（应用会自动生成）
2. 使用 API 端点：`POST /api/vip/set?device_id=YOUR_DEVICE_ID&is_vip=true&expire_date=2026-12-31`

或者直接在 KV 控制台添加记录：
- Key: `user:YOUR_DEVICE_ID`
- Value:
```json
{
  "device_id": "YOUR_DEVICE_ID",
  "is_vip": true,
  "vip_expire_date": "2026-12-31T23:59:59.000Z",
  "vip_updated_at": "2026-04-30T17:20:08.037Z",
  "created_at": "2026-04-30T17:20:08.037Z",
  "updated_at": "2026-04-30T17:20:08.037Z"
}
```

## 参考文档

- [EdgeOne Pages KV 存储文档](https://pages.edgeone.ai/zh/document/kv-storage)
- [EdgeOne Pages Functions 文档](https://edgeone.cloud.tencent.com/pages/document/162936866445025280)
