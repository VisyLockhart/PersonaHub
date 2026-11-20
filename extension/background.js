import { SERVICES, serviceById, serviceForUrl } from './services.js';
import * as C from './crypto.js';

// ---- 儲存結構 ----
// chrome.storage.local   { vault: {v, salt, iter, iv, ct}, settings }
//   vault 解密後:       { services: { [id]: { cookies: [...], savedAt, hasAuth } } }
// chrome.storage.session { k: <AES 金鑰 raw b64> }   ← 有它 = 已解鎖;關閉瀏覽器自動消失

const DEFAULT_SETTINGS = { idleMinutes: 15, lockOnScreenLock: true, openMode: 'tab', embed: false };
const AUTOSAVE_MINUTES = 10;

// ---------- 基本存取 ----------

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...settings };
}

async function getVault() {
  const { vault } = await chrome.storage.local.get('vault');
  return vault || null;
}

async function getKey() {
  const { k } = await chrome.storage.session.get('k');
  return k ? C.importRaw(k) : null;
}

async function requireKey() {
  const key = await getKey();
  if (!key) throw new Error('已鎖定,請先解鎖');
  return key;
}

async function loadData(key) {
  return C.decryptJson(key, await getVault());
}

async function saveData(key, data) {
  const vault = await getVault();
  const { iv, ct } = await C.encryptJson(key, data);
  await chrome.storage.local.set({ vault: { ...vault, iv, ct } });
}

// 所有讀改寫 vault 的操作排隊執行,避免自動保存與手動操作互相覆蓋
let queue = Promise.resolve();
function serial(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

// ---------- Cookie ----------

function cookieUrl(c) {
  return `http${c.secure ? 's' : ''}://${c.domain.replace(/^\./, '')}${c.path}`;
}

async function readCookies(svc) {
  const seen = new Map();
  for (const domain of svc.domains) {
    for (const c of await chrome.cookies.getAll({ domain })) {
      seen.set(`${c.name}|${c.domain}|${c.path}`, c);
    }
  }
  return [...seen.values()].map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    hostOnly: c.hostOnly,
    session: c.session,
    expirationDate: c.expirationDate,
    partitionKey: c.partitionKey,
  }));
}

function hasAuthCookie(svc, cookies) {
  if (!svc.authCookies.length) return null; // 未確認的服務不判斷
  return cookies.some((c) => svc.authCookies.includes(c.name));
}

async function restoreCookies(cookies, frameCookies = []) {
  const now = Date.now() / 1000;
  let ok = 0;
  for (const c of cookies) {
    if (!c.session && c.expirationDate && c.expirationDate < now) continue;
    const d = {
      url: cookieUrl(c),
      name: c.name,
      value: c.value,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
    };
    if (!c.hostOnly) d.domain = c.domain;
    if (c.sameSite && c.sameSite !== 'unspecified') d.sameSite = c.sameSite;
    // 內嵌框架是第三方情境,網站自己寫的 Lax cookie 讀寫不到;同意紀錄這類非登入 cookie 放寬
    // Secure cookie 必須用 https 網址寫入,否則 chrome.cookies.set 會失敗
    if (frameCookies.includes(c.name)) Object.assign(d, { sameSite: 'no_restriction', secure: true, url: cookieUrl({ ...c, secure: true }) });
    if (!c.session && c.expirationDate) d.expirationDate = c.expirationDate;
    if (c.partitionKey) d.partitionKey = c.partitionKey;
    try {
      if (await chrome.cookies.set(d)) ok++;
    } catch (e) {
      console.warn('還原 cookie 失敗', c.domain, c.name, e);
    }
  }
  return ok;
}

async function wipeService(svc) {
  for (const domain of svc.domains) {
    for (const c of await chrome.cookies.getAll({ domain })) {
      const d = { url: cookieUrl(c), name: c.name };
      if (c.partitionKey) d.partitionKey = c.partitionKey;
      try {
        await chrome.cookies.remove(d);
      } catch (e) {
        console.warn('刪除 cookie 失敗', c.domain, c.name, e);
      }
    }
  }
  await chrome.browsingData.remove(
    { origins: svc.origins },
    { localStorage: true, indexedDB: true, cacheStorage: true, serviceWorkers: true, fileSystems: true },
  );
}

async function closeServiceTabs() {
  const patterns = SERVICES.flatMap((s) => s.domains.map((d) => `*://*.${d}/*`));
  const tabs = await chrome.tabs.query({ url: patterns });
  if (tabs.length) await chrome.tabs.remove(tabs.map((t) => t.id));
}

// ---------- 保存 ----------

// 已確認登入 cookie 的服務:目前沒登入就不覆蓋舊快照,避免把「已登出」存進去
async function captureInto(data, svc) {
  // 不還原的服務不保存;舊版留下的快照順便刪掉
  if (svc.noRestore) {
    if (!data.services[svc.id]) return false;
    delete data.services[svc.id];
    return true;
  }
  const cookies = await readCookies(svc);
  const auth = hasAuthCookie(svc, cookies);
  if (auth === false || cookies.length === 0) return false;
  data.services[svc.id] = { cookies, savedAt: Date.now(), hasAuth: auth };
  return true;
}

function captureServices(svcs) {
  return serial(async () => {
    const key = await getKey();
    if (!key) return;
    const data = await loadData(key);
    let changed = false;
    for (const svc of svcs) changed = (await captureInto(data, svc)) || changed;
    if (changed) await saveData(key, data);
  });
}

// ---------- 動作 ----------

async function status() {
  const vault = await getVault();
  const key = vault ? await getKey() : null;
  const out = { hasVault: !!vault, unlocked: !!key, settings: await getSettings(), services: [] };
  const data = key ? await loadData(key) : null;
  for (const svc of SERVICES) {
    const snap = svc.noRestore ? null : data?.services[svc.id];
    out.services.push({
      id: svc.id,
      name: svc.name,
      color: svc.color,
      url: svc.url,
      embed: !!svc.embed,
      noRestore: !!svc.noRestore,
      noRestoreReason: svc.noRestoreReason || '',
      authKnown: svc.authCookies.length > 0,
      savedAt: snap?.savedAt ?? null,
      hasAuth: snap?.hasAuth ?? null,
    });
  }
  return out;
}

async function setup({ password }) {
  if (await getVault()) throw new Error('Vault 已存在');
  if (!password || password.length < 12) throw new Error('主密碼至少 12 個字元');
  const salt = C.randomBytes(16);
  const key = await C.deriveKey(password, salt);
  await chrome.storage.local.set({
    vault: { v: 1, salt: C.toB64(salt), iter: C.PBKDF2_ITERATIONS },
    settings: DEFAULT_SETTINGS,
  });
  await saveData(key, { services: {} });
  await chrome.storage.session.set({ k: await C.exportRaw(key) });
  await captureServices(SERVICES); // 已經登入的服務直接收進來
  await onUnlocked();
}

async function unlock({ password }) {
  const vault = await getVault();
  if (!vault) throw new Error('尚未建立 Vault');
  const key = await C.deriveKey(password, C.fromB64(vault.salt), vault.iter);
  try {
    await C.decryptJson(key, vault);
  } catch {
    throw new Error('主密碼錯誤');
  }
  await chrome.storage.session.set({ k: await C.exportRaw(key) });
  await onUnlocked();
}

async function lock() {
  await captureServices(SERVICES);
  await chrome.storage.session.remove('k');
  await closeServiceTabs();
  for (const svc of SERVICES) await wipeService(svc);
  await chrome.alarms.clear('autosave');
  await updateBadge();
}

async function openService({ id }, sender) {
  await requireKey();
  const svc = serviceById(id);
  if (!svc) throw new Error('未知的服務');
  const data = await loadData(await getKey());
  const snap = svc.noRestore ? null : data.services[id];
  if (snap) await restoreCookies(snap.cookies, svc.frameCookies);

  const auth = hasAuthCookie(svc, await readCookies(svc));
  const needsLogin = auth === false;
  const url = needsLogin ? svc.loginUrl : svc.url;

  const { openMode, embed } = await getSettings();
  // 實驗:在入口頁內嵌開啟。Google 登入頁不允許在框架內登入,登入過期時退回一般開啟方式
  if (embed && svc.embed && sender?.tab?.id != null && !(needsLogin && svc.embedLogin === false)) {
    await allowEmbedIn(sender.tab.id);
    return { needsLogin, embed: { url } };
  }
  if (openMode === 'group') {
    await openInGroupWindow(svc, url);
  } else if (openMode === 'window') {
    await chrome.windows.create({ url, type: 'popup', width: 1280, height: 820 });
  } else {
    await chrome.tabs.create({ url });
  }
  return { needsLogin };
}

// PersonaHub 專用視窗:所有服務開在同一個一般視窗,收進名為 PersonaHub 的分頁群組。
// 視窗與群組 id 記在 storage.session(瀏覽器關閉就消失,不寫入持久儲存)。
async function openInGroupWindow(svc, url) {
  const { hubWindow } = await chrome.storage.session.get('hubWindow');
  let win = null;
  if (hubWindow) win = await chrome.windows.get(hubWindow.windowId, { populate: true }).catch(() => null);

  if (!win) {
    win = await chrome.windows.create({ url, type: 'normal', width: 1280, height: 860, focused: true });
    const groupId = await chrome.tabs.group({ tabIds: [win.tabs[0].id], createProperties: { windowId: win.id } });
    await chrome.tabGroups.update(groupId, { title: 'PersonaHub', color: 'blue' });
    await chrome.storage.session.set({ hubWindow: { windowId: win.id, groupId } });
    return;
  }

  // 已經開過這個服務就切過去,不重複開
  const existing = win.tabs.find((t) => serviceForUrl(t.url || t.pendingUrl || '') === svc);
  let tabId;
  if (existing) {
    tabId = existing.id;
    // 登入過期時改導到登入頁,否則保留使用者目前看的頁面
    await chrome.tabs.update(tabId, url === svc.loginUrl ? { active: true, url } : { active: true });
  } else {
    tabId = (await chrome.tabs.create({ windowId: win.id, url, active: true })).id;
  }
  await chrome.windows.update(win.id, { focused: true });

  // 使用者可能把群組拆掉了,群組不在就重建
  const group = await chrome.tabGroups.get(hubWindow.groupId).catch(() => null);
  if (group && group.windowId === win.id) {
    await chrome.tabs.group({ tabIds: [tabId], groupId: group.id });
  } else {
    const groupId = await chrome.tabs.group({ tabIds: [tabId], createProperties: { windowId: win.id } });
    await chrome.tabGroups.update(groupId, { title: 'PersonaHub', color: 'blue' });
    await chrome.storage.session.set({ hubWindow: { windowId: win.id, groupId } });
  }
}

// ---------- 內嵌原型(實驗,見 STATUS §4) ----------
// 只對「入口頁所在分頁」裡、可內嵌服務的子框架回應,移除禁止嵌入的標頭。
// 用 tabIds 限定範圍:其他網站嵌入這些服務時標頭照常生效。規則是 session rule,瀏覽器關閉就消失。
const EMBED_RULE_ID = 1;
const EMBED_DOMAINS = SERVICES.filter((s) => s.embed).map((s) => s.domains[0]);

async function syncEmbedRule(tabIds) {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [EMBED_RULE_ID],
    addRules: tabIds.length
      ? [
          {
            id: EMBED_RULE_ID,
            priority: 1,
            action: {
              type: 'modifyHeaders',
              responseHeaders: [
                { header: 'x-frame-options', operation: 'remove' },
                // DNR 無法只刪 frame-ancestors 指令,只能整個 CSP 標頭移除
                { header: 'content-security-policy', operation: 'remove' },
              ],
            },
            condition: { tabIds, resourceTypes: ['sub_frame'], requestDomains: EMBED_DOMAINS },
          },
        ]
      : [],
  });
}

async function allowEmbedIn(tabId) {
  const { embedTabs = [] } = await chrome.storage.session.get('embedTabs');
  if (embedTabs.includes(tabId)) return;
  const next = [...embedTabs, tabId];
  await chrome.storage.session.set({ embedTabs: next });
  await syncEmbedRule(next);
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { embedTabs = [] } = await chrome.storage.session.get('embedTabs');
  if (!embedTabs.includes(tabId)) return;
  const next = embedTabs.filter((t) => t !== tabId);
  await chrome.storage.session.set({ embedTabs: next });
  await syncEmbedRule(next);
});

async function forget({ id }) {
  const key = await requireKey();
  const svc = serviceById(id);
  await serial(async () => {
    const data = await loadData(key);
    delete data.services[id];
    await saveData(key, data);
  });
  await wipeService(svc);
}

async function saveSettings({ settings }) {
  const next = { ...(await getSettings()), ...settings };
  next.idleMinutes = Math.max(0, Math.min(240, Number(next.idleMinutes) || 0));
  await chrome.storage.local.set({ settings: next });
  await applyIdleSetting();
}

async function resetAll() {
  await chrome.storage.session.remove('k');
  await chrome.storage.local.remove('vault');
  await closeServiceTabs();
  for (const svc of SERVICES) await wipeService(svc);
  await updateBadge();
}

async function onUnlocked() {
  await chrome.alarms.create('autosave', { periodInMinutes: AUTOSAVE_MINUTES });
  await updateBadge();
}

async function updateBadge() {
  const unlocked = !!(await getKey());
  await chrome.action.setBadgeText({ text: unlocked ? 'ON' : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#2e7d32' });
}

async function applyIdleSetting() {
  const { idleMinutes } = await getSettings();
  chrome.idle.setDetectionInterval(Math.max(15, (idleMinutes || 15) * 60));
}

// ---------- 事件 ----------

async function saveNow() {
  await requireKey();
  await captureServices(SERVICES);
}

const HANDLERS = {
  status,
  setup,
  unlock,
  lock,
  save: saveNow,
  open: openService,
  forget,
  settings: saveSettings,
  reset: resetAll,
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 只接受自己的擴充功能頁面
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return false;
  const fn = HANDLERS[msg?.type];
  if (!fn) return false;
  fn(msg, sender)
    .then((r) => sendResponse({ ok: true, ...r }))
    .catch((e) => sendResponse({ ok: false, error: e.message || String(e) }));
  return true;
});

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('hub.html');
  const [tab] = await chrome.tabs.query({ url });
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
});

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'lock-now') lock();
});

chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'active' || !(await getKey())) return;
  const s = await getSettings();
  if ((state === 'locked' && s.lockOnScreenLock) || (state === 'idle' && s.idleMinutes > 0)) await lock();
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'autosave') captureServices(SERVICES);
});

// 重新登入後自動收進 Vault:服務頁面載入完成時保存一次(延遲讓登入 cookie 寫完)
const pending = new Map();
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.url) return;
  const svc = serviceForUrl(tab.url);
  if (!svc) return;
  clearTimeout(pending.get(svc.id));
  pending.set(
    svc.id,
    setTimeout(() => {
      pending.delete(svc.id);
      captureServices([svc]);
    }, 3000),
  );
});

// cookie 一變動就保存(延遲合併)。Google 等服務會輪替登入 cookie,若快照停在舊的那份,
// 還原時會被判定無效而登出。只處理新增／覆寫,忽略刪除:鎖定、清除時的刪除不能存進快照。
// 鎖定狀態沒有金鑰,captureServices 會直接跳過。
const cookieTimers = new Map();
chrome.cookies.onChanged.addListener(({ removed, cookie }) => {
  if (removed) return;
  const svc = serviceForUrl(`https://${cookie.domain.replace(/^\./, '')}/`);
  if (!svc) return;
  clearTimeout(cookieTimers.get(svc.id));
  cookieTimers.set(
    svc.id,
    setTimeout(() => {
      cookieTimers.delete(svc.id);
      captureServices([svc]);
    }, 5000),
  );
});

// 安全網:瀏覽器啟動時一定是鎖定狀態(session 已清空),清掉上次沒鎖就關閉時留下的登入資料
async function wipeWhileLocked() {
  if (!(await getVault())) return;
  await closeServiceTabs();
  for (const svc of SERVICES) await wipeService(svc);
  await updateBadge();
}
chrome.runtime.onStartup.addListener(wipeWhileLocked);
// 外掛重新載入／更新時不清除:使用者選擇保留登入(storage.session 被清空,外掛會顯示鎖定)

applyIdleSetting();
updateBadge();
