# CONVENTIONS — 技術慣例與踩過的坑

每條附來源。沒有來源的規則不寫進來。

## 1. 程式

| 規則 | 為什麼 | 來源 |
|---|---|---|
| 不使用建置工具或第三方套件，原生 ES module 直接載入 | 外掛小、可直接讀懂；加密相關不引入外部依賴 | D-0001 |
| 讀改寫 Vault 一律包在 `serial()` 裡 | 自動保存、分頁載入保存和手動操作可能同時發生，會互相覆蓋 | D-0001 |
| 已確認登入 cookie 的服務，目前沒登入就不覆蓋舊快照 | 避免把「已登出」的狀態存進 Vault，蓋掉有效的登入 | D-0001 |
| 服務圖示用 Chrome `_favicon` API（`favicon` 權限），不打包品牌 Logo、不向外取圖；載入失敗退回服務名首字 | 公開 repo 不放商標檔；不送資料出本機 | 2026-11-20 入口頁改版 |
| 新增服務要同時改 `services.js` 和 `manifest.json` 的 `host_permissions` | 沒有權限時 `chrome.cookies` 讀不到該網域 | D-0001 |

## 2. 測試

| 規則 | 為什麼 | 來源 |
|---|---|---|
| 檢查指令：每個 `.js` 跑 `node --input-type=module --check`；`manifest.json` 要能 JSON 解析 | 沒有建置流程，語法錯誤只能這樣提早抓 | D-0001 |
| 外掛行為在真實 Chrome 驗證 | Claude 的內建瀏覽器無法載入外掛 | D-0001 |

## 3. 踩過的坑

### 設了 `display` 的元素，`hidden` 屬性失效

- **現象：** 入口頁同時顯示解鎖表單、服務卡片和設定表單。
- **根因：** `.narrow { display: flex }` 的優先順序高於瀏覽器預設的 `[hidden] { display: none }`。
- **之後：** `hub.css` 保留 `[hidden] { display: none !important; }`。
- **來源：** 2026-11-20 使用者實測
