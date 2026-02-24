# 系統更新摘要

## 🎯 主要變更

本次更新實作了「訊號驅動交易」架構，讓 TradingView 只需傳送簡單訊號，所有交易參數由系統集中管理。

---

## 📦 新增功能

### 1. 策略管理系統

- **資料表：** `strategy_config`
- **功能：**
  - 商品映射（訊號商品 → 實際下單商品）
  - 口數倍數設定
  - 進場/出場單別獨立設定
  - 啟用/停用控制

### 2. 訊號歷史記錄

- **資料表：** `signal_history`
- **功能：**
  - 記錄所有接收到的訊號
  - 追蹤訊號處理狀態
  - 關聯實際下單結果

### 3. 新增 API Endpoints

| Method | Endpoint | 說明 |
|--------|----------|------|
| `POST` | `/signal` | 接收 TradingView 訊號 |
| `GET` | `/strategies` | 列出所有策略 |
| `POST` | `/strategies` | 建立策略 |
| `PUT` | `/strategies/{name}` | 更新策略 |
| `DELETE` | `/strategies/{name}` | 刪除策略 |
| `PATCH` | `/strategies/{name}/toggle` | 啟用/停用 |
| `GET` | `/signals` | 查詢訊號歷史 |

### 4. 前端管理介面

- **新頁面：** `/strategies`
- **功能：**
  - 視覺化策略設定
  - 即時啟用/停用
  - 商品映射和口數倍數管理

---

## 📂 檔案變更

### 後端

- ✅ `db/migrations/004_add_strategy_config.sql` - 資料庫遷移
- ✅ `models.py` - 新增 `StrategyConfig` 和 `SignalHistory` 模型
- ✅ `main.py` - 新增訊號處理和策略管理 API

### 前端

- ✅ `frontend/src/app/pages/strategies.component.ts` - 策略管理頁面
- ✅ `frontend/src/app/services/api.service.ts` - API 服務更新
- ✅ `frontend/src/app/app.routes.ts` - 路由配置
- ✅ `frontend/src/app/app.component.ts` - 導航選單

### 文件

- ✅ `docs/tradingview-signal-setup.md` - 簡化版設定指南
- ✅ `docs/database-migration.md` - 資料庫遷移指南
- ✅ `tradingview_webhook_example.pine` - Pine Script 範例

---

## 🚀 部署步驟

### 1. 資料庫遷移

```bash
# 執行遷移腳本
psql $DATABASE_URL -f db/migrations/004_add_strategy_config.sql
```

### 2. 重新部署後端

```bash
# 如果使用 Azure Container Apps
.\deploy-no-docker.ps1 -UnitradeWsUrl "..." -UnitradeAccount "..." \
  -UnitradePassword "..." -UnitradeCertPassword "..." -UnitradeActno "..."

# 或手動重啟
az containerapp revision restart --name <app-name> --resource-group <rg-name>
```

### 3. 重新部署前端

```bash
# 前端會自動隨後端部署更新
# 如需單獨部署前端，可執行：
cd frontend
npm run build
```

### 4. 驗證部署

```bash
# 檢查健康狀態
curl https://your-api.azurewebsites.net/health

# 查詢預設策略
curl https://your-api.azurewebsites.net/strategies

# 測試訊號
curl -X POST https://your-api.azurewebsites.net/signal \
  -H "Content-Type: application/json" \
  -d '{"strategy":"TXF_vivi","signal":"long_entry","quantity":1}'
```

---

## 📊 使用流程

### 舊版流程（完整訊號）

```
TradingView → Webhook（包含所有參數）→ API → 下單
```

### 新版流程（簡化訊號）

```
TradingView → 簡化訊號 → API → 查詢策略設定 → 計算參數 → 下單
```

---

## 🎬 使用範例

### 場景：大台訊號改下小台

**步驟 1：建立策略**

```bash
curl -X POST https://your-api.azurewebsites.net/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_name": "TXF_to_mini",
    "source_product": "TXFF5",
    "target_product": "MXFF5",
    "quantity_multiplier": 2,
    "entry_order_type": "L",
    "exit_order_type": "M",
    "enabled": true
  }'
```

**步驟 2：TradingView 設定**

```pine
strategyName = input.string("TXF_to_mini", title="策略名稱")

// 進場訊號
strategy.entry("Buy", strategy.long, 
    alert_message='{"strategy":"' + strategyName + '","signal":"long_entry","quantity":1}')
```

**步驟 3：TradingView Alert**

- URL: `https://your-api.azurewebsites.net/signal`
- 訊息: `{{strategy.order.alert_message}}`

**結果：**
- 訊號：TXFF5 1口
- 實際下單：MXFF5 2口

---

## ⚠️ 重要注意事項

### 1. 向後相容性

- ✅ 保留舊的 `/webhook` endpoint
- ✅ 可同時使用舊版和新版
- ✅ 不影響現有功能

### 2. 資料庫變更

- 新增 2 個表格，不影響現有表格
- 預設建立 3 個範例策略
- 可安全回滾

### 3. 前端變更

- 新增「策略管理」頁面
- 不影響現有頁面功能

---

## 🧪 測試清單

- [ ] 資料庫遷移成功
- [ ] API 服務正常啟動
- [ ] 前端可以訪問策略管理頁面
- [ ] 可以建立/更新/刪除策略
- [ ] 可以啟用/停用策略
- [ ] TradingView 可以發送訊號到 `/signal`
- [ ] 訊號正確轉換為訂單
- [ ] 訊號歷史正確記錄

---

## 📚 相關文件

- [TradingView 訊號設定指南](./docs/tradingview-signal-setup.md)
- [資料庫遷移指南](./docs/database-migration.md)
- [API 文件](./README.md)

---

**版本：** 2.0  
**更新日期：** 2026-02-09
