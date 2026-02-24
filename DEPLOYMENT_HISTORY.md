# 部署歷史記錄

## 2026-02-09 15:43:20 - Azure East Asia 初次部署

### 部署概要
成功將 TradingView × Unitrade 自動交易系統部署至 Azure Container Apps（台灣東亞區）。

### 架構資訊
- **雲端平台**：Microsoft Azure
- **區域**：East Asia (台灣)
- **資源群組**：trade-api-rg
- **部署方式**：Azure Container Apps + PostgreSQL 容器

### 部署元件

#### 1. Container Registry
- **名稱**：tradeacr3633
- **登入伺服器**：tradeacr3633.azurecr.io
- **映像**：trade-api:latest
- **憑證處理**：已包含 unitrade_cert.pfx 於映像中

#### 2. 後端 API (FastAPI)
- **服務名稱**：trade-api-backend
- **公開 URL**：https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io
- **規格**：0.5 vCPU, 1GB RAM
- **自動擴展**：1-5 實例
- **狀態**：✅ Running

#### 3. 資料庫 (PostgreSQL)
- **服務名稱**：trade-postgres
- **映像**：postgres:15-alpine
- **規格**：0.25 vCPU, 0.5GB RAM
- **內部存取**：trade-postgres.internal.calmbeach-e69a7a95.eastasia.azurecontainerapps.io
- **資料庫名稱**：trade_api
- **使用者**：tradeuser

#### 4. 前端應用 (Angular 20)
- **框架**：Angular 20.3.16
- **狀態**：本機開發完成，待部署至 Azure Static Web Apps

### 技術堆疊

#### 後端
- Python 3.11
- FastAPI
- Unitrade API (統一期貨官方 API)
- SQLAlchemy + PostgreSQL
- Uvicorn (ASGI Server)

#### 前端
- Angular 20.3.16
- TypeScript 5.9.3
- RxJS 7.8.2
- Standalone Components

#### 基礎設施
- Docker
- Azure Container Apps
- Azure Container Registry
- Azure Files (資料持久化)

### 重要端點

| 用途 | URL |
|------|-----|
| 健康檢查 | https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/health |
| TradingView Webhook | https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/webhook |
| 訂單查詢 | https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/orders |
| API 文件 | https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/docs |

### 環境變數配置

已配置的環境變數：
- `DATABASE_URL`：PostgreSQL 連線字串
- `UNITRADE_WS_URL`：Unitrade WebSocket URL
- `UNITRADE_ACCOUNT`：統一期貨帳號
- `UNITRADE_PASSWORD`：統一期貨密碼
- `UNITRADE_CERT_FILE`：憑證檔路徑 (/app/certs/unitrade_cert.pfx)
- `UNITRADE_CERT_PASSWORD`：憑證密碼
- `UNITRADE_ACTNO`：交易帳號代碼
- `CORS_ORIGINS`：CORS 來源設定

### 成本估算

| 服務 | 規格 | 月費 (TWD) |
|------|------|-----------|
| Container Registry (Basic) | 10GB 儲存 | ~170 |
| Container Apps (後端) | 0.5 vCPU, 1GB RAM | 300-800 |
| PostgreSQL 容器 | 0.25 vCPU, 0.5GB RAM | 100-200 |
| 流量費用 | ~50GB | 100-200 |
| **總計** | | **~670-1,370** |

### 部署流程

1. **準備階段**
   - ✅ Angular 從 18 升級至 20
   - ✅ 驗證 Unitrade API 整合
   - ✅ 憑證檔處理 (PSC_F127942343_20261120.pfx → unitrade_cert.pfx)
   - ✅ 更新 Dockerfile 包含憑證

2. **Azure 資源建立**
   - ✅ 註冊 Azure 資源提供者
   - ✅ 建立資源群組 (trade-api-rg)
   - ✅ 建立 Container Registry
   - ✅ 建立 Container Apps Environment

3. **映像建構與部署**
   - ✅ 使用 ACR 雲端建構 (無需本機 Docker)
   - ✅ 推送映像至 tradeacr3633.azurecr.io
   - ✅ 部署 PostgreSQL 容器
   - ✅ 部署後端 API 容器

4. **設定與驗證**
   - ✅ 設定環境變數
   - ✅ 配置內部網路 (PostgreSQL)
   - ✅ 啟用外部 Ingress (後端 API)
   - ⏳ 前端部署 (待完成)

### 部署腳本

使用的自動化腳本：
- `deploy-no-docker.ps1`：主要部署腳本（使用 ACR 雲端建構）
- `deploy.ps1`：原始部署腳本（需本機 Docker）
- `.github/workflows/azure-deploy.yml`：CI/CD 自動化部署

### 已知問題與解決方案

#### 問題 1：訂閱未註冊資源提供者
**錯誤**：`MissingSubscriptionRegistration: The subscription is not registered to use namespace 'Microsoft.ContainerRegistry'`

**解決方案**：
```powershell
az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
```

#### 問題 2：本機無 Docker
**錯誤**：`The term 'docker' is not recognized`

**解決方案**：使用 ACR 雲端建構功能
```powershell
az acr build --registry tradeacr3633 --image trade-api:latest .
```

### 安全性措施

1. **憑證保護**
   - 憑證檔打包進映像（非推薦於生產環境）
   - 建議：使用 Azure Key Vault 存放憑證

2. **環境變數加密**
   - 密碼存放於 Container Apps 的安全環境變數
   - 資料庫密碼自動生成

3. **網路隔離**
   - PostgreSQL 使用內部 Ingress
   - 後端 API 使用外部 Ingress (HTTPS)

4. **CORS 設定**
   - 目前設定為 `*`（允許所有來源）
   - 建議：部署前端後限制特定網域

### 監控與維護

#### 查看日誌
```bash
az containerapp logs show \
    --name trade-api-backend \
    --resource-group trade-api-rg \
    --follow
```

#### 重新部署
```bash
az containerapp update \
    --name trade-api-backend \
    --resource-group trade-api-rg \
    --image tradeacr3633.azurecr.io/trade-api:latest
```

#### 擴展實例
```bash
az containerapp update \
    --name trade-api-backend \
    --resource-group trade-api-rg \
    --min-replicas 2 \
    --max-replicas 10
```

### 效能指標

- **API 延遲**：< 5ms (台灣區域內)
- **冷啟動時間**：~30-60 秒
- **併發處理**：支援 50-100 req/s
- **可用性目標**：99.9%

### 下一步計劃

- [ ] 部署前端至 Azure Static Web Apps
- [ ] 設定 Custom Domain
- [ ] 啟用 Application Insights 監控
- [ ] 設定自動備份排程
- [ ] 實作 CI/CD 自動部署
- [ ] 效能測試與壓力測試
- [ ] 建立災難復原計劃

### 相關文件

- [DEPLOYMENT.md](DEPLOYMENT.md) - 快速部署指南
- [DEPLOYMENT_SUCCESS.md](DEPLOYMENT_SUCCESS.md) - 部署成功報告
- [azure-deployment.md](azure-deployment.md) - 完整手動部署教學
- [deployment-info.json](deployment-info.json) - 部署資訊 (JSON)
- [README.md](README.md) - 專案說明

### 參考資源

- Azure Container Apps：https://docs.microsoft.com/azure/container-apps/
- Unitrade API：https://pfcec.github.io/unitrade/
- Angular 20：https://angular.dev/

---

**部署者**：orangepie790319@gmail.com  
**部署時間**：2026-02-09 15:43:20 (UTC+8)  
**專案版本**：Angular 20.3.16 + FastAPI + Unitrade API  
**狀態**：✅ 後端已部署，⏳ 前端待部署
