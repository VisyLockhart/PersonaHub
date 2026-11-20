# PersonaHub

在共用電腦（例如公司電腦）上，**一鍵還原**個人服務的登入狀態，下班時**一鍵清除**。

- 不用每天重新登入：登入狀態（cookie）用你的主密碼加密保存，點服務卡片就還原，直接是已登入狀態。
- 不留痕跡：鎖定時清掉這些服務的 cookie、localStorage 和 IndexedDB，並關閉相關分頁。
- 過期也不麻煩：登入過期時會自動打開官方登入頁，登入完成後自動存回 Vault。

目前支援：Spotify、Netflix、YouTube、Uber Eats、Friday影音。

## 安裝

1. Chrome 右上角頭像 →「新增」，建立一個專用的**個人設定檔**（與公司設定檔隔離）。
   - 建議關閉這個設定檔的 Chrome 同步，也不要讓 Chrome 記住個人密碼。
2. 在個人設定檔打開 `chrome://extensions`，開啟右上角「開發人員模式」。
3. 按「載入未封裝項目」，選擇本 repo 的 `extension/` 資料夾。
4. （建議）再按一次「載入未封裝項目」，選 `theme/` 資料夾，套用深色主題。
5. Chrome 設定 → 外觀 → 側邊欄位置選「左側」。
6. 點工具列上的 PersonaHub 圖示，側邊欄會開啟入口頁，建立主密碼。

## 桌面捷徑（Windows）

入口頁「設定」→「複製建立桌面捷徑的指令」，貼到 PowerShell 按 Enter，桌面會出現 PersonaHub 捷徑：使用 PersonaHub 圖示、直接用裝了外掛的設定檔開啟解鎖畫面。右鍵捷徑可釘選到工作列。

也可以不開入口頁：雙擊 `extension/shortcut/create-shortcut.cmd`（或在 cmd 執行它），會依外掛資料夾自動找出外掛與設定檔。PowerShell 版本：`powershell -ExecutionPolicy Bypass -File extension/shortcut/create-shortcut.ps1 [外掛 ID]`。

## 使用

| 時機 | 操作 |
|---|---|
| 第一次 | 建立 Vault，點每個服務登入一次（帳密可交給 Bitwarden 自動填入）。登入後會自動保存。 |
| 每天上班 | 點 PersonaHub 圖示開側邊欄 → 輸入主密碼 → 點服務，主畫面開啟（或切換到）該服務分頁，直接是已登入狀態。 |
| 下班 | 按「鎖定並登出」，或按 `Alt+Shift+L`，或直接按 `Win+L` 鎖定 Windows。 |
| 忘了鎖就關瀏覽器 | 下次啟動時會自動清除登入資料。Vault 每 10 分鐘自動保存一次，最多只會遺失最後 10 分鐘的更新。 |

Spotify、YouTube 的官方 PWA 和這個設定檔共用 cookie。用 PersonaHub 還原後，直接開官方 PWA 也是登入狀態。

## 安全模型

- 主密碼經過 PBKDF2-SHA256（60 萬次迭代）衍生成 AES-GCM-256 金鑰，加密後的 Vault 存在 `chrome.storage.local`。
- 解鎖期間，金鑰只存在 `chrome.storage.session`（只在記憶體裡）。關閉瀏覽器、鎖定、閒置逾時或 Windows 鎖定畫面時都會清除。
- 主密碼不會被保存。忘記主密碼就只能重設 Vault，再重新登入各服務。
- **防不了**：鍵盤側錄、公司的監控軟體、有人趁你解鎖期間直接使用電腦。

## 已知限制

- 綁定 IP 或裝置的登入（例如部分 Google 安全機制）還原後可能失效，這時會走重新登入流程。
- Uber Eats、Friday影音的登入 cookie 名稱尚未確認，所以目前不判斷是否已登入，一律直接打開首頁。
- YouTube 會一併保存 google.com 的 cookie，因此還原後這個設定檔裡的 Google 帳號也是登入狀態。

- 「PersonaHub 視窗」是一般 Chrome 視窗，會有網址列與工具列；Chrome 的 App 視窗（獨立視窗）沒有分頁列，兩者無法合併。

## 新增服務

1. 在 [`extension/services.js`](extension/services.js) 加一筆服務定義。
2. 在 [`extension/manifest.json`](extension/manifest.json) 的 `host_permissions` 加上對應網域。
3. 到 `chrome://extensions` 按重新載入。
