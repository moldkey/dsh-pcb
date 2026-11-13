/**
 * dsh-pcb — PCB 工艺检查与报价参考
 */

export const name = "dsh-pcb";
export const inject = ["tools"];

const NL = String.fromCharCode(10);
const SITE = "https://deepseekbase.com/zh/tools/";
const TEXT_OUTPUT = {
  schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] },
  render: (_args, value) => [{ type: "text", text: (value && value.text) || "" }],
};

const FINISH = { hasl: "喷锡 HASL", enig: "沉金 ENIG", osp: "OSP", silver: "沉银" };
function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function f(x) { return (Math.round(x * 100) / 100).toString(); }

const TOOLS = {
  pcb_dfm: {
    description: "PCB DFM：线宽/间距、最小孔径、板边距离、层数与工艺能力检查",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        layers: { type: "number", description: "层数" },
        trace_mm: { type: "number", description: "最小线宽 mm" },
        space_mm: { type: "number", description: "最小间距 mm" },
        hole_mm: { type: "number", description: "最小孔径 mm" },
        edge_mm: { type: "number", description: "孔/铜到板边距离 mm（可选）" },
      },
      required: ["layers", "trace_mm", "space_mm", "hole_mm"],
    },
    run(args) {
      const L = n(args.layers, 2);
      const t = n(args.trace_mm, 0), s = n(args.space_mm, 0), h = n(args.hole_mm, 0);
      const lines = ["PCB DFM 检查", "=".repeat(52), "层数: " + L, "最小线宽: " + t + " mm", "最小间距: " + s + " mm", "最小孔径: " + h + " mm", ""];
      let pass = true;
      const rule = (name, ok, detail) => { if (!ok) pass = false; lines.push((ok ? "PASS " : "FAIL ") + name + " — " + detail); };
      const stdTrace = L <= 2 ? 0.15 : 0.1;
      rule("线宽 ≥ 常规能力", t >= stdTrace, "常规 " + stdTrace + " mm，更细需加价");
      rule("间距 ≥ 常规能力", s >= stdTrace, "常规 " + stdTrace + " mm");
      rule("孔径 ≥ 常规能力", h >= 0.2, "常规 0.2 mm，≤0.15 需激光钻");
      if (args.edge_mm != null) rule("板边距离 ≥ 0.3mm", n(args.edge_mm, 0) >= 0.3, "实际 " + n(args.edge_mm, 0) + " mm");
      lines.push("");
      lines.push(pass ? "结论：常规工艺可做" : "结论：超出常规能力，需确认板厂工艺或加价");
      lines.push("能力值随板厂不同，下单前以板厂工艺能力表为准。");
      lines.push("");
      lines.push("更多工具：" + SITE);
      return lines.join(NL);
    },
  },
  pcb_quote: {
    description: "PCB 报价参考：按尺寸、层数、数量、表面处理估算单价与成本项",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        width_cm: { type: "number", description: "板宽 cm" },
        height_cm: { type: "number", description: "板高 cm" },
        layers: { type: "number", description: "层数" },
        qty: { type: "number", description: "数量" },
        finish: { type: "string", enum: ["hasl", "enig", "osp", "silver"], description: "表面处理" },
      },
      required: ["width_cm", "height_cm", "layers", "qty"],
    },
    run(args) {
      const w = n(args.width_cm, 0), h = n(args.height_cm, 0);
      const L = n(args.layers, 2), q = n(args.qty, 1);
      if (w <= 0 || h <= 0 || q <= 0) throw new Error("尺寸与数量必须大于 0");
      const area = w * h;
      const layerFactor = L <= 2 ? 1 : L <= 4 ? 2.2 : L <= 6 ? 4 : 7;
      const fin = String(args.finish || "hasl");
      const finFactor = fin === "enig" ? 1.6 : fin === "silver" ? 2.0 : 1;
      const setup = 80; // 工程费
      const unit = Math.max(1.2, (area * 0.08 * layerFactor + 0.8) * finFactor);
      const total = setup + unit * q;
      const lines = ["PCB 报价参考", "=".repeat(52), "尺寸: " + w + "×" + h + " cm（" + f(area) + " cm²）", "层数: " + L,
        "数量: " + q, "表面处理: " + (FINISH[fin] || fin), "", "工程费: " + setup + " 元", "单价估算: " + f(unit) + " 元/片",
        "总价估算: " + f(total) + " 元", "", "价格为粗略参考（不含税/运费/加急），以板厂报价为准。", "",
        "更多工具：" + SITE];
      return lines.join(NL);
    },
  },
};

export function apply(ctx, config) {
  void config;
  for (const name of Object.keys(TOOLS)) {
    const t = TOOLS[name];
    ctx.tools.register({
      name: name,
      description: t.description,
      parameters: t.parameters,
      output: TEXT_OUTPUT,
      async execute(args) { try { return { text: t.run(args || {}) }; } catch (e) { return { text: "处理失败: " + String((e && e.message) || e) }; } },
    });
  }
}
