# CLAUDE.md — PersonaHub 工作規則

個人專案（單人開發）。協作方式取自 `claude-workflow-template`，只保留單人用得到的部分（D-0002）。

## 0. 開工前

自動載入下面三份；個別決策檔需要時才讀。提方案前先查否決清單，不重提已否決的做法。

@docs/STATUS.md
@docs/DECISIONS.md
@docs/CONVENTIONS.md

## 1. 文件

| 變動 | 更新哪裡 |
|---|---|
| 新決策、推翻 | `docs/decisions/D-NNNN-*.md` + `docs/DECISIONS.md` 索引一行 |
| 被否決的方案 | 該決策檔 + 索引的否決清單 |
| 進度、未決事項 | `docs/STATUS.md`（只寫現況，改寫不追加） |
| 技術慣例、踩過的坑 | `docs/CONVENTIONS.md` |
| 使用方式、安裝 | `README.md` |

- 決定當場寫回，不等對話結束。
- 文件改動和程式改動放同一個 commit。
- 標 `[待確認]` 的內容不自行補寫。
- 換對話不寫交接檔：現況寫進 `docs/STATUS.md`，只給使用者一段簡短開場白（目前做到哪、下一步），新對話靠自動載入的文件接續。

## 2. Git

- 使用者授權 Claude 直接 commit 並 push 到 `main`（D-0002）。
- Commit message 用 Conventional Commits，說明為什麼。
- 只 `git add` 自己改的檔案。行尾一律 LF。
- 需要 GitHub 授權（push 失敗、gh 未登入）時，提醒使用者處理，不自己繞過。

## 3. 機密

- 這是**公開 repo**：任何帳密、cookie、Token、Vault 匯出檔都不進 git、不貼進對話。
- 測試用的 cookie 或帳號資料不寫進程式碼或文件。

## 4. 驗證與回報

- 不說「應該可以」。階段用詞：`已實作` / `已 commit` / `已 push` / `已驗收`。
- 分開列**已驗證**與**尚未驗證**。外掛的實際行為（cookie 還原、各服務登入）只能在使用者的真實 Chrome 驗證，Claude 的內建瀏覽器無法載入外掛。
- 回報結尾：**改了什麼**、**驗證到哪**、**等使用者做什麼**。

## 5. 溝通

繁體中文，先講結論。使用者是軟體工程師，不問基本環境問題。提選項時附建議與理由。

## 6. 專案紅線

- 解密後的 Vault 內容和金鑰不寫進 `chrome.storage.local` 或任何持久儲存；金鑰只放 `chrome.storage.session`。
- 加密只用 WebCrypto，不自己實作演算法，也不引入第三方加密套件。
- 背景訊息只接受本擴充功能自己的頁面（`sender.id` + `sender.url` 檢查），不加 content script 對網頁開放的介面。
- 不加任何會把資料送出本機的功能（遙測、雲端同步），除非另立決策。
