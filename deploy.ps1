# Azure 部署腳本（台灣區域）
# 執行前請先：az login

param(
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = "trade-api-rg",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "eastasia",  # 台灣
    
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
Write-Host "ACR Login Server: $AcrLoginServer"

# 3. 建構並推送 Docker 映像
Write-Host "🐳 建構 Docker 映像..." -ForegroundColor Yellow
docker build -t trade-api:latest .

Write-Host "📤 推送映像到 ACR..." -ForegroundColor Yellow
az acr login --name $AcrName
docker tag trade-api:latest "${AcrLoginServer}/trade-api:latest"
docker push "${AcrLoginServer}/trade-api:latest"

# 4. 建立 Container Apps Environment
Write-Host "🌍 建立 Container Apps Environment..." -ForegroundColor Yellow
$ContainerAppEnv = "trade-env"
az containerapp env create `
    --name $ContainerAppEnv `
    --resource-group $ResourceGroup `
    --location $Location

# 5. 建立儲存體帳戶（PostgreSQL 資料持久化）
Write-Host "💾 建立儲存體帳戶..." -ForegroundColor Yellow
$StorageAccount = "tradestorage$(Get-Random -Maximum 9999)"
az storage account create `
    --name $StorageAccount `
    --resource-group $ResourceGroup `
    --location $Location `
    --sku Standard_LRS

az storage share create `
    --name pgdata `
    --account-name $StorageAccount `
    --quota 10

# 6. 部署 PostgreSQL 容器
Write-Host "🗄️  部署 PostgreSQL 容器..." -ForegroundColor Yellow
$DbPassword = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 16 | % {[char]$_})

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

Write-Host "資料庫密碼: $DbPassword" -ForegroundColor Cyan
Write-Host "請儲存此密碼！"

# 7. 部署後端 API
Write-Host "🚀 部署後端 API..." -ForegroundColor Yellow
$ContainerAppName = "trade-api-backend"
$AcrPassword = az acr credential show --name $AcrName --query "passwords[0].value" -o tsv

# 建立暫時的前端 URL（稍後更新）
$CorsOrigins = "https://localhost:4200,https://*.azurestaticapps.net"

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
        "UNITRADE_CERT_FILE=/app/certs/your_cert.pfx" `
        "UNITRADE_CERT_PASSWORD=$UnitradeCertPassword" `
        "UNITRADE_ACTNO=$UnitradeActno" `
        "CORS_ORIGINS=$CorsOrigins"

$BackendUrl = az containerapp show --name $ContainerAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv

Write-Host ""
Write-Host "✅ 部署完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📝 部署資訊：" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────"
Write-Host "資源群組: $ResourceGroup"
Write-Host "區域: $Location (台灣)"
Write-Host "後端 API URL: https://$BackendUrl"
Write-Host "Webhook URL: https://$BackendUrl/webhook"
Write-Host "Health Check: https://$BackendUrl/health"
Write-Host ""
Write-Host "資料庫資訊："
Write-Host "  主機: trade-postgres (內部)"
Write-Host "  使用者: tradeuser"
Write-Host "  密碼: $DbPassword"
Write-Host "  資料庫: trade_api"
Write-Host ""
Write-Host "⚠️  重要：請儲存上述資訊！" -ForegroundColor Yellow
Write-Host ""
Write-Host "下一步："
Write-Host "1. 測試後端 API: curl https://$BackendUrl/health"
Write-Host "2. 部署前端（請參考 azure-deployment.md）"
Write-Host "3. 設定 TradingView Webhook URL"
Write-Host "4. ⚠️  上傳 PFX 憑證檔（需手動操作）"
Write-Host ""

# 儲存部署資訊
$DeploymentInfo = @{
    ResourceGroup = $ResourceGroup
    Location = $Location
    AcrName = $AcrName
    AcrLoginServer = $AcrLoginServer
    BackendUrl = "https://$BackendUrl"
    WebhookUrl = "https://$BackendUrl/webhook"
    DbPassword = $DbPassword
    DeploymentTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
} | ConvertTo-Json

$DeploymentInfo | Out-File -FilePath "deployment-info.json" -Encoding utf8
Write-Host "部署資訊已儲存至: deployment-info.json" -ForegroundColor Green
