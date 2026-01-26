# 憑證與帳號放置位置

## 憑證檔

- 建議路徑：`/app/certs/your_cert.pfx`
- 專案路徑對應：在專案根目錄建立 `certs/`，將 .pfx 放入。

```
trade-api-dashboard-uni/
└─ certs/
   └─ your_cert.pfx
```

## 帳號與密碼

請將帳號與密碼放在 `.env`：

```
UNITRADE_WS_URL=...
UNITRADE_ACCOUNT=...
UNITRADE_PASSWORD=...
UNITRADE_CERT_FILE=/app/certs/your_cert.pfx
UNITRADE_CERT_PASSWORD=...
UNITRADE_ACTNO=...
```

> `.env` 需放在專案根目錄，請勿提交到版本控制。
