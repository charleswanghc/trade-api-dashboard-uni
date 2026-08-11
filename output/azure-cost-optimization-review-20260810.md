# Azure 成本與殘餘資源複核報告

日期：2026-08-10（Asia/Taipei）

範圍：`Azure subscription 1`、`trade-api-rg`、目前部署程式碼與 GitHub Actions

## 結論

原始成本報告把 `tradeacr3633` 與 `trade-db-server` 判定為已刪除或不存在，與 Azure Portal 的即時狀態不符。兩者均為正式服務的現行相依資源，不能刪除：Container App 使用 ACR 中的映像啟動，公開 API 的健康、策略與排程查詢也證實 PostgreSQL 仍承載現行資料。

訂閱目前共 14 項資源；其中 `trade-api-rg` 有且只有下列 6 項。未發現其他名稱或相依關係屬於本專案的舊 VM、磁碟、NIC、公用 IP、Storage Account、舊 Container App 或第二個 ACR。

| 資源 | 類型 | 判定 |
|---|---|---|
| `trade-api-backend` | Container App | 使用中 |
| `trade-dashboard` | Static Web App | 使用中，目前無費用 |
| `trade-db-server` | PostgreSQL Flexible Server | 使用中，不是殘餘 DB |
| `trade-env` | Container Apps environment | 使用中 |
| `tradeacr3633` | Azure Container Registry Basic | 使用中，不是殘餘 ACR |
| `workspace-tradeapirgk8OW` | Log Analytics workspace | Container Apps 環境相依，目前無費用 |

## ACR 殘餘資料

`tradeacr3633` 的 soft delete 為停用，因此目前刪除 artifacts 不會進入可復原保留期。Registry 內有三個現行 repositories：

| Repository | 現況 | 建議 |
|---|---|---|
| `trade-api` | 44 tags、55 manifests；目前 revision 使用 tag `8a170a679df1dd7340a612a1bb51156507124f7a` | 保留現行 digest 與少量可回滾版本；其餘舊版可設 retention 後清理 |
| `trade-api-backend` | 2 tags、1 manifest；目前部署與工作流程未引用 | 殘餘候選，確認不需回滾後可刪 |
| `trade-api-test` | 1 tag、1 manifest；目前部署與工作流程未引用 | 殘餘候選，確認不需回滾後可刪 |

清理這些映像可降低資料雜訊與未來超額儲存風險，但只要用量未超過 Basic SKU 內含的 10 GB，就不會消除約 NT$160/月的 ACR 基本費。若要消除基本費，需先把部署流程與 Container App 私有映像來源遷移到其他 registry；不能直接刪除現行 ACR。

## 實際成本與用量

2026-08-10 Azure Portal 顯示本月截至目前訂閱成本為 NT$835.37，其中本專案約 NT$678.09：

| 資源 | 本月至今 | 最近 30 天參考 | 觀察 |
|---|---:|---:|---|
| Container App | NT$570.16 | 約 NT$1,987 | 最大成本來源 |
| PostgreSQL | NT$58.49 | 約 NT$807 | 本月目前只有 storage、compute 為 0，表示伺服器近期多數時間曾停止 |
| ACR Basic | NT$49.44 | 約 NT$160 | 接近固定基本費 |

最近 30 天監控摘要：

| 資源 | 指標 | 平均值 | 解讀 |
|---|---|---:|---|
| Container App | CPU | 18.11% | 1 vCPU 可能可降到 0.5 vCPU，但需先看尖峰/p95 |
| Container App | Memory | 25.06% | 2 GiB 可能可降到 1 GiB，但需先確認尖峰與 OOM |
| Container App | Response time | 25.39 ms | 目前健康 |
| PostgreSQL B1ms | CPU | 12.59% | CPU 有餘裕 |
| PostgreSQL B1ms | Memory | 57.86% | 不建議再降記憶體等級 |
| PostgreSQL | Storage | 7.14% of 128 GiB | 資料量低，但已配置儲存通常不宜直接縮小 |
| PostgreSQL | Failed connections | 0 | 目前健康 |

## 已發現的成本問題

`.github/workflows/trading-schedule.yml` 原本想在週六 05:30 至週一 07:30（台灣時間）停止服務約 50 小時，但近期每次週五 stop job 都失敗。GitHub Actions 錯誤為：

```text
ERROR: --max-replicas must be in range [1,1000]
```

舊流程使用 `--min-replicas 0 --max-replicas 0`，Azure 不接受 `max-replicas=0`，因此週末 Container App 實際未停止。

本機已把流程改為 Azure Container Apps 官方 `start` / `stop` REST API，並加入以下保護：

1. 停止時先確認 App 已 `Stopped`，再停止 PostgreSQL compute。
2. 啟動時先等 PostgreSQL `Ready`，再啟動 App。
3. 停止前先對 App 與 DB 做唯讀 preflight；service principal 若缺 PostgreSQL 讀取權限，流程會保守中止而不停止 App。
4. 各步驟可重複執行，並有 10 分鐘 timeout 與最終狀態驗證。
5. `azure/login` 已由出現 Node 20 淘汰警告的 v1 更新為 v2。
6. 尚未 commit、push 或在 Azure 執行，因此目前線上服務完全未受影響。

## 節省方案

| 優先 | 調整 | 月省估算 | 風險與執行方式 |
|---|---|---:|---|
| P0 | 修正週末 App stop/start | 約 NT$592 | 延續既有休市窗口；需 push 後先做無停機 start preflight，再監看首次週末 stop/start 與 RBAC |
| P0 | 同步停止 PostgreSQL compute | 最多約 NT$188 | storage 照常計費；本月已有人為停機，這項主要是把現有節省自動化並避免 7 天後自動啟動 |
| P1 | Container App 改 0.5 vCPU / 1 GiB | 排程後再省約 NT$698 | 僅平均值不足；先建新 revision、做尖峰與 OOM/延遲 canary，再切流量 |
| P2 | ACR 遷移至 private GHCR | 約 NT$160 | 需重做映像發佈、pull credential 與回滾測試；完成前保留 ACR |
| P3 | 清理未引用 ACR repositories/tags | 目前接近 NT$0 | 可降低超額儲存風險，但不能消除 Basic 基本費；需保留現行 digest 與回滾版本 |

估算方式：週末 50 小時占一週 168 小時約 29.8%；Container App 最近 30 天成本約 NT$1,987 × 29.8% ≈ NT$592。PostgreSQL 的 NT$188 是相對於整月持續運行的上限，不應與本月已經停止所省下的 compute 重複計算。

## 驗證與稽核軌跡

- Azure Portal `All resources`：逐頁檢查訂閱 14 項資源與 `trade-api-rg` 6 項資源。
- Azure Portal ACR：檢查建立日期、SKU、soft delete、repositories、tags、manifests 與目前 image digest。
- ACR `list-deleted` 額外交叉檢查：Azure CLI 兩次均被本機 Avast HTTPS 憑證攔截阻擋，因此無法獨立列出過去在 soft-delete 曾啟用期間可能留下、但 Portal 未呈現的項目；未降低 TLS 安全性繼續重試。
- Azure Portal Container App：檢查 active revision、100% traffic、replicas、image、CPU/memory、scale 與最近 30 天 metrics。
- Azure Portal PostgreSQL：檢查 SKU、storage、HA、state 與最近 30 天 metrics。
- Cost Management：檢查本月至今與最近 30 天 resource-level cost。
- 現行 API 唯讀驗證：health 正常、1 筆 strategy、scheduler running 且有 2 個 jobs。
- GitHub Actions：檢查近期排程歷史與週五 stop job 失敗 log。
- 本機驗證：4 個 Actions shell blocks 全數通過 `bash -n`；`git diff --check` 無錯。

## 執行邊界

本次沒有刪除 ACR、repository、tag、資料庫或 Azure 資源，也沒有改動線上設定。下一個需明確核准的動作是 commit/push 排程修正，接著以 Actions log 與 Azure 狀態驗證第一次正式 stop/start。Container App rightsizing、GHCR 遷移與 ACR 清理均應分開核准與執行。
