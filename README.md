# 留学身份时间线（visa-helper）

给在美中国留学生的 OPT / STEM OPT / H-1B 身份助手：

- **身份时间线**：OPT 申请窗口、工卡到期、STEM OPT 申请窗口、60 天宽限期、Cap-gap、下一次抽签
- **剩余天数**：身份剩余天数、失业天数余量（OPT 90 天 / 含 STEM 150 天），超限醒目提醒
- **H-1B 中签率估算**：按 2026 年起的工资等级加权抽签，给出单次和累计概率
- **导出到日历**：一键生成 .ics，关键日期提前 7 天提醒
- **政策动态**：每条附官方或权威来源

数据只保存在用户自己的浏览器（localStorage），不上传。

> 仅供参考，不构成法律意见，请以 USCIS / 学校 DSO 为准。

## 本地运行

纯静态网页，无需构建：

```
python -m http.server 5173
```

然后打开 http://localhost:5173

## 测试

```
npm test
```

规则引擎（`js/rules.js`）、中签率（`js/lottery.js`）、日历导出（`js/ics.js`）都有测试，规则出处写在代码注释里。

## 维护

- 政策动态：编辑 `js/policy.js`，新条目加在最上面，并更新 `POLICY_UPDATED`
- 付费意向收集：在 `js/config.js` 填入 Formspree 表单地址
