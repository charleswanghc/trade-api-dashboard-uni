# TradingView × Unitrade 自動交易系統

此專案將原本的 Shioaji 架構改為 **Angular 前端 + FastAPI 後端**，並使用 **統一期貨 Unitrade 官方 Python API** 進行下單。

## 🔗 官方資源

- Unitrade 官方文件：https://pfcec.github.io/unitrade/
- Unitrade 快速開始：https://pfcec.github.io/unitrade/開始/
- Unitrade API 參考：https://pfcec.github.io/unitrade/API/
- Unitrade 教學 Notebook：https://colab.research.google.com/github/PFCEC/unitrade/blob/main/教學/sample/unitrade_Demo.ipynb

## ✅ 功能目標

- TradingView Webhook 自動下單
- Angular 18+ Dashboard（SPA）
- FastAPI 後端 API
- Unitrade API 下單
- 可部署至 Azure / Google Cloud（Linux 環境）

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
```

## 🧭 前端（Angular）

前端位於 [frontend/](frontend/)：

- Angular 18+
- Reactive Forms
- HttpClient
- SPA Router

頁面模組：Dashboard / Orders / Positions / Trades / Alerts

> Dashboard UI 以原本的 [static/dashboard.html](static/dashboard.html) 為重寫參考。

### 前端啟動

```
cd frontend
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
5. 前端 Orders 頁面會顯示最新訂單（含 source）

快速測試（以本機為例）：

```
curl -X POST http://localhost:9879/webhook \
  -H "Content-Type: application/json" \
  -d '{"actno":"1234567","productid":"TXFF5","bs":"B","ordertype":"L","price":17850,"orderqty":1,"ordercondition":"R","opencloseflag":"","dtrade":"N","note":"TV"}'
```

## ☁️ 部署（參考）

### Dockerfile

```
FROM python:3.11
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
CMD uvicorn main:app --host 0.0.0.0 --port 8000
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