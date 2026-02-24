# 資料庫遷移指南

## 執行遷移

執行以下命令來更新資料庫結構，新增策略設定和訊號歷史表：

### 方法 1：使用 psql（本地開發）

```bash
# 設定資料庫 URL
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trade_api"

# 執行遷移
psql $DATABASE_URL -f db/migrations/004_add_strategy_config.sql
```

### 方法 2：使用 Azure PostgreSQL

```bash
# 取得資料庫連線資訊
az postgres flexible-server show \
  --resource-group trade-api-rg \
  --name your-db-server \
  --output table

# 執行遷移
az postgres flexible-server execute \
  --name your-db-server \
  --admin-user adminuser \
  --admin-password <your-password> \
  --database-name trade_api \
  --file-path db/migrations/004_add_strategy_config.sql
```

### 方法 3：使用 Docker Compose

```bash
# 複製 SQL 到容器
docker cp db/migrations/004_add_strategy_config.sql trade-api-dashboard-uni-db-1:/tmp/

# 在容器內執行
docker exec -it trade-api-dashboard-uni-db-1 \
  psql -U postgres -d trade_api -f /tmp/004_add_strategy_config.sql
```

## 驗證遷移

執行以下 SQL 確認表格建立成功：

```sql
-- 檢查 strategy_config 表
SELECT * FROM strategy_config;

-- 檢查 signal_history 表
SELECT * FROM signal_history;

-- 確認預設策略已建立
SELECT strategy_name, source_product, target_product, quantity_multiplier 
FROM strategy_config;
```

## 預期結果

遷移完成後，您應該會看到：

1. **strategy_config** 表包含 3 個預設策略：
   - `TXF_vivi` - 大台轉大台（1倍）
   - `TXF_vivi_mini` - 大台訊號轉小台（2倍）
   - `TXF_vivi_3x` - 大台3倍口數

2. **signal_history** 表（空表，等待接收訊號）

## 回滾遷移（如需要）

```sql
-- 刪除新建的表格
DROP TABLE IF EXISTS signal_history;
DROP TABLE IF EXISTS strategy_config;
```

## 注意事項

- 遷移會使用 `ON CONFLICT DO NOTHING`，重複執行不會造成錯誤
- 建議在執行前備份資料庫
- PostgreSQL 註解語法使用 `COMMENT` 關鍵字
