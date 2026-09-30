#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全球 AI 产业链每日监控 —— 本地服务 + 自动刷新
- 托管 dashboard/ 下的静态文件（index.html / app.js / style.css / assets/）
- 提供 /api/data 端点：聚合 seed.json（近一月演示种子）与真实每日报告
  ai_daily_report_YYYY-MM-DD.json（工作区根目录），将真实值覆盖/扩展到时序。
- 页面每 60s 轮询 /api/data 自动刷新；每日定时任务产出的 JSON 会被自动并入。
"""
import json, os, re, glob, datetime as dt
from http.server import HTTPServer, SimpleHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_ROOT = os.path.dirname(HERE)          # 工作区根目录（报告 JSON 所在）
SEED_PATH = os.path.join(HERE, "data", "seed.json")
NEWS_PATH = os.path.join(HERE, "data", "news.json")
HW_PATH = os.path.join(HERE, "data", "hardware_products.json")
MODELS_PATH = os.path.join(HERE, "data", "models_db.json")
SOFT_PATH = os.path.join(HERE, "data", "software_companies.json")
CHAIN_PATH = os.path.join(HERE, "data", "chain.json")
CONS_PATH = os.path.join(HERE, "data", "consumer_products.json")
SNAPSHOT_PATH = os.path.join(HERE, "data", "latest_snapshot.json")
DATA_JS_PATH = os.path.join(HERE, "data", "data.js")
PORT = int(os.environ.get("PORT", "8777"))


def write_static(payload):
    """写出静态快照（JSON）与内嵌数据（JS），供 file:// 直接打开或静态托管使用。"""
    try:
        with open(SNAPSHOT_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        with open(DATA_JS_PATH, "w", encoding="utf-8") as f:
            f.write("window.__DATA__ = " + json.dumps(payload, ensure_ascii=False) + ";")
    except Exception:
        pass

INDEX_KEYS = {                                  # 股指 key -> 报告中文名
    "NASDAQ100": "纳斯达克100",
    "SP500": "标普500",
    "NIKKEI225": "日经225",
    "STOXX50": "欧洲斯托克50",
    "CSI300": "沪深300",
}
YIELD_KEYS = {"US10Y": "US10Y", "JP10Y": "JP10Y", "DE10Y": "DE10Y", "CN10Y": "CN10Y"}

# 中国宏观兜底（若当日报告未含中国，保证 GDP 表始终展示）
CHINA_GDP_FALLBACK = {
    "region": "中国",
    "gdp": "2026Q2 GDP 同比约+5.0%（国家统计局初值，2026-07发布；环比约+1.1%）；上半年累计同比约+5.2%",
}


def _num(s):
    s = s.replace(",", "").replace("−", "-").replace("＋", "+").strip()
    m = re.search(r"[-+]?\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None


def parse_report(path):
    """解析一份每日报告 JSON，返回 {date, stocks:{ticker:price}, yields:{k:val}, indices:{k:val}} """
    try:
        with open(path, "r", encoding="utf-8") as f:
            d = json.load(f)
    except Exception:
        return None
    date = d.get("report_date") or os.path.basename(path).replace("ai_daily_report_", "").replace(".json", "")
    stocks, yields, indices = {}, {}, {}
    pcts = {}  # ticker -> 报告文本中的涨跌幅（%，带符号）
    for grp in ("hardware", "software_cloud"):
        for c in d.get("ai_companies", {}).get(grp, []):
            sp = c.get("stock_performance", "")
            m = re.search(r"\$\s*([\d,]+(?:\.\d+)?)", sp) or re.search(r"([\d,]+(?:\.\d+)?)\s*美元", sp)
            if m:
                stocks[c["ticker"]] = float(m.group(1).replace(",", ""))
            mp = re.search(r"([+\-−]\d+(?:\.\d+)?)\s*%", sp)
            if mp:
                try:
                    pcts[c["ticker"]] = float(mp.group(1).replace("−", "-"))
                except ValueError:
                    pass
    for m in d.get("macro_market", []):
        by = m.get("bond_yield_10y", "")
        for yk in YIELD_KEYS:
            mm = re.search(yk + r"\s*([\d.]+)", by)
            if mm:
                yields[yk] = float(mm.group(1))
        mi = m.get("main_index", "")
        for ik, zh in INDEX_KEYS.items():
            mm = re.search(zh + r"\s*([\d,]+(?:\.\d+)?)\s*([+\-−]?\d+(?:\.\d+)?)\s*%", mi)
            if mm:
                indices[ik] = float(mm.group(1).replace(",", ""))
    return {"date": date, "stocks": stocks, "pcts": pcts, "yields": yields, "indices": indices}


def load_real():
    out = {}
    for p in glob.glob(os.path.join(WORKSPACE_ROOT, "ai_daily_report_*.json")):
        r = parse_report(p)
        if r:
            out[r["date"]] = r
    return out


def load_news():
    """读取 AI 硬件 / 模型两条业务线的新闻增量存档，按日期倒序并去重。"""
    try:
        with open(NEWS_PATH, "r", encoding="utf-8") as f:
            d = json.load(f)
    except Exception:
        return {"hardware": [], "model": [], "updated": ""}

    def clean(items):
        seen, out = set(), []
        for it in items or []:
            key = (it.get("date", ""), it.get("title", ""))
            if key in seen:
                continue
            seen.add(key)
            out.append({
                "date": it.get("date", ""),
                "tag": it.get("tag", "综合"),
                "title": it.get("title", ""),
                "detail": it.get("detail", ""),
                "source": it.get("source", ""),
                "ticker": it.get("ticker", ""),
                "org": it.get("org", ""),
            })
        out.sort(key=lambda x: x["date"], reverse=True)
        return out

    return {
        "hardware": clean(d.get("hardware")),
        "model": clean(d.get("model")),
        "updated": d.get("updated", ""),
    }


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def build_payload():
    with open(SEED_PATH, "r", encoding="utf-8") as f:
        seed = json.load(f)
    dates = list(seed["dates"])
    series = seed["series"]
    real = load_real()

    # 真实报告覆盖映射
    override = {}  # key -> {date: value}
    extra_dates = set()
    for date, r in real.items():
        if date > dates[-1]:
            extra_dates.add(date)
        for k, v in {**r["stocks"], **r["yields"], **r["indices"]}.items():
            override.setdefault(k, {})[date] = v
    if extra_dates:
        dates = dates + sorted(extra_dates)

    real_dates = set(real.keys())

    def align(key, base_vals):
        ov = override.get(key, {})
        vals, flags = [], []
        last = base_vals[-1] if base_vals else 0
        for i, dt_ in enumerate(dates):
            if dt_ in ov:
                v, fl = ov[dt_], True
            elif i < len(base_vals):
                v, fl = base_vals[i], (dt_ == dates[-1] and dt_ in real_dates) or (dt_ == seed["end_date"])
                # seed 末点(2026-09-25)即真实快照，标记为真实
                if dt_ == seed["end_date"]:
                    fl = True
            else:
                v, fl = last, False
            last = v
            vals.append(round(v, 4))
            flags.append(fl)
        return vals, flags

    def change_of(vals):
        if len(vals) >= 2 and vals[-2]:
            return round((vals[-1] - vals[-2]) / vals[-2] * 100, 2)
        return None

    macro_yields, macro_indices, stocks = [], [], []
    for key, item in series.items():
        vals, flags = align(key, item["values"])
        entry = {
            "key": key, "label": item["label"], "values": vals, "real_flags": flags,
            "last": vals[-1], "change": change_of(vals),
            "today_change": item.get("today_change"),
        }
        if item["cat"] == "yield":
            macro_yields.append(entry)
        elif item["cat"] == "index":
            macro_indices.append(entry)
        elif item["cat"] == "stock":
            entry["ticker"] = item.get("ticker", key)
            stocks.append(entry)

    last_updated = max(real.keys()) if real else seed["end_date"]

    # 最新报告文本中的涨跌幅覆盖到个股（报告未给出价格时 change 仍真实可用）
    latest = real.get(last_updated) or (real[max(real)] if real else None)
    lp = (latest or {}).get("pcts") or {}
    for st in stocks:
        if st["ticker"] in lp:
            st["change"] = lp[st["ticker"]]
            st["today_change"] = f"{lp[st['ticker']]:+.2f}%"

    # 最新报告的摘要与 GDP 行（用于宏观表格）
    exec_summary, gdp_rows = "", []
    if latest:
        rp = [p for p in glob.glob(os.path.join(WORKSPACE_ROOT, "ai_daily_report_*.json"))
              if last_updated in p]
        try:
            with open(rp[0] if rp else "", "r", encoding="utf-8") as f:
                rd = json.load(f)
            exec_summary = rd.get("daily_executive_summary", "")
            gdp_rows = [{"region": m.get("region", ""), "gdp": m.get("gdp_data", "")}
                        for m in rd.get("macro_market", [])]
            # 兜底：保证中国行始终存在
            if not any(r.get("region", "").startswith("中国") for r in gdp_rows):
                gdp_rows.append(CHINA_GDP_FALLBACK)
        except Exception:
            pass

    news = load_news()
    hw = load_json(HW_PATH, {"updated": "", "categories": []})
    models = load_json(MODELS_PATH, {"updated": "", "models": []})
    soft = load_json(SOFT_PATH, {"updated": "", "companies": []})
    chain = load_json(CHAIN_PATH, {"updated": "", "segments": []})

    # 中国宏观补充指标（USDCNY/LPR/MLF/M2/社融）：优先用最新报告的，否则用种子参考值
    china_macro = seed.get("china_macro", {"note": "", "items": []})
    if latest and rp:
        try:
            with open(rp[0], "r", encoding="utf-8") as f:
                rd = json.load(f)
            if rd.get("china_macro"):
                china_macro = rd["china_macro"]
        except Exception:
            pass

    return {
        "last_updated": last_updated,
        "seed_end": seed["end_date"],
        "dates": dates,
        "macro": {"yields": macro_yields, "indices": macro_indices},
        "stocks": stocks,
        "real_dates": sorted(real_dates),
        "exec_summary": exec_summary,
        "gdp_rows": gdp_rows,
        "hardware_news": news["hardware"],
        "model_news": news["model"],
        "news_updated": news["updated"],
        "hardware_products": hw,
        "models_db": models,
        "software_companies": soft,
        "chain": chain,
        "china_macro": china_macro,
        "consumer": load_json(CONS_PATH, {"updated": "", "summary": "", "price_bands": [], "min_spec_advice": [], "categories": [], "products": []}),
        "data_note": ("曲线含约一年演示种子数据（%s ~ %s），自 %s 起为真实抓取值；"
                      "支持近一月/近一季/近一年三档切换，后续每日定时任务产出的报告将自动并入并延伸曲线。"
                      % (dates[0], seed["end_date"], seed["end_date"])),
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def do_GET(self):
        if self.path.startswith("/api/data"):
            try:
                payload = build_payload()
                # 写静态快照 + 内嵌 JS，供 file:// 直接打开或静态托管回退使用
                write_static(payload)
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode("utf-8"))
            return
        # 静态文件：交由父类处理（不要重复发送状态行）
        super().do_GET()

    def log_message(self, fmt, *args):
        pass  # 静默日志


if __name__ == "__main__":
    # 启动即生成静态快照与内嵌 JS，便于 file:// 直接打开或静态托管读取
    try:
        write_static(build_payload())
    except Exception as e:
        print("static init skipped:", e)
    print("Serving dashboard at http://127.0.0.1:%d  (Ctrl+C to stop)" % PORT)
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
