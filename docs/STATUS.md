# STATUS — 現況

最後更新：2026-11-21

只記現況，改寫不追加。階段：`已實作` → `已 commit` → `已 push` → `已驗收`

## 1. 元件狀態

| 元件 | 狀態 | 版本 | 現況 |
|---|---|---|---|
| 外掛 `extension/` | 已 push，部分驗收 | 0.1.0 | MVP：建立 Vault、解鎖、服務卡片、還原、鎖定清除、自動保存、閒置鎖定 |
| 入口頁 UI | 已 push，部分驗收 | — | Logo 配色（鐵灰藍＋金屬灰＋黃銅金）、服務卡片側欄用 `_favicon` 服務圖示、動效、主題切換（系統／淺色／深色） |
| 外掛圖示 | 已驗收 | — | 方案 A：裁切 Logo 中央徽記；完整原圖 `icons/logo-full.png` 放在設定頁底部，也供上架使用 |
| 開啟方式 | 已 push，部分驗收 | — | 新分頁／獨立視窗（App 視窗）／PersonaHub 視窗（分頁群組，D-0003） |
| 內嵌分頁原型（實驗） | 已 push，未驗收 | — | 設定頁開關；Spotify、Netflix 在入口頁分頁列（YouTube 已改回不內嵌）＋iframe 開啟；DNR session rule 只對入口頁所在分頁的子框架移除 `X-Frame-Options`、CSP |
| 桌面捷徑腳本 `extension/shortcut/` | 已 push，部分驗收 | — | 設定頁複製 PowerShell 指令，或雙擊 `create-shortcut.cmd`；捷徑以 App 視窗開啟入口頁、用 PersonaHub 圖示 |

## 2. 驗證

使用者在獨立的本機 Chrome 設定檔「PersonaHub 測試」（`Profile 1`，不登入 Google）載入外掛測試。

**已驗證（2026-11-20～21，使用者實測）：**
- 內嵌原型：Spotify、Netflix 能內嵌並播放；YouTube 一般影片在框架內崩潰（一般分頁可播），已改回不內嵌
- 建立主密碼、解鎖、入口頁顯示
- Spotify：鎖定 → 解鎖、關閉瀏覽器重開，都能還原為已登入（2026-11-21）
- YouTube：還原必定被登出，原因是 DBSC 裝置綁定；改為不還原後，鎖定 → 解鎖點卡片會開登入頁（D-0004，2026-11-21）
- Spotify 內嵌：同意 cookie 還原為 SameSite=None 後不再跳 cookie 政策橫幅（2026-11-21）
- Spotify：登入後自動保存、鎖定後登出、Win+L 觸發鎖定並登出
- 外掛圖示、設定頁（含底部原圖）
- 「PersonaHub 視窗」：服務集中在同一視窗的分頁群組
- 桌面捷徑（PowerShell 版）：建立成功、圖示正常
- 桌面捷徑（cmd 版）：Claude 在本機執行成功（自動找到 `Profile 1`）

**尚未驗證：**

| 項目 | 怎麼驗 |
|---|---|
| 服務卡片 `_favicon` 圖示、主題切換、設定頁「返回」修正 | 入口頁實際操作 |
| Spotify：解鎖後點卡片還原為已登入；未鎖定直接關閉瀏覽器，重開後自動清除 | README 的測試步驟 |
| Netflix、YouTube、Uber Eats、Friday影音 的保存、還原、清除 | 逐一測試 |
| 官方 PWA（Spotify、YouTube）還原後是否登入 | 開 PWA 確認 |
| 捷徑釘選到工作列後，入口頁 App 視窗是否獨立一顆、顯示 PersonaHub 圖示 | 釘選後觀察 |

## 3. 未決問題

| # | 問題 | 影響 | 建議 |
|---|---|---|---|
| Q-1 | Uber Eats、Friday影音的登入 cookie 名稱 `[待確認]` | 無法判斷是否過期、可能把已登出狀態存進去 | 使用者登入後截 DevTools → Application → Cookies（遮住 Value），補進 `services.js` 的 `authCookies` |
| Q-2 | Friday影音的登入是否經過 fetnet.net 以外的網域 `[待確認]` | 還原可能不完整 | 同上，觀察登入流程的網域 |

## 4. 下一步候選

1. **內嵌原型**：Spotify、Netflix 可行，觀察穩定性後決定是否立新決策對個別服務推翻 R-006（實測紀錄在 D-0003）。YouTube 不內嵌（框架內一般影片崩潰）；框架內登入靠 cookie 變動即時保存
2. 完成 §2 尚未驗證的項目，補 Q-1、Q-2
3. 可在入口頁新增自訂服務（不用改程式碼）

## 5. 備忘

- 重新載入／更新外掛時不清除服務登入（使用者 2026-11-21 決定）：外掛會顯示鎖定，但各服務仍保持登入。

- 測試用設定檔不可用日常設定檔：鎖定會清掉 google.com 等網域的 cookie，會登出 Gmail 等所有 Google 服務。
- Win+L 時 FFXIV 斷線是遊戲本身的問題（實測鎖定期間網路沒有中斷），與 PersonaHub 無關。
