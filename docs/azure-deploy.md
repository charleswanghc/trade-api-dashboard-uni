# Azure 部署指引

本專案建議分成兩個服務部署：

- 後端 FastAPI（Docker 容器）→ Azure App Service 或 Azure Container Apps
- 前端 Angular（靜態檔案）→ Azure Static Web Apps 或 Azure Storage + CDN

## 1) 後端：Azure App Service（Linux + Docker）

### 需求

- Azure 訂閱
- Azure CLI
- Docker（本機或 CI 產出映像）

### 建議流程（App Service + ACR）

1. 建立資源群組
2. 建立 ACR
3. 建構映像並推送到 ACR
4. 建立 App Service（Linux）並指向映像
5. 設定環境變數

### 必要環境變數

```
UNITRADE_WS_URL=...
UNITRADE_ACCOUNT=...
UNITRADE_PASSWORD=...
UNITRADE_CERT_FILE=/app/certs/your_cert.pfx
UNITRADE_CERT_PASSWORD=...
UNITRADE_ACTNO=...
DATABASE_URL=postgresql://<user>:<pass>@<host>:5432/trade_api
CORS_ORIGINS=https://<your-frontend-domain>
```

### 憑證檔

建議使用 App Service 的「自訂啟動」或「掛載 Azure Files」方式放置 `/app/certs/your_cert.pfx`。

## 2) 後端：Azure Container Apps（可選）

適合：需要彈性擴縮或多環境設定。

重點：
- 使用 Container Apps + ACR
- 以環境變數注入帳密
- 憑證檔透過 Azure Files 掛載

## 3) 前端：Azure Static Web Apps

1. 使用 `npm run build` 產出 `dist/futures-dashboard`
2. 建立 Static Web Apps
3. 將 `dist/futures-dashboard` 發佈
4. 設定 API 端點（如需要反向代理）

## 4) 網域與 Webhook

TradingView Webhook 必須是 HTTPS。

- App Service 預設提供 HTTPS
- NGINX 反向代理可選

Webhook URL 範例：

```
https://<your-app>.azurewebsites.net/webhook
```
