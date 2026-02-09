# 🎉 Azure 部署完成報告

## ✅ 部署狀態：成功

**部署時間**：2026-02-09 15:43:20  
**區域**：East Asia (台灣)  
**資源群組**：trade-api-rg

---

## 📋 已部署的資源

### 1. Container Registry（映像儲存）
- **名稱**：tradeacr3633
- **登入伺服器**：tradeacr3633.azurecr.io
- **映像**：trade-api:latest ✅
- **憑證**：已包含在映像中 (unitrade_cert.pfx)

### 2. Container Apps Environment
- **名稱**：trade-env
- **類型**：Consumption (消費型)
- **狀態**：已建立 ✅

### 3. PostgreSQL 資料庫
- **容器名稱**：trade-postgres
- **映像**：postgres:15-alpine
- **內部 URL**：trade-postgres.internal.calmbeach-e69a7a95.eastasia.azurecontainerapps.io
- **資料庫名稱**：trade_api
- **使用者**：tradeuser
- **密碼**：`bQaswP6BE1oTUJvAWYtd` ⚠️ **請保存此密碼！**

### 4. 後端 API（FastAPI）
- **容器名稱**：trade-api-backend
- **公開 URL**：https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io
- **狀態**：Running ✅
- **規格**：
  - CPU: 0.5 vCPU
  - Memory: 1GB
  - Min/Max Replicas: 1-5

---

## 🌐 重要端點

| 用途 | URL |
|------|-----|
| **健康檢查** | https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/health |
| **TradingView Webhook** | https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/webhook |
| **訂單列表** | https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/orders |
| **API 文件 (Swagger)** | https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/docs |

---

## 🔐 環境變數配置

已設定的環境變數：

```bash
DATABASE_URL=postgresql://tradeuser:bQaswP6BE1oTUJvAWYtd@trade-postgres:5432/trade_api
UNITRADE_WS_URL=https://viploginm.pfctrade.com
UNITRADE_ACCOUNT=80009802591
UNITRADE_PASSWORD=whc790319
UNITRADE_CERT_FILE=/app/certs/unitrade_cert.pfx
UNITRADE_CERT_PASSWORD=790319
UNITRADE_ACTNO=myTxf
CORS_ORIGINS=*
```

---

## ✅ 驗證步驟

### 1. 測試健康檢查

在瀏覽器或終端執行：

```bash
# 使用瀏覽器
# 開啟：https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/health

# 或使用 PowerShell
Invoke-RestMethod -Uri "https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/health"

# 預期回應：
# {
#   "status": "ok",
#   "unitrade": "connected" 或 "error"
# }
```

### 2. 查看 API 文件

開啟：https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/docs

### 3. 測試 Webhook

```powershell
$body = @{
    productid = "TXFF5"
    bs = "B"
    ordertype = "M"
    orderqty = 1
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/webhook" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

### 4. 查看容器日誌

```bash
az containerapp logs show \
    --name trade-api-backend \
    --resource-group trade-api-rg \
    --follow
```

---

## 📱 設定 TradingView Webhook

### 在 TradingView 設定警示時：

1. **Webhook URL**：
   ```
   https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/webhook
   ```

2. **訊息格式**（JSON）：
   ```json
   {
     "productid": "TXFF5",
     "bs": "{{strategy.order.action}}",
     "ordertype": "L",
     "price": {{close}},
     "orderqty": 1,
     "ordercondition": "R",
     "opencloseflag": "",
     "dtrade": "N",
     "note": "TV",
     "strategy": "{{strategy.order.id}}"
   }
   ```

---

## 🎯 下一步：部署前端

### 1. 更新前端 API URL

編輯檔案：`frontend/src/environments/environment.prod.ts`

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io'
};
```

### 2. 建構前端

```bash
cd frontend
npm run build -- --configuration production
```

### 3. 部署到 Azure Static Web Apps

```bash
# 方法 A: 使用 Azure Portal
# 1. 在 Azure Portal 建立 Static Web App
# 2. 上傳 dist/futures-dashboard 資料夾

# 方法 B: 使用 Azure CLI
az staticwebapp create \
    --name trade-dashboard \
    --resource-group trade-api-rg \
    --location eastasia
```

詳細步驟請參考：[DEPLOYMENT.md](DEPLOYMENT.md)

---

## 💰 預估費用

| 服務 | 規格 | 月費估算 (TWD) |
|------|------|----------------|
| Container Registry (Basic) | 10GB 儲存 | ~170 |
| Container Apps | 0.5 vCPU, 1GB RAM | 300-800 |
| PostgreSQL 容器 | 0.25 vCPU, 0.5GB RAM | 100-200 |
| 流量費用 | ~50GB | 100-200 |
| **總計** | | **~670-1,370** |

---

## 🔧 常用管理指令

### 重新啟動後端

```bash
az containerapp revision restart \
    --name trade-api-backend \
    --resource-group trade-api-rg \
    --revision trade-api-backend--nwletzf
```

### 更新環境變數

```bash
az containerapp update \
    --name trade-api-backend \
    --resource-group trade-api-rg \
    --set-env-vars "NEW_VAR=value"
```

### 擴展實例數

```bash
az containerapp update \
    --name trade-api-backend \
    --resource-group trade-api-rg \
    --min-replicas 2 \
    --max-replicas 10
```

### 查看所有資源

```bash
az resource list \
    --resource-group trade-api-rg \
    --output table
```

---

## 🆘 故障排除

### 問題 1: 健康檢查失敗

**可能原因**：
- 容器還在啟動中（通常需要 30-60 秒）
- Unitrade 連線失敗（檢查帳號密碼）
- 憑證檔問題

**解決方法**：
```bash
# 查看容器日誌
az containerapp logs show \
    --name trade-api-backend \
    --resource-group trade-api-rg \
    --tail 100 \
    --follow
```

### 問題 2: Unitrade 連線錯誤

**檢查清單**：
- ✅ UNITRADE_WS_URL 是否正確
- ✅ UNITRADE_ACCOUNT / PASSWORD 是否正確
- ✅ 憑證檔是否存在於容器中
- ✅ UNITRADE_CERT_PASSWORD 是否正確

### 問題 3: 資料庫連線失敗

**檢查**：
```bash
# 確認 PostgreSQL 容器運行中
az containerapp show \
    --name trade-postgres \
    --resource-group trade-api-rg \
    --query "properties.runningStatus"
```

---

## 📊 效能監控

### 啟用 Application Insights

```bash
# 建立 Application Insights
az monitor app-insights component create \
    --app trade-api-insights \
    --location eastasia \
    --resource-group trade-api-rg

# 取得 Connection String
az monitor app-insights component show \
    --app trade-api-insights \
    --resource-group trade-api-rg \
    --query connectionString
```

---

## 🔒 安全性建議

### 1. 更新 CORS 設定

目前設定為 `*`（允許所有來源），部署前端後應更新為：

```bash
az containerapp update \
    --name trade-api-backend \
    --resource-group trade-api-rg \
    --set-env-vars "CORS_ORIGINS=https://your-frontend-url.azurestaticapps.net"
```

### 2. 設定 IP 限制（選用）

如需限制只允許特定 IP 存取 Webhook：

```bash
# 在 Azure Portal 中設定
# Container Apps > trade-api-backend > Ingress > IP Security Restrictions
```

### 3. 啟用 Azure Key Vault（進階）

將敏感資訊（密碼、憑證）存放在 Key Vault：

```bash
az keyvault create \
    --name trade-keyvault-$(Get-Random) \
    --resource-group trade-api-rg \
    --location eastasia
```

---

## 📞 支援資源

- **Azure 文件**：https://docs.microsoft.com/azure/container-apps/
- **Unitrade API**：https://pfcec.github.io/unitrade/
- **專案文件**：[DEPLOYMENT.md](DEPLOYMENT.md)

---

## ✨ 恭喜！

您的交易系統後端已成功部署到 Azure（台灣區域）！

**下一步**：
1. ✅ 測試後端 API
2. ✅ 設定 TradingView Webhook
3. ⏳ 部署前端應用程式
4. ⏳ 進行完整測試

---

**部署產生的檔案**：
- ✅ `deployment-info.json` - 部署資訊（已產生）
- ✅ `certs/unitrade_cert.pfx` - 憑證檔（已包含在映像中）

**重要提醒**：
- 🔐 請妥善保存資料庫密碼：`bQaswP6BE1oTUJvAWYtd`
- 🔐 請勿將 `deployment-info.json` 提交到 Git

---

祝交易順利！ 📈🚀
