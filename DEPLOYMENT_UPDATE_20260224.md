# 部署更新報告 - 2026-02-24

## 📋 概要

本次更新完成了專案程式碼的完整打包和雲端部署更新，包括 Git 歷史文件建立和 Azure Container Apps 映像更新。

## ✅ 完成項目

### 1. Git 歷史文件建立
- **檔案**: `DEPLOYMENT_HISTORY.md`
- **內容**: 完整的 Azure 部署歷史記錄
  - 架構圖
  - 成本分析
  - 部署步驟
  - 疑難排解指南
  - 維護命令
- **Commit**: `67bb797`
- **分支**: `main`
- **狀態**: ✅ 已推送至 GitHub

### 2. Docker 映像建構
- **Registry**: `tradeacr3633.azurecr.io`
- **Repository**: `trade-api`
- **Tags**: 
  - `latest` (永遠指向最新版本)
  - `20260224-165207` (時間戳版本)
- **建構時間**: 2026-02-24 16:52:07
- **建構方式**: ACR Cloud Build (無需本地 Docker)
- **狀態**: ✅ 建構成功並上傳至 ACR

### 3. Azure Container App 更新
- **名稱**: `trade-api-backend`
- **資源群組**: `trade-api-rg`
- **區域**: East Asia (台灣)
- **映像**: `tradeacr3633.azurecr.io/trade-api:latest`
- **最後更新時間**: 2026-02-24 08:56:22 (UTC)
- **配置狀態**: Succeeded
- **執行狀態**: Running
- **修訂版本**: `trade-api-backend--nwletzf`

## 🌐 部署端點

| 端點類型 | URL |
|---------|-----|
| **主要 URL** | https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io |
| **健康檢查** | https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/health |
| **API 文件** | https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/docs |
| **Webhook** | https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/webhook |

## 📦 部署內容

### 包含的程式碼檔案
- `main.py` - FastAPI 主應用程式
- `database.py` - 資料庫連接層
- `models.py` - SQLAlchemy 資料模型
- `unitrade_client.py` - Unitrade API 客戶端
- `requirements.txt` - Python 相依套件
- `certs/unitrade_cert.pfx` - Unitrade API 憑證

### 環境變數設定
- `DATABASE_URL` - PostgreSQL 連線字串
- `UNITRADE_WS_URL` - Unitrade WebSocket URL
- `UNITRADE_ACCOUNT` - 帳號 (80009802591)
- `UNITRADE_PASSWORD` - API 密碼
- `UNITRADE_CERT_FILE` - 憑證路徑 (/app/certs/unitrade_cert.pfx)
- `UNITRADE_CERT_PASSWORD` - 憑證密碼
- `UNITRADE_ACTNO` - 交易帳號
- `CORS_ORIGINS` - CORS 設定

## 🔧 技術規格

### Container App 規格
- **CPU**: 0.5 vCPU
- **記憶體**: 1 GB
- **儲存空間**: 2 GB (ephemeral)
- **最小副本數**: 1
- **最大副本數**: 5
- **冷卻時間**: 300 秒

### 資料庫連線
- **主機**: trade-postgres (容器內部)
- **資料庫**: trade_api
- **使用者**: tradeuser
- **密碼**: bQaswP6BE1oTUJvAWYtd

## 📊 部署時間軸

```
16:52:07 - ACR 開始建構映像
16:52:XX - 映像建構完成，上傳至 ACR
16:56:22 - Container App 更新完成
16:56:XX - 應用程式啟動並執行中
```

## 🎯 下一步建議

### 1. 驗證部署
```powershell
# 測試健康檢查
Invoke-WebRequest -Uri "https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/health"

# 查看 API 文件
Start-Process "https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/docs"

# 檢查容器日誌
az containerapp logs show --name trade-api-backend --resource-group trade-api-rg --tail 50
```

### 2. 前端部署
- 更新前端環境變數指向後端 URL
- 建構 Angular 應用程式（production mode）
- 部署至 Azure Static Web Apps

### 3. 監控設定
```powershell
# 檢視即時日誌
az containerapp logs show --name trade-api-backend --resource-group trade-api-rg --follow

# 檢視修訂版本
az containerapp revision list --name trade-api-backend --resource-group trade-api-rg --output table

# 檢視容器狀態
az containerapp show --name trade-api-backend --resource-group trade-api-rg --query properties.runningStatus
```

## 📝 備註

- 本次部署使用 ACR Cloud Build，無需本地 Docker 環境
- 映像包含最新的程式碼變更和憑證檔案
- Container App 自動從 ACR 拉取 `latest` 標籤映像
- 如需回滾，可使用時間戳標籤: `20260224-165207`

## 🔗 相關文件

- [DEPLOYMENT_HISTORY.md](DEPLOYMENT_HISTORY.md) - 完整部署歷史
- [DEPLOYMENT.md](DEPLOYMENT.md) - 快速部署指南
- [DEPLOYMENT_SUCCESS.md](DEPLOYMENT_SUCCESS.md) - 初次部署報告
- [deployment-info.json](deployment-info.json) - 部署資訊 JSON

---

**部署狀態**: ✅ 成功  
**部署時間**: 2026-02-24 16:56:22  
**Git Commit**: 67bb797  
**映像標籤**: 20260224-165207
