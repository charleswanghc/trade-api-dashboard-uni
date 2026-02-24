# Pine Script 極簡修改指南

本指南展示如何用**最少的程式碼修改**，讓您的 TradingView 策略產生 `action` 和 `side` 參數。

---

## 🎯 核心概念

您只需要在策略中加入**一個輔助函數**，然後在每個 `strategy.entry()` 和 `strategy.exit()` 使用它。

---

## 📝 步驟 1：加入策略名稱設定

在策略開頭加入這一行：

```pine
strategyName = input.string("TXF_vivi", title="策略名稱")
```

---

## 📝 步驟 2：加入輔助函數

在策略邏輯之前加入這個函數：

```pine
// 建立 alert 訊息的函數
makeAlert(action, side, price, stopLoss = 0.0, note = "") =>
    alertMsg = '{"strategy":"' + strategyName + '"'
    alertMsg := alertMsg + ',"action":"' + action + '"'
    alertMsg := alertMsg + ',"side":"' + side + '"'
    alertMsg := alertMsg + ',"quantity":1'
    alertMsg := alertMsg + ',"price":' + str.tostring(price)
    if stopLoss > 0
        alertMsg := alertMsg + ',"stop_loss":' + str.tostring(stopLoss)
    if note != ""
        alertMsg := alertMsg + ',"note":"' + note + '"'
    alertMsg := alertMsg + '}'
    alertMsg
```

---

## 📝 步驟 3：在進場/出場使用函數

### **做多進場：**

**原本：**
```pine
if (buyCondition)
    strategy.entry("Buy", strategy.long, stop=entryPrice)
```

**修改為：**
```pine
if (buyCondition)
    strategy.entry("Buy", strategy.long, stop=entryPrice, 
        alert_message=makeAlert("entry", "buy", entryPrice, 0, "Buy"))
```

---

### **做空進場：**

**原本：**
```pine
if (sellCondition)
    strategy.entry("Sell", strategy.short, stop=entryPrice)
```

**修改為：**
```pine
if (sellCondition)
    strategy.entry("Sell", strategy.short, stop=entryPrice,
        alert_message=makeAlert("entry", "sell", entryPrice, 0, "Sell"))
```

---

### **做多出場：**

**原本：**
```pine
if (exitCondition)
    strategy.exit("Exit Long", stop=stopPrice)
```

**修改為：**
```pine
if (exitCondition)
    strategy.exit("Exit Long", stop=stopPrice,
        alert_message=makeAlert("exit", "sell", close, 0, "Exit"))
```

---

### **做空出場：**

**原本：**
```pine
if (exitCondition)
    strategy.exit("Exit Short", stop=stopPrice)
```

**修改為：**
```pine
if (exitCondition)
    strategy.exit("Exit Short", stop=stopPrice,
        alert_message=makeAlert("exit", "buy", close, 0, "Cover"))
```

---

## 🎨 makeAlert 函數參數說明

```pine
makeAlert(action, side, price, stopLoss, note)
```

| 參數 | 說明 | 範例 |
|------|------|------|
| `action` | 動作類型 | `"entry"` 或 `"exit"` |
| `side` | 交易方向 | `"buy"` 或 `"sell"` |
| `price` | 進場/出場價格 | `entryPrice`, `close` |
| `stopLoss` | 止損價格（選填） | `stopPrice`, `0` |
| `note` | 備註（選填） | `"Buy"`, `"Exit"` |

---

## 📊 action 和 side 對應關係

| 交易動作 | action | side | 說明 |
|----------|--------|------|------|
| 做多進場 | `"entry"` | `"buy"` | 買入建立多倉 |
| 做多出場 | `"exit"` | `"sell"` | 賣出平倉多倉 |
| 做空進場 | `"entry"` | `"sell"` | 賣出建立空倉 |
| 做空出場 | `"exit"` | `"buy"` | 買入平倉空倉 |

---

## 🔍 範例：完整修改對照

### **範例 1：簡單的突破策略**

#### **原始程式碼：**
```pine
//@version=5
strategy("突破策略", overlay=true)

ma = ta.sma(close, 20)

if (ta.crossover(close, ma))
    strategy.entry("Long", strategy.long)

if (ta.crossunder(close, ma))
    strategy.close("Long")
```

#### **修改後：**
```pine
//@version=5
strategy("突破策略", overlay=true)

// 1. 加入策略名稱
strategyName = input.string("TXF_vivi", title="策略名稱")

// 2. 加入輔助函數
makeAlert(action, side, price, stopLoss = 0.0, note = "") =>
    alertMsg = '{"strategy":"' + strategyName + '"'
    alertMsg := alertMsg + ',"action":"' + action + '"'
    alertMsg := alertMsg + ',"side":"' + side + '"'
    alertMsg := alertMsg + ',"quantity":1'
    alertMsg := alertMsg + ',"price":' + str.tostring(price)
    if stopLoss > 0
        alertMsg := alertMsg + ',"stop_loss":' + str.tostring(stopLoss)
    if note != ""
        alertMsg := alertMsg + ',"note":"' + note + '"'
    alertMsg := alertMsg + '}'
    alertMsg

ma = ta.sma(close, 20)

// 3. 使用函數產生 alert_message
if (ta.crossover(close, ma))
    strategy.entry("Long", strategy.long,
        alert_message=makeAlert("entry", "buy", close, 0, "MA_Cross"))

if (ta.crossunder(close, ma))
    strategy.close("Long",
        alert_message=makeAlert("exit", "sell", close, 0, "MA_Exit"))
```

---

### **範例 2：帶止損的策略**

```pine
// 做多進場，設定止損在最近低點
if (buySignal)
    entryPrice = high
    stopPrice = ta.lowest(low, 5)
    strategy.entry("Buy", strategy.long, stop=entryPrice,
        alert_message=makeAlert("entry", "buy", entryPrice, stopPrice, "Buy"))
```

**產生的訊息：**
```json
{
  "strategy": "TXF_vivi",
  "action": "entry",
  "side": "buy",
  "quantity": 1,
  "price": 21500,
  "stop_loss": 21450,
  "note": "Buy"
}
```

---

### **範例 3：不需要止損的出場**

```pine
// 做多出場（不設定止損）
if (exitSignal)
    strategy.exit("Exit", stop=exitPrice,
        alert_message=makeAlert("exit", "sell", close, 0, "Exit"))
```

**產生的訊息：**
```json
{
  "strategy": "TXF_vivi",
  "action": "exit",
  "side": "sell",
  "quantity": 1,
  "price": 21520,
  "note": "Exit"
}
```

---

## 💡 進階技巧

### **技巧 1：使用變數簡化重複呼叫**

如果有多個相似的出場條件：

```pine
// 定義一個變數來存放常用的出場訊息
exitMsg = makeAlert("exit", "sell", close, 0, "Exit")

if (stopLossCondition)
    strategy.exit("Stop Loss", stop=stopPrice, alert_message=exitMsg)

if (takeProfitCondition)
    strategy.exit("Take Profit", limit=targetPrice, alert_message=exitMsg)
```

---

### **技巧 2：動態止損**

```pine
// 根據 ATR 設定止損
atrValue = ta.atr(14)
if (buySignal)
    entryPrice = close
    dynamicStop = close - (atrValue * 2)  // 2倍 ATR
    strategy.entry("Buy", strategy.long,
        alert_message=makeAlert("entry", "buy", entryPrice, dynamicStop, "ATR_Buy"))
```

---

### **技巧 3：條件式止損**

```pine
// 根據波動度決定是否傳送止損
if (buySignal)
    entryPrice = close
    stopPrice = volatileMarket ? ta.lowest(low, 10) : 0  // 高波動才設止損
    strategy.entry("Buy", strategy.long,
        alert_message=makeAlert("entry", "buy", entryPrice, stopPrice, "Buy"))
```

---

## 🧪 測試您的修改

### **步驟 1：在 Pine Editor 測試**

1. 複製修改後的程式碼到 Pine Editor
2. 點擊「添加到圖表」
3. 檢查是否有編譯錯誤

### **步驟 2：測試 Alert 訊息**

1. 建立一個測試 Alert
2. 條件：選擇您的策略
3. 訊息：`{{strategy.order.alert_message}}`
4. 手動觸發 Alert（調整時間範圍）
5. 在 TradingView 的 Alert Log 查看產生的訊息

### **步驟 3：驗證 JSON 格式**

複製產生的訊息，貼到 [JSONLint](https://jsonlint.com/) 驗證格式是否正確。

---

## ⚠️ 常見錯誤

### **錯誤 1：字串拼接錯誤**

❌ **錯誤：**
```pine
alertMsg = '{"action":' + action + '}'  // 缺少引號
```

✅ **正確：**
```pine
alertMsg = '{"action":"' + action + '"}'  // action 需要用引號包住
```

---

### **錯誤 2：action/side 參數錯誤**

| 正確 | 錯誤 |
|------|------|
| `"entry"` | `"buy"`, `"open"` |
| `"exit"` | `"sell"`, `"close"` |
| `"buy"` | `"long"` |
| `"sell"` | `"short"` |

---

### **錯誤 3：price 使用字串**

❌ **錯誤：**
```pine
',"price":"' + str.tostring(price) + '"'  // price 被當成字串
```

✅ **正確：**
```pine
',"price":' + str.tostring(price)  // price 是數字
```

---

## 📋 檢查清單

修改完成後，確認：

- [ ] 已加入 `strategyName` 參數
- [ ] 已加入 `makeAlert()` 函數
- [ ] 所有 `strategy.entry()` 都加上 `alert_message`
- [ ] 所有 `strategy.exit()` 都加上 `alert_message`
- [ ] `action` 只使用 `"entry"` 或 `"exit"`
- [ ] `side` 只使用 `"buy"` 或 `"sell"`
- [ ] Pine Editor 沒有錯誤
- [ ] 測試 Alert 可以產生正確的 JSON

---

## 🎉 完成！

現在您的策略可以：
- ✅ 產生標準化的 `action` 和 `side` 參數
- ✅ 自動建立完整的 JSON 訊息
- ✅ 支援選填的止損價格
- ✅ 保持程式碼簡潔易維護

---

---

## 🧪 整套流程驗證測試

在正式將 `makeAlert()` 套用到您的策略之前，建議先用獨立的測試腳本驗證 **TradingView → API → 統一期貨** 整套流程是否正常運作。

### **測試策略檔案**

專用測試腳本位於：[tradingview_flow_test.pine](../tradingview_flow_test.pine)

該腳本使用 **快速 MA 交叉（預設 3/8）** 產生高頻訊號，涵蓋所有 4 種組合：

| 步驟 | 觸發條件 | action | side | 代表意義 |
|------|----------|--------|------|----------|
| ① | 黃金交叉 且 無部位 | `entry` | `buy`  | 做多進場 |
| ② | 死亡交叉 且 持多倉 | `exit`  | `sell` | 做多出場 |
| ③ | 死亡交叉 且 無部位 | `entry` | `sell` | 做空進場 |
| ④ | 黃金交叉 且 持空倉 | `exit`  | `buy`  | 做空出場 |

### **快速使用步驟**

**步驟 1：載入測試腳本**

1. 開啟 TradingView → Pine Editor
2. 貼上 `tradingview_flow_test.pine` 完整內容
3. 點擊「加到圖表」
4. 切換到 **TXFF5 1 分鐘圖** → MA 交叉頻繁，訊號快速觸發

**步驟 2：設定策略名稱**

在腳本設定中，確認「策略名稱」與後端資料庫中的 `strategy_name` 一致：

```
策略名稱: TXF_vivi     ← 需與 strategy_config 完全一致
```

**步驟 3：建立 TradingView Alert**

| 欄位 | 填寫內容 |
|------|----------|
| 條件 | 選擇 `🧪 流程驗證測試` → **Order fills only** |
| 訊息 | `{{strategy.order.alert_message}}` |
| Webhook URL | `https://your-api-url/signal/simple` |

**步驟 4：確認 API 收到訊號**

```powershell
# 查詢最近的訊號記錄
Invoke-RestMethod -Uri "https://your-api-url/signals" -Method GET |
    Select-Object -First 10 |
    Format-Table strategy_name, signal_type, status, created_at
```

或直接開啟前端頁面的訊號記錄確認。

**正常運作時，每筆訊號應顯示：**

```json
{
  "status": "processed",
  "signal_type": "long_entry",
  "actual_product": "TXFF5",
  "actual_quantity": 1
}
```

### **逐步驗證建議**

1. **先只測試做多方向**：將腳本設定中「測試做空方向」取消勾選
2. **確認 ① entry+buy 正常後**，等待 ② exit+sell 觸發
3. **多方向完整驗證後**，再開啟做空方向
4. **全部 4 種訊號都確認正常**，再套用到您的正式策略

### **⚠️ 測試完成後**

務必在 TradingView 停用（或刪除）此測試 Alert，避免 MA 交叉訊號影響正式交易。

---

## 📚 相關文件

- [流程驗證測試腳本](../tradingview_flow_test.pine)
- [完整範例策略](../tradingview_simple_alert.pine)
- [TradingView 佔位符設定指南](./tradingview-placeholder-setup.md)
- [API 文件](../README.md)

---

**最後更新：** 2026-02-24  
**版本：** 2.3 (新增流程驗證測試章節)
