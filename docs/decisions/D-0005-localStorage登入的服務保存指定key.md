# D-0005 登入存在 localStorage 的服務：保存、還原指定的 key

| | |
|---|---|
| 狀態 | 有效 |
| 日期 | 2026-11-21 |
| 決定者 | 使用者（選擇繼續投入），細節由 Claude 擬定 |
| 範圍 | Discord 與日後同類服務 |

## 決定

1. 服務定義加 `storage: { origin, keys, authKey }`，只保存列出的 key，和 cookie 一起加密存進 Vault。
2. 新增 `scripting` 權限，只由背景主動注入：
   - 讀：從已開啟的服務分頁或入口頁內嵌框架讀取；沒開著就不更新，沒有 `authKey` 也不覆蓋舊快照。
   - 寫：開背景分頁到該來源的 `/robots.txt`（不執行網站程式），寫入後關閉，再開服務。
3. 鎖定時照原本流程清除該來源的 localStorage。
4. Discord 套用：`token`。

## 理由

使用者實測 Discord 的登入不在 cookie，只還原 cookie 一定是登出。localStorage 的 token 不受裝置綁定，寫回後可以登入。注入是一次性的，不常駐 content script、不對網頁開放訊息介面，符合 CLAUDE.md §6。

## 風險

- Discord 改變 token 儲存方式就會失效。
- 入口頁內嵌框架的 localStorage 若被分區，內嵌登入的 token 讀不到、寫入也不會生效 `[待實測]`。
- Discord 可能把異常的 token 使用判定為可疑登入，要求重新驗證。

## 否決的方案

| ID | 方案 | 原因 | 重啟條件 |
|---|---|---|---|
| R-009 | 常駐 content script 讀寫 localStorage | 對網頁暴露介面、違反 §6 | 無 |
