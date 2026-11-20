# 建立 PersonaHub 桌面捷徑（Windows）
#
# 用法：
#   1. 入口頁「設定」→「複製建立捷徑的指令」，貼到 PowerShell 執行（外掛 ID 已自動帶入）
#   2. 或直接執行：powershell -ExecutionPolicy Bypass -File create-shortcut.ps1 <外掛 ID>
#
# 做的事：
#   - 找出裝了 PersonaHub 的 Chrome 設定檔與外掛資料夾
#   - 用外掛的圖示產生 PersonaHub.ico（放在 %LOCALAPPDATA%\PersonaHub）
#   - 在桌面建立 PersonaHub.lnk：用該設定檔、以 App 視窗開啟入口頁
# 不會修改 Chrome 設定，也不會讀取或輸出任何 cookie、Vault 內容。

if (-not $ExtensionId) { $ExtensionId = $args[0] }
if (-not $ExtensionId) { Write-Host '缺少外掛 ID（chrome://extensions 可查）' -ForegroundColor Red; return }

$userData = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'
$profileDir = $null
$extPath = $null
foreach ($dir in Get-ChildItem $userData -Directory -ErrorAction SilentlyContinue) {
  foreach ($name in 'Secure Preferences', 'Preferences') {
    $file = Join-Path $dir.FullName $name
    if (-not (Test-Path $file)) { continue }
    $text = [IO.File]::ReadAllText($file)
    if (-not $text.Contains($ExtensionId)) { continue }
    try {
      $ext = (ConvertFrom-Json $text).extensions.settings.$ExtensionId
      if ($ext) {
        $profileDir = $dir.Name
        if ($ext.path -and (Test-Path (Join-Path $ext.path 'manifest.json'))) { $extPath = $ext.path }
      }
    } catch { }
    if ($profileDir) { break }
  }
  if ($profileDir) { break }
}
if (-not $profileDir) { Write-Host "找不到裝了外掛 $ExtensionId 的 Chrome 設定檔" -ForegroundColor Red; return }

$chrome = @(
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $chrome) { Write-Host '找不到 chrome.exe' -ForegroundColor Red; return }

# 圖示：把外掛的 PNG 包成 .ico（PNG 內嵌格式，Windows Vista 以後支援）
$iconFile = $null
if ($extPath) {
  $pngs = foreach ($n in 16, 32, 48, 256) {
    $p = Join-Path $extPath "icons\icon$n.png"
    if (Test-Path $p) { [pscustomobject]@{ Size = $n; Bytes = [IO.File]::ReadAllBytes($p) } }
  }
  if ($pngs) {
    $outDir = Join-Path $env:LOCALAPPDATA 'PersonaHub'
    New-Item -ItemType Directory -Force $outDir | Out-Null
    $iconFile = Join-Path $outDir 'PersonaHub.ico'
    $ms = New-Object IO.MemoryStream
    $w = New-Object IO.BinaryWriter $ms
    $w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$pngs.Count)
    $offset = 6 + 16 * $pngs.Count
    foreach ($img in $pngs) {
      $dim = if ($img.Size -ge 256) { 0 } else { $img.Size }
      $w.Write([byte]$dim); $w.Write([byte]$dim); $w.Write([byte]0); $w.Write([byte]0)
      $w.Write([uint16]1); $w.Write([uint16]32)
      $w.Write([uint32]$img.Bytes.Length); $w.Write([uint32]$offset)
      $offset += $img.Bytes.Length
    }
    foreach ($img in $pngs) { $w.Write($img.Bytes) }
    $w.Flush()
    [IO.File]::WriteAllBytes($iconFile, $ms.ToArray())
    $w.Dispose()
  }
}

$lnkPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'PersonaHub.lnk'
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($lnkPath)
$lnk.TargetPath = $chrome
$lnk.Arguments = "--profile-directory=`"$profileDir`" --app=chrome-extension://$ExtensionId/hub.html"
$lnk.WorkingDirectory = Split-Path $chrome
$lnk.Description = 'PersonaHub'
if ($iconFile) { $lnk.IconLocation = "$iconFile,0" }
$lnk.Save()

Write-Host "已建立桌面捷徑：$lnkPath" -ForegroundColor Green
Write-Host "設定檔：$profileDir"
if (-not $iconFile) { Write-Host '找不到外掛資料夾，捷徑沿用 Chrome 圖示' -ForegroundColor Yellow }
Write-Host '要放到工作列：在捷徑上按右鍵 →「釘選到工作列」（Windows 11 需先選「顯示其他選項」）。'
