/* 全球 AI 产业链每日监控 —— 前端渲染（多页 / 新浪财经风格 / ECharts） */
'use strict';

const REFRESH_MS = 60000;          // 每 60 秒轮询一次（本地服务模式）
const HW_TICKERS = ['NVDA', 'TSM', 'ASML', 'AVGO', 'AMD', 'MU'];
const C = {
  red: '#e60012', green: '#0aa05a', blue: '#1f6fe0',
  grid: '#e6eaf0', muted: '#6b7785', ink: '#1f2733',
  palette: ['#e60012', '#1f6fe0', '#0aa05a', '#f59e0b', '#8b5cf6', '#0891b2', '#db2777']
};
let charts = {};

const TAG_CLASS = {
  '芯片': 't-chip', '超节点': 't-node', '存储': 't-mem', '内存': 't-mem', '封装': 't-pkg',
  '设备': 't-eq', 'EDA': 't-eq', '代工生态': 't-fab', 'GPU IP': 't-chip', '互联': 't-net',
  '大模型': 't-llm', '多模态': 't-mm', '开源': 't-open', 'Agent': 't-agent',
  '安全': 't-sec', '生态': 't-eco', '科学AI': 't-sci'
};

function isUp(chg) { return /[+]/.test(chg || '') ? 1 : /[-−]/.test(chg || '') ? -1 : 0; }
function chgClass(chg) { const s = isUp(chg); return s > 0 ? 'up' : s < 0 ? 'down' : ''; }
function fmt(v, d = 2) { return v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d }); }
function esc(s) { return (s == null ? '' : '' + s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function tagCls(tag) { return 'news-tag ' + (TAG_CLASS[tag] || 't-def'); }

/* ---------- 信息来源超链接 ---------- */
// 宏观指标 → 行情/官方数据来源页
const MACRO_LINKS = {
  US10Y: 'https://cn.investing.com/rates-bonds/u.s.-10-year-bond-yield',
  JP10Y: 'https://cn.investing.com/rates-bonds/japan-10-year-bond-yield',
  DE10Y: 'https://cn.investing.com/rates-bonds/germany-10-year-bond-yield',
  CN10Y: 'https://cn.investing.com/rates-bonds/china-10-year-bond-yield',
  NASDAQ100: 'https://cn.investing.com/indices/nq-100',
  SP500: 'https://cn.investing.com/indices/us-spx-500',
  NIKKEI225: 'https://cn.investing.com/indices/japan-ni225',
  STOXX50: 'https://cn.investing.com/indices/eu-stoxx50',
  CSI300: 'https://finance.sina.com.cn/realstock/company/sh000300/nc.shtml'
};
// GDP 数据来源（按地区 → 官方统计机构）
const GDP_LINKS = {
  '中国': 'https://www.stats.gov.cn/',
  '美国': 'https://www.bea.gov/',
  '日本': 'https://www.esri.cao.go.jp/index.shtml',
  '欧元区·德国': 'https://ec.europa.eu/eurostat',
  '德国': 'https://www.destatis.de/',
  '韩国': 'https://www.bok.or.kr/main/engMain.do',
  '中国台湾': 'https://www.stat.gov.tw/'
};
// 新闻来源关键词 → 官网
const SOURCE_HINTS = [
  ['reuters', 'https://www.reuters.com/technology/'],
  ['bloomberg', 'https://www.bloomberg.com/technology'],
  ['semiconductor engineering', 'https://semiengineering.com/'],
  ['nikkei', 'https://www.nikkei.com/'],
  ['新浪', 'https://finance.sina.com.cn/'],
  ['腾讯', 'https://news.qq.com/'],
  ['terminal-bench', 'https://www.tbench.ai/leaderboard'],
  ['openai', 'https://openai.com/news/'],
  ['anthropic', 'https://www.anthropic.com/news'],
  ['seoul economic', 'https://www.sedaily.com/'],
  ['云栖大会', 'https://yunqi.aliyun.com/'],
  ['华为全联接', 'https://www.huawei.com/cn/events/huaweiconnect'],
  ['台积电', 'https://pr.tsmc.com/english/news/'],
  ['英为财情', 'https://cn.investing.com/']
];
// AI 模型厂商 → 官网/发布页
const VENDOR_LINKS = {
  'OpenAI': 'https://openai.com/news/',
  'Google DeepMind': 'https://deepmind.google/models/',
  'Google': 'https://deepmind.google/models/',
  'Anthropic': 'https://www.anthropic.com/news',
  'Meta AI': 'https://ai.meta.com/blog/',
  'Meta': 'https://ai.meta.com/blog/',
  'DeepSeek': 'https://api-docs.deepseek.com/',
  '阿里云通义': 'https://tongyi.aliyun.com/',
  '通义千问': 'https://tongyi.aliyun.com/',
  'xAI': 'https://x.ai/news',
  'Mistral AI': 'https://mistral.ai/news/',
  '月之暗面': 'https://www.moonshot.cn/',
  '智谱': 'https://www.zhipuai.cn/',
  '百度': 'https://qianfan.cloud.baidu.com/',
  '字节跳动': 'https://team.doubao.com/'
};
function googleSearch(q) { return 'https://www.google.com/search?q=' + encodeURIComponent(q); }
function googleNews(q) { return 'https://news.google.com/search?q=' + encodeURIComponent(q) + '&hl=zh-CN&gl=CN'; }
// 证券代码 → 行情页（A股/港股用雪球，日韩台用 Yahoo Finance，美股用新浪）
function tickerLink(tk) {
  if (!tk) return null;
  const first = ('' + tk).split('/')[0].trim();
  if (!first || first.startsWith('—') || first.startsWith('（')) return null;
  const m = first.match(/^(\d{4,6})\.(SH|SZ|HK|T|TW|TWO|KS|KQ)$/i);
  if (m) {
    const code = m[1], ex = m[2].toUpperCase();
    if (ex === 'SH' || ex === 'SZ') return 'https://xueqiu.com/S/' + ex + code;
    if (ex === 'HK') return 'https://xueqiu.com/S/HK' + code.padStart(5, '0');
    return 'https://finance.yahoo.com/quote/' + code + '.' + ex;
  }
  if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(first)) return 'https://stock.finance.sina.com.cn/usstock/quotes/' + first + '.html';
  return null;
}
// 新闻来源 → 链接（优先 source_url 字段，其次关键词官网，兜底 Google News 检索）
function newsSourceLink(n) {
  if (n.source_url) return n.source_url;
  const s = ('' + (n.source || '')).toLowerCase();
  for (const [kw, url] of SOURCE_HINTS) if (s.includes(kw)) return url;
  return googleNews((n.org || '') + ' ' + (n.title || ''));
}
// 通用「了解更多」：优先自带 source_url，其次代码行情页，最后搜索引擎
function moreLink(item, fallbackQuery) {
  return item.source_url || tickerLink(item.ticker) || googleSearch(fallbackQuery);
}

/* ---------- 语音播报（Web Speech API） ---------- */
const SPEECH_LANG = 'zh-CN';
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = window.speechSynthesis.getVoices();
  return vs.find(v => v.lang && v.lang.toLowerCase().startsWith('zh')) || vs[0] || null;
}
function speak(text, btn) {
  if (!('speechSynthesis' in window)) { alert('当前浏览器不支持语音播报'); return; }
  const synth = window.speechSynthesis;
  if (synth.speaking) { synth.cancel(); if (btn) setVoiceBtn(btn, false); return; }
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) u.voice = v;
  u.lang = SPEECH_LANG; u.rate = 1.02; u.pitch = 1.0;
  u.onend = () => { if (btn) setVoiceBtn(btn, false); };
  u.onerror = () => { if (btn) setVoiceBtn(btn, false); };
  if (btn) setVoiceBtn(btn, true);
  synth.speak(u);
}
function setVoiceBtn(btn, on) {
  if (!btn) return;
  btn.classList.toggle('voicing', on);
  if (btn.id === 'voiceFloat') btn.textContent = on ? '⏹' : '🔊';
  else btn.dataset.on = on ? '1' : '';
}
function attachVoice(node, sel, textFn) {
  (node || document).querySelectorAll(sel).forEach(b => {
    if (b.dataset._v) return; b.dataset._v = '1';
    b.addEventListener('click', () => speak(textFn(b), b));
  });
}
function bindVoiceBrief(getText) {
  const vb = document.getElementById('voiceBrief'), vf = document.getElementById('voiceFloat');
  if (vb && !vb.dataset._b) { vb.dataset._b = '1'; vb.addEventListener('click', () => speak(getText(), vb)); }
  if (vf && !vf.dataset._b) { vf.dataset._b = '1'; vf.addEventListener('click', () => speak(getText(), vf)); }
}

/* ---------- 图表基础 ---------- */
function baseLineOpt(dates, series, yName, dark) {
  const axis = dark ? '#5b6b7e' : C.muted;
  const grid = dark ? '#1b2738' : '#f0f2f5';
  const tick = dark ? '#33425a' : C.grid;
  return {
    tooltip: { trigger: 'axis', confine: true, backgroundColor: dark ? '#0f1623' : '#fff',
      borderColor: dark ? '#26354a' : '#e6eaf0', textStyle: { color: dark ? '#e6edf3' : '#1f2733', fontSize: 11 } },
    legend: { type: 'scroll', top: 0, textStyle: { fontSize: 11, color: axis }, icon: 'roundRect' },
    grid: { left: 58, right: 14, top: 34, bottom: 26 },
    xAxis: {
      type: 'category', data: dates, boundaryGap: false,
      axisLabel: { fontSize: 10, color: axis, interval: Math.floor(dates.length / 7) },
      axisLine: { lineStyle: { color: tick } }
    },
    yAxis: {
      type: 'value', scale: true, name: yName, nameTextStyle: { color: axis, fontSize: 10 },
      axisLabel: { fontSize: 10, color: axis }, splitLine: { lineStyle: { color: grid } }
    },
    series: series
  };
}
function lineSerie(name, vals, color, area) {
  return {
    name, type: 'line', data: vals, smooth: true, showSymbol: false,
    lineStyle: { width: 2, color }, itemStyle: { color },
    areaStyle: area ? { opacity: 0.08, color } : undefined,
    markPoint: { symbolSize: 6, data: [{ type: 'max', label: { fontSize: 9 } }], itemStyle: { color } }
  };
}
function makeChart(id, opt) {
  const el = document.getElementById(id);
  if (!el) return;
  if (charts[id]) charts[id].dispose();
  const c = echarts.init(el);
  c.setOption(opt);
  charts[id] = c;
}

/* ---------- 数据获取 ---------- */
async function tryJSON(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const txt = await res.text();
    if (!txt) return null;
    return JSON.parse(txt);
  } catch (e) { return null; }
}
async function getDATA() {
  let data = null, src = 'live';
  if (location.protocol !== 'file:') data = await tryJSON('/api/data');
  if (!data && window.__DATA__) { data = window.__DATA__; src = 'embedded'; }
  if (!data) { data = await tryJSON('data/latest_snapshot.json'); src = 'snapshot'; }
  return { data, src };
}

/* ---------- 行情条（全站共享） ---------- */
function renderTicker(data) {
  const items = [];
  data.macro.yields.forEach(s => items.push({ nm: s.label, v: fmt(s.last, 2), chg: s.today_change }));
  data.macro.indices.forEach(s => items.push({ nm: s.label, v: fmt(s.last, 0), chg: s.today_change }));
  data.stocks.forEach(s => items.push({ nm: s.ticker, v: fmt(s.last, 2), chg: s.today_change }));
  const span = items.map(it =>
    `<span class="tk"><span class="nm">${it.nm}</span>${it.v} <span class="${chgClass(it.chg)}">${it.chg || ''}</span></span>`).join('');
  const el = document.getElementById('ticker');
  if (el) el.innerHTML = span + span;
  const nl = document.getElementById('navLive');
  if (nl) nl.innerHTML = '● 数据日期 <b>' + (data.last_updated || '—') + '</b> ｜ 每日 09:00 自动更新';
}

/* ---------- 新闻条目 ---------- */
function newsItemHTML(n, isFresh) {
  const meta = [];
  if (n.ticker) {
    const tkUrl = tickerLink(n.ticker);
    meta.push(tkUrl
      ? `<a class="news-tk" href="${tkUrl}" target="_blank" rel="noopener" title="查看行情 ↗">${esc(n.ticker)} ↗</a>`
      : `<span class="news-tk">${esc(n.ticker)}</span>`);
  }
  if (n.org) meta.push(`<span class="news-org">${esc(n.org)}</span>`);
  if (n.country) meta.push(`<span class="news-cty">${esc(n.country)}</span>`);
  if (isFresh) meta.push('<span class="news-fresh">今日</span>');
  const srcUrl = n.source ? newsSourceLink(n) : null;
  const spk = (n.title || '') + (n.detail ? '。' + n.detail : '');
  return `<article class="news-item">
      <div class="news-head">
        <span class="news-date">${esc(n.date || '')}</span>
        <span class="${tagCls(n.tag)}">${esc(n.tag || '综合')}</span>
        ${meta.join('')}
        <button class="hx-news-voice" data-spk="${esc(spk)}" title="语音播报本条">🔊</button>
        <h4 class="news-title">${esc(n.title || '')}</h4>
      </div>
      ${n.detail ? `<p class="news-detail">${esc(n.detail)}</p>` : ''}
      ${n.source ? `<div class="news-src">来源：${srcUrl
        ? `<a class="src-link" href="${srcUrl}" target="_blank" rel="noopener" title="打开信息来源 ↗">${esc(n.source)} ↗</a>`
        : esc(n.source)}</div>` : ''}
    </article>`;
}

/* ============ 首页 ============ */
function kpiHTML(x) {
  const url = MACRO_LINKS[x.key];
  const inner = `
      <div class="kpi-nm">${esc(x.label)}</div>
      <div class="kpi-v">${fmt(x.last, x.label.includes('国债') || x.label.includes('10Y') ? 2 : 0)}</div>
      <div class="kpi-c ${chgClass(x.today_change)}">${x.today_change || '—'}</div>
      ${url ? '<div class="kpi-src">来源 ↗</div>' : ''}`;
  return url
    ? `<a class="kpi kpi-link" href="${url}" target="_blank" rel="noopener" title="点击查看 ${esc(x.label)} 行情来源">${inner}</a>`
    : `<div class="kpi">${inner}</div>`;
}

function renderHome(data) {
  const s = document.getElementById('summaryText');
  if (s) s.textContent = data.exec_summary || '（暂无摘要）';

  // Hero 右侧：核心快照（4 个最关键数字）
  const hs = document.getElementById('heroStats');
  if (hs) {
    const pick = (arr, keys) => keys.map(k => arr.find(x => x.key === k)).filter(Boolean);
    const stats = [
      ...pick(data.macro.yields, ['US10Y', 'CN10Y']).map(x => ({ key: x.key, nm: x.label, v: fmt(x.last, 2) + '%', chg: x.today_change })),
      ...pick(data.macro.indices, ['NASDAQ100', 'CSI300']).map(x => ({ key: x.key, nm: x.label, v: fmt(x.last, 0), chg: x.today_change }))
    ];
    hs.innerHTML = stats.map(x => {
      const url = MACRO_LINKS[x.key];
      const inner = `
        <div class="hs-nm">${esc(x.nm)}</div>
        <div class="hs-v">${esc(x.v)}</div>
        <div class="hs-c ${chgClass(x.chg)}">${esc(x.chg || '—')}</div>
        ${url ? '<div class="kpi-src hs-src">来源 ↗</div>' : ''}`;
      return url
        ? `<a class="hero-stat hs-link" href="${url}" target="_blank" rel="noopener" title="点击查看 ${esc(x.nm)} 行情来源">${inner}</a>`
        : `<div class="hero-stat">${inner}</div>`;
    }).join('');
  }

  // 关键市场数字：分 收益率 / 股指 两组
  const yEl = document.getElementById('kpiYields');
  if (yEl) yEl.innerHTML = data.macro.yields.map(kpiHTML).join('');
  const iEl = document.getElementById('kpiIndices');
  if (iEl) iEl.innerHTML = data.macro.indices.map(kpiHTML).join('');

  // 派生利差（中美 / 日美 / 德美）—— 给理工科用户的量化视角
  const dv = document.getElementById('hxDeriv');
  if (dv) {
    const y = {};
    data.macro.yields.forEach(s => y[s.key] = s.last);
    const spread = (a, b) => (y[a] != null && y[b] != null) ? Math.round((y[a] - y[b]) * 100) : null;
    const rows = [
      { nm: '中美利差', f: 'CN10Y − US10Y', v: spread('CN10Y', 'US10Y'), unit: 'bp', note: '负值=资金偏向美元' },
      { nm: '日美利差', f: 'JP10Y − US10Y', v: spread('JP10Y', 'US10Y'), unit: 'bp', note: '日元套息空间' },
      { nm: '德美利差', f: 'DE10Y − US10Y', v: spread('DE10Y', 'US10Y'), unit: 'bp', note: '欧美货币政策差' },
    ];
    dv.innerHTML = rows.map(r => `
      <div class="hx-deriv-card">
        <div class="hx-dn">${esc(r.nm)}</div>
        <div class="hx-df">${esc(r.f)}</div>
        <div class="hx-dv">${r.v == null ? '—' : (r.v > 0 ? '+' : '') + r.v} <span class="hx-du">${r.unit}</span></div>
        <div class="hx-dnote">${esc(r.note)}</div>
      </div>`).join('');
  }

  // 中国宏观补充条
  const cn = document.getElementById('homeCn');
  const cm = data.china_macro || {};
  if (cn) {
    const cnNote = document.getElementById('cnNote');
    if (cnNote && cm.note) cnNote.textContent = cm.note;
    cn.innerHTML = (cm.items || []).map(it => `
      <div class="hx-cn-cell">
        <div class="hx-cn-nm">${esc(it.name)}</div>
        <div class="hx-cn-v">${esc(it.value)}<span class="hx-cn-u">${esc(it.unit || '')}</span></div>
        <div class="hx-cn-chg ${chgClass(it.chg)}">${esc(it.chg || '')}</div>
        <div class="hx-cn-note">${esc(it.note || '')}</div>
      </div>`).join('');
  }

  // 首页宏观速览：GDP 表 + 收益率/股指 迷你走势
  renderHomeMacro(data);

  // 个股涨跌幅榜（绝对值前 6）
  const moversEl = document.getElementById('keyMovers');
  if (moversEl) {
    const arr = data.stocks.map(st => ({
      tk: st.ticker, nm: st.label, chg: (st.change == null ? 0 : st.change)
    })).sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg)).slice(0, 6);
    const maxAbs = Math.max(...arr.map(m => Math.abs(m.chg)), 0.01);
    moversEl.innerHTML = arr.map(m => {
      const cls = m.chg > 0 ? 'up' : m.chg < 0 ? 'down' : 'flat';
      const w = m.chg === 0 ? 4 : Math.max(8, Math.min(100, Math.abs(m.chg) / maxAbs * 100));
      return `
      <div class="hx-mover ${cls}">
        <span class="hx-m-tk">${m.tk}</span>
        <span class="hx-m-bar"><i style="width:${w}%"></i></span>
        <span class="hx-m-chg">${m.chg >= 0 ? '+' : ''}${m.chg.toFixed(2)}%</span>
      </div>`; }).join('');
  }

  // 消费 AI 硬件：价位档速览（首页速览）
  const bandsEl = document.getElementById('homeBands');
  const cons = data.consumer || { price_bands: [], products: [] };
  if (bandsEl) {
    const countBy = {};
    (cons.products || []).forEach(p => { countBy[p.band] = (countBy[p.band] || 0) + 1; });
    bandsEl.innerHTML = (cons.price_bands || []).map(b => `
      <a class="hx-band" href="consumer.html">
        <div class="hx-b-name">${esc(b.name)}</div>
        <div class="hx-b-range">${esc(b.range)}</div>
        <div class="hx-b-do">${esc(b.can_do)}</div>
        <div class="hx-b-foot"><span>${countBy[b.id] || 0} 款</span><span class="hx-go">选购 →</span></div>
      </a>`).join('');
  }

  // 最新动态亮点
  const hh = document.getElementById('homeHwNews');
  if (hh) {
    const items = (data.hardware_news || []).slice(0, 3);
    hh.innerHTML = items.length ? items.map(n => newsItemHTML(n, n.date === data.last_updated)).join('')
      : '<div class="news-empty">暂无。</div>';
  }
  const mm = document.getElementById('homeMdNews');
  if (mm) {
    const items = (data.model_news || []).slice(0, 3);
    mm.innerHTML = items.length ? items.map(n => newsItemHTML(n, n.date === data.last_updated)).join('')
      : '<div class="news-empty">暂无。</div>';
  }

  // 栏目导航
  const mods = document.getElementById('hxMods');
  if (mods) {
    const mod = [
      ['macro.html', '📊', '宏观市场', '中/美/日/欧 GDP、10Y 收益率与股指走势（含沪深300）'],
      ['hardware.html', '🛠️', 'AI 硬件产品', '七品类 66 件产品库：芯片/存储/设备/代工/互联/封装/果链'],
      ['consumer.html', '🛒', '消费 AI 硬件', 'AI PC / 显卡 / AI 手机价位档、NPU 算力与性价比点评'],
      ['models.html', '🧠', 'AI 模型发布', '旗舰/开源/多模态模型库与横向对比、能力趋势'],
      ['software.html', '☁️', 'AI 软件与云', 'MSFT/GOOGL/META/AMZN/AAPL 战略、产品、CapEx'],
      ['chain.html', '🔗', '产业链全景', '从芯片设计到云应用的六环节流程图与关键玩家'],
      ['about.html', 'ℹ️', '数据说明', '方法论、数据来源、更新频率与免责声明'],
    ];
    mods.innerHTML = mod.map(m => `
      <a class="hx-mod" href="${m[0]}"><span class="hx-m-ico">${m[1]}</span>
        <span class="hx-m-t">${m[2]}</span><span class="hx-m-d">${m[3]}</span></a>`).join('');
  }

  // 语音播报：速览文本 + 绑定
  const briefText = () => {
    const y = {}; data.macro.yields.forEach(s => y[s.key] = s.last);
    const i = {}; data.macro.indices.forEach(s => i[s.key] = s.last);
    const parts = [];
    parts.push('今日速览。' + (data.exec_summary || ''));
    parts.push(`美十年期国债收益率 ${y['US10Y']}%，中十年期 ${y['CN10Y']}%，中美利差 ${Math.round((y['CN10Y'] - y['US10Y']) * 100)} 个基点。`);
    parts.push(`纳斯达克100指数 ${Math.round(i['NASDAQ100'])}，标普500 ${Math.round(i['SP500'])}，日经225 ${Math.round(i['NIKKEI225'])}，欧洲斯托克50 ${Math.round(i['STOXX50'])}，沪深300 ${Math.round(i['CSI300'])}。`);
    (data.hardware_news || []).slice(0, 3).forEach(n => parts.push('硬件动态：' + (n.title || '')));
    (data.model_news || []).slice(0, 3).forEach(n => parts.push('模型动态：' + (n.title || '')));
    return parts.join(' ');
  };
  bindVoiceBrief(briefText);
  attachVoice(document.getElementById('homeHwNews'), '.hx-news-voice', b => b.dataset.spk);
  attachVoice(document.getElementById('homeMdNews'), '.hx-news-voice', b => b.dataset.spk);

  const lu = document.getElementById('lastUpdated');
  if (lu) lu.textContent = '数据日期：' + data.last_updated;
  const dn = document.getElementById('dataNote');
  if (dn) dn.textContent = data.data_note || '';
  injectSiteFooter(data);
  return true;  // 供手动刷新判断成败
}

/* ============ 首页宏观速览 ============ */
function renderHomeMacro(data) {
  // GDP 表（含中国）
  const gEl = document.getElementById('homeGdp');
  if (gEl) {
    let h = '<table><thead><tr><th>国家/地区</th><th>最新 GDP 增速</th><th>数据来源 / 发布季度</th></tr></thead><tbody>';
    (data.gdp_rows || []).forEach(r => {
      const gUrl = GDP_LINKS[r.region] || googleSearch(r.region + ' 最新GDP 官方');
      h += `<tr><td><b>${esc(r.region)}</b></td><td>${esc(r.gdp)}</td><td>${r.source
        ? `<a class="src-link" href="${gUrl}" target="_blank" rel="noopener" title="打开官方统计机构 ↗">${esc(r.source)} ↗</a>` : '—'}</td></tr>`;
    });
    h += '</tbody></table>';
    gEl.innerHTML = h;
  }
  // 迷你走势图（首页·新浪浅色配色）
  makeChart('yieldChartHome', baseLineOpt(data.dates,
    data.macro.yields.map((s, i) => lineSerie(s.label, s.values, C.palette[i % C.palette.length], i === 0)), '%', false));
  makeChart('indexChartHome', baseLineOpt(data.dates,
    data.macro.indices.map((s, i) => lineSerie(s.label, s.values, C.palette[i % C.palette.length], i === 0)), '收盘', false));
}

/* ============ 宏观市场 ============ */
function renderMacro(data) {
  // GDP 表
  const gEl = document.getElementById('gdpTable');
  if (gEl) {
    let h = '<table><thead><tr><th>国家/地区</th><th>最新 GDP 增速</th><th>数据来源 / 发布季度</th></tr></thead><tbody>';
    (data.gdp_rows || []).forEach(r => {
      const gUrl = GDP_LINKS[r.region] || googleSearch(r.region + ' 最新GDP 官方');
      h += `<tr><td><b>${esc(r.region)}</b></td><td>${esc(r.gdp)}</td><td>${r.source
        ? `<a class="src-link" href="${gUrl}" target="_blank" rel="noopener" title="打开官方统计机构 ↗">${esc(r.source)} ↗</a>` : '—'}</td></tr>`;
    });
    h += '</tbody></table>';
    gEl.innerHTML = h;
  }
  // 收益率 / 股指 走势
  makeChart('yieldChart', baseLineOpt(data.dates,
    data.macro.yields.map((s, i) => lineSerie(s.label, s.values, C.palette[i % C.palette.length], i === 0)), '%'));
  makeChart('indexChart', baseLineOpt(data.dates,
    data.macro.indices.map((s, i) => lineSerie(s.label, s.values, C.palette[i % C.palette.length], i === 0)), '收盘'));

  // 收益率 + 股指 表
  const tEl = document.getElementById('macroTable');
  if (tEl) {
    let h = '<table><thead><tr><th>指标</th><th>最新值</th><th>今日涨跌</th><th>近一月走势</th></tr></thead><tbody>';
    [...data.macro.yields, ...data.macro.indices].forEach(s => {
      const mUrl = MACRO_LINKS[s.key];
      h += `<tr><td>${mUrl
        ? `<a class="src-link row-link" href="${mUrl}" target="_blank" rel="noopener" title="查看行情来源 ↗"><b>${esc(s.label)} ↗</b></a>`
        : `<b>${esc(s.label)}</b>`}</td><td>${fmt(s.last, s.key.includes('10Y') ? 2 : 0)}</td>
        <td class="${chgClass(s.today_change)}">${s.today_change || '—'}</td>
        <td><span class="mini ${chgClass(s.change)}">${s.change == null ? '' : (s.change >= 0 ? '+' : '') + s.change + '%'}</span></td></tr>`;
    });
    h += '</tbody></table>';
    tEl.innerHTML = h;
  }
}

/* ============ AI 硬件（支持按地区筛选） ============ */
let HW_DATA = null;
let currentRegion = 'all';   // all / 中国 / 美国 / 日本 / 韩国 / 中国台湾 / 荷兰

function countryBadge(p) {
  if (!p.country) return '';
  return `<span class="pc-country">${esc(p.country)}</span>`;
}

function renderHardwareGrid() {
  const wrap = document.getElementById('hwCategories');
  if (!wrap) return;
  const hw = HW_DATA || { categories: [] };
  const cats = (hw.categories || []).map(cat => {
    const prods = (cat.products || []).filter(p => currentRegion === 'all' || p.country === currentRegion);
    if (!prods.length) return '';
    const cards = prods.map(p => {
      const specs = Object.entries(p.specs || {}).map(([k, v]) =>
        `<tr><td class="sp-k">${esc(k)}</td><td class="sp-v">${esc(v)}</td></tr>`).join('');
      const hl = (p.tech_highlights || []).map(x => `<li>${esc(x)}</li>`).join('');
      const tkUrl = p.ticker ? tickerLink(p.ticker) : null;
      const more = moreLink(p, p.vendor + ' ' + p.name + ' 发布 官方');
      const tkHTML = p.ticker ? (tkUrl
        ? `<a class="pc-tk" href="${tkUrl}" target="_blank" rel="noopener" title="查看行情 ↗">${esc(p.ticker)} ↗</a>`
        : `<span class="pc-tk">${esc(p.ticker)}</span>`) : '';
      return `<div class="prod-card">
        <div class="pc-head">
          <div><span class="pc-vendor">${esc(p.vendor)}</span><h4 class="pc-name">${esc(p.name)}</h4></div>
          <div class="pc-meta">${countryBadge(p)}<span class="pc-status">${esc(p.status || '')}</span>${tkHTML}</div>
        </div>
        <div class="pc-body">
          <table class="spec"><tbody>${specs}</tbody></table>
          ${hl ? `<div class="pc-hl-title">科技特点</div><ul class="pc-hl">${hl}</ul>` : ''}
          ${p.positioning ? `<div class="pc-pos"><b>定位：</b>${esc(p.positioning)}</div>` : ''}
          ${more ? `<a class="pc-more" href="${more}" target="_blank" rel="noopener" title="打开信息来源 ↗">🔗 信息来源 / 了解更多 ↗</a>` : ''}
        </div>
      </div>`;
    }).join('');
    return `<section class="cat-block">
      <div class="cat-head"><h3>${esc(cat.name)}</h3><span class="cat-n">${prods.length} 项</span></div>
      <p class="cat-desc">${esc(cat.desc || '')}</p>
      <div class="prod-grid">${cards}</div>
    </section>`;
  }).join('');
  wrap.innerHTML = cats || '<div class="news-empty">该区域暂无产品。</div>';
}

function renderHardware(data) {
  HW_DATA = data.hardware_products || { summary: '', categories: [] };
  const sum = document.getElementById('hwSummary');
  if (sum) sum.textContent = HW_DATA.summary || '';
  renderHardwareGrid();

  // 关键加速器对比表（取含 显存/算力 的产品，按地区过滤）
  const cmp = document.getElementById('hwCompare');
  if (cmp) {
    const rows = [];
    (HW_DATA.categories || []).forEach(cat => (cat.products || []).forEach(p => {
      if (currentRegion !== 'all' && p.country !== currentRegion) return;
      const sp = p.specs || {};
      if (sp['显存'] || sp['算力'] || sp['晶体管']) rows.push(p);
    }));
    let h = '<table><thead><tr><th>地区</th><th>厂商</th><th>产品</th><th>状态</th><th>显存/带宽</th><th>算力</th><th>制程/互联</th></tr></thead><tbody>';
    rows.forEach(p => {
      const sp = p.specs || {};
      h += `<tr><td>${esc(p.country || '—')}</td><td>${esc(p.vendor)}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.status || '')}</td>
        <td>${esc(sp['显存'] || '—')}</td><td>${esc(sp['算力'] || '—')}</td>
        <td>${esc(sp['制程'] || sp['互联'] || '—')}</td></tr>`;
    });
    h += '</tbody></table>';
    cmp.innerHTML = h;
  }

  // 发布时间线（按地区过滤）
  const tl = document.getElementById('hwTimeline');
  if (tl) {
    const all = [];
    (HW_DATA.categories || []).forEach(cat => (cat.products || []).forEach(p => {
      if (currentRegion !== 'all' && p.country !== currentRegion) return;
      if (p.date) all.push({ date: p.date, vendor: p.vendor, name: p.name, status: p.status });
    }));
    all.sort((a, b) => b.date.localeCompare(a.date));
    tl.innerHTML = all.map(x =>
      `<div class="tl-item"><span class="tl-dot"></span><div class="tl-body">
        <span class="tl-date">${esc(x.date)}</span><b>${esc(x.name)}</b>
        <span class="tl-sub">${esc(x.vendor)}${x.status ? ' · ' + esc(x.status) : ''}</span></div></div>`).join('');
  }
}

/* ============ AI 模型 ============ */
function renderModels(data) {
  const md = data.models_db || { summary: '', models: [] };
  const sum = document.getElementById('mdSummary');
  if (sum) sum.textContent = md.summary || '';

  const grid = document.getElementById('mdGrid');
  if (grid) {
    grid.innerHTML = (md.models || []).map(m => {
      const hl = (m.highlights || []).map(x => `<li>${esc(x)}</li>`).join('');
      const more = m.source_url || VENDOR_LINKS[m.vendor] || googleSearch(m.vendor + ' ' + m.name + ' 模型 发布');
      return `<div class="model-card">
        <div class="mc-head">
          <div><span class="mc-vendor">${esc(m.vendor)}</span><h4 class="mc-name">${esc(m.name)}</h4></div>
          <div class="mc-badges">
            ${m.open_source ? '<span class="badge open">开源</span>' : '<span class="badge close">闭源</span>'}
            <span class="badge type">${esc(m.type || '')}</span>
          </div>
        </div>
        <div class="mc-spec">
          <div><span>参数</span>${esc(m.params || '—')}</div>
          <div><span>上下文</span>${esc(m.context || '—')}</div>
          <div><span>定价</span>${esc(m.pricing || '—')}</div>
          ${m.ticker ? `<div><span>关联</span>${esc(m.ticker)}</div>` : ''}
        </div>
        ${hl ? `<ul class="mc-hl">${hl}</ul>` : ''}
        ${m.benchmarks ? `<div class="mc-bench"><b>基准：</b>${esc(m.benchmarks)}</div>` : ''}
        <div class="mc-foot">
          <div class="mc-date">发布：${esc(m.date || '—')}</div>
          ${more ? `<a class="pc-more mc-more" href="${more}" target="_blank" rel="noopener" title="打开信息来源 ↗">🔗 信息来源 / 了解更多 ↗</a>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  // 对比表
  const cmp = document.getElementById('mdCompare');
  if (cmp) {
    let h = '<table><thead><tr><th>厂商</th><th>模型</th><th>类型</th><th>参数</th><th>上下文</th><th>开源</th><th>关联</th></tr></thead><tbody>';
    (md.models || []).forEach(m => {
      h += `<tr><td>${esc(m.vendor)}</td><td><b>${esc(m.name)}</b></td><td>${esc(m.type || '')}</td>
        <td>${esc(m.params || '—')}</td><td>${esc(m.context || '—')}</td>
        <td>${m.open_source ? '是' : '否'}</td><td>${esc(m.ticker || '—')}</td></tr>`;
    });
    h += '</tbody></table>';
    cmp.innerHTML = h;
  }

  // 时间线
  const tl = document.getElementById('mdTimeline');
  if (tl) {
    const arr = (md.models || []).filter(m => m.date).slice().sort((a, b) => b.date.localeCompare(a.date));
    tl.innerHTML = arr.map(m =>
      `<div class="tl-item"><span class="tl-dot"></span><div class="tl-body">
        <span class="tl-date">${esc(m.date)}</span><b>${esc(m.name)}</b>
        <span class="tl-sub">${esc(m.vendor)} · ${esc(m.type || '')}</span></div></div>`).join('');
  }
}

/* ============ AI 软件与云 ============ */
function renderSoftware(data) {
  const sw = (data.software_companies || { companies: [] }).companies || [];
  const grid = document.getElementById('swGrid');
  if (grid) {
    grid.innerHTML = sw.map(c => {
      const prods = (c.products || []).map(x => `<li>${esc(x)}</li>`).join('');
      const latest = (c.latest || []).map(x => `<li>${esc(x)}</li>`).join('');
      const cUrl = c.url || tickerLink(c.ticker) || googleSearch(c.name + ' 公司官网');
      return `<div class="sw-card">
        <div class="sw-head">${cUrl
          ? `<a class="sw-tk" href="${cUrl}" target="_blank" rel="noopener" title="打开官网 / 行情 ↗">${esc(c.ticker)} ↗</a>`
          : `<span class="sw-tk">${esc(c.ticker)}</span>`}<h3 class="sw-name">${esc(c.name)}</h3></div>
        <div class="sw-role">${esc(c.role)}</div>
        <div class="sw-strategy"><b>战略：</b>${esc(c.strategy)}</div>
        <div class="sw-block"><div class="sw-bt">核心产品</div><ul>${prods}</ul></div>
        <div class="sw-block"><div class="sw-bt">资本开支</div><div class="sw-capex">${esc(c.capex || '—')}</div></div>
        <div class="sw-block"><div class="sw-bt">近期动态</div><ul class="sw-latest">${latest}</ul></div>
      </div>`;
    }).join('');
  }
}

/* ============ 产业链全景 ============ */
function renderChain(data) {
  const ch = (data.chain || { segments: [] }).segments || [];
  const flow = document.getElementById('chainFlow');
  if (flow) {
    flow.innerHTML = ch.map((s, i) =>
      `<div class="chain-node">
        <div class="cn-icon">${s.icon || '◆'}</div>
        <div class="cn-name">${esc(s.name)}</div>
        <div class="cn-desc">${esc(s.desc || '')}</div>
        <div class="cn-players">${(s.tickers || s.players || []).map(p => `<span class="cn-p">${esc(p)}</span>`).join('')}</div>
        ${i < ch.length - 1 ? '<div class="cn-arrow">→</div>' : ''}
      </div>`).join('');
  }
}

/* ============ 消费者 AI 硬件 ============ */
let CONS_DATA = null;
let consCat = 'all';     // all / aipc / gpu / phone / minipc
let consBand = 'all';    // all / entry / mainstream / pro / flagship

const BAND_CLS = { entry: 'b-entry', mainstream: 'b-main', pro: 'b-pro', flagship: 'b-flag' };

function renderConsumerGrid() {
  const wrap = document.getElementById('consGrid');
  if (!wrap || !CONS_DATA) return;
  const cats = CONS_DATA.categories || [];
  const prods = CONS_DATA.products || [];
  let html = '';
  cats.forEach(cat => {
    if (consCat !== 'all' && cat.id !== consCat) return;
    const list = prods.filter(p => p.cat === cat.id && (consBand === 'all' || p.band === consBand));
    if (!list.length) return;
    const cards = list.map(p => {
      const specs = Object.entries(p.specs || {}).map(([k, v]) =>
        `<tr><td class="sp-k">${esc(k)}</td><td class="sp-v">${esc(v)}</td></tr>`).join('');
      const feats = (p.ai_features || []).map(x => `<li>${esc(x)}</li>`).join('');
      const more = moreLink(p, p.vendor + ' ' + p.name + ' 官网');
      return `<div class="prod-card cons-card">
        <div class="pc-head">
          <div><span class="pc-vendor">${esc(p.vendor)}</span><h4 class="pc-name">${esc(p.name)}</h4></div>
          <div class="pc-meta">
            ${p.status === '未发布（预期）' ? '<span class="pc-status st-soon">未发布</span>' : '<span class="pc-status">在售</span>'}
            ${p.ticker ? `<span class="pc-tk">${esc(p.ticker)}</span>` : ''}
          </div>
        </div>
        <div class="cons-price-row">
          <span class="cons-price">${esc(p.price)}</span>
          <span class="cons-npu">⚡ ${esc(p.npu || '—')}</span>
        </div>
        <div class="pc-body">
          <table class="spec"><tbody>${specs}</tbody></table>
          ${feats ? `<div class="pc-hl-title">AI 特性</div><ul class="pc-hl">${feats}</ul>` : ''}
          <div class="cons-value"><b>💡 点评：</b>${esc(p.value_note || '')}</div>
          ${more ? `<a class="pc-more" href="${more}" target="_blank" rel="noopener" title="打开产品页 / 信息来源 ↗">🔗 信息来源 / 了解更多 ↗</a>` : ''}
        </div>
      </div>`;
    }).join('');
    html += `<section class="cat-block">
      <div class="cat-head"><h3>${esc(cat.name)}</h3><span class="cat-n">${list.length} 项</span></div>
      <p class="cat-desc">${esc(cat.desc || '')}</p>
      <div class="prod-grid">${cards}</div>
    </section>`;
  });
  wrap.innerHTML = html || '<div class="news-empty">该筛选条件下暂无产品，试试放宽预算或品类。</div>';
}

function renderConsumer(data) {
  CONS_DATA = data.consumer || { summary: '', price_bands: [], min_spec_advice: [], categories: [], products: [] };
  const sum = document.getElementById('consSummary');
  if (sum) sum.textContent = CONS_DATA.summary || '';

  // 价位档速查
  const bandsEl = document.getElementById('consBands');
  if (bandsEl) {
    const countBy = {};
    (CONS_DATA.products || []).forEach(p => { countBy[p.band] = (countBy[p.band] || 0) + 1; });
    bandsEl.innerHTML = (CONS_DATA.price_bands || []).map(b => `
      <div class="band-card static">
        <div class="bc-name">${esc(b.name)}</div>
        <div class="bc-range">${esc(b.range)}</div>
        <div class="bc-do">${esc(b.can_do)}</div>
        <div class="bc-note">${esc(b.note || '')}</div>
        <div class="bc-foot"><span class="bc-n">${countBy[b.id] || 0} 款</span></div>
      </div>`).join('');
  }

  // 本地模型配置建议
  const adv = document.getElementById('consAdvice');
  if (adv) adv.innerHTML = (CONS_DATA.min_spec_advice || []).map(x => `<li>${esc(x)}</li>`).join('');

  renderConsumerGrid();

  // 算力速查表
  const cmp = document.getElementById('consCompare');
  if (cmp) {
    let h = '<table><thead><tr><th>品类</th><th>厂商</th><th>产品</th><th>参考价</th><th>NPU / AI 算力</th><th>关键配置</th><th>预算档</th></tr></thead><tbody>';
    (CONS_DATA.products || []).forEach(p => {
      const key = (p.specs && (p.specs['内存'] || p.specs['显存'] || p.specs['SoC'])) || '—';
      h += `<tr><td>${esc((CONS_DATA.categories.find(c => c.id === p.cat) || {}).name || p.cat)}</td>
        <td>${esc(p.vendor)}</td><td><b>${esc(p.name)}</b></td>
        <td class="mini">${esc(p.price)}</td><td>${esc(p.npu || '—')}</td>
        <td>${esc(key)}</td><td>${esc(p.band || '—')}</td></tr>`;
    });
    h += '</tbody></table>';
    cmp.innerHTML = h;
  }
}

/* ============ 全站页脚：数据来源 ============ */
function injectSiteFooter(data) {
  if (document.getElementById('siteFooter')) return;
  const main = document.querySelector('main');
  if (!main) return;
  const div = document.createElement('div');
  div.id = 'siteFooter';
  div.className = 'site-footer';
  div.innerHTML = `
    <div class="sf-ttl">📡 数据来源与更新说明</div>
    <div class="sf-links">
      <b>常用入口：</b>
      <a href="https://finance.sina.com.cn/" target="_blank" rel="noopener">新浪财经 ↗</a>
      <a href="https://cn.investing.com/" target="_blank" rel="noopener">英为财情 Investing ↗</a>
      <a href="https://finance.yahoo.com/" target="_blank" rel="noopener">Yahoo Finance ↗</a>
      <a href="https://www.chinabond.com.cn/" target="_blank" rel="noopener">中国债券信息网 ↗</a>
      <a href="https://www.reuters.com/technology/" target="_blank" rel="noopener">Reuters ↗</a>
      <a href="https://www.bloomberg.com/technology" target="_blank" rel="noopener">Bloomberg ↗</a>
      <a href="https://semiengineering.com/" target="_blank" rel="noopener">SemiEngineering ↗</a>
      <a href="https://www.nikkei.com/" target="_blank" rel="noopener">日经 ↗</a>
      <a href="https://news.google.com/" target="_blank" rel="noopener">Google News ↗</a>
    </div>
    <div class="sf-grid">
      <div class="sf-item"><b>宏观与市场指标</b>
        <span>各国统计局与央行（<a href="https://www.stats.gov.cn/" target="_blank" rel="noopener">国家统计局 ↗</a> / <a href="https://www.bea.gov/" target="_blank" rel="noopener">BEA ↗</a> / <a href="https://www.esri.cao.go.jp/index.shtml" target="_blank" rel="noopener">日本内阁府 ↗</a> / <a href="https://ec.europa.eu/eurostat" target="_blank" rel="noopener">Eurostat ↗</a>）、交易所收盘数据；行情参考新浪财经、英为财情。宏观表格中 GDP 数值与收益率/股指名称均可点击跳转官方或行情来源。</span></div>
      <div class="sf-item"><b>新闻动态</b>
        <span>每条新闻下方的「来源」为可点击链接（Reuters / Bloomberg / 官方 IR / 新浪科技 / 集微网等），证券代码可点击查看行情；数据日期 ${esc(data.last_updated || '—')} 起为每日定时抓取的真实值。</span></div>
      <div class="sf-item"><b>产品 / 模型 / 消费硬件库</b>
        <span>综合厂商官方发布（GTC / Computex / 各家发布会）、官方 IR 披露与公开评测整理；每张产品/模型卡片底部提供「🔗 信息来源 / 了解更多 ↗」链接，可直达厂商页面或行情页。消费硬件价格为电商参考价，随促销波动。</span></div>
      <div class="sf-item"><b>更新机制</b>
        <span>每日 09:00（北京时间）定时抓取过去 24 小时增量并自动并入；本地服务模式下页面每 60 秒自动轮询，点击右上角「↻ 刷新」可立即手动更新。</span></div>
    </div>
    <div class="sf-disclaim">本看板为研究与信息整理用途，不构成投资建议；真实行情与公告请以交易所、公司 IR 与权威财经媒体为准。</div>`;
  main.appendChild(div);
}

/* ============ 总调度 ============ */
async function refresh() {
  const { data } = await getDATA();
  if (!data) {
    const el = document.getElementById('summaryText');
    if (el) el.textContent = '加载失败：请通过本地服务打开，或确认 data/data.js 已生成。';
    return false;
  }
  renderTicker(data);
  const page = document.body.dataset.page || 'home';
  if (page === 'home') renderHome(data);
  else if (page === 'macro') renderMacro(data);
  else if (page === 'hardware') renderHardware(data);
  else if (page === 'models') renderModels(data);
  else if (page === 'software') renderSoftware(data);
  else if (page === 'chain') renderChain(data);
  else if (page === 'consumer') renderConsumer(data);
  // about 页为静态内容，无需 JS 渲染
  const lu = document.getElementById('lastUpdated');
  if (lu) lu.textContent = '数据日期：' + data.last_updated;
  injectSiteFooter(data);
  return true;
}

const rb = document.getElementById('refreshBtn');
if (rb) rb.addEventListener('click', async () => {
  if (rb.disabled) return;
  rb.disabled = true;
  rb.classList.add('refreshing');
  const old = '↻ 刷新';
  rb.textContent = '⟳ 刷新中…';
  const ok = await refresh();
  rb.classList.remove('refreshing');
  rb.disabled = false;
  if (ok) {
    rb.textContent = '✓ 已刷新 ' + new Date().toTimeString().slice(0, 8);
    setTimeout(() => { rb.textContent = old; }, 4000);
  } else {
    rb.textContent = '✗ 刷新失败';
    setTimeout(() => { rb.textContent = old; }, 4000);
  }
});
window.addEventListener('resize', () => Object.values(charts).forEach(c => c.resize()));

// 硬件页：地区筛选
const regionFilter = document.getElementById('regionFilter');
if (regionFilter) {
  regionFilter.addEventListener('click', e => {
    const b = e.target.closest('.flt');
    if (!b) return;
    currentRegion = b.dataset.r;
    [...regionFilter.children].forEach(x => x.classList.toggle('active', x === b));
    if (document.body.dataset.page === 'hardware') renderHardwareGrid();
  });
}

// 消费页：品类 + 预算筛选
const consFilters = document.getElementById('consFilters');
if (consFilters) {
  consFilters.addEventListener('click', e => {
    const b = e.target.closest('.flt');
    if (!b) return;
    if (b.dataset.c !== undefined) consCat = b.dataset.c;
    if (b.dataset.b !== undefined) consBand = b.dataset.b;
    // 同组按钮互斥高亮
    const group = b.dataset.c !== undefined ? 'c' : 'b';
    [...consFilters.querySelectorAll('.flt')].forEach(x => {
      if ((group === 'c' && x.dataset.c !== undefined) || (group === 'b' && x.dataset.b !== undefined))
        x.classList.toggle('active', x === b);
    });
    renderConsumerGrid();
  });
}

refresh();
setInterval(refresh, REFRESH_MS);
