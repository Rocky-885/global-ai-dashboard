# Global AI Hardware & Software Dashboard

每日更新的「全球 AI 产业链 & 发达国家宏观」监控看板（新浪财经风格）。

## 结构
- `dashboard/index.html` 首页/总览
- `dashboard/macro.html` 宏观市场（GDP / 收益率 / 股指 / 央行）
- `dashboard/hardware.html` AI 硬件产品与技术（支持地区筛选）
- `dashboard/consumer.html` 消费者级 AI 硬件
- `dashboard/models.html` AI 模型发布
- `dashboard/software.html` AI 软件云
- `dashboard/chain.html` 产业链全景
- `dashboard/about.html` 数据说明

## 运行
```bash
cd dashboard
PORT=8793 python server.py   # 默认 8777
```
浏览器打开 http://127.0.0.1:<PORT>

## 约定
- 涨=红、跌=绿；币种 ¥。
- 数据每日 09:00 抓取；前端 60s 轮询自动刷新。
- 取数优先级：`/api/data` → `window.__DATA__` → `latest_snapshot.json`。
