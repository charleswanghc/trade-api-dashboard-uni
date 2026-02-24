# TradingView × Unitrade 自動交易系統

此專案將原本的 Shioaji 架構改為 **Angular 20 前端 + FastAPI 後端**，並使用 **統一期貨 Unitrade 官方 Python API** 進行下單。

## ✨ 新功能：訊號驅動交易

**v2.0 新增！** 現在支援「簡化版訊號」，TradingView 只需傳送訊號類型，所有交易參數由系統集中管理：

- 🎯 **商品映射** - 訊號可以是大台，實際下單改為小台
- 📊 **口數倍數** - 訊號 1 口，系統自動乘以 2 口、3 口下單
- ⚙️ **集中管理** - 前端 UI 統一設定，無需修改 TradingView 策略
- 📜 **訊號歷史** - 完整記錄所有訊號和處理結果

**快速開始：** 參考 [QUICKSTART.md](QUICKSTART.md) 或 [詳細設定指南](docs/tradingview-signal-setup.md)

---

## 🚀 快速開始

完整部署指南請參考：**[DEPLOYMENT.md](DEPLOYMENT.md)**

### 本機開發

```bash
# 後端
docker compose up -d

# 前端
cd frontend
npm install
npm start
```

## 🔗 官方資源

- Unitrade 官方文件：https://pfcec.github.io/unitrade/
- Unitrade 快速開始：https://pfcec.github.io/unitrade/開始/
- Unitrade API 參考：https://pfcec.github.io/unitrade/API/
- Unitrade 教學 Notebook：https://colab.research.google.com/github/PFCEC/unitrade/blob/main/教學/sample/unitrade_Demo.ipynb

## ✅ 功能目標

- ✅ TradingView Webhook 自動下單
- ✅ **訊號驅動交易**（v2.0 新增）
  - ✅ 策略管理系統
  - ✅ 商品映射設定
  - ✅ 口數倍數控制
  - ✅ 訊號歷史記錄
- ✅ Angular 20 Dashboard（SPA）
- ✅ FastAPI 後端 API
- ✅ Unitrade API 下單
- ✅ Azure 部署（台灣區域優化）
### 訊號驅動交易流程（v2.0）

```
TradingView 策略
    ↓ (簡化訊號)
    ↓ {"strategy": "TXF_vivi_mini", "signal": "long_entry", "quantity": 1}
    ↓
/signal Endpoint
    ↓ (查詢策略設定)
    ↓
Strategy Config
    - 商品: TXFF5 → MXFF5
    - 倍數: 1 → 2
    - 參數: 限價/市價...
    ↓
Unitrade API → 統一期貨下單
```

### 傳統 Webhook 流程（仍支援）

```
TradingView Alert
    → HTTPS Webhook (完整參數)
## 🧱 系統架構

```
TradingView Alert
    → HTTPS Webhook
    → FastAPI
    → Unitrade API
    → 統一期貨下單

Angular SPA → REST API → FastAPI
```

## 📦 目錄結構（重點）

```
trade-api-dashboard-uni/
├── main.py                  # FastAPI 後端
├── unitrade_client.py       # Unitrade 登入/下單
├── database.py              # DB 連線
├── models.py                # 訂單資料表
├── db/                      # SQL migrations
├── frontend/                # Angular 前端
└── docker-compose.yaml      # Docker 編排
```

## ⚙️ 環境變數

複製範例檔案：

```
cp example.env .env
```

重點欄位（詳見 [example.env](example.env)）：

- `UNITRADE_WS_URL`
- `UNITRADE_ACCOUNT`
- `UNITRADE_PASSWORD`
- `UNITRADE_CERT_FILE`
- `UNITRADE_CERT_PASSWORD`
- `UNITRADE_ACTNO`

憑證與帳號放置位置請參考：[docs/credentials.md](docs/credentials.md)

## 🚀 後端（FastAPI）

### API 端點

| 方法 | 路徑 | 用途 |
|------|------|------|
| POST | /webhook | TradingView Webhook 下單 |
| POST | /order | Angular 手動下單 |
| GET | /health | 健康檢查 |
| GET | /orders | 訂單列表（簡易） |

### Webhook 範例（DOrderObject 參數）

```json
{
  "actno": "1234567",
  "subactno": "",
  "productid": "TXFF5",
  "bs": "B",
  "ordertype": "L",
  "price": 17850,
  "orderqty": 1,
  "ordercondition": "R",
  "opencloseflag": "",
  "dtrade": "N",
  "note": "TV",
  "strategy": "EMA_CROSS"
}
```

### 下單欄位重點

- `productid`：商品代碼（內期）
- `bs`：B=買進，S=賣出
- `ordertype`：L=限價，M=市價，P=範圍市價
- `ordercondition`：R=ROD，I=IOC，F=FOK
- `opencloseflag`：空白=自動，0=新倉，1=平倉
- `dtrade`：Y=當沖，N=非當沖
- `note`：限 10 碼非中文

### 手動下單範例

```json
{
  "actno": "1234567",
  "productid": "TXFF5",
  "bs": "S",
  "ordertype": "L",
  "price": 17820,
  "orderqty": 1,
  "ordercondition": "R",
  "opencloseflag": "",
  "dtrade": "N",
  "note": "Manual",
  "strategy": "Manual"
}
``` 20）

前端位於 [frontend/](frontend/)：

- Angular 20.3.16
- Standalone Components
- Reactive Forms
- HttpClient
- SPA Router

頁面模組：Dashboard / Orders / Positions / Trades / Alerts

> Dashboard UI 以原本的 [static/dashboard.html](static/dashboard.html) 為重寫參考。

### 前端啟動

```bash
cd frontend
npm install
npm start
```

### 前端建置

```bash
cd frontend
npm run build -- --configuration productionnd
npm install
npm start
```

預設 Dashboard：

```
http://localhost:4200
```

## 🐳 Docker（後端 + DB）

```
docker compose up -d
```

FastAPI Swagger：

```
http://localhost:9879/docs
```

## ✅ 驗證流程（Webhook → 下單 → 畫面顯示）

1. 啟動後端與前端
2. TradingView Webhook 指向 `http(s)://<domain>/webhook`
3. Webhook 送出下單 JSON
4. 後端寫入資料庫（source=webhook）
5. 前端 Azure 部署

### 🎯 推薦方案（台灣優化）

| 服務 | Azure 方案 | 月費估算 |
|------|-----------|---------|
| 後端 API | Container Apps | NT$ 300-800 |
| 資料庫 | PostgreSQL 容器 | NT$ 100-300 |
| 前端 | Static Web Apps (Free) | NT$ 0 |
| **總計** | | **NT$ 400-1,100** |

### 快速部署

**完整教學請參考：[DEPLOYMENT.md](DEPLOYMENT.md)**

```powershell
# 1. 登入 Azure
az login

# 2. 執行自動化部署腳本
.\deploy.ps1 `
    -UnitradeWsUrl "wss://your-ws-url" `
    -UnitradeAccount "your_account" `
    -UnitradePassword "your_password" `
    -UnitradeCertPassword "cert_password" `
    -UnitradeActno "your_actno"
```

### 部署檔案

- [DEPLOYMENT.md](DEPLOYMENT.md) - 快速部署指南
- [azure-deployment.md](azure-deployment.md) - 完整手動部署教學
- [deploy.ps1](deploy.ps1) - 自動化部署腳本
- [.github/workflows/azure-deploy.yml](.github/workflows/azure-deploy.yml) - CI/CD 設定

### 其他雲端平台

也可部署至：
- Google Cloud Run
- Google Compute Engine（Linux VM）
- AWS ECS / App Runner
```

### 雲端

- Azure App Service（Linux + Docker）
- Azure Container Apps
- Google Cloud Run
- Google Compute Engine（Linux VM）

Azure 部署細節請見：[docs/azure-deploy.md](docs/azure-deploy.md)

## 📌 注意事項

- Webhook 必須使用 HTTPS（可用 ngrok 或 NGINX）
- 正式交易請務必先做模擬驗證
- 憑證與 .env 請勿提交到版本控制