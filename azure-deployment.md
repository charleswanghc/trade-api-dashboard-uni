# Azure 部署指南（台灣優化方案）

## 📋 部署架構

```
┌─────────────────────────────────────────────────────────┐
│                    Azure (East Asia - 台灣)              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────┐    ┌────────────────────┐   │
│  │ Static Web Apps      │    │ Container Apps     │   │
│  │ (前端 Angular 20)     │───▶│ (後端 FastAPI)     │   │
│  │ ✓ 免費層             │    │ ✓ Docker 映像     │   │
│  │ ✓ CDN + HTTPS       │    │ ✓ 自動擴展        │   │
│  └──────────────────────┘    └─────────┬──────────┘   │
│                                        │               │
│                               ┌────────▼──────────┐   │
│                               │ PostgreSQL 容器   │   │
│                               │ + Azure Files     │   │
│                               │ (持久化存儲)       │   │
│                               └───────────────────┘   │
│                                                        │
│  ┌──────────────────────┐                            │
│  │ Container Registry   │                            │
│  │ (Docker 映像儲存)     │                            │
│  └──────────────────────┘                            │
└────────────────────────────────────────────────────────┘

外部: TradingView Webhook ──HTTPS──▶ Container Apps (/webhook)
```

## 💰 成本估算

| 服務 | 規格 | 每月費用（TWD） |
|------|------|----------------|
| Container Apps | 0.5 vCPU, 1GB RAM | 300-800 |
| Azure Files | 10GB | 100-200 |
| Container Registry | Basic | 170 |
| Static Web Apps | Free Tier | 0 |
| 流量費用 | ~50GB | 100-200 |
| **總計** | | **~670-1,370** |

## 🚀 部署步驟

### 前置準備

```bash
# 1. 登入 Azure（使用您的帳號）
az login

# 2. 設定訂閱
az account set --subscription "<您的訂閱ID>"

# 3. 設定變數
$RESOURCE_GROUP="trade-api-rg"
$LOCATION="eastasia"  # 台灣
$ACR_NAME="tradeacr$(Get-Random -Maximum 9999)"
$CONTAINER_APP_ENV="trade-env"
$CONTAINER_APP_NAME="trade-api-backend"
$STATIC_WEB_APP="trade-dashboard"
```

### 步驟 1: 建立資源群組

```bash
az group create `
  --name $RESOURCE_GROUP `
  --location $LOCATION
```

### 步驟 2: 建立 Container Registry

```bash
# 建立 ACR
az acr create `
  --resource-group $RESOURCE_GROUP `
  --name $ACR_NAME `
  --sku Basic `
  --location $LOCATION `
  --admin-enabled true

# 取得登入伺服器
$ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer --output tsv)
```

### 步驟 3: 建構並推送 Docker 映像

```bash
# 本機建構映像
cd C:\Users\User\Documents\Github\trade-api-dashboard-uni
docker build -t trade-api:latest .

# 登入 ACR
az acr login --name $ACR_NAME

# 標記映像
docker tag trade-api:latest ${ACR_LOGIN_SERVER}/trade-api:latest

# 推送到 ACR
docker push ${ACR_LOGIN_SERVER}/trade-api:latest
```

### 步驟 4: 建立 Container Apps Environment

```bash
# 安裝 Container Apps 擴充功能
az extension add --name containerapp --upgrade

# 建立 Container Apps Environment
az containerapp env create `
  --name $CONTAINER_APP_ENV `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION
```

### 步驟 5: 建立 Azure Files（PostgreSQL 資料持久化）

```bash
# 建立儲存體帳戶
$STORAGE_ACCOUNT="tradestorage$(Get-Random -Maximum 9999)"
az storage account create `
  --name $STORAGE_ACCOUNT `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION `
  --sku Standard_LRS

# 建立檔案共用
az storage share create `
  --name pgdata `
  --account-name $STORAGE_ACCOUNT `
  --quota 10

# 取得連接字串
$STORAGE_KEY=$(az storage account keys list --resource-group $RESOURCE_GROUP --account-name $STORAGE_ACCOUNT --query '[0].value' -o tsv)
```

### 步驟 6: 部署 PostgreSQL 容器

```bash
az containerapp create `
  --name trade-postgres `
  --resource-group $RESOURCE_GROUP `
  --environment $CONTAINER_APP_ENV `
  --image postgres:15-alpine `
  --target-port 5432 `
  --ingress internal `
  --min-replicas 1 `
  --max-replicas 1 `
  --cpu 0.25 `
  --memory 0.5Gi `
  --env-vars `
    "POSTGRES_DB=trade_api" `
    "POSTGRES_USER=tradeuser" `
    "POSTGRES_PASSWORD=<請設定強密碼>"

# 注意：需要設定 Azure Files 掛載（需在 Portal 設定）
```

### 步驟 7: 部署後端 API

```bash
# 取得 ACR 密碼
$ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

# 部署 Container App
az containerapp create `
  --name $CONTAINER_APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --environment $CONTAINER_APP_ENV `
  --image ${ACR_LOGIN_SERVER}/trade-api:latest `
  --target-port 8000 `
  --ingress external `
  --min-replicas 1 `
  --max-replicas 5 `
  --cpu 0.5 `
  --memory 1.0Gi `
  --registry-server $ACR_LOGIN_SERVER `
  --registry-username $ACR_NAME `
  --registry-password $ACR_PASSWORD `
  --env-vars `
    "DATABASE_URL=postgresql://tradeuser:<密碼>@trade-postgres:5432/trade_api" `
    "UNITRADE_WS_URL=<您的 WS URL>" `
    "UNITRADE_ACCOUNT=<您的帳號>" `
    "UNITRADE_PASSWORD=<您的密碼>" `
    "UNITRADE_CERT_FILE=/app/certs/your_cert.pfx" `
    "UNITRADE_CERT_PASSWORD=<憑證密碼>" `
    "UNITRADE_ACTNO=<您的交易帳號>" `
    "CORS_ORIGINS=https://<您的前端網域>"

# 取得後端 URL
$BACKEND_URL=$(az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)
echo "後端 API URL: https://$BACKEND_URL"
```

### 步驟 8: 上傳憑證檔到容器

由於憑證檔敏感，建議使用以下方式：

**方法 1: 使用 Azure Key Vault（推薦）**
```bash
# 建立 Key Vault
az keyvault create `
  --name trade-keyvault-$(Get-Random -Maximum 9999) `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION

# 上傳憑證（將憑證轉為 base64）
# TODO: 需手動操作
```

**方法 2: 打包進映像（測試環境）**
```bash
# 將 certs/ 資料夾加入 Dockerfile
# 不建議用於正式環境
```

### 步驟 9: 部署前端 Static Web App

```bash
# 建立 Static Web App
az staticwebapp create `
  --name $STATIC_WEB_APP `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION `
  --sku Free

# 取得部署 Token
$SWA_TOKEN=$(az staticwebapp secrets list --name $STATIC_WEB_APP --query properties.apiKey -o tsv)

# 建構前端
cd frontend
npm run build

# 部署（需要 Azure Static Web Apps CLI）
npm install -g @azure/static-web-apps-cli
swa deploy ./dist/futures-dashboard `
  --deployment-token $SWA_TOKEN `
  --app-location "/" `
  --output-location "/"
```

### 步驟 10: 設定前端 API 端點

編輯前端環境變數，指向後端 URL：

```typescript
// frontend/src/environments/environment.ts
export const environment = {
  production: true,
  apiUrl: 'https://<BACKEND_URL>'
};
```

## 🔒 環境變數清單

請準備以下資訊：

| 變數名稱 | 說明 | 範例 |
|---------|------|------|
| `UNITRADE_WS_URL` | Unitrade WebSocket URL | `wss://...` |
| `UNITRADE_ACCOUNT` | 統一期貨帳號 | `your_account` |
| `UNITRADE_PASSWORD` | 統一期貨密碼 | `your_password` |
| `UNITRADE_CERT_PASSWORD` | PFX 憑證密碼 | `cert_password` |
| `UNITRADE_ACTNO` | 交易帳號代碼 | `1234567` |
| `POSTGRES_PASSWORD` | PostgreSQL 密碼 | `StrongP@ssw0rd!` |

## 📝 TradingView Webhook 設定

部署完成後，在 TradingView 設定 Webhook URL：

```
https://<BACKEND_URL>/webhook
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

## 🔧 維護指南

### 更新後端程式碼

```bash
# 1. 重新建構映像
docker build -t trade-api:v2 .
docker tag trade-api:v2 ${ACR_LOGIN_SERVER}/trade-api:v2
docker push ${ACR_LOGIN_SERVER}/trade-api:v2

# 2. 更新 Container App
az containerapp update `
  --name $CONTAINER_APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --image ${ACR_LOGIN_SERVER}/trade-api:v2
```

### 查看日誌

```bash
# 後端日誌
az containerapp logs show `
  --name $CONTAINER_APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --follow

# 資料庫日誌
az containerapp logs show `
  --name trade-postgres `
  --resource-group $RESOURCE_GROUP `
  --follow
```

### 資料庫備份

```bash
# 執行備份（需進入容器）
az containerapp exec `
  --name trade-postgres `
  --resource-group $RESOURCE_GROUP `
  --command "pg_dump -U tradeuser trade_api > /backup/backup_$(date +%Y%m%d).sql"
```

## ⚡ 效能優化

### 1. 啟用 Application Insights

```bash
# 建立 Application Insights
az monitor app-insights component create `
  --app trade-api-insights `
  --location $LOCATION `
  --resource-group $RESOURCE_GROUP `
  --application-type web

# 取得連接字串並加入 Container App 環境變數
```

### 2. 設定自動擴展規則

```bash
az containerapp update `
  --name $CONTAINER_APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --min-replicas 1 `
  --max-replicas 10 `
  --scale-rule-name http-rule `
  --scale-rule-type http `
  --scale-rule-http-concurrency 50
```

## 🆘 故障排除

### 問題 1: Unitrade 連線逾時
- 檢查環境變數是否正確
- 確認憑證檔路徑
- 查看 Container App 日誌

### 問題 2: 資料庫連線失敗
- 確認 PostgreSQL 容器運行中
- 檢查內部 DNS 是否正確（trade-postgres）
- 檢查 DATABASE_URL 格式

### 問題 3: Webhook 403/404
- 確認 Container App 的 Ingress 設定為 External
- 檢查 CORS_ORIGINS 設定
- 測試 `/health` 端點

## 📊 監控

建議設定以下監控：

1. **可用性測試**：每 5 分鐘 ping `/health`
2. **警示規則**：
   - CPU > 80%
   - Memory > 80%
   - HTTP 5xx 錯誤
   - 資料庫連線失敗

## 💡 省錢秘訣

1. **使用 Spot 實例**（非關鍵時段）
2. **設定自動關閉**（夜間無交易時）
3. **使用保留實例**（長期使用可省 30-40%）
4. **定期清理舊資料**（資料庫瘦身）

## 🎯 下一步

- [ ] 設定 CI/CD（GitHub Actions）
- [ ] 啟用 SSL 憑證自動更新
- [ ] 設定備份排程
- [ ] 建立災難復原計劃
- [ ] 效能測試與壓力測試
