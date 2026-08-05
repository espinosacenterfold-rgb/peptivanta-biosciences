# Peptivanta Biosciences 独立站源码

面向专业客户的多语言 B2B 多肽产品展示与询盘网站。网站目前支持英语、
葡萄牙语、西班牙语、法语和中文，默认语言为英语。

## 最常修改：WhatsApp 和企业邮箱

所有联系方式都集中在根目录的 `site.config.ts`。以后不要在页面代码中
逐个查找号码或邮箱，只修改这个配置文件即可。

### 修改 WhatsApp

找到下面这一行：

```ts
whatsappNumber: "19863059927",
```

把引号内的数字替换为新号码。号码必须包含国家/地区代码，并且只填写数字：

```ts
// 美国或加拿大号码示例
whatsappNumber: "19863059927",

// 中国大陆号码示例
whatsappNumber: "8613812345678",
```

不要填写 `+`、空格、括号或短横线。修改后，产品询价按钮、询盘表单和右下角
WhatsApp 按钮会一起更新。

### 修改企业邮箱

找到下面这一行：

```ts
salesEmail: "sales@peptivanta.com",
```

替换为准备好的企业邮箱：

```ts
salesEmail: "sales@yourdomain.com",
```

邮箱留空时网站会自动隐藏邮箱，不会显示空白地址。

### 修改公司资料

同一个文件中还可以修改：

```ts
operatingRegion: "Hong Kong SAR · Sales & Export Coordination",
registeredAddress: "经过核实的注册地址",
responseTime: "Within one business day",
```

注册地址留空时网站会自动隐藏。公司地址、认证、资质和工厂信息应当与可提供的
证明文件保持一致。

## 常用文件

- `site.config.ts` — WhatsApp、邮箱、品牌和公司资料
- `app/page.tsx` — 首页内容、多语言文字和产品目录
- `app/globals.css` — 字体、颜色、版式和手机端样式
- `app/ledger.css` — 履约台账的表格、提示和状态样式
- `app/api/fulfillment-cases/generator.ts` — 每日订单结构、金额和状态推进规则
- `public/images` — 网站照片素材
- `app/privacy`、`app/terms`、`app/compliance` — 合规与法律页面

## 本地预览

第一次下载源码后：

```bash
npm install
npm run dev
```

修改完成后进行检查：

```bash
npm run build
```

## 部署到 Cloudflare Workers

仓库已经包含 `wrangler.jsonc` 和 Cloudflare 构建命令。当前配置对应
`peptivanta.com` 所在的 Cloudflare 账号。

在当前账号连接 GitHub 时使用：

```text
构建命令：npm run build
部署命令：npx wrangler deploy -c dist/server/wrangler.json
根目录：留空
生产分支：main
```

### 复制到另一个 Cloudflare 账号

D1 数据库 ID 属于创建它的 Cloudflare 账号，不能跨账号共用。朋友部署前必须：

1. 复制本私人仓库，或取得本仓库的私人访问权限。
2. 在朋友自己的 Cloudflare 账号创建一个新的 D1 数据库。
3. 打开 `wrangler.jsonc`：
   - 把 `name` 改成朋友专用的 Worker 名称；
   - 把 `database_name` 改成新数据库名称；
   - 把 `database_id` 改成新数据库 ID。
4. 在 `site.config.ts` 修改朋友自己的 WhatsApp 和邮箱。
5. 再按上面的构建、部署命令连接 GitHub。

第一次访问履约页面时，程序会在新 D1 中建立最新 300 条示例履约台账。
之后每天按日期稳定追加 10–30 条记录，已有记录不会重新随机变化；新增完成后会
自动删除超出 500 条保留上限的最旧模拟记录，避免模拟表持续膨胀。公开页面默认
展示最新 300 条；真实订单使用独立
数据表，不参与自动清理；
状态根据真实经过的工作日从订单确认、文件审核、生产、质检、包装、发运推进到
送达。页面必须保留“示例履约流程数据”的提示，不应把系统生成数据描述为真实
客户成交证明。

> 不要把 `peptivanta.com` 当前的 D1 ID直接用于朋友的 Cloudflare 账号，
> 否则部署会因账号不匹配而失败。

### 域名

Worker 部署成功后，在 Cloudflare 中为它添加自定义域名。根域名和 `www`
建议只保留一个正式入口，另一个使用重定向规则跳转。网站使用的 MX、SPF、
DKIM 等邮箱记录与 Worker 网站记录相互独立，不要在绑定网站时删除邮箱记录。

## 真实订单后台

后台地址：

```text
https://你的域名/admin/orders
```

后台用来登记真实订单并手动推进“订单已确认 → 文件审核中 → 生产中 → 质量检测 →
包装中 → 已发运 → 已送达”的状态。真实订单保存在
`manual_fulfillment_orders` 和 `manual_fulfillment_order_items` 表中；一个订单
可以包含多种产品与规格。每日模拟器只会维护
`fulfillment_cases` 表，绝不会覆盖、修改或删除后台录入的真实订单。

在 Cloudflare 中为每个 Worker 单独设置管理密钥：

```bash
npx wrangler secret put FULFILLMENT_ADMIN_KEY
```

请使用足够长的随机密钥，并且不要把真实密钥写入源码、`wrangler.jsonc`、README
或提交到 GitHub。朋友复制网站到自己的 Cloudflare 账号后，也必须设置他自己的
`FULFILLMENT_ADMIN_KEY`。

公开页面会把“已公开”的真实订单和模拟订单按订单日期合并，不再让新登记的真实
订单强制置顶。登记历史订单时，它会出现在对应历史日期的位置。页面默认展示 300 条，
并优先为已公开的真实订单保留展示位置。
在后台关闭“公开展示”只会将真实订单从公开页面隐藏，记录仍会保存在数据库中。

## 模拟订单控制台

控制台地址：

```text
https://你的域名/admin/generator
```

这个页面与真实订单后台使用不同的页面、API 和数据库表，只共享同一项管理密钥。
可以调整公开展示量、每日新增量、贴牌与大货目标占比、复购目标占比以及暂停/恢复
生成器。设置只影响之后新增或补齐的模拟订单，不会重新抽取已经存在的订单。

新模拟订单允许由 1–3 个报价表产品组成。复购记录必须指向一笔更早的可见订单，
继承相同国家和产品组合，并在公开页显示对应前单编号。大货仍受间隔规则限制，避免
短期内连续出现大量高额订单。模拟设置保存在
`fulfillment_generator_settings` 表；真实订单仍只保存在上述 manual 表中。

### 产品报价与数量折扣

后台产品下拉框和模拟履约记录共用 `lib/product-catalog.ts`。该文件当前对应
`PEPTIVANTA_2026_All_Languages_USD.xlsx` 中的 96 个 SKU，零售价单位为
USD/盒（每盒 10 瓶），不包含运费。

数量折扣和总额公式集中在 `lib/order-pricing.ts`。多产品订单按所有产品的总盒数
确定同一个阶梯折扣；运费不在后台登记，也不计入网站展示金额：

```text
全部产品零售价小计 - 总盒数阶梯折扣 + 贴牌/包装/检测费 - 额外减免 = 订单总额
```

不要直接在后台手填产品价格。需要更新报价时，应同步修改产品对应的 SKU、规格和
`retailUsdCents`，然后运行 `npm test`，确认后台、模拟订单和报价规则仍然一致。
折扣使用 basis points（基点）：例如 `500` 表示 5%，`4000` 表示 40%。

## 网站内容定位

网站采用专业客户询盘模式，不提供在线直接结账，也不在公开页面提供剂量、
注射方法、疾病治疗或个人医疗建议。

## 反爬与素材防盗链

源码中的 `worker/anti-scraping.ts` 提供基础保护：

- 保留 Google、Bing、OAI Search 等正常搜索流量；
- 拒绝常见训练型和批量采集爬虫；
- 阻止其他网站直接嵌入 COA 报告和工厂媒体；
- 原始报告文件不进入图片搜索和网页快照；
- 后台、API 和公开页面自动附加对应的机器人与防嵌入响应头。

User-Agent 可以被伪造，因此源码规则不能代替 Cloudflare 的网络检测。正式域名还应在
Cloudflare 的“安全设置”中开启免费的 **Bot Fight Mode**，并在
**AI Crawl Control** 中阻止 Training 类爬虫。不要用“禁用右键”或“禁止选择文字”
作为保护措施，这些方式容易绕过，也会影响正常客户浏览。
