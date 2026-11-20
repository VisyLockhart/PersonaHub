# 交接摘要：PersonaHub 入口頁內嵌分頁原型

產生時間：2026-11-20

## 目標
使用者想把 PersonaHub 入口頁（以 App 視窗開啟、沒有網址列）當主畫面，在頁面內自製分頁列，用 iframe 開啟各服務，結合「分頁管理」和「App 視窗外觀」。先做原型確認可行性。

## 先讀這些
- `CLAUDE.md`：工作規則與專案紅線（公開 repo、不送資料出本機、背景訊息只收自己頁面）
- `docs/STATUS.md` §4 第 1 項：原型範圍
- `docs/decisions/D-0003-服務集中在專用視窗的分頁群組.md` 的 R-006：原本否決 iframe 的理由與重啟條件
- `docs/CONVENTIONS.md` 的「分頁管理和 App 視窗外觀無法兼得」

## 目前進度
- 已 push：入口頁改版（Logo 配色、服務圖示側欄、動效、主題切換）、外掛圖示、「PersonaHub 視窗」分頁群組模式、桌面捷徑腳本（PowerShell 與 cmd）
- 使用者已同意試做 iframe 原型，並了解需要在 PersonaHub 頁面內拿掉各服務的防嵌入保護

## 待辦事項
- [ ] 做實驗性開啟方式：入口頁內的分頁列＋iframe，先只接 Spotify、YouTube
- [ ] 用 `declarativeNetRequest` 移除 `X-Frame-Options`、CSP `frame-ancestors`，規則只套用在由本外掛頁面發出的子框架請求
- [ ] iframe 開放 `encrypted-media`、`fullscreen`、`autoplay`
- [ ] 請使用者在真實 Chrome 驗證三件事：能否顯示、是否保持登入（cookie 有沒有送進 iframe）、能否播放
- [ ] 依結果：可行就補其他服務並寫新決策推翻 R-006；不可行就把實測結果寫進 R-006 的否決理由

## 未解決的問題
- iframe 內的登入 cookie 是否會被送出（Chrome 對有網域權限的外掛頁面可能放行，未證實）
- 網站偵測到被嵌入時是否拒絕顯示（Netflix 最可能）；Google 登入頁禁止在框架裡登入，YouTube 登入過期時需改開一般分頁
- 服務彈出的新視窗、上一頁與下一頁、Bitwarden 自動填入在 iframe 內的行為

## 重要細節
- 溝通用繁體中文、先講結論；回報分「已驗證／尚未驗證」，結尾寫改了什麼、驗證到哪、等使用者做什麼
- Claude 可直接 commit 並 push 到 `main`；文件與程式放同一個 commit；行尾 LF；Conventional Commits 說明為什麼
- 不用建置工具，原生 ES module；新增權限要同步改 `manifest.json`
- 外掛實際行為只能由使用者在真實 Chrome 驗證；Claude 的內建瀏覽器不能載入外掛，預覽時 `<link>` 樣式表有時不會載入，要用 JS 注入 `<style>`
- 測試設定檔是 `Profile 1`（「PersonaHub 測試」），不可用日常設定檔
- `create-shortcut.ps1` 存成 UTF-8 含 BOM（Windows PowerShell 5.1 才不會把中文讀成亂碼）；`.cmd` 裡 `chcp` 之前只能用 ASCII

## 相關檔案
- `extension/background.js`：開啟服務（`openService`、`openInGroupWindow`）、鎖定、訊息處理
- `extension/hub.html`、`hub.css`、`hub.js`：入口頁
- `extension/services.js`：服務定義
- `extension/manifest.json`：權限
- `extension/shortcut/`：桌面捷徑腳本
