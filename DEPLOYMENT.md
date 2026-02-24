# 🚀 快速部署指南

## ✅ 已完成的準備工作

1. ✅ 前端升級到 Angular 20.3.16
2. ✅ 驗證 webhook → UNI API 下單邏輯正確
3. ✅ 建立 Azure 部署設定（台灣區域優化）

## 📦 部署檔案說明

| 檔案 | 用途 |
|------|------|
| [azure-deployment.md](azure-deployment.md) | 完整部署教學（手動步驟） |
| [deploy.ps1](deploy.ps1) | 自動化部署腳本（推薦） |
| [.github/workflows/azure-deploy.yml](.github/workflows/azure-deploy.yml) | CI/CD 自動部署 |
| [frontend/src/environments/](frontend/src/environments/) | 前端環境設定 |

## 🎯 推薦方案（台灣優化）

| 服務 | Azure 方案 | 月費估算 |
|------|-----------|---------|
| 後端 API | Container Apps | NT$ 300-800 |
| 資料庫 | PostgreSQL 容器 | NT$ 100-300 |
| 前端 | Static Web Apps (Free) | NT$ 0 |
| **總計** | | **NT$ 400-1,100** |

### 為什麼選這個方案？

✅ **East Asia（台灣）區域** - 延遲 < 5ms  
✅ **Container Apps** - 原生 Docker 支援，比 App Service 便宜 50%  
✅ **PostgreSQL 容器** - 適合小型專案，省下 ~NT$ 2,000/月  
✅ **Static Web Apps Free** - 免費層含 100GB 流量  

## ⚡ 快速開始

### 方法 1: 使用自動化腳本（推薦）

```powershell
# 1. 登入 Azure
az login

# 2. 執行部署腳本
.\deploy.ps1 `
    -UnitradeWsUrl "wss://your-ws-url" `
    -UnitradeAccount "your_account" `
    -UnitradePassword "your_password" `
    -UnitradeCertPassword "cert_password" `
    -UnitradeActno "your_actno"

# 3. 腳本會自動：
#    - 建立資源群組（台灣區域）
#    - 建立 Container Registry
#    - 建構並推送 Docker 映像
#    - 部署 PostgreSQL 容器
#    - 部署後端 API
#    - 輸出 Webhook URL
```

### 方法 2: 手動部署

詳見 [azure-deployment.md](azure-deployment.md)

## 🔐 部署前準備清單

請準備以下資訊：

- [ ] Azure 訂閱 ID
- [ ] Unitrade WebSocket URL
- [ ] Unitrade 帳號 & 密碼
- [ ] PFX 憑證檔 & 密碼
- [ ] 交易帳號代碼 (actno)

## 📝 部署後設定

### 1. 取得後端 URL

```powershell
# 執行完 deploy.ps1 後會顯示
# 或者手動查詢：
az containerapp show \
    --name trade-api-backend \
    --resource-group trade-api-rg \
    --query properties.configuration.ingress.fqdn -o tsv
```

### 2. 更新前端 API URL

編輯 `frontend/src/environments/environment.prod.ts`：

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://YOUR_BACKEND_URL'  // 替換為實際 URL
};
```

### 3. 建構並部署前端

```powershell
cd frontend
npm run build -- --configuration production

# 使用 Azure Static Web Apps CLI 部署
npx @azure/static-web-apps-cli deploy \
    ./dist/futures-dashboard \
    --deployment-token <YOUR_TOKEN>
```

### 4. 設定 TradingView Webhook

在 TradingView 策略中設定 Webhook URL：

```
https://YOUR_BACKEND_URL/webhook
```

Webhook 訊息格式：

```json
{
  "productid": "TXFF5",
  "bs": "B",
  "ordertype": "L",
  "price": 18500,
  "orderqty": 1,
  "ordercondition": "R",
  "opencloseflag": "0",
  "strategy": "MA_Cross"
}
```

### 5. 上傳 PFX 憑證檔

⚠️ **重要**：憑證檔需要手動處理

**選項 A: 打包進 Docker 映像（測試用）**

1. 將憑證檔放到 `certs/` 目錄
2. 更新 Dockerfile：
   ```dockerfile
   COPY certs/ /app/certs/
   ```
3. 重新建構並推送映像

**選項 B: 使用 Azure Key Vault（生產環境推薦）**

```powershell
# 建立 Key Vault
az keyvault create \
    --name trade-kv-$(Get-Random) \
    --resource-group trade-api-rg \
    --location eastasia

# 上傳憑證
az keyvault certificate import \
    --vault-name trade-kv-XXXX \
    --name unitrade-cert \
    --file path/to/your_cert.pfx \
    --password "cert_password"

# 設定 Container App 讀取 Key Vault
# (需額外設定 Managed Identity)
```

## 🔧 常用指令

### 查看後端日誌

```powershell
az containerapp logs show \
    --name trade-api-backend \
    --resource-group trade-api-rg \
    --follow
```

### 測試 API

```powershell
# Health Check
curl https://YOUR_BACKEND_URL/health

# 查看訂單
curl https://YOUR_BACKEND_URL/orders

# 測試下單（POST）
curl -X POST https://YOUR_BACKEND_URL/order \
    -H "Content-Type: application/json" \
    -d '{
        "productid": "TXFF5",
        "bs": "B",
        "ordertype": "M",
        "orderqty": 1
    }'
```

### 更新後端程式碼

```powershell
# 1. 重新建構映像
docker build -t trade-api:v2 .

# 2. 推送到 ACR
az acr login --name YOUR_ACR_NAME
docker tag trade-api:v2 YOUR_ACR_NAME.azurecr.io/trade-api:v2
docker push YOUR_ACR_NAME.azurecr.io/trade-api:v2

# 3. 更新 Container App
az containerapp update \
    --name trade-api-backend \
    --resource-group trade-api-rg \
    --image YOUR_ACR_NAME.azurecr.io/trade-api:v2
```

## 📊 監控與維護

### 設定監控

```powershell
# 建立 Application Insights
az monitor app-insights component create \
    --app trade-api-insights \
    --location eastasia \
    --resource-group trade-api-rg \
    --application-type web

# 取得連接字串並加入 Container App 環境變數
```

### 資料庫備份

```powershell
# 進入 PostgreSQL 容器執行備份
az containerapp exec \
    --name trade-postgres \
    --resource-group trade-api-rg \
    --command "/bin/sh"

# 在容器內執行
pg_dump -U tradeuser trade_api > /backup/backup_$(date +%Y%m%d).sql
```

## 🆘 故障排除

### 問題 1: Docker 映像建構失敗

```powershell
# 確認 Docker 正在運行
docker version

# 檢查 Dockerfile 語法
docker build -t trade-api:test .
```

### 問題 2: Container App 無法啟動

```powershell
# 查看日誌
az containerapp logs show \
    --name trade-api-backend \
    --resource-group trade-api-rg \
    --tail 100

# 常見問題：
# - 環境變數設定錯誤
# - 憑證檔路徑不存在
# - 資料庫連線失敗
```

### 問題 3: Webhook 收到 403/404

1. 確認 Container App Ingress 設定為 `External`
2. 檢查 CORS_ORIGINS 環境變數
3. 測試 health endpoint

### 問題 4: Unitrade 連線失敗

1. 確認環境變數正確
2. 檢查憑證檔是否存在
3. 確認 WebSocket URL 正確

## 💡 省錢技巧

1. **設定自動縮放**：非交易時段自動縮減實例
2. **使用保留實例**：長期使用可省 30-40%
3. **定期清理舊資料**：資料庫瘦身
4. **監控使用量**：避免超出免費額度

## 🎯 下一步

- [ ] 設定 GitHub Actions CI/CD
- [ ] 啟用 Application Insights
- [ ] 設定自動備份
- [ ] 建立災難復原計劃
- [ ] 效能測試

## 📞 需要協助？

- Azure 文件：https://docs.microsoft.com/azure
- Unitrade API 說明：https://pfcec.github.io/unitrade/
- 專案問題：開 GitHub Issue

---

**預計部署時間**：30-45 分鐘（首次）  
**預計月費用**：NT$ 400-1,100  
**維護時間**：每週 1-2 小時
