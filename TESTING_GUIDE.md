# 🧪 測試指南 - TradingView Webhook 自動下單系統

## 📝 系統資訊

### 🔗 部署網址

#### 後端 API (Azure Container Apps)
- **主要 URL**: `https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io`
- **健康檢查**: `https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/health`
- **API 文件**: `https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/docs`
- **Webhook 端點**: `https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/webhook`

#### 前端 Dashboard
- **本地 HTML**: `file:///C:/Users/User/Documents/Github/trade-api-dashboard-uni/static/dashboard.html`
- **Angular 開發伺服器** (待啟動): `http://localhost:4200`

---

## 🎯 TradingView Webhook 設定步驟

### 1️⃣ 在 TradingView 建立警報

1. 開啟 TradingView 圖表
2. 點擊「鬧鐘」圖示建立警報
3. 在「通知」選項中勾選 **Webhook URL**

### 2️⃣ 設定 Webhook URL

#### 模擬模式（建議先用此模式測試）
```
https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/webhook?simulation=true
```

#### 實單模式（確認無誤後使用）
```
https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/webhook
```

### 3️⃣ 設定 Webhook 訊息格式

在「訊息」欄位中輸入以下 JSON 格式：

#### A. 做多進場 (Long Entry)
```json
{
  "action": "long_entry",
  "symbol": "TXFA6",
  "price": "{{close}}",
  "quantity": 1
}
```

#### B. 做多出場 (Long Exit)
```json
{
  "action": "long_exit",
  "symbol": "TXFA6",
  "price": "{{close}}",
  "quantity": 1
}
```

#### C. 做空進場 (Short Entry)
```json
{
  "action": "short_entry",
  "symbol": "TXFA6",
  "price": "{{close}}",
  "quantity": 1
}
```

#### D. 做空出場 (Short Exit)
```json
{
  "action": "short_exit",
  "symbol": "TXFA6",
  "price": "{{close}}",
  "quantity": 1
}
```

### 📌 參數說明

| 參數 | 說明 | 範例 |
|------|------|------|
| `action` | 交易動作 | `long_entry`, `long_exit`, `short_entry`, `short_exit` |
| `symbol` | 商品代碼 | `TXFA6` (台指期), `MXFA6` (小台) |
| `price` | 價格 | `{{close}}` (使用收盤價), 或固定價格如 `18500` |
| `quantity` | 數量 | `1`, `2`, `3` 等整數 |

### 🔍 TradingView 可用變數

- `{{close}}` - 收盤價
- `{{open}}` - 開盤價
- `{{high}}` - 最高價
- `{{low}}` - 最低價
- `{{volume}}` - 成交量
- `{{ticker}}` - 商品代碼

---

## 🧪 測試流程

### 方法一：使用 PowerShell 手動測試 Webhook

```powershell
# 測試做多進場
$body = @{
    action = "long_entry"
    symbol = "TXFA6"
    price = 18500
    quantity = 1
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/webhook?simulation=true" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### 方法二：使用 curl 測試

```bash
curl -X POST "https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/webhook?simulation=true" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "long_entry",
    "symbol": "TXFA6",
    "price": 18500,
    "quantity": 1
  }'
```

### 方法三：使用 API 文件測試

1. 開啟 API 文件: https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/docs
2. 找到 `/webhook` 端點
3. 點擊「Try it out」
4. 輸入測試資料
5. 點擊「Execute」

---

## 📊 在 Dashboard 查看結果

### 開啟 Dashboard
```powershell
# 方法 1: 開啟靜態 HTML
Start-Process "C:\Users\User\Documents\Github\trade-api-dashboard-uni\static\dashboard.html"

# 方法 2: 啟動 Angular 開發伺服器
cd frontend
npm start
# 然後開啟 http://localhost:4200
```

### Dashboard 功能

1. **📋 委託紀錄**
   - 查看所有下單記錄
   - 篩選狀態、動作、商品代碼
   - 查看下單時間、價格、數量

2. **💼 目前持倉**
   - 查看目前持有的部位
   - 顯示未實現損益
   - 顯示持倉成本

3. **📜 可用商品**
   - 查看可交易的期貨商品
   - 顯示商品代碼和名稱

4. **🔗 TradingView 設定**
   - 顯示 Webhook URL
   - 提供訊息格式範例

---

## ✅ 測試檢查清單

### 後端健康檢查
- [ ] 健康檢查端點回應正常
  ```powershell
  Invoke-WebRequest -Uri "https://trade-api-backend.calmbeach-e69a7a95.eastasia.azurecontainerapps.io/health"
  ```

### Webhook 測試（模擬模式）
- [ ] 做多進場 webhook 觸發成功
- [ ] 做多出場 webhook 觸發成功
- [ ] 做空進場 webhook 觸發成功
- [ ] 做空出場 webhook 觸發成功

### Dashboard 驗證
- [ ] Dashboard 可正常開啟
- [ ] 可查看委託紀錄
- [ ] 可查看持倉狀態
- [ ] 資料即時更新

### TradingView 整合測試
- [ ] TradingView 警報設定完成
- [ ] Webhook URL 設定正確
- [ ] 觸發警報後可看到下單記錄
- [ ] Dashboard 有顯示新的委託

---

## 🔧 疑難排解

### 問題 1: Webhook 沒有回應
```powershell
# 檢查容器狀態
az containerapp show --name trade-api-backend --resource-group trade-api-rg --query properties.runningStatus

# 查看日誌
az containerapp logs show --name trade-api-backend --resource-group trade-api-rg --tail 50
```

### 問題 2: Dashboard 無法載入資料
- 檢查瀏覽器開發者工具 (F12) 的 Console 和 Network tab
- 確認 CORS 設定正確
- 確認後端 API URL 正確

### 問題 3: 下單失敗
- 檢查商品代碼是否正確
- 確認交易時間（期貨交易時間: 8:45-13:45, 15:00-次日05:00）
- 查看 API 日誌了解詳細錯誤

---

## 📞 支援資訊

### Azure 資源
- **資源群組**: `trade-api-rg`
- **區域**: `East Asia` (台灣)
- **Container App**: `trade-api-backend`
- **Container Registry**: `tradeacr3633`

### 資料庫
- **類型**: PostgreSQL 15
- **容器名稱**: `trade-postgres`
- **資料庫名稱**: `trade_api`

### 相關文件
- [DEPLOYMENT_HISTORY.md](DEPLOYMENT_HISTORY.md) - 部署歷史
- [DEPLOYMENT_UPDATE_20260224.md](DEPLOYMENT_UPDATE_20260224.md) - 最新部署報告
- [deployment-info.json](deployment-info.json) - 部署資訊

---

## 🎓 測試建議順序

1. ✅ 先測試後端健康檢查
2. ✅ 使用 PowerShell/curl 手動測試 Webhook（模擬模式）
3. ✅ 開啟 Dashboard 確認可看到測試記錄
4. ✅ 在 TradingView 設定 Webhook 並觸發測試警報
5. ✅ 確認 Dashboard 有顯示新的委託記錄
6. ✅ 確認所有功能正常後，切換到實單模式

**⚠️ 重要提醒**: 請先使用模擬模式 (`?simulation=true`) 充分測試，確認無誤後再切換到實單模式！
