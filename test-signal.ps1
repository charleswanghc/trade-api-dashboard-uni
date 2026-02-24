# 測試訊號功能腳本
# 用途：測試策略設定和訊號處理功能

param(
    [string]$ApiUrl = "http://localhost:8000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  訊號功能測試腳本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 檢查 API 健康狀態
Write-Host "1️⃣ 檢查 API 健康狀態..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$ApiUrl/health" -Method Get
    Write-Host "   ✅ API 正常運作" -ForegroundColor Green
    Write-Host "   狀態: $($health.status)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ API 無法連線" -ForegroundColor Red
    Write-Host "   錯誤: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 2. 查詢現有策略
Write-Host "2️⃣ 查詢現有策略..." -ForegroundColor Yellow
try {
    $strategies = Invoke-RestMethod -Uri "$ApiUrl/strategies" -Method Get
    Write-Host "   ✅ 找到 $($strategies.Count) 個策略" -ForegroundColor Green
    foreach ($strategy in $strategies) {
        $status = if ($strategy.enabled) { "✅ 啟用" } else { "⭕ 停用" }
        Write-Host "   - $($strategy.strategy_name): $($strategy.source_product) → $($strategy.target_product) (×$($strategy.quantity_multiplier)) $status" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ 查詢策略失敗" -ForegroundColor Red
    Write-Host "   錯誤: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 3. 建立測試策略（如果不存在）
Write-Host "3️⃣ 建立測試策略..." -ForegroundColor Yellow
$testStrategyName = "test_strategy_" + (Get-Date -Format "HHmmss")
$testStrategy = @{
    strategy_name = $testStrategyName
    source_product = "TXFF5"
    target_product = "TXFF5"
    quantity_multiplier = 1
    max_position = 10
    order_type = "M"
    order_condition = "I"
    dtrade = "N"
    entry_order_type = "M"
    entry_order_condition = "I"
    exit_order_type = "M"
    exit_order_condition = "I"
    account = $null
    sub_account = ""
    enabled = $true
    description = "自動測試策略 - 請勿用於實際交易"
}

try {
    $created = Invoke-RestMethod -Uri "$ApiUrl/strategies" -Method Post `
        -ContentType "application/json" `
        -Body ($testStrategy | ConvertTo-Json)
    Write-Host "   ✅ 測試策略建立成功: $testStrategyName" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️ 測試策略建立失敗（可能已存在）" -ForegroundColor Yellow
}

Write-Host ""

# 4. 測試訊號 - 做多進場
Write-Host "4️⃣ 測試訊號: 做多進場..." -ForegroundColor Yellow
$signal1 = @{
    strategy = $testStrategyName
    signal = "long_entry"
    quantity = 1
    price = 21500
    note = "test_buy"
}

try {
    $result1 = Invoke-RestMethod -Uri "$ApiUrl/signal" -Method Post `
        -ContentType "application/json" `
        -Body ($signal1 | ConvertTo-Json)
    
    Write-Host "   ✅ 訊號處理成功" -ForegroundColor Green
    Write-Host "   狀態: $($result1.status)" -ForegroundColor Gray
    Write-Host "   商品: $($result1.actual_product)" -ForegroundColor Gray
    Write-Host "   數量: $($result1.actual_quantity) 口" -ForegroundColor Gray
    if ($result1.order_id) {
        Write-Host "   訂單ID: $($result1.order_id)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ 訊號處理失敗" -ForegroundColor Red
    Write-Host "   錯誤: $($_.Exception.Message)" -ForegroundColor Red
    
    # 顯示詳細錯誤
    if ($_.ErrorDetails.Message) {
        $errorDetail = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "   詳細: $($errorDetail.detail)" -ForegroundColor Red
    }
}

Write-Host ""

# 5. 測試訊號 - 做多出場
Write-Host "5️⃣ 測試訊號: 做多出場..." -ForegroundColor Yellow
$signal2 = @{
    strategy = $testStrategyName
    signal = "long_exit"
    quantity = 1
    note = "test_sell"
}

try {
    $result2 = Invoke-RestMethod -Uri "$ApiUrl/signal" -Method Post `
        -ContentType "application/json" `
        -Body ($signal2 | ConvertTo-Json)
    
    Write-Host "   ✅ 訊號處理成功" -ForegroundColor Green
    Write-Host "   狀態: $($result2.status)" -ForegroundColor Gray
    Write-Host "   商品: $($result2.actual_product)" -ForegroundColor Gray
    Write-Host "   數量: $($result2.actual_quantity) 口" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠️ 訊號處理失敗（可能是沒有持倉）" -ForegroundColor Yellow
}

Write-Host ""

# 6. 查詢訊號歷史
Write-Host "6️⃣ 查詢訊號歷史..." -ForegroundColor Yellow
try {
    $signals = Invoke-RestMethod -Uri "$ApiUrl/signals?strategy=$testStrategyName&limit=5" -Method Get
    Write-Host "   ✅ 找到 $($signals.Count) 筆訊號記錄" -ForegroundColor Green
    
    foreach ($sig in $signals) {
        $statusColor = switch ($sig.status) {
            "processed" { "Green" }
            "ignored" { "Yellow" }
            "failed" { "Red" }
            default { "Gray" }
        }
        Write-Host "   [$($sig.signal_type)] $($sig.status) - $($sig.actual_product) $($sig.actual_quantity)口" -ForegroundColor $statusColor
        if ($sig.error_message) {
            Write-Host "     錯誤: $($sig.error_message)" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "   ❌ 查詢訊號歷史失敗" -ForegroundColor Red
}

Write-Host ""

# 7. 測試停用策略
Write-Host "7️⃣ 測試停用策略..." -ForegroundColor Yellow
try {
    $toggled = Invoke-RestMethod -Uri "$ApiUrl/strategies/$testStrategyName/toggle" -Method Patch
    $status = if ($toggled.enabled) { "啟用" } else { "停用" }
    Write-Host "   ✅ 策略已切換為: $status" -ForegroundColor Green
    
    # 測試停用狀態下的訊號
    Write-Host "   測試停用狀態下的訊號..." -ForegroundColor Gray
    $signal3 = @{
        strategy = $testStrategyName
        signal = "long_entry"
        quantity = 1
    }
    
    $result3 = Invoke-RestMethod -Uri "$ApiUrl/signal" -Method Post `
        -ContentType "application/json" `
        -Body ($signal3 | ConvertTo-Json)
    
    if ($result3.status -eq "ignored") {
        Write-Host "   ✅ 停用狀態正常運作（訊號被忽略）" -ForegroundColor Green
    }
    
    # 恢復啟用
    $toggled2 = Invoke-RestMethod -Uri "$ApiUrl/strategies/$testStrategyName/toggle" -Method Patch
    Write-Host "   ✅ 策略已恢復啟用" -ForegroundColor Green
    
} catch {
    Write-Host "   ⚠️ 停用測試失敗" -ForegroundColor Yellow
}

Write-Host ""

# 8. 清理測試策略
Write-Host "8️⃣ 清理測試策略..." -ForegroundColor Yellow
$cleanup = Read-Host "是否刪除測試策略? (y/N)"
if ($cleanup -eq "y") {
    try {
        Invoke-RestMethod -Uri "$ApiUrl/strategies/$testStrategyName" -Method Delete | Out-Null
        Write-Host "   ✅ 測試策略已刪除" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️ 刪除失敗" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⏭️ 保留測試策略: $testStrategyName" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  測試完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 查看更多資訊：" -ForegroundColor Yellow
Write-Host "   - 策略列表: $ApiUrl/strategies" -ForegroundColor Gray
Write-Host "   - 訊號歷史: $ApiUrl/signals" -ForegroundColor Gray
Write-Host "   - 訂單記錄: $ApiUrl/orders" -ForegroundColor Gray
Write-Host ""
