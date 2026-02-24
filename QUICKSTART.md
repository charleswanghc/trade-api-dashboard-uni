# 快速開始指南 - 訊號驅動交易

本指南將帶您透過 3 步驟完成「訊號驅動交易」的設定。

---

## 📋 概念說明

**傳統方式：**
```
TradingView 需要完整指定所有參數
↓
{"productid":"TXFF5","bs":"B","ordertype":"L","price":21500,"orderqty":1,...}
```

**新方式（簡化）：**
```
TradingView 只傳送訊號
↓
{"strategy":"TXF_vivi_mini","signal":"long_entry","quantity":1}
↓
系統自動套用策略設定（商品映射、口數倍數等）
```

---

## ⚡ 快速開始（3 步驟）

### 步驟 1：資料庫遷移

```bash
# 連線到您的資料庫並執行遷移
psql $DATABASE_URL -f db/migrations/004_add_strategy_config.sql
```

**預期結果：** 建立 3 個預設策略
- `TXF_vivi` - 標準大台策略（1倍）
- `TXF_vivi_mini` - 大台訊號轉小台（2倍）
- `TXF_vivi_3x` - 大台3倍口數

### 步驟 2：重新部署 API

```bash
# 使用現有部署腳本
.\deploy-no-docker.ps1 \
  -UnitradeWsUrl "https://viploginm.pfctrade.com" \
  -UnitradeAccount "your-account" \
  -UnitradePassword "your-password" \
  -UnitradeCertPassword "cert-password" \
  -UnitradeActno "myTxf"
```

### 步驟 3：修改 TradingView 策略

**在策略開頭加入：**
```pine
strategyName = input.string("TXF_vivi_mini", title="策略名稱")
```

**修改所有 strategy.entry/exit 的 alert_message：**

**進場範例：**
```pine
strategy.entry("Buy", strategy.long, stop=entryPrice, 
    alert_message='{"strategy":"' + strategyName + '","signal":"long_entry","quantity":1,"price":' + str.tostring(entryPrice) + '}')
```

**出場範例：**
```pine
strategy.exit("Drop L", stop=stopPrice,
    alert_message='{"strategy":"' + strategyName + '","signal":"long_exit","quantity":1}')
```

**在 TradingView Alert 中：**
- URL: `https://your-api.azurewebsites.net/signal` ⚠️ 注意是 **/signal**
- 訊息: `{{strategy.order.alert_message}}`

---

## ✅ 驗證設定

### 1. 檢查資料庫

```bash
curl https://your-api.azurewebsites.net/strategies
```

**應該看到：**
```json
[
  {
    "strategy_name": "TXF_vivi",
    "source_product": "TXFF5",
    "target_product": "TXFF5",
    "quantity_multiplier": 1,
    "enabled": true
  },
  ...
]
```

### 2. 測試訊號

```bash
curl -X POST https://your-api.azurewebsites.net/signal \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "TXF_vivi",
    "signal": "long_entry",
    "quantity": 1,
    "price": 21500
  }'
```

**預期回應：**
```json
{
  "status": "ok",
  "signal_id": 1,
  "order_id": "...",
  "actual_product": "TXFF5",
  "actual_quantity": 1
}
```

### 3. 查看訊號歷史

```bash
curl https://your-api.azurewebsites.net/signals?limit=5
```

---

## 🎯 常見使用場景

### 場景 1：大台訊號改下小台

**前往前端 UI：** `https://your-app.azurewebsites.net/strategies`

**編輯策略 `TXF_vivi_mini`：**
- 訊號商品：`TXFF5` (大台)
- 實際下單商品：`MXFF5` (小台)
- 口數倍數：`2`

**TradingView 中設定：**
```pine
strategyName = input.string("TXF_vivi_mini", title="策略名稱")
```

**結果：** 訊號 TXFF5 1口 → 實際下單 MXFF5 2口

---

### 場景 2：調整口數倍數

**方法 1：使用 UI**
1. 前往 `/strategies`
2. 點擊編輯按鈕
3. 修改「口數倍數」
4. 儲存

**方法 2：使用 API**
```bash
curl -X PUT https://your-api.azurewebsites.net/strategies/TXF_vivi \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_name": "TXF_vivi",
    "source_product": "TXFF5",
    "target_product": "TXFF5",
    "quantity_multiplier": 3,
    "entry_order_type": "L",
    "exit_order_type": "M",
    "enabled": true
  }'
```

---

### 場景 3：暫停策略

**使用 UI：** 點擊策略卡片上的 ✅/⭕ 按鈕

**使用 API：**
```bash
curl -X PATCH https://your-api.azurewebsites.net/strategies/TXF_vivi/toggle
```

當策略停用時，訊號會被記錄但不會下單（狀態為 `ignored`）

---

## 🎨 前端管理介面

訪問 `https://your-app.azurewebsites.net/strategies` 即可看到視覺化管理介面：

**功能：**
- 📋 查看所有策略
- ➕ 建立新策略
- ✏️ 編輯現有策略
- 🗑️ 刪除策略
- ✅ 啟用/停用策略
- 📊 即時查看策略設定

**策略卡片顯示：**
- 商品映射（訊號 → 實際）
- 口數倍數
- 進場/出場單別
- 是否當沖
- 啟用狀態

---

## 📊 監控訊號

### 查看最近的訊號

```bash
# 所有訊號
curl https://your-api.azurewebsites.net/signals?limit=10

# 特定策略的訊號
curl https://your-api.azurewebsites.net/signals?strategy=TXF_vivi_mini
```

### 訊號狀態說明

| 狀態 | 說明 |
|------|------|
| `processing` | 處理中 |
| `processed` | 已處理並下單 |
| `ignored` | 策略已停用，訊號被忽略 |
| `failed` | 處理失敗（查看 error_message） |

---

## 🔧 疑難排解

### Q: 訊號沒有觸發下單？

**檢查清單：**
1. ✅ 策略是否存在？
   ```bash
   curl https://your-api.azurewebsites.net/strategies/TXF_vivi
   ```

2. ✅ 策略是否啟用？
   - 前往 UI 查看或使用 API 確認 `enabled: true`

3. ✅ TradingView Alert URL 正確？
   - 必須是 `/signal` 而非 `/webhook`

4. ✅ 查看訊號歷史錯誤訊息
   ```bash
   curl https://your-api.azurewebsites.net/signals?limit=5
   ```

---

### Q: 如何調整商品代碼？

**直接在 UI 或 API 修改策略設定即可，不需要改 TradingView 策略。**

範例：把大台改為小台
```bash
curl -X PUT https://your-api.azurewebsites.net/strategies/TXF_vivi \
  -H "Content-Type: application/json" \
  -d '{"target_product": "MXFF5", ...}'
```

---

### Q: 可以同時使用舊版 /webhook 嗎？

**可以！** 兩個 endpoint 完全獨立：
- `/webhook` - 完整參數版（舊版）
- `/signal` - 簡化訊號版（新版）

您可以根據不同策略選擇使用不同的 endpoint。

---

## 📚 完整文件

- [詳細設定指南](./docs/tradingview-signal-setup.md) - 完整的使用說明
- [資料庫遷移](./docs/database-migration.md) - 資料庫更新步驟
- [升級指南](./UPGRADE_GUIDE.md) - 系統更新摘要

---

## 💡 最佳實踐

1. **先用紙上交易測試** - 確認訊號和參數轉換正確
2. **小口數開始** - 實盤時從 1 口開始測試
3. **監控訊號歷史** - 定期檢查 `/signals` 確保沒有失敗的訊號
4. **備份策略設定** - 定期匯出策略設定以防意外
5. **使用描述欄位** - 在策略中加入說明，方便日後管理

---

## 🎉 完成！

現在您可以：
- ✅ 在 TradingView 中只需傳送簡單訊號
- ✅ 透過 UI 隨時調整商品和口數
- ✅ 不用修改 Pine Script 就能切換交易參數
- ✅ 集中管理所有策略設定

**下一步：** 前往 `https://your-app.azurewebsites.net/strategies` 開始管理您的策略！

---

**需要協助？** 查看完整文件或聯繫技術支援。
