import type { Order } from "./sales-data";

export const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
export const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0);
export function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 0;
  const p = (sorted.length - 1) * q;
  const lo = Math.floor(p);
  const hi = Math.ceil(p);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (p - lo);
}
export function sd(a: number[]) {
  const m = mean(a);
  return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / Math.max(1, a.length - 1));
}
export function pearson(x: number[], y: number[]) {
  const mx = mean(x),
    my = mean(y);
  let n = 0,
    dx = 0,
    dy = 0;
  for (let i = 0; i < x.length; i++) {
    n += (x[i]! - mx) * (y[i]! - my);
    dx += (x[i]! - mx) ** 2;
    dy += (y[i]! - my) ** 2;
  }
  return dx && dy ? n / Math.sqrt(dx * dy) : 0;
}
function skew(a: number[]) {
  const m = mean(a),
    s = sd(a);
  return s ? mean(a.map((x) => ((x - m) / s) ** 3)) : 0;
}

export function summary(a: number[]) {
  const s = [...a].sort((x, y) => x - y);
  return {
    n: a.length,
    mean: mean(a),
    median: quantile(s, 0.5),
    sd: sd(a),
    min: s[0] ?? 0,
    q1: quantile(s, 0.25),
    q3: quantile(s, 0.75),
    max: s[s.length - 1] ?? 0,
    skew: skew(a),
  };
}

export function histogram(a: number[], bins: number, max?: number) {
  const hi = max ?? Math.max(...a);
  const w = hi / bins;
  const out = Array.from({ length: bins }, (_, i) => ({
    x0: i * w,
    x1: (i + 1) * w,
    label: "",
    count: 0,
  }));
  for (const v of a) out[Math.min(bins - 1, Math.floor(v / w))]!.count++;
  out.forEach((b) => (b.label = `${Math.round(b.x0)}`));
  return out;
}

export function kde(a: number[], points = 60) {
  const lo = Math.min(...a),
    hi = Math.max(...a);
  const h = 1.06 * sd(a) * Math.pow(a.length, -0.2);
  return Array.from({ length: points }, (_, i) => {
    const x = lo + ((hi - lo) * i) / (points - 1);
    let d = 0;
    for (const v of a) d += Math.exp(-0.5 * ((x - v) / h) ** 2);
    return { x: +x.toFixed(2), density: d / (a.length * h * Math.sqrt(2 * Math.PI)) };
  });
}

export function levelsOf(orders: Order[], key: "category" | "region" | "segment") {
  const c = new Map<string, number>();
  for (const o of orders) c.set(o[key], (c.get(o[key]) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

export function groupBy(orders: Order[], key: "category" | "region" | "segment") {
  const levels = levelsOf(orders, key);
  return levels.map((name) => {
    const g = orders.filter((o) => o[key] === name);
    const sales = g.map((o) => o.sales);
    const s = [...sales].sort((a, b) => a - b);
    const totalSales = sum(sales);
    const totalProfit = sum(g.map((o) => o.profit));
    return {
      name,
      orders: g.length,
      totalSales,
      meanSales: mean(sales),
      medianSales: quantile(s, 0.5),
      totalProfit,
      margin: totalSales ? totalProfit / totalSales : 0,
      meanDiscount: mean(g.map((o) => o.discount)),
    };
  });
}

/** Proporción de varianza de log(Sales) explicada por un factor (eta²). */
export function etaSquared(orders: Order[], key: "category" | "region" | "segment") {
  const y = orders.map((o) => Math.log(o.sales));
  const m = mean(y);
  const sst = sum(y.map((v) => (v - m) ** 2));
  const groups = new Map<string, number[]>();
  orders.forEach((o, i) => {
    const arr = groups.get(o[key]) ?? [];
    arr.push(y[i]!);
    groups.set(o[key], arr);
  });
  let ssb = 0;
  groups.forEach((g) => (ssb += g.length * (mean(g) - m) ** 2));
  return sst ? ssb / sst : 0;
}

export function computeAll(orders: Order[]) {
  const sales = orders.map((o) => o.sales);
  const logSales = sales.map((s) => Math.log(s));
  const totalSales = sum(sales);
  const totalProfit = sum(orders.map((o) => o.profit));
  return {
    n: orders.length,
    totalSales,
    totalProfit,
    margin: totalSales ? totalProfit / totalSales : 0,
    avgTicket: mean(sales),
    sales: summary(sales),
    logSales: summary(logSales),
    byCategory: groupBy(orders, "category"),
    byRegion: groupBy(orders, "region"),
    bySegment: groupBy(orders, "segment"),
    eta: {
      category: etaSquared(orders, "category"),
      region: etaSquared(orders, "region"),
      segment: etaSquared(orders, "segment"),
    },
    corr: {
      discount: pearson(
        sales,
        orders.map((o) => o.discount),
      ),
      quantity: pearson(
        sales,
        orders.map((o) => o.quantity),
      ),
      profit: pearson(
        sales,
        orders.map((o) => o.profit),
      ),
      discountProfit: pearson(
        orders.map((o) => o.discount),
        orders.map((o) => o.profit),
      ),
    },
    lossOrdersPct: orders.filter((o) => o.profit < 0).length / Math.max(1, orders.length),
    highDiscountLossPct:
      orders.filter((o) => o.discount >= 0.3 && o.profit < 0).length /
      Math.max(1, orders.filter((o) => o.discount >= 0.3).length),
  };
}

export type Stats = ReturnType<typeof computeAll>;

export const fmtMoney = (v: number) =>
  "$" +
  (Math.abs(v) >= 1e6
    ? (v / 1e6).toFixed(2) + "M"
    : Math.abs(v) >= 1e3
      ? (v / 1e3).toFixed(1) + "K"
      : v.toFixed(0));
export const fmtPct = (v: number, d = 1) => (v * 100).toFixed(d) + "%";
export const fmtNum = (v: number, d = 2) => v.toLocaleString("es-CO", { maximumFractionDigits: d });
