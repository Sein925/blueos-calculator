# BlueOS Calculator Backend

## 部署说明

### 本地运行

```bash
cd backend
npm install
npm start
```

### EdgeOne 部署

1. 将 backend 目录上传到 EdgeOne
2. 配置环境变量
3. 启动服务

## API 接口

### 健康检查

```
GET /api/health
```

### 创建VIP订单

```
POST /api/vip/order
Content-Type: application/json

{
  "device_id": "设备ID",
  "package_type": "month|quarter|year|permanent"
}
```

### 查询VIP状态

```
GET /api/vip/status/:device_id
```

## 数据库配置

- 数据库名: blueos\_calculator
- 地址: mysql6.sqlpub.com:3311
- 账号: dasein
- 密码: NiGrg1RNwfsybSx4

## 套餐价格

- 月卡: ¥1
- 季卡: ¥2
- 年卡: ¥6
- 永久: ¥9

