# 交易時段排程控制指南

本文說明如何透過 **GitHub Actions 排程工作流程** 控制 Azure Container App 與 PostgreSQL compute 的啟停，以節省非交易時段的執行費用。

---

## 排程設計邏輯

台灣期貨 + 美股交易時間合併後，完整休市期間為 **週六 05:30 CST → 週一 07:30 CST**（約 50 小時），僅在此期間關閉 Container App。

| 動作 | 台灣時間（CST） | UTC | GitHub cron |
|---|---|---|---|
| **關閉 App，再關閉 DB compute** | 週六 05:30 | 週五 21:30 | `30 21 * * 5` |
| **開啟 DB，確認 Ready，再開啟 App** | 週一 07:30 | 週日 23:30 | `30 23 * * 0` |

> GitHub Actions 的 cron 時區固定為 **UTC**，台灣時間需減 8 小時換算。

---

## 手動操作教學

### 步驟 1 — 進入 Actions 頁面

1. 前往 GitHub 倉庫首頁
2. 點選上方 **Actions** 分頁
3. 左側清單找到 **Trading Hours Schedule**

### 步驟 2 — 手動觸發

1. 點選右上角 **Run workflow**
2. 下拉選單選擇 `start`（開啟）或 `stop`（關閉）
3. 按 **Run workflow** 確認

```
┌─────────────────────────────────────┐
│  Run workflow                        │
│  Branch: main                        │
│                                      │
│  手動控制容器狀態                    │
│  ● start   ○ stop                    │
│                                      │
│  [Run workflow]                      │
└─────────────────────────────────────┘
```

### 步驟 3 — 確認執行結果

點選觸發的工作流程紀錄，最後一步 **驗證目前服務狀態** 會同時顯示 App 與 DB 狀態：

```
Container App: Running
PostgreSQL: Ready

# 或休市期間：
Container App: Stopped
PostgreSQL: Stopped
```

---

## 適用情境

| 情境 | 操作 |
|---|---|
| 台灣國定假日（期交所休市） | 手動觸發 `stop` |
| 美股特殊假日（感恩節等） | 手動觸發 `stop` |
| 颱風假 / 臨時停市 | 手動觸發 `stop` |
| 排程異常沒有自動開啟 | 手動觸發 `start` |
| 需要在週末緊急維運 | 手動觸發 `start`，維運完再 `stop` |

---

## 費用說明

### GitHub Actions 費用

| 倉庫類型 | 費用 |
|---|---|
| **公開倉庫** | **完全免費，無限制** |
| 私有倉庫 | 每月 2,000 分鐘免費，超過 $0.008 USD/分鐘 |

本排程每次通常需要數分鐘；PostgreSQL 或 Container App 啟動較慢時，單次最多等待約 20 分鐘。每週觸發 2 次，仍遠低於一般私有倉庫的每月免費額度。

### 節省效果

| 項目 | 數字 |
|---|---|
| 每週關閉時數 | 約 50 小時（週六 05:30 → 週一 07:30 CST） |
| 費用節省比例 | 約 30% Container App 執行費與 PostgreSQL compute 費；DB 儲存費仍會計收 |

---

## 與 Azure 原生排程方案比較

| 項目 | **GitHub Actions**（目前使用） | Azure Logic Apps | Azure Automation |
|---|---|---|---|
| 費用 | **免費** | ~$0.01 USD/次 | 500 分鐘/月免費 |
| 設定位置 | 倉庫 `.github/workflows/` | Azure Portal | Azure Portal |
| 觸發精度 | 分鐘級（偶爾延遲最多 15 分鐘） | 分鐘級 | 分鐘級 |
| 手動觸發 | GitHub Actions 頁面點一下 | 需進 Azure Portal | 需進 Azure Portal |
| 執行紀錄 | GitHub Actions 頁面 | Azure Monitor | Azure Automation 紀錄 |
| 與 CI/CD 整合 | ✅ 同一倉庫 | ❌ 需另外維護 | ❌ 需另外維護 |

> **結論**：對每週僅執行 2 次的停啟排程，GitHub Actions 是最簡單且免費的選擇。

---

## 工作流程檔案位置

```
.github/workflows/trading-schedule.yml
```

---

## 常見問題

**Q：排程沒有在預定時間觸發？**  
A：GitHub Actions 的 cron 在 UTC 高峰期可能延遲最多 15 分鐘，屬正常現象。由於開市前有 1 小時緩衝（07:30 CST 啟動 → 08:45 CST 開盤），不影響使用。

**Q：Container App 關閉後，Unitrade 連線會怎樣？**

A：Container App 進入 `Stopped` 時，所有程序（含 APScheduler、Unitrade WebSocket）均會停止。恢復後 `lifespan` 事件會重新建立 Unitrade 連線與 Scheduler。

**Q：PostgreSQL 停止後還會收費嗎？**

A：停止期間不收 compute 費，但佈建儲存體與超額備份仍會計費。工作流程會在週一先啟動 DB 並等到 `Ready`，才啟動 Container App。

**Q：為什麼不再用 `min-replicas=0, max-replicas=0`？**

A：Azure 要求 `maxReplicas` 至少為 1；舊命令因此每逢週五失敗。現在改用 Azure Container Apps 的官方 stop/start API，能確實停止 App，也不會為了切換 scale 設定建立額外 revision。

**Q：`AZURE_CREDENTIALS` 需要哪些權限？**

A：登入使用的 service principal 必須能讀取並啟停 `trade-api-backend` 與 `trade-db-server`。流程會先完成 App/DB 唯讀 preflight，任一查詢失敗便中止且不停止 App；首次上線仍應監看 Actions log，確認實際 RBAC 足夠。

**Q：週末需要手動查詢部位怎麼辦？**

A：手動觸發 `start`，查詢完後再手動觸發 `stop`。
