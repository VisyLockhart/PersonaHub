// 服務定義。新增服務時:補這裡 + manifest.json 的 host_permissions。
//
// domains      讀取/還原/清除 cookie 的網域(含所有子網域)
// origins      鎖定時一併清除 localStorage / IndexedDB 等站台資料的來源
// authCookies  代表「已登入」的 cookie 名稱;空陣列 = 尚未確認,不做登入判斷
// loginUrl     登入過期時開啟的官方登入頁
// noRestore    true = 不保存、不還原(登入受裝置綁定保護,或登入不在 cookie 裡),鎖定時照樣清除。見 D-0004
// noRestoreReason 入口頁卡片顯示的原因(noRestore 時)
// frameCookies 還原時改成 SameSite=None 的非登入 cookie(例如 cookie 政策同意紀錄),內嵌時才讀得到。不可放登入 cookie
// embed        [實驗] 可在入口頁內嵌開啟;embedLogin: false = 登入頁不能內嵌,過期時改用一般開啟方式

export const SERVICES = [
  {
    id: 'spotify',
    name: 'Spotify',
    color: '#1DB954',
    url: 'https://open.spotify.com/',
    loginUrl: 'https://accounts.spotify.com/login?continue=https%3A%2F%2Fopen.spotify.com%2F',
    domains: ['spotify.com'],
    origins: ['https://open.spotify.com', 'https://accounts.spotify.com', 'https://www.spotify.com'],
    authCookies: ['sp_dc'],
    embed: true,
    frameCookies: ['OptanonAlertBoxClosed', 'OptanonConsent'],
  },
  {
    id: 'netflix',
    name: 'Netflix',
    color: '#E50914',
    url: 'https://www.netflix.com/browse',
    loginUrl: 'https://www.netflix.com/login',
    domains: ['netflix.com'],
    origins: ['https://www.netflix.com'],
    authCookies: ['NetflixId'],
    embed: true,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    color: '#FF0033',
    url: 'https://www.youtube.com/',
    loginUrl:
      'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2F',
    // YouTube 的登入狀態來自 Google 帳號,所以 google.com 一起保存
    domains: ['youtube.com', 'google.com', 'google.com.tw'],
    origins: ['https://www.youtube.com', 'https://music.youtube.com', 'https://accounts.google.com'],
    authCookies: ['SAPISID'],
    // Google 帳號受 DBSC 裝置綁定保護(__Secure-*PSIDTS),還原必定被登出
    noRestore: true,
    noRestoreReason: 'Google 裝置綁定',
    // 不內嵌:框架內播放一般影片時框架崩潰(Shorts 正常),一般分頁可播。見 D-0003 R-006
    embed: false,
    embedLogin: false,
  },
  {
    id: 'ubereats',
    name: 'Uber Eats',
    color: '#06C167',
    url: 'https://www.ubereats.com/tw',
    loginUrl: 'https://auth.uber.com/',
    domains: ['ubereats.com', 'uber.com'],
    origins: ['https://www.ubereats.com', 'https://auth.uber.com', 'https://www.uber.com'],
    authCookies: [], // [待確認] 實際登入 cookie 名稱
  },
  {
    id: 'friday',
    name: 'Friday影音',
    color: '#F5A623',
    url: 'https://video.friday.tw/',
    loginUrl: 'https://video.friday.tw/',
    domains: ['friday.tw', 'fetnet.net'],
    origins: ['https://video.friday.tw'],
    authCookies: [], // [待確認] 實際登入 cookie 名稱與登入網域
  },
  {
    id: 'claude',
    name: 'Claude',
    color: '#D97757',
    url: 'https://claude.ai/',
    loginUrl: 'https://claude.ai/login',
    domains: ['claude.ai'],
    origins: ['https://claude.ai'],
    authCookies: ['sessionKey'], // [待確認] 實測確認名稱,並看 Device bound sessions
    embed: true,
    // 登入走 Google OAuth 或 email 連結,框架內不保證能完成
    embedLogin: false,
  },
  {
    id: 'discord',
    name: 'Discord',
    color: '#5865F2',
    url: 'https://discord.com/channels/@me',
    loginUrl: 'https://discord.com/login',
    domains: ['discord.com'],
    origins: ['https://discord.com'],
    authCookies: [],
    // 登入 token 存在 localStorage 不在 cookie,只還原 cookie 不會登入;鎖定時照樣清除站台資料
    noRestore: true,
    noRestoreReason: '登入資料不在 cookie',
    embed: true,
  },
];

export function serviceById(id) {
  return SERVICES.find((s) => s.id === id);
}

export function serviceForUrl(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return undefined;
  }
  return SERVICES.find((s) => s.domains.some((d) => host === d || host.endsWith('.' + d)));
}
