#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成种子时序数据 seed.json（约一年，250 个交易日）。
末点 = 2026-09-25 真实抓取快照值；此前通过反向随机游走(确定性)回溯约 250 个交易日，
用于在没有真实历史累积前即可展示"近一月 / 近一季 / 近一年"三档走势曲线。
真实每日报告会覆盖/扩展对应日期。前端按周期(1m/3m/1y)对 dates/values 截断渲染。
"""
import json, random, datetime as dt

END_DATE = dt.date(2026, 9, 25)
N = 250  # 约一年（250 个交易日）

# 末点真实快照（来自 ai_daily_report_2026-09-25.json）
SNAPSHOT = {
    # 国债收益率（%，今日涨跌以 bp 计）
    "US10Y":   {"cat": "yield", "label": "美10Y(%)",  "end": 5.207, "vol": 0.012, "chg": "+8.5bp"},
    "JP10Y":   {"cat": "yield", "label": "日10Y(%)",  "end": 3.11,  "vol": 0.013, "chg": "+3.5bp"},
    "DE10Y":   {"cat": "yield", "label": "德10Y(%)",  "end": 3.60,  "vol": 0.012, "chg": "+5.0bp"},
    # 核心股指（今日涨跌幅 %）
    "NASDAQ100": {"cat": "index", "label": "纳斯达克100", "end": 30478.86, "vol": 0.011, "chg": "+0.03%"},
    "SP500":     {"cat": "index", "label": "标普500",     "end": 7704.13,  "vol": 0.009, "chg": "-0.02%"},
    "NIKKEI225": {"cat": "index", "label": "日经225",     "end": 66364.20, "vol": 0.012, "chg": "+1.30%"},
    "STOXX50":   {"cat": "index", "label": "欧洲斯托克50", "end": 6272.50,  "vol": 0.010, "chg": "-0.43%"},
    # AI 硬件个股（收盘价，今日涨跌幅 %）
    "NVDA": {"cat": "stock", "label": "NVIDIA", "ticker": "NVDA", "end": 224.58,  "vol": 0.024, "chg": "-0.41%"},
    "TSM":  {"cat": "stock", "label": "TSMC",   "ticker": "TSM",  "end": 446.30,  "vol": 0.020, "chg": "+1.00%"},
    "ASML": {"cat": "stock", "label": "ASML",   "ticker": "ASML", "end": 1713.41, "vol": 0.022, "chg": "-1.80%"},
    "AVGO": {"cat": "stock", "label": "Broadcom","ticker": "AVGO", "end": 348.19,  "vol": 0.023, "chg": "-1.90%"},
    "AMD":  {"cat": "stock", "label": "AMD",    "ticker": "AMD",  "end": 629.26,  "vol": 0.028, "chg": "+2.40%"},
    "MU":   {"cat": "stock", "label": "Micron", "ticker": "MU",   "end": 1080.53, "vol": 0.026, "chg": "+0.81%"},
    # AI 软件/云个股
    "MSFT":  {"cat": "stock", "label": "Microsoft","ticker": "MSFT", "end": 497.93, "vol": 0.018, "chg": "-0.53%"},
    "GOOGL": {"cat": "stock", "label": "Alphabet", "ticker": "GOOGL","end": 339.01, "vol": 0.019, "chg": "+1.20%"},
    "META":  {"cat": "stock", "label": "Meta",    "ticker": "META", "end": 777.59, "vol": 0.025, "chg": "+4.50%"},
    "AMZN":  {"cat": "stock", "label": "Amazon",  "ticker": "AMZN", "end": 249.38, "vol": 0.017, "chg": "+0.04%"},
    "AAPL":  {"cat": "stock", "label": "Apple",   "ticker": "AAPL", "end": 335.92, "vol": 0.016, "chg": "-0.33%"},
}

rng = random.Random(20260925)

# 回溯 N 个交易日（跳过周末），末点为 END_DATE
def trading_dates(end, n):
    out = []
    d = end
    while len(out) < n:
        if d.weekday() < 5:  # 周一~周五
            out.append(d)
        d -= dt.timedelta(days=1)
    return out[::-1]

dates = [d.isoformat() for d in trading_dates(END_DATE, N)]

series = {}
for key, cfg in SNAPSHOT.items():
    vals = [0.0] * N
    vals[N - 1] = cfg["end"]
    for i in range(N - 2, -1, -1):
        step = rng.gauss(0, cfg["vol"])
        # 限制单步幅度，避免极端跳变
        step = max(-0.06, min(0.06, step))
        vals[i] = vals[i + 1] / (1 + step)
    item = {
        "cat": cfg["cat"],
        "label": cfg["label"],
        "values": [round(v, 4) for v in vals],
        "today_change": cfg["chg"],
    }
    if cfg["cat"] == "stock":
        item["ticker"] = cfg["ticker"]
    series[key] = item

out = {
    "end_date": END_DATE.isoformat(),
    "dates": dates,
    "note": "seed",
    "series": series,
}

path = "C:/Users/MXK-1107/WorkBuddy/全球AI硬件与软件状况信息网站/dashboard/data/seed.json"
with open(path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print("wrote", path, "dates:", dates[0], "->", dates[-1], "series:", len(series))
