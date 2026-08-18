/**
 * ================================================================
 * Peptivanta 网站联系信息配置
 * ================================================================
 *
 * 后续需要更换 WhatsApp、企业邮箱或公司资料时，只修改本文件即可。
 * 首页产品按钮、右下角 WhatsApp 按钮、询盘表单和网站底部联系信息
 * 都会自动读取这里的内容，不需要到 app/page.tsx 里逐个修改。
 *
 * 修改完成后请保存文件，并运行 `npm run build` 检查网站。
 */
export const siteConfig = {
  // 网站左上角显示的简短品牌名。
  brandName: "Peptivanta",

  // 网站页脚、法律页面等位置使用的完整品牌名。
  fullBrandName: "Peptivanta Biosciences",

  // 品牌英文标语；如果以后更换标语，只修改引号内的文字。
  tagline: "Precision in every batch",

  /**
   * WhatsApp 号码修改说明：
   * 1. 必须包含国家/地区代码；
   * 2. 只填写数字，不要填写 +、空格、短横线或括号；
   * 3. 美国/加拿大示例：19863059927；
   * 4. 中国大陆示例：8613812345678；
   * 5. 如果暂时不使用 WhatsApp，填写空字符串：""。
   *
   * 网站会自动生成 wa.me 链接，并自动带上客户选择的产品和询盘内容。
   */
  whatsappNumber: "+85246328271",

  /**
   * 企业邮箱修改说明：
   * 直接把引号内替换为你的企业邮箱，例如：
   * salesEmail: "sales@peptivanta.com",
   *
   * 目前留空，所以网站不会显示邮箱地址。
   * 企业邮箱准备好后，只需要修改下面这一行。
   */
  salesEmail: "sales@peptivanta.com",

  // 公司运营地区。请只填写能够由公司资料支持的真实信息。
  operatingRegion: "Hong Kong SAR · Sales & Export Coordination",

  /**
   * 公司注册地址。
   * 留空时网站自动隐藏该项；确认地址和公司文件一致后再填写。
   */
  registeredAddress: "",

  // 对外承诺的正常回复时间，会出现在品牌/服务信息中。
  responseTime: "Within one business day",
} as const;

/**
 * 以下函数负责把号码和询盘内容组合成 WhatsApp 链接。
 * 一般不需要修改此处；更换号码只改上面的 whatsappNumber。
 */
export function createWhatsAppUrl(message: string) {
  // 即使误输入了空格或短横线，也会在生成链接前自动清除非数字字符。
  const number = siteConfig.whatsappNumber.replace(/\D/g, "");

  // 没有填写号码时，按钮回到站内询盘区，避免跳转到无效链接。
  return number
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : "#inquiry";
}
