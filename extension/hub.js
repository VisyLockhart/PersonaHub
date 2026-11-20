const $ = (sel) => document.querySelector(sel);
const views = ['setup', 'unlock', 'hub', 'settings'];
let current = null;

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
  if (!s.savedAt) return { text: '尚未保存 — 點擊後登入一次', cls: 'warn' };
  const t = `已保存 ${fmtTime(s.savedAt)}`;
  if (!s.authKnown) return { text: `${t}(登入判斷待確認)`, cls: '' };
  return { text: t, cls: 'ok' };
}

function renderGrid(services) {
  const grid = $('#grid');
  grid.replaceChildren();
  for (const s of services) {
    const st = stateOf(s);
    const card = document.createElement('button');
    card.className = 'svc';
    card.style.setProperty('--svc', s.color);
    card.innerHTML = `<span class="name"></span><span class="state ${st.cls}"></span>`;
    card.querySelector('.name').textContent = s.name;
    card.querySelector('.state').textContent = st.text;
    card.addEventListener('click', () =>
      busy(card, async () => {
        const r = await send('open', { id: s.id });
        say(r.needsLogin ? `${s.name} 的登入已過期,已開啟登入頁;登入後會自動保存。` : `已開啟 ${s.name}`);
      }),
    );
    if (s.savedAt) {
      const forget = document.createElement('button');
      forget.className = 'link forget';
      forget.textContent = '清除';
      forget.title = '刪除此服務的保存資料並登出';
      forget.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm(`刪除 ${s.name} 的保存資料並登出?`)) return;
        busy(forget, async () => {
          await send('forget', { id: s.id });
          await refresh(`已清除 ${s.name}`);
        });
      });
      card.append(forget);
    }
    grid.append(card);
  }
}

function fillSettings(settings) {
  const f = $('#view-settings');
  f.idleMinutes.value = settings.idleMinutes;
  f.lockOnScreenLock.checked = settings.lockOnScreenLock;
  f.openMode.value = settings.openMode;
}

async function refresh(message = '') {
  const st = await send('status');
  fillSettings(st.settings);
  if (!st.hasVault) current = 'setup';
  else if (!st.unlocked) current = 'unlock';
  else if (current !== 'settings') current = 'hub';
  if (st.unlocked) renderGrid(st.services);
  show(current);
  say(message);
  if (current === 'unlock') $('#view-unlock').password.focus();
}

$('#view-setup').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.password.value !== f.confirm.value) return say('兩次輸入的主密碼不同', true);
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
$('#btn-settings-close').addEventListener('click', () => refresh());

$('#view-settings').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  busy(f.querySelector('button[type=submit]'), async () => {
    await send('settings', {
      settings: { idleMinutes: Number(f.idleMinutes.value), lockOnScreenLock: f.lockOnScreenLock.checked, openMode: f.openMode.value },
    });
    current = 'hub';
    await refresh('設定已儲存');
  });
});

// 其他地方(快捷鍵、閒置)鎖定時,入口頁跟著更新
chrome.storage.session.onChanged.addListener(() => refresh());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refresh();
});

refresh().catch((e) => say(e.message, true));
