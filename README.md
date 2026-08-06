# Recovered License API

这是给遗失源码后的移动端项目准备的干净替代授权 API。它提供卡密创建、验证、会话心跳、功能配置和结束会话接口。

## 启动

```powershell
$env:ADMIN_TOKEN="change-this-token"
npm start
```

默认监听：

```text
https://via-license-api.onrender.com
```

如果 8787 被占用，可以指定端口：

```powershell
$env:ADMIN_TOKEN="change-this-token"
$env:PORT="18787"
npm start
```

## 创建卡密

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri https://via-license-api.onrender.com/admin/keys `
  -Headers @{ Authorization = "Bearer change-this-token" } `
  -ContentType "application/json" `
  -Body '{"kami":"TEST-1234-5678","days":7,"max_devices":1}'
```

## 客户端验证

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri https://via-license-api.onrender.com/api/v1/auth/verify `
  -ContentType "application/json" `
  -Body '{"kami":"TEST-1234-5678","udid":"device-001","bundle_id":"com.disguise.chagee.tea"}'
```

返回字段：

```json
{
  "success": true,
  "access_token": "...",
  "token_expire_unix": 123,
  "license_expire_unix": 123,
  "features": {}
}
```

## 心跳

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri https://via-license-api.onrender.com/api/v1/auth/heartbeat `
  -Headers @{ Authorization = "Bearer ACCESS_TOKEN" }
```

## 功能配置

```powershell
Invoke-RestMethod `
  -Method GET `
  -Uri https://via-license-api.onrender.com/api/v1/features `
  -Headers @{ Authorization = "Bearer ACCESS_TOKEN" }
```

## 兼容别名

为了方便恢复旧客户端时逐步迁移，服务也提供短路径别名：

```text
POST /verify
POST /hb
GET  /feature
POST /sess/end
```
