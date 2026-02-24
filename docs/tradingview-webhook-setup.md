# TradingView Webhook 設定指南

## 📋 目錄
1. [API 訊息格式規格](#api-訊息格式規格)
2. [Pine Script 修改步驟](#pine-script-修改步驟)
3. [TradingView Alert 設定](#tradingview-alert-設定)
4. [實際範例](#實際範例)
5. [常見問題](#常見問題)

---

## 🎯 API 訊息格式規格

您的 API endpoint (`/webhook`) 接受以下 JSON 格式：

### 必填欄位
```json
{
  "productid": "TXFF5",     // 商品代碼
  "bs": "B",                // B=買進, S=賣出
  "orderqty": 1             // 數量（整數）
}
```

### 選填欄位
| 欄位 | 說明 | 可選值 | 預設值 |
|------|------|--------|--------|
| `ordertype` | 單別 | "L"(限價) / "M"(市價) / "P"(範圍市價) | "L" |
| `price` | 價格 | 數字（限價單必填） | 0 |
| `ordercondition` | 委託條件 | "R"(ROD) / "I"(IOC) / "F"(FOK) | "R" |
| `opencloseflag` | 開平倉 | "0"(新倉) / "1"(平倉) / ""(自動) | "" |
| `dtrade` | 當沖 | "Y" / "N" | "N" |
| `note` | 備註 | 字串（最多10字元） | "" |
| `strategy` | 策略名稱 | 字串 | null |

---

## 🔧 Pine Script 修改步驟

### 步驟 1：新增 Webhook 參數設定

在您的策略開頭加入以下參數：

```pine
// Webhook 設定參數
productId = input.string("TXFF5", title="商品代碼", tooltip="例如：TXFF5 (台指期近月)")
orderQty = input.int(1, title="每次下單口數", minval=1)
useMarketOrder = input.bool(false, title="使用市價單", tooltip="若勾選則使用市價單，否則使用限價單")
```

### 步驟 2：在 strategy.entry() 加上 alert_message

**做多進場範例：**
```pine
if (/* 您的做多進場條件 */)
    entryPrice = close  // 替換為您的實際進場價格
    strategy.entry("Buy", strategy.long, stop=entryPrice,
                   alert_message='{"productid":"' + productId + '","bs":"B","ordertype":"' + (useMarketOrder ? 'M' : 'L') + '","price":' + str.tostring(entryPrice) + ',"orderqty":' + str.tostring(orderQty) + ',"ordercondition":"R","opencloseflag":"","dtrade":"N","note":"Buy","strategy":"TXF_vivi"}')
```

**做空進場範例：**
```pine
if (/* 您的做空進場條件 */)
    entryPrice = close  // 替換為您的實際進場價格
    strategy.entry("Sell", strategy.short, stop=entryPrice,
                   alert_message='{"productid":"' + productId + '","bs":"S","ordertype":"' + (useMarketOrder ? 'M' : 'L') + '","price":' + str.tostring(entryPrice) + ',"orderqty":' + str.tostring(orderQty) + ',"ordercondition":"R","opencloseflag":"","dtrade":"N","note":"Sell","strategy":"TXF_vivi"}')
```

### 步驟 3：在 strategy.exit() 加上 alert_message

**平倉範例（使用市價單 + IOC）：**
```pine
strategy.exit("Exit Long", stop=yourExitStopPrice,
              alert_message='{"productid":"' + productId + '","bs":"S","ordertype":"M","price":0,"orderqty":' + str.tostring(orderQty) + ',"ordercondition":"I","opencloseflag":"1","dtrade":"N","note":"ExitL","strategy":"TXF_vivi"}')
```

**重點說明：**
- 平倉時 `bs` 方向相反（多單平倉用 "S"，空單平倉用 "B"）
- 平倉建議使用 `"ordertype":"M"`（市價單）快速成交
- 設定 `"opencloseflag":"1"` 明確指定為平倉
- 使用 `"ordercondition":"I"`（IOC）避免掛單

---

## 📡 TradingView Alert 設定

### 步驟 1：建立 Alert

1. 在 TradingView 圖表上點擊右上角「⏰ 鬧鐘」圖示
2. 選擇「建立警報」

### 步驟 2：設定警報條件

- **選擇條件：** 選擇您的策略名稱
- **警報動作名稱：** 選擇「Order fills and alert() function calls only」或「Order fills only」

### 步驟 3：設定 Webhook

1. **勾選「Webhook URL」**
2. **輸入您的 API URL：**
   ```
   https://your-deployed-api.azurewebsites.net/webhook
   ```
   ⚠️ 替換成您實際部署的 Azure URL

3. **訊息欄位：**
   - 使用 `{{strategy.order.alert_message}}`
   - TradingView 會自動使用您在 Pine Script 中設定的 `alert_message`

### 步驟 4：其他設定

- **警報名稱：** 自訂名稱（例：TXF_vivi_webhook）
- **頻率：** 選擇「All（每次條件滿足）」
- **過期時間：** 依需求設定

---

## 📝 實際範例

### 範例 1：做多進場（限價單）

**Pine Script 設定：**
```pine
strategy.entry("Buy", strategy.long, stop=21500, 
               alert_message='{"productid":"TXFF5","bs":"B","ordertype":"L","price":21500,"orderqty":1,"ordercondition":"R","opencloseflag":"","dtrade":"N","note":"Buy","strategy":"TXF_vivi"}')
```

**實際發送的 Webhook 內容：**
```json
{
  "productid": "TXFF5",
  "bs": "B",
  "ordertype": "L",
  "price": 21500,
  "orderqty": 1,
  "ordercondition": "R",
  "opencloseflag": "",
  "dtrade": "N",
  "note": "Buy",
  "strategy": "TXF_vivi"
}
```

### 範例 2：做空進場（市價單）

**Pine Script 設定：**
```pine
strategy.entry("Sell", strategy.short, 
               alert_message='{"productid":"TXFF5","bs":"S","ordertype":"M","price":0,"orderqty":2,"ordercondition":"I","opencloseflag":"","dtrade":"N","note":"Sell","strategy":"TXF_vivi"}')
```

**實際發送的 Webhook 內容：**
```json
{
  "productid": "TXFF5",
  "bs": "S",
  "ordertype": "M",
  "price": 0,
  "orderqty": 2,
  "ordercondition": "I",
  "opencloseflag": "",
  "dtrade": "N",
  "note": "Sell",
  "strategy": "TXF_vivi"
}
```

### 範例 3：多單平倉（市價 + IOC）

**Pine Script 設定：**
```pine
strategy.exit("Close Long", 
              alert_message='{"productid":"TXFF5","bs":"S","ordertype":"M","price":0,"orderqty":1,"ordercondition":"I","opencloseflag":"1","dtrade":"N","note":"CloseLong","strategy":"TXF_vivi"}')
```

**實際發送的 Webhook 內容：**
```json
{
  "productid": "TXFF5",
  "bs": "S",
  "ordertype": "M",
  "price": 0,
  "orderqty": 1,
  "ordercondition": "I",
  "opencloseflag": "1",
  "dtrade": "N",
  "note": "CloseLong",
  "strategy": "TXF_vivi"
}
```

---

## ❓ 常見問題

### Q1: 為什麼需要在 alert_message 中使用字串拼接？

**A:** Pine Script 不支援直接使用 JSON 物件，必須透過字串拼接來建立 JSON 格式：

```pine
// ✅ 正確：使用字串拼接
alert_message='{"productid":"' + productId + '","bs":"B","orderqty":' + str.tostring(orderQty) + '}'

// ❌ 錯誤：Pine Script 不支援
alert_message={"productid": productId, "bs": "B"}
```

### Q2: 限價單和市價單該如何選擇？

**建議配置：**
- **進場訂單：** 使用限價單（`"ordertype":"L"`）控制成本
- **出場訂單：** 使用市價單（`"ordertype":"M"`）快速成交
- **停損停利：** 使用市價 + IOC（`"ordercondition":"I"`）避免追價

### Q3: 如何測試 Webhook 是否正確？

**測試步驟：**

1. **使用 curl 測試：**
   ```bash
   curl -X POST https://your-api.azurewebsites.net/webhook \
     -H "Content-Type: application/json" \
     -d '{"productid":"TXFF5","bs":"B","ordertype":"M","price":0,"orderqty":1,"ordercondition":"R","opencloseflag":"","dtrade":"N","note":"test","strategy":"test"}'
   ```

2. **檢查 API 日誌：**
   - 查看 Azure Container Apps 日誌
   - 確認訂單是否成功提交

3. **查詢訂單記錄：**
   ```bash
   curl https://your-api.azurewebsites.net/orders
   ```

### Q4: opencloseflag 該怎麼設定？

| 值 | 說明 | 適用情境 |
|----|------|---------|
| `"0"` | 強制新倉 | 確定要開新倉位 |
| `"1"` | 強制平倉 | 確定要平掉既有倉位 |
| `""` | 自動判斷 | 由系統自動判斷開平倉（建議） |

**建議：**
- 進場時使用 `""`（自動）
- 出場時使用 `"1"`（強制平倉）

### Q5: 如何處理加碼邏輯？

**方法 1：多次進場**
```pine
strategy.entry("Buy", strategy.long, qty=1)
strategy.entry("Buy_2", strategy.long, qty=1)  // 加碼
```
每次都發送 `"opencloseflag":""`，系統會自動累加倉位。

**方法 2：指定總口數**
```pine
// 第一次進場
alert_message='{"productid":"TXFF5","bs":"B","orderqty":1,...}'

// 加碼時指定總口數
alert_message='{"productid":"TXFF5","bs":"B","orderqty":1,...}'  // 再加1口
```

### Q6: 當沖單該如何設定？

將 `dtrade` 設為 `"Y"`：

```pine
alert_message='{"productid":"TXFF5","bs":"B","ordertype":"L","price":21500,"orderqty":1,"ordercondition":"R","opencloseflag":"","dtrade":"Y","note":"Buy","strategy":"TXF_vivi"}'
```

### Q7: 如何除錯 Webhook 失敗的原因？

1. **檢查 API 健康狀態：**
   ```bash
   curl https://your-api.azurewebsites.net/health
   ```

2. **查看訂單歷史記錄：**
   ```bash
   curl https://your-api.azurewebsites.net/orders?limit=10
   ```
   檢查 `status` 和 `error_message` 欄位

3. **驗證 JSON 格式：**
   使用 [JSONLint](https://jsonlint.com/) 驗證 JSON 是否正確

4. **檢查 Azure 日誌：**
   ```bash
   az containerapp logs show \
     --name <your-app-name> \
     --resource-group <your-rg> \
     --follow
   ```

---

## 🚀 快速開始檢查清單

- [ ] 已在 Pine Script 中新增 Webhook 參數（productId, orderQty 等）
- [ ] 已在所有 `strategy.entry()` 加上 `alert_message`
- [ ] 已在所有 `strategy.exit()` 加上 `alert_message`
- [ ] 已取得 Azure 部署的 API URL
- [ ] 已在 TradingView 建立 Alert
- [ ] 已設定 Webhook URL
- [ ] 已測試 curl 請求確認 API 運作正常
- [ ] 已用小口數測試實際下單功能

---

## 📚 相關文件

- [API 文件](../README.md)
- [Azure 部署指南](./azure-deploy.md)
- [統一期貨 API 文件](./credentials.md)

---

## 💡 提示

1. **建議先用紙上交易測試** TradingView 策略和 Webhook 整合
2. **記得備份原始策略** 修改前先複製一份
3. **小口數開始** 實盤測試時從 1 口開始
4. **監控日誌** 初期密切關注 API 日誌和訂單狀態
5. **設定停損** 確保每筆訂單都有適當的風險控制

---

**最後更新：** 2026-02-09  
**版本：** 1.0
