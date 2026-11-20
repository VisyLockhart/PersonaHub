const $ = (sel) => document.querySelector(sel);
const views = ['setup', 'unlock', 'hub', 'settings'];
let current = null;
let shown = null;

// 主題:system / light / dark。不是機密,存在 chrome.storage.local。
// 另存一份在 localStorage,頁面載入時可以同步套用,減少閃爍。
function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  const radio = document.querySelector(`#theme input[value="${theme}"]`) ?? document.querySelector('#theme input[value="system"]');
  radio.checked = true;
}
applyTheme(localStorage.getItem('theme') || 'system');
chrome.storage.local.get('theme').then(({ theme }) => {
  if (theme) {
    applyTheme(theme);
    localStorage.setItem('theme', theme);
  }
});
document.querySelector('#theme').addEventListener('change', (e) => {
  const theme = e.target.value;
  applyTheme(theme);
  localStorage.setItem('theme', theme);
  chrome.storage.local.set({ theme });
});

async function send(type, payload = {}) {
  const res = await chrome.runtime.sendMessage({ type, ...payload });
  if (!res?.ok) throw new Error(res?.error || '未知錯誤');
  return res;
}

function show(view) {
  for (const v of views) $(`#view-${v}`).hidden = v !== view;
  $('#toolbar').hidden = !(view === 'hub' || view === 'settings');
}

function say(text, isError = false) {
  const el = $('#msg');
  el.textContent = text;
  el.classList.toggle('error', isError);
}

async function busy(btn, fn) {
  btn.disabled = true;
  try {
    await fn();
  } catch (e) {
    say(e.message, true);
  } finally {
    btn.disabled = false;
  }
}

function fmtTime(ts) {
  return new Date(ts).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function stateOf(s) {
  if (s.noRestore) return { text: `每次解鎖後需重新登入(${s.noRestoreReason || '無法還原'})`, cls: '' };
  if (!s.savedAt) return { text: '尚未保存 — 點擊後登入一次', cls: 'warn' };
  const t = `已保存 ${fmtTime(s.savedAt)}`;
  if (!s.authKnown) return { text: `${t}(登入判斷待確認)`, cls: '' };
  return { text: t, cls: 'ok' };
}

function faviconUrl(pageUrl) {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', pageUrl);
  u.searchParams.set('size', '64');
  return u.toString();
}

// 卡片框線跟著游標發光(Border Spotlight);rAF 節流,只在游標位於卡片區時計算
let spot = null;
document.addEventListener('pointermove', (e) => {
  if (spot || !e.target.closest?.('#grid')) return;
  spot = requestAnimationFrame(() => {
    spot = null;
    for (const card of document.querySelectorAll('.svc')) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }
  });
});

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

// ---- 內嵌分頁(實驗) ----
// 每個服務一個 iframe,切換分頁只切顯示,不重新載入(保留播放狀態)
const frames = new Map(); // id -> { tab, frame }

function selectTab(id) {
  $('#tabbar').hidden = frames.size === 0;
  const home = id === 'home' || !frames.has(id);
  $('#grid').hidden = !home;
  document.body.classList.toggle('embedding', !home);
  for (const t of $('#tabbar').querySelectorAll('.tab')) t.setAttribute('aria-selected', String(t.dataset.tab === (home ? 'home' : id)));
  for (const [fid, f] of frames) f.frame.hidden = fid !== id;
}

function openFrame(s, url) {
  let f = frames.get(s.id);
  if (!f) {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.tab = s.id;
    tab.style.setProperty('--svc', s.color);
    tab.innerHTML = '<button type="button" class="tab-open"><img alt="" width="16" height="16"><span></span></button><button type="button" class="tab-close" aria-label="關閉">×</button>';
    tab.querySelector('img').src = faviconUrl(s.url);
    tab.querySelector('span').textContent = s.name;
    tab.querySelector('.tab-open').addEventListener('click', () => selectTab(s.id));
    tab.querySelector('.tab-close').addEventListener('click', () => closeFrame(s.id));
    $('#tabbar').append(tab);
    const frame = document.createElement('iframe');
    frame.title = s.name;
    frame.allow = 'encrypted-media; fullscreen; autoplay; picture-in-picture; clipboard-write';
    frame.allowFullscreen = true;
    frame.src = url;
    $('#frames').append(frame);
    f = { tab, frame };
    frames.set(s.id, f);
  } else if (f.frame.src !== url && url !== s.url) {
    f.frame.src = url;
  }
  selectTab(s.id);
}

function closeFrame(id) {
  const f = frames.get(id);
  if (!f) return;
  f.tab.remove();
  f.frame.remove();
  frames.delete(id);
  selectTab('home');
}

function closeAllFrames() {
  for (const id of [...frames.keys()]) closeFrame(id);
}

$('#tabbar .home').addEventListener('click', () => selectTab('home'));

function renderGrid(services) {
  const grid = $('#grid');
  grid.replaceChildren();
  services.forEach((s, i) => {
    const st = stateOf(s);
    // 外層是 div,開啟與清除是兩個並列的 button(button 不能巢狀)
    const card = document.createElement('div');
    card.className = 'svc';
    card.style.setProperty('--svc', s.color);
    card.style.setProperty('--i', i);
    card.innerHTML = `<span class="logo"><img alt=""></span><span class="name"></span><span class="state ${st.cls}"></span><button type="button" class="open"></button>`;
    // Chrome 內建的網站圖示快取(_favicon),不會對外連線;沒造訪過的網站會是預設地球圖示
    const img = card.querySelector('.logo img');
    img.addEventListener('error', () => {
      img.replaceWith(Object.assign(document.createElement('b'), { className: 'initial', textContent: s.name[0] }));
    });
    img.src = faviconUrl(s.url);
    card.querySelector('.name').textContent = s.name;
    card.querySelector('.state').textContent = st.text;
    const open = card.querySelector('.open');
    open.setAttribute('aria-label', `開啟 ${s.name}(${st.text})`);
    open.addEventListener('click', () =>
      busy(open, async () => {
        const r = await send('open', { id: s.id });
        if (r.embed) openFrame(s, r.embed.url);
        say(r.notice ? r.notice : r.needsLogin && s.noRestore ? `${s.name} 需要重新登入(${s.noRestoreReason || '無法還原'})。` : r.needsLogin ? `${s.name} 的登入已過期,已開啟登入頁;登入後會自動保存。` : `已開啟 ${s.name}`);
      }),
    );
    if (s.savedAt) {
      const forget = document.createElement('button');
      forget.type = 'button';
      forget.className = 'link forget';
      forget.textContent = '清除';
      forget.title = '刪除此服務的保存資料並登出';
      forget.addEventListener('click', () => {
        if (!confirm(`刪除 ${s.name} 的保存資料並登出?`)) return;
        busy(forget, async () => {
          await send('forget', { id: s.id });
          await refresh(`已清除 ${s.name}`);
        });
      });
      card.append(forget);
    }
    grid.append(card);
  });
}

function fillSettings(settings) {
  const f = $('#view-settings');
  f.idleMinutes.value = settings.idleMinutes;
  f.lockOnScreenLock.checked = settings.lockOnScreenLock;
  f.openMode.value = settings.openMode;
  f.embed.checked = settings.embed;
}

async function refresh(message = '') {
  const st = await send('status');
  fillSettings(st.settings);
  if (!st.hasVault) current = 'setup';
  else if (!st.unlocked) current = 'unlock';
  else if (current !== 'settings') current = 'hub';
  if (!st.unlocked) closeAllFrames(); // 鎖定後不留任何已登入的框架
  if (st.unlocked) renderGrid(st.services);
  $('#grid').classList.toggle('enter', current === 'hub' && shown !== 'hub');
  shown = current;
  show(current);
  say(message);
  if (current === 'unlock') $('#view-unlock').password.focus();
}

$('#view-setup').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.password.value !== f.confirm.value) {
    shake(f);
    return say('兩次輸入的主密碼不同', true);
  }
  busy(f.querySelector('button'), async () => {
    say('建立中…(金鑰衍生需要幾秒)');
    await send('setup', { password: f.password.value });
    f.reset();
    await refresh('Vault 已建立。點選服務登入一次,之後就會自動保存。');
  });
});

$('#view-unlock').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  busy(f.querySelector('button[type=submit]'), async () => {
    say('解鎖中…');
    try {
      await send('unlock', { password: f.password.value });
    } catch (err) {
      shake(f);
      throw err;
    } finally {
      f.reset();
    }
    await refresh('已解鎖');
  });
});

$('#btn-reset').addEventListener('click', () => {
  if (!confirm('重設會刪除所有保存的登入資料,並登出所有服務。確定?')) return;
  busy($('#btn-reset'), async () => {
    await send('reset');
    await refresh('Vault 已重設');
  });
});

$('#btn-lock').addEventListener('click', () =>
  busy($('#btn-lock'), async () => {
    await send('lock');
    current = null;
    await refresh('已保存、鎖定並登出所有服務');
  }),
);

$('#btn-save').addEventListener('click', () =>
  busy($('#btn-save'), async () => {
    await send('save');
    await refresh('已保存目前的登入狀態');
  }),
);

$('#btn-settings').addEventListener('click', () => {
  current = 'settings';
  show(current);
  say('');
});
$('#btn-settings-close').addEventListener('click', () => {
  current = 'hub';
  refresh();
});

// 建立桌面捷徑:把外掛內附的腳本加上本外掛 ID,複製成可直接貼進 PowerShell 的指令
$('#btn-shortcut').addEventListener('click', () =>
  busy($('#btn-shortcut'), async () => {
    const script = await (await fetch(chrome.runtime.getURL('shortcut/create-shortcut.ps1'))).text();
    await navigator.clipboard.writeText(`& {
$ExtensionId = '${chrome.runtime.id}'
${script.trimStart()}
}`);
    say('已複製。開啟 PowerShell,貼上後按 Enter。');
  }),
);

$('#view-settings').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  busy(f.querySelector('button[type=submit]'), async () => {
    await send('settings', {
      settings: { idleMinutes: Number(f.idleMinutes.value), lockOnScreenLock: f.lockOnScreenLock.checked, openMode: f.openMode.value, embed: f.embed.checked },
    });
    current = 'hub';
    await refresh('設定已儲存');
  });
});

// 其他地方(快捷鍵、閒置)鎖定時,入口頁跟著更新
chrome.storage.session.onChanged.addListener((changes) => {
  if ('k' in changes) refresh();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refresh();
});

refresh().catch((e) => say(e.message, true));
