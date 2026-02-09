# Azure 部署腳本（無需本機 Docker 版本）
# 使用 Azure Container Registry 雲端建構功能

param(
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = "trade-api-rg",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "eastasia",
    
    [Parameter(Mandatory=$false)]
    [string]$AcrName = "tradeacr$(Get-Random -Maximum 9999)",
    
    [Parameter(Mandatory=$true)]
    [string]$UnitradeWsUrl,
    
    [Parameter(Mandatory=$true)]
    [string]$UnitradeAccount,
    
    [Parameter(Mandatory=$true)]
    [string]$UnitradePassword,
    
    [Parameter(Mandatory=$true)]
    [string]$UnitradeCertPassword,
    
    [Parameter(Mandatory=$true)]
    [string]$UnitradeActno
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 開始部署至 Azure (East Asia - 台灣)" -ForegroundColor Green
Write-Host "資源群組: $ResourceGroup"
Write-Host "區域: $Location"
Write-Host ""

# 1. 建立資源群組
Write-Host "📦 建立資源群組..." -ForegroundColor Yellow
az group create `
    --name $ResourceGroup `
    --location $Location

# 2. 建立 Container Registry
Write-Host "📦 建立 Container Registry..." -ForegroundColor Yellow
az acr create `
    --resource-group $ResourceGroup `
    --name $AcrName `
    --sku Basic `
    --location $Location `
    --admin-enabled true

$AcrLoginServer = az acr show --name $AcrName --query loginServer --output tsv
Write-Host "✅ ACR Login Server: $AcrLoginServer" -ForegroundColor Cyan

# 3. 使用 ACR 雲端建構映像（無需本機 Docker）
Write-Host "☁️  使用 ACR 雲端建構 Docker 映像..." -ForegroundColor Yellow
az acr build `
    --registry $AcrName `
    --image trade-api:latest `
    --file Dockerfile `
    .

Write-Host "✅ 映像建構完成" -ForegroundColor Green

# 4. 確認 Container Apps 擴充功能
Write-Host "📦 確認 Container Apps 擴充功能..." -ForegroundColor Yellow
az extension add --name containerapp --upgrade --yes

# 5. 建立 Container Apps Environment
Write-Host "🌍 建立 Container Apps Environment..." -ForegroundColor Yellow
$ContainerAppEnv = "trade-env"
az containerapp env create `
    --name $ContainerAppEnv `
    --resource-group $ResourceGroup `
    --location $Location

# 6. 建立儲存體帳戶（PostgreSQL 資料持久化）
Write-Host "💾 建立儲存體帳戶..." -ForegroundColor Yellow
$StorageAccount = "tradestorage$(Get-Random -Maximum 9999)"
az storage account create `
    --name $StorageAccount `
    --resource-group $ResourceGroup `
    --location $Location `
    --sku Standard_LRS `
    --allow-blob-public-access false

az storage share create `
    --name pgdata `
    --account-name $StorageAccount `
    --quota 10

Write-Host "✅ 儲存體建立完成" -ForegroundColor Green

# 7. 部署 PostgreSQL 容器
Write-Host "🗄️  部署 PostgreSQL 容器..." -ForegroundColor Yellow
$DbPassword = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 20 | % {[char]$_})

try {
    az containerapp create `
        --name trade-postgres `
        --resource-group $ResourceGroup `
        --environment $ContainerAppEnv `
        --image postgres:15-alpine `
        --target-port 5432 `
        --ingress internal `
        --min-replicas 1 `
        --max-replicas 1 `
        --cpu 0.25 `
        --memory 0.5Gi `
        --env-vars `
            "POSTGRES_DB=trade_api" `
            "POSTGRES_USER=tradeuser" `
            "POSTGRES_PASSWORD=$DbPassword"
    
    Write-Host "✅ PostgreSQL 部署完成" -ForegroundColor Green
} catch {
    Write-Host "⚠️  PostgreSQL 部署警告: $_" -ForegroundColor Yellow
}

# 8. 部署後端 API
Write-Host "🚀 部署後端 API..." -ForegroundColor Yellow
$ContainerAppName = "trade-api-backend"
$AcrPassword = az acr credential show --name $AcrName --query "passwords[0].value" -o tsv

# 憑證路徑在容器內
$CertPath = "/app/certs/unitrade_cert.pfx"

# CORS 暫時設定為允許所有來源（稍後更新）
$CorsOrigins = "*"

try {
    az containerapp create `
        --name $ContainerAppName `
        --resource-group $ResourceGroup `
        --environment $ContainerAppEnv `
        --image "${AcrLoginServer}/trade-api:latest" `
        --target-port 8000 `
        --ingress external `
        --min-replicas 1 `
        --max-replicas 5 `
        --cpu 0.5 `
        --memory 1.0Gi `
        --registry-server $AcrLoginServer `
        --registry-username $AcrName `
        --registry-password $AcrPassword `
        --env-vars `
            "DATABASE_URL=postgresql://tradeuser:${DbPassword}@trade-postgres:5432/trade_api" `
            "UNITRADE_WS_URL=$UnitradeWsUrl" `
            "UNITRADE_ACCOUNT=$UnitradeAccount" `
            "UNITRADE_PASSWORD=$UnitradePassword" `
            "UNITRADE_CERT_FILE=$CertPath" `
            "UNITRADE_CERT_PASSWORD=$UnitradeCertPassword" `
            "UNITRADE_ACTNO=$UnitradeActno" `
            "CORS_ORIGINS=$CorsOrigins"

    $BackendUrl = az containerapp show --name $ContainerAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv

    Write-Host ""
    Write-Host "🎉 部署完成！" -ForegroundColor Green
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "📝 部署資訊" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "資源群組: $ResourceGroup" -ForegroundColor White
    Write-Host "區域: $Location (台灣 East Asia)" -ForegroundColor White
    Write-Host ""
    Write-Host "🌐 後端 API URL: " -NoNewline -ForegroundColor White
    Write-Host "https://$BackendUrl" -ForegroundColor Green
    Write-Host ""
    Write-Host "📌 重要端點：" -ForegroundColor Yellow
    Write-Host "   健康檢查: https://$BackendUrl/health" -ForegroundColor White
    Write-Host "   Webhook URL: https://$BackendUrl/webhook" -ForegroundColor White
    Write-Host "   訂單列表: https://$BackendUrl/orders" -ForegroundColor White
    Write-Host "   API 文件: https://$BackendUrl/docs" -ForegroundColor White
    Write-Host ""
    Write-Host "🗄️  資料庫資訊：" -ForegroundColor Yellow
    Write-Host "   主機: trade-postgres (內部)" -ForegroundColor White
    Write-Host "   使用者: tradeuser" -ForegroundColor White
    Write-Host "   密碼: $DbPassword" -ForegroundColor White
    Write-Host "   資料庫: trade_api" -ForegroundColor White
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "✅ 下一步：" -ForegroundColor Yellow
    Write-Host "1. 測試後端 API:" -ForegroundColor White
    Write-Host "   curl https://$BackendUrl/health" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. 設定 TradingView Webhook URL:" -ForegroundColor White
    Write-Host "   https://$BackendUrl/webhook" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. 部署前端 Angular 應用（詳見 DEPLOYMENT.md）" -ForegroundColor White
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""

    # 儲存部署資訊
    $DeploymentInfo = @{
        ResourceGroup = $ResourceGroup
        Location = $Location
        AcrName = $AcrName
        AcrLoginServer = $AcrLoginServer
        BackendUrl = "https://$BackendUrl"
        WebhookUrl = "https://$BackendUrl/webhook"
        HealthCheckUrl = "https://$BackendUrl/health"
        ApiDocsUrl = "https://$BackendUrl/docs"
        DbPassword = $DbPassword
        DbHost = "trade-postgres"
        DbUser = "tradeuser"
        DbName = "trade_api"
        DeploymentTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        CertificatePath = $CertPath
    } | ConvertTo-Json -Depth 10

    $DeploymentInfo | Out-File -FilePath "deployment-info.json" -Encoding utf8
    Write-Host "💾 部署資訊已儲存至: deployment-info.json" -ForegroundColor Green
    Write-Host ""

    # 測試健康檢查
    Write-Host "🔍 測試後端健康檢查..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    try {
        $HealthResponse = Invoke-RestMethod -Uri "https://$BackendUrl/health" -Method Get
        Write-Host "✅ 後端 API 正常運行！" -ForegroundColor Green
        Write-Host ($HealthResponse | ConvertTo-Json) -ForegroundColor Gray
    } catch {
        Write-Host "⚠️  健康檢查失敗，請稍後手動確認" -ForegroundColor Yellow
    }

} catch {
    Write-Host "❌ 部署失敗: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "建議檢查：" -ForegroundColor Yellow
    Write-Host "1. Azure 訂閱是否有足夠權限" -ForegroundColor White
    Write-Host "2. 資源配額是否足夠" -ForegroundColor White
    Write-Host "3. 查看詳細錯誤訊息" -ForegroundColor White
    throw
}
