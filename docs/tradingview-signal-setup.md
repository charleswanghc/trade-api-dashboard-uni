# TradingView 訊號整合指南（簡化版）

## 🎯 核心概念

此版本讓您的 TradingView 策略只需傳送**簡單的訊號**（進場/出場），所有交易參數（商品代碼、口數倍數）都在系統中統一管理。

### ✨ 優勢

1. **不用修改 TradingView 策略** - 策略只傳送訊號，參數都在系統設定
2. **靈活的商品映射** - 訊號可以是大台，實際下單改為小台
3. **動態口數倍數** - 訊號 1 口，實際可以下 2 口、3 口或更多
4. **集中管理** - 所有策略參數在前後端 UI 統一設定

---

## 📋 目錄

1. [系統架構](#系統架構)
2. [策略設定](#策略設定)
3. [TradingView 設定](#tradingview-設定)
4. [API 使用範例](#api-使用範例)
5. [常見場景](#常見場景)

---

## 🏗️ 系統架構

```
TradingView 策略
    ↓ (簡單訊號)
    ↓ {"strategy": "TXF_vivi_mini", "signal": "long_entry", "quantity": 1}
    ↓
API /signal Endpoint
    ↓ (查詢策略設定)
    ↓
Strategy Config (資料庫)
    - 商品映射: TXFF5 → MXFF5
    - 口數倍數: 1 → 2
    - 下單參數: 限價/市價/IOC...
    ↓
實際下單
    - 商品: MXFF5 (小台)
    - 數量: 2 口
    - 類型: 限價單
```

---

## ⚙️ 策略設定

### 策略設定欄位說明

| 欄位 | 說明 | 範例 |
|------|------|------|
| `strategy_name` | 策略名稱（唯一） | `TXF_vivi_mini` |
| `source_product` | 訊號商品代碼 | `TXFF5` (大台) |
| `target_product` | 實際下單商品 | `MXFF5` (小台) |
| `quantity_multiplier` | 口數倍數 | `2` (訊號1口=實際2口) |
| `max_position` | 最大持倉口數 | `10` |
| `entry_order_type` | 進場單別 | `L`(限價) / `M`(市價) |
| `entry_order_condition` | 進場委託條件 | `R`(ROD) / `I`(IOC) |
| `exit_order_type` | 出場單別 | `M`(市價) |
| `exit_order_condition` | 出場委託條件 | `I`(IOC) |
| `dtrade` | 是否當沖 | `Y` / `N` |
| `enabled` | 是否啟用 | `true` / `false` |

### 預設策略範例

安裝後會自動建立以下預設策略：

#### 1. **TXF_vivi** - 標準大台策略
```json
{
  "strategy_name": "TXF_vivi",
  "source_product": "TXFF5",
  "target_product": "TXFF5",
  "quantity_multiplier": 1,
  "entry_order_type": "L",
  "exit_order_type": "M",
  "description": "大台轉大台，1倍口數"
}
```

#### 2. **TXF_vivi_mini** - 大台訊號轉小台
```json
{
  "strategy_name": "TXF_vivi_mini",
  "source_product": "TXFF5",
  "target_product": "MXFF5",
  "quantity_multiplier": 2,
  "entry_order_type": "L",
  "exit_order_type": "M",
  "description": "大台訊號轉小台：訊號1口 = 實際2口小台"
}
```

#### 3. **TXF_vivi_3x** - 3倍口數
```json
{
  "strategy_name": "TXF_vivi_3x",
  "source_product": "TXFF5",
  "target_product": "TXFF5",
  "quantity_multiplier": 3,
  "entry_order_type": "L",
  "exit_order_type": "M",
  "description": "大台3倍口數：訊號1口 = 實際3口"
}
```

---

## 📡 TradingView 設定

### Pine Script 修改（極簡版）

您的 Pine Script 只需要傳送簡單的訊號訊息：

```pine
//@version=5
strategy("My_Strategy", overlay=true, pyramiding=2)

// ========== Webhook 參數（只需設定策略名稱）==========
strategyName = input.string("TXF_vivi_mini", title="策略名稱",
    tooltip="對應後端系統的策略設定")

// ========== 您的策略指標計算（邏輯保留在您本機，此處不公開）==========
// 請將您原本的指標計算程式碼放在這裡

var series float lastMarketPosition = 0
var float entryPrice = na
entryPrice := strategy.opentrades.entry_price(strategy.opentrades - 1)
lastMarketPosition := strategy.position_size

// ========== 做多進場：替換 /* ... */ 為您的條件 ==========
if (/* 您的做多進場條件 */ and lastMarketPosition <= 0)
    strategy.entry("Buy", strategy.long, stop=entryPrice,
        alert_message='{"strategy":"' + strategyName + '","signal":"long_entry","quantity":1,"price":' + str.tostring(entryPrice) + ',"note":"Buy"}')

// ========== 做空進場：替換 /* ... */ 為您的條件 ==========
if (/* 您的做空進場條件 */)
    strategy.entry("Sell", strategy.short, stop=entryPrice,
        alert_message='{"strategy":"' + strategyName + '","signal":"short_entry","quantity":1,"price":' + str.tostring(entryPrice) + ',"note":"Sell"}')

// ========== 多單出場：替換 /* ... */ 為您的條件 ==========
if (lastMarketPosition > 0)
    yourLongExitStop = close  // 替換為您的實際停損價格
    if (/* 您的多單出場條件 */)
        strategy.exit("Exit Long", stop=yourLongExitStop,
            alert_message='{"strategy":"' + strategyName + '","signal":"long_exit","quantity":1,"note":"ExitL"}')

// ========== 空單出場：替換 /* ... */ 為您的條件 ==========
if (lastMarketPosition < 0)
    yourShortExitStop = close  // 替換為您的實際停損價格
    if (/* 您的空單出場條件 */)
        strategy.exit("Exit Short", stop=yourShortExitStop,
            alert_message='{"strategy":"' + strategyName + '","signal":"short_exit","quantity":1,"note":"ExitS"}')
```

### 訊號格式 (JSON)

```json
{
  "strategy": "TXF_vivi_mini",
  "signal": "long_entry",
  "quantity": 1,
  "price": 21500,
  "note": "Buy"
}
```

**欄位說明：**
- `strategy` **(必填)** - 策略名稱，對應資料庫中的設定
- `signal` **(必填)** - 訊號類型：
  - `long_entry` - 做多進場
  - `long_exit` - 做多出場
  - `short_entry` - 做空進場
  - `short_exit` - 做空出場
- `quantity` - 訊號數量（預設 1，會乘以倍數）
- `price` - 訊號價格（選填，進場時可提供）
- `note` - 備註（最多 10 字元）

### TradingView Alert 設定

1. **建立警報**
   - 條件：選擇您的策略
   - 選擇：「Order fills and alert() function calls only」

2. **Webhook 設定**
   - URL: `https://your-api.azurewebsites.net/signal`  ⚠️ 注意是 **/signal** 而非 /webhook
   - 訊息: `{{strategy.order.alert_message}}`

3. **完成設定**
   - 頻率：All（每次觸發）
   - 點擊「建立」

---

## 🔌 API 使用範例

### 1. 建立策略設定

```bash
curl -X POST https://your-api.azurewebsites.net/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_name": "TXF_vivi_mini",
    "source_product": "TXFF5",
    "target_product": "MXFF5",
    "quantity_multiplier": 2,
    "entry_order_type": "L",
    "exit_order_type": "M",
    "exit_order_condition": "I",
    "dtrade": "N",
    "enabled": true,
    "description": "大台訊號轉小台"
  }'
```

### 2. 查詢所有策略

```bash
curl https://your-api.azurewebsites.net/strategies
```

### 3. 更新策略設定

```bash
curl -X PUT https://your-api.azurewebsites.net/strategies/TXF_vivi_mini \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_name": "TXF_vivi_mini",
    "source_product": "TXFF5",
    "target_product": "MXFF5",
    "quantity_multiplier": 3,
    "entry_order_type": "L",
    "exit_order_type": "M",
    "exit_order_condition": "I",
    "dtrade": "N",
    "enabled": true
  }'
```

### 4. 啟用/停用策略

```bash
# 切換策略啟用狀態
curl -X PATCH https://your-api.azurewebsites.net/strategies/TXF_vivi_mini/toggle
```

### 5. 測試訊號

```bash
curl -X POST https://your-api.azurewebsites.net/signal \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "TXF_vivi_mini",
    "signal": "long_entry",
    "quantity": 1,
    "price": 21500,
    "note": "test"
  }'
```

### 6. 查詢訊號歷史

```bash
# 查詢所有訊號
curl https://your-api.azurewebsites.net/signals

# 查詢特定策略的訊號
curl https://your-api.azurewebsites.net/signals?strategy=TXF_vivi_mini
```

---

## 🎬 常見場景

### 場景 1：大台訊號改下小台

**需求：** TradingView 策略是大台，但實際想下小台

**解決方案：**
```json
{
  "strategy_name": "TXF_to_mini",
  "source_product": "TXFF5",
  "target_product": "MXFF5",
  "quantity_multiplier": 1
}
```

**TradingView 訊號：**
```json
{"strategy": "TXF_to_mini", "signal": "long_entry", "quantity": 1}
```

**實際下單：** MXFF5 (小台) 1 口

---

### 場景 2：訊號 1 口，實際下 3 口

**需求：** 想要放大訊號規模

**解決方案：**
```json
{
  "strategy_name": "TXF_3x",
  "source_product": "TXFF5",
  "target_product": "TXFF5",
  "quantity_multiplier": 3
}
```

**TradingView 訊號：**
```json
{"strategy": "TXF_3x", "signal": "long_entry", "quantity": 1}
```

**實際下單：** TXFF5 3 口

---

### 場景 3：進場限價，出場市價

**需求：** 進場要控制成本，出場要快速成交

**解決方案：**
```json
{
  "strategy_name": "TXF_mixed",
  "source_product": "TXFF5",
  "target_product": "TXFF5",
  "quantity_multiplier": 1,
  "entry_order_type": "L",
  "entry_order_condition": "R",
  "exit_order_type": "M",
  "exit_order_condition": "I"
}
```

系統會自動判斷：
- `long_entry` / `short_entry` → 使用限價單 (L) + ROD (R)
- `long_exit` / `short_exit` → 使用市價單 (M) + IOC (I)

---

### 場景 4：測試新策略（先停用）

**需求：** 建立新策略但暫時不想啟用

**解決方案：**
```json
{
  "strategy_name": "TXF_test",
  "source_product": "TXFF5",
  "target_product": "TXFF5",
  "quantity_multiplier": 1,
  "enabled": false
}
```

訊號會被記錄但不會實際下單，狀態顯示為 `ignored`。

---

### 場景 5：多個策略切換

**需求：** 白天用小口數，晚上用大口數

**解決方案：**

建立兩個策略：
```json
// 白天策略
{
  "strategy_name": "TXF_day",
  "quantity_multiplier": 1,
  "enabled": true
}

// 夜盤策略
{
  "strategy_name": "TXF_night",
  "quantity_multiplier": 2,
  "enabled": false
}
```

在 TradingView 中切換 `strategyName` 參數，或透過 API 啟用/停用策略。

---

## 📊 訊號處理流程

```mermaid
graph TD
    A[TradingView 觸發] -->|Webhook| B[/signal endpoint]
    B --> C{查詢策略設定}
    C -->|找不到| D[記錄失敗 + 返回 404]
    C -->|已停用| E[記錄忽略 + 返回 ignored]
    C -->|正常| F[計算實際參數]
    F --> G[商品映射]
    F --> H[口數倍數]
    F --> I[判斷進/出場]
    G --> J[建立訂單]
    H --> J
    I --> J
    J --> K[提交到 Unitrade]
    K -->|成功| L[記錄成功 + 返回 order_id]
    K -->|失敗| M[記錄失敗 + 返回錯誤]
```

---

## 🛠️ 資料庫遷移

執行以下命令更新資料庫結構：

```bash
# 方法 1：使用 psql（推薦）
psql $DATABASE_URL -f db/migrations/004_add_strategy_config.sql

# 方法 2：在 PostgreSQL 內執行
\i db/migrations/004_add_strategy_config.sql

# 方法 3：使用 Azure PostgreSQL
az postgres flexible-server execute \
  --name your-db-server \
  --database-name trade_api \
  --file-path db/migrations/004_add_strategy_config.sql
```

---

## 🧪 測試流程

### 1. 建立測試策略

```bash
curl -X POST http://localhost:8000/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_name": "test_strategy",
    "source_product": "TXFF5",
    "target_product": "TXFF5",
    "quantity_multiplier": 1,
    "entry_order_type": "M",
    "exit_order_type": "M",
    "enabled": true
  }'
```

### 2. 測試訊號

```bash
# 測試做多進場
curl -X POST http://localhost:8000/signal \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "test_strategy",
    "signal": "long_entry",
    "quantity": 1,
    "note": "test"
  }'
```

### 3. 檢查結果

```bash
# 查詢訊號歷史
curl http://localhost:8000/signals?strategy=test_strategy

# 查詢訂單
curl http://localhost:8000/orders?limit=5
```

---

## ❓ 常見問題

### Q1: 如何快速切換商品？

**A:** 只需修改策略設定中的 `target_product`，無需修改 TradingView 策略。

```bash
curl -X PUT https://your-api.azurewebsites.net/strategies/TXF_vivi \
  -H "Content-Type: application/json" \
  -d '{"target_product": "MXFF5", ...其他設定}'
```

### Q2: 如何調整口數？

**A:** 修改 `quantity_multiplier` 即可。

```bash
curl -X PUT https://your-api.azurewebsites.net/strategies/TXF_vivi \
  -H "Content-Type: application/json" \
  -d '{"quantity_multiplier": 3, ...其他設定}'
```

### Q3: 如何暫停策略？

**A:** 使用 toggle endpoint 快速切換啟用狀態。

```bash
curl -X PATCH https://your-api.azurewebsites.net/strategies/TXF_vivi/toggle
```

### Q4: 可以同時使用 /signal 和 /webhook 嗎？

**A:** 可以！兩個 endpoint 獨立運作：
- `/signal` - 簡化版訊號，依賴策略設定
- `/webhook` - 完整版訊號，直接提供所有參數

### Q5: 訊號記錄會保留多久？

**A:** 所有訊號都會記錄在 `signal_history` 表中，可以查詢完整歷史進行分析。

---

## 📚 API Endpoints 總覽

| Method | Endpoint | 說明 |
|--------|----------|------|
| `POST` | `/signal` | 處理 TradingView 訊號 |
| `GET` | `/strategies` | 列出所有策略 |
| `GET` | `/strategies/{name}` | 取得單一策略 |
| `POST` | `/strategies` | 建立策略 |
| `PUT` | `/strategies/{name}` | 更新策略 |
| `DELETE` | `/strategies/{name}` | 刪除策略 |
| `PATCH` | `/strategies/{name}/toggle` | 啟用/停用策略 |
| `GET` | `/signals` | 查詢訊號歷史 |
| `GET` | `/signals/{id}` | 取得單一訊號 |

---

## 🎉 快速開始檢查清單

- [ ] 執行資料庫遷移（004_add_strategy_config.sql）
- [ ] 重新部署 API 服務
- [ ] 建立您的策略設定
- [ ] 修改 TradingView Pine Script（只加入簡化版 alert_message）
- [ ] 在 TradingView 建立 Alert，URL 使用 `/signal`
- [ ] 測試訊號接收
- [ ] 確認訂單正確下單
- [ ] 監控訊號歷史記錄

---

**最後更新：** 2026-02-09  
**版本：** 2.0 (簡化訊號版)
