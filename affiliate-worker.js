// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cloudflare Worker: 邀请返佣页面 + API 反向代理
// 部署到 Cloudflare Workers，自定义菜单填 Worker URL 即可
// 零跨域问题 —— 浏览器只和 Worker 通信
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // ── API 代理：/api/* → 转发到 src_host（sub2api 主站）──
    if (url.pathname.startsWith('/api/')) {
      return handleApiProxy(request, url);
    }

    // ── 其他所有请求 → 返回 HTML 页面 ──
    return new Response(HTML_PAGE, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  },
};

async function handleApiProxy(request, url) {
  // 从 Referer 中提取 src_host，或从自定义 header 获取
  const referer = request.headers.get('Referer') || '';
  let srcHost = '';

  try {
    const refUrl = new URL(referer);
    srcHost = refUrl.searchParams.get('src_host') || '';
  } catch {}

  // 也支持通过 X-Upstream-Host header 传递
  if (!srcHost) {
    srcHost = request.headers.get('X-Upstream-Host') || '';
  }

  if (!srcHost) {
    return new Response(JSON.stringify({ error: '缺少上游主机地址' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 构建上游 URL
  const upstream = srcHost.replace(/\/+$/, '') + url.pathname + url.search;

  // 转发请求，保留 Authorization header
  const headers = new Headers();
  const auth = request.headers.get('Authorization');
  if (auth) headers.set('Authorization', auth);
  headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');

  try {
    const resp = await fetch(upstream, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    });

    // 返回响应，添加 CORS 头
    const respHeaders = new Headers(resp.headers);
    respHeaders.set('Access-Control-Allow-Origin', '*');
    respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    respHeaders.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Upstream-Host');

    return new Response(resp.body, {
      status: resp.status,
      headers: respHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: '代理请求失败: ' + e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HTML 页面（内联）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const HTML_PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>邀请返佣</title>
<style>
  :root {
    --primary-50: #f0fdfa; --primary-100: #ccfbf1; --primary-200: #99f6e4;
    --primary-300: #5eead4; --primary-400: #2dd4bf; --primary-500: #14b8a6;
    --primary-600: #0d9488; --primary-700: #0f766e; --primary-800: #115e59;
    --primary-900: #134e4a;
    --gray-50: #f8fafc; --gray-100: #f1f5f9; --gray-200: #e2e8f0;
    --gray-300: #cbd5e1; --gray-400: #94a3b8; --gray-500: #64748b;
    --gray-600: #475569; --gray-700: #334155; --gray-800: #1e293b;
    --gray-900: #0f172a; --gray-950: #020617;
    --bg: var(--gray-50); --card-bg: #ffffff; --text: var(--gray-900);
    --text-secondary: var(--gray-500); --text-tertiary: var(--gray-400);
    --border: var(--gray-200); --border-light: var(--gray-100);
    --emerald-400: #34d399; --emerald-600: #059669;
    --amber-400: #fbbf24; --amber-600: #d97706;
  }
  html.dark {
    --bg: var(--gray-950); --card-bg: var(--gray-800); --text: #f1f5f9;
    --text-secondary: var(--gray-400); --text-tertiary: var(--gray-500);
    --border: var(--gray-700); --border-light: var(--gray-800);
    --emerald-600: #34d399; --amber-600: #fbbf24;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      'Helvetica Neue', Arial, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    background: var(--bg); color: var(--text);
    line-height: 1.6; padding: 20px; min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
  .container { max-width: 960px; margin: 0 auto; }
  .space-y > * + * { margin-top: 20px; }

  .card {
    background: var(--card-bg); border-radius: 16px;
    border: 1px solid var(--border); padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  @media (max-width: 768px) {
    .grid-3, .grid-2 { grid-template-columns: 1fr; }
  }
  .stat-label { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
  .stat-value { font-size: 26px; font-weight: 700; margin-top: 8px; }
  .stat-value.emerald { color: var(--emerald-600); }
  .section-title { font-size: 16px; font-weight: 600; }
  .section-desc { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }

  /* Tier cards */
  .tier-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 16px; }
  @media (max-width: 768px) { .tier-grid { grid-template-columns: 1fr; } }
  .tier-card {
    border: 2px solid var(--border); border-radius: 14px; padding: 20px;
    text-align: center; transition: all 0.25s; position: relative; overflow: hidden;
  }
  .tier-card.active {
    border-color: var(--primary-500);
    background: linear-gradient(135deg, rgba(20,184,166,0.06) 0%, rgba(20,184,166,0.02) 100%);
  }
  .tier-badge {
    display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 10px;
    border-radius: 20px; margin-bottom: 10px; letter-spacing: 0.5px;
  }
  .tier-card.bronze .tier-badge { background: rgba(180,83,9,0.1); color: #b45309; }
  .tier-card.silver .tier-badge { background: rgba(100,116,139,0.12); color: var(--gray-600); }
  .tier-card.gold .tier-badge { background: rgba(234,179,8,0.12); color: #ca8a04; }
  html.dark .tier-card.bronze .tier-badge { background: rgba(251,191,36,0.15); color: #fbbf24; }
  html.dark .tier-card.silver .tier-badge { background: rgba(148,163,184,0.15); color: #cbd5e1; }
  html.dark .tier-card.gold .tier-badge { background: rgba(234,179,8,0.18); color: #facc15; }
  .tier-rate { font-size: 36px; font-weight: 800; color: var(--primary-600); }
  html.dark .tier-rate { color: var(--primary-400); }
  .tier-rate span { font-size: 18px; font-weight: 600; }
  .tier-cond { font-size: 13px; color: var(--text-secondary); margin-top: 6px; }
  .tier-card.active::after {
    content: '当前'; position: absolute; top: 10px; right: -28px;
    background: var(--primary-500); color: #fff; font-size: 11px; font-weight: 600;
    padding: 2px 32px; transform: rotate(45deg);
  }

  .code-box {
    display: flex; align-items: center; gap: 8px;
    border: 1px solid var(--border); background: var(--bg);
    border-radius: 12px; padding: 10px 14px;
  }
  .code-box code {
    flex: 1; font-size: 14px; font-weight: 600;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    border-radius: 12px; padding: 10px 18px; font-size: 13px; font-weight: 600;
    border: none; cursor: pointer; transition: all 0.2s; white-space: nowrap;
  }
  .btn:active { transform: scale(0.97); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .btn-sm { padding: 6px 14px; font-size: 12px; border-radius: 10px; }
  .btn-primary {
    background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
    color: #fff; box-shadow: 0 2px 8px rgba(20,184,166,0.25);
  }
  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, var(--primary-600), var(--primary-700));
    box-shadow: 0 4px 12px rgba(20,184,166,0.35);
  }
  .btn-secondary {
    background: var(--bg); color: var(--text); border: 1px solid var(--border);
  }
  .btn-secondary:hover:not(:disabled) { background: var(--border-light); }

  .info-box {
    border-radius: 14px; padding: 16px; margin-top: 16px;
    border: 1px solid rgba(20,184,166,0.2);
    background: rgba(20,184,166,0.04);
  }
  html.dark .info-box {
    border-color: rgba(20,184,166,0.15); background: rgba(20,184,166,0.06);
  }
  .info-box .info-title { font-size: 13px; font-weight: 600; color: var(--primary-700); }
  html.dark .info-box .info-title { color: var(--primary-300); }
  .info-box ul { list-style: none; margin-top: 8px; }
  .info-box ul li { font-size: 13px; color: var(--primary-700); padding: 3px 0; }
  html.dark .info-box ul li { color: var(--primary-300); }

  .transfer-row {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 12px;
  }
  .transfer-warn { font-size: 13px; color: var(--amber-600); margin-top: 10px; }

  .table-wrap { overflow-x: auto; margin-top: 14px; }
  table { width: 100%; min-width: 500px; border-collapse: collapse; font-size: 14px; text-align: left; }
  thead tr { border-bottom: 1px solid var(--border); }
  thead th { padding: 8px 12px; color: var(--text-secondary); font-weight: 500; font-size: 13px; }
  tbody tr { border-bottom: 1px solid var(--border-light); }
  tbody tr:last-child { border-bottom: none; }
  tbody td { padding: 12px; }

  .empty-state {
    border: 2px dashed var(--border); border-radius: 14px;
    padding: 32px; text-align: center; color: var(--text-secondary); font-size: 14px;
    margin-top: 14px;
  }

  .spinner {
    width: 32px; height: 32px; border: 3px solid var(--border);
    border-top-color: var(--primary-500); border-radius: 50%;
    animation: spin 0.7s linear infinite; margin: 40px auto;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(80px);
    background: var(--gray-800); color: #fff; padding: 10px 22px;
    border-radius: 12px; font-size: 13px; font-weight: 500; z-index: 9999;
    box-shadow: 0 8px 30px rgba(0,0,0,0.18); opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none;
  }
  html.dark .toast { background: var(--gray-700); }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

  .flex-between { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }

  @media (max-width: 640px) {
    body { padding: 12px; }
    .card { padding: 16px; border-radius: 14px; }
    .tier-rate { font-size: 28px; }
  }
</style>
</head>
<body>
<div class="container space-y" id="app">
  <div class="spinner" id="loading"></div>
</div>
<div class="toast" id="toast"></div>

<script>
(function() {
  // ── 解析 URL 参数 ──
  const params   = new URLSearchParams(window.location.search);
  const TOKEN    = params.get('token') || '';
  const THEME    = params.get('theme') || 'light';
  const SRC_HOST = params.get('src_host') || '';

  // ★ 关键：API 请求发到 Worker 自身（同源），由 Worker 代理转发到 sub2api 主站
  // 这样完全不存在跨域问题
  const API_BASE = '/api/v1';

  if (THEME === 'dark') document.documentElement.classList.add('dark');

  // ── 三层返佣配置 ──
  const TIERS = [
    { name: '青铜', css: 'bronze', rate: 10, min: 0,    label: '月充值 < ¥500' },
    { name: '白银', css: 'silver', rate: 12, min: 500,  label: '月充值 ¥500 – ¥3,000' },
    { name: '黄金', css: 'gold',   rate: 15, min: 3000, label: '月充值 > ¥3,000' },
  ];

  function getCurrentTier(amount) {
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (amount >= TIERS[i].min) return i;
    }
    return 0;
  }

  function $(sel) { return document.querySelector(sel); }

  function showToast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2500);
  }

  function fmt(v) { return v == null ? '¥0.00' : '¥' + Number(v).toFixed(2); }

  function fmtDate(s) {
    if (!s) return '-';
    const d = new Date(s);
    if (isNaN(d)) return '-';
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (TOKEN) opts.headers['Authorization'] = 'Bearer ' + TOKEN;
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(API_BASE + path, opts);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'HTTP ' + resp.status);
    }
    return resp.json();
  }

  // ── 主渲染 ──
  async function init() {
    if (!TOKEN) {
      $('#app').innerHTML =
        '<div class="card" style="text-align:center;padding:60px 20px;">' +
        '<div style="font-size:48px;margin-bottom:16px;">🔒</div>' +
        '<h3 style="font-size:18px;font-weight:600;">请先登录</h3>' +
        '<p style="font-size:14px;color:var(--text-secondary);margin-top:8px;">需要登录后才能使用邀请返佣功能</p></div>';
      return;
    }
    try {
      const data = await api('GET', '/user/aff');
      render(data);
    } catch (e) {
      $('#app').innerHTML =
        '<div class="card" style="text-align:center;padding:60px 20px;">' +
        '<div style="font-size:48px;margin-bottom:16px;">⚠️</div>' +
        '<h3 style="font-size:18px;font-weight:600;">加载失败</h3>' +
        '<p style="font-size:14px;color:var(--text-secondary);margin-top:8px;">' + esc(e.message) + '</p>' +
        '<button class="btn btn-primary" style="margin-top:20px;" onclick="location.reload()">重试</button></div>';
    }
  }

  function render(data) {
    const code  = data.aff_code || '';
    const count = data.aff_count || 0;
    const quota = data.aff_quota || 0;
    const total = data.aff_history_quota || 0;
    const list  = data.invitees || [];
    const tier  = getCurrentTier(total);

    // 邀请链接指向 sub2api 主站注册页
    const regHost = SRC_HOST || window.location.origin;
    const link = regHost + '/register?aff=' + encodeURIComponent(code);

    var rows = '';
    if (list.length === 0) {
      rows = '<div class="empty-state">还没有邀请到用户，快分享你的邀请链接吧 🚀</div>';
    } else {
      rows = '<div class="table-wrap"><table><thead><tr>' +
        '<th>邮箱</th><th>用户名</th><th>注册时间</th></tr></thead><tbody>';
      for (var i = 0; i < list.length; i++) {
        rows += '<tr><td style="color:var(--text)">' + esc(list[i].email || '-') + '</td>' +
          '<td style="color:var(--text-secondary)">' + esc(list[i].username || '-') + '</td>' +
          '<td style="color:var(--text-secondary);font-size:13px">' + esc(fmtDate(list[i].created_at)) + '</td></tr>';
      }
      rows += '</tbody></table></div>';
    }

    var tierHtml = '';
    for (var j = 0; j < TIERS.length; j++) {
      var t = TIERS[j];
      tierHtml += '<div class="tier-card ' + t.css + (j === tier ? ' active' : '') + '">' +
        '<span class="tier-badge">' + t.name + '</span>' +
        '<div class="tier-rate">' + t.rate + '<span>%</span></div>' +
        '<div class="tier-cond">' + t.label + '</div></div>';
    }

    $('#app').innerHTML =
      // 统计面板
      '<div class="grid-3">' +
        '<div class="card"><div class="stat-label">邀请用户数</div><div class="stat-value">' + count.toLocaleString() + '</div></div>' +
        '<div class="card"><div class="stat-label">可用佣金</div><div class="stat-value emerald">' + fmt(quota) + '</div></div>' +
        '<div class="card"><div class="stat-label">累计佣金</div><div class="stat-value">' + fmt(total) + '</div></div>' +
      '</div>' +

      // 返佣等级
      '<div class="card">' +
        '<div class="section-title">📊 返佣等级</div>' +
        '<div class="section-desc">根据被邀请人月累计充值金额自动匹配返佣比例</div>' +
        '<div class="tier-grid">' + tierHtml + '</div>' +
      '</div>' +

      // 邀请码 & 链接
      '<div class="card">' +
        '<div class="section-title">🔗 邀请推广</div>' +
        '<div class="section-desc">分享你的专属邀请码或链接，被邀请人注册时填写即可绑定</div>' +
        '<div class="grid-2" style="margin-top:16px;">' +
          '<div><div class="stat-label" style="margin-bottom:8px;">你的邀请码</div>' +
            '<div class="code-box"><code>' + esc(code) + '</code>' +
            '<button class="btn btn-secondary btn-sm" id="copyCodeBtn">📋 复制</button></div></div>' +
          '<div><div class="stat-label" style="margin-bottom:8px;">邀请链接</div>' +
            '<div class="code-box"><code style="font-weight:400;font-size:12px">' + esc(link) + '</code>' +
            '<button class="btn btn-secondary btn-sm" id="copyLinkBtn">📋 复制</button></div></div>' +
        '</div>' +
        '<div class="info-box">' +
          '<div class="info-title">💡 推广说明</div><ul>' +
          '<li>1. 被邀请人通过你的链接注册或手动填写你的邀请码，即与你绑定</li>' +
          '<li>2. 被邀请人每次充值，你将按当前等级比例获得返佣</li>' +
          '<li>3. 返佣等级根据被邀请人月累计充值自动升级：<strong>10% → 12% → 15%</strong></li>' +
          '<li>4. 佣金累计后可一键提取到账户余额</li></ul>' +
        '</div>' +
      '</div>' +

      // 提取佣金
      '<div class="card">' +
        '<div class="transfer-row"><div>' +
          '<div class="section-title">💰 提取佣金</div>' +
          '<div class="section-desc">将可用佣金转入账户余额，可直接用于消费</div></div>' +
          '<button class="btn btn-primary" id="transferBtn"' + (quota <= 0 ? ' disabled' : '') + '>💸 提取到余额</button>' +
        '</div>' +
        (quota <= 0 ? '<div class="transfer-warn">⚠️ 当前无可提取佣金</div>' : '') +
      '</div>' +

      // 邀请记录
      '<div class="card">' +
        '<div class="flex-between"><div class="section-title">👥 邀请记录</div>' +
        '<span class="stat-label">共 ' + count + ' 人</span></div>' +
        rows +
      '</div>';

    // ── 绑定事件 ──
    $('#copyCodeBtn').onclick = function() { copyText(code, '邀请码已复制'); };
    $('#copyLinkBtn').onclick = function() { copyText(link, '链接已复制'); };
    $('#transferBtn').onclick = doTransfer;
  }

  function copyText(text, msg) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function() { showToast(msg); }).catch(function() { fallbackCopy(text, msg); });
    } else {
      fallbackCopy(text, msg);
    }
  }

  function fallbackCopy(text, msg) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast(msg);
  }

  function doTransfer() {
    var btn = $('#transferBtn');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    btn.innerHTML = '⏳ 提取中...';
    api('POST', '/user/aff/transfer').then(function(resp) {
      showToast('成功提取 ' + fmt(resp.transferred_quota) + ' 到余额');
      setTimeout(init, 600);
    }).catch(function(e) {
      showToast('提取失败: ' + e.message);
      btn.disabled = false;
      btn.innerHTML = '💸 提取到余额';
    });
  }

  init();
})();
</script>
</body>
</html>`;
