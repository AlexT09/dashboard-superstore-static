import type { Order } from "./sales-data";

function parseCSV(text: string): string[][] {
  const delim =
    (text.split("\n")[0] ?? "").split(";").length > (text.split("\n")[0] ?? "").split(",").length
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cur = "",
    q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const ALIASES: Record<keyof Omit<Order, "id">, string[]> = {
  category: ["category", "categoria", "categoría"],
  region: ["region", "región"],
  segment: ["segment", "segmento"],
  sales: ["sales", "ventas", "venta"],
  quantity: ["quantity", "cantidad"],
  discount: ["discount", "descuento"],
  profit: ["profit", "beneficio", "ganancia", "utilidad"],
};

const num = (v: string) => {
  let s = (v ?? "").trim().replace(/[$\s%]/g, "");
  if (/,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  return Number(s);
};

export function ordersFromCSV(text: string): Order[] {
  const rows = parseCSV(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("El archivo no tiene filas de datos.");
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const idx = {} as Record<keyof typeof ALIASES, number>;
  const missing: string[] = [];
  for (const [k, al] of Object.entries(ALIASES) as [keyof typeof ALIASES, string[]][]) {
    const i = header.findIndex((h) => al.includes(h));
    if (i < 0) missing.push(al[0]!.charAt(0).toUpperCase() + al[0]!.slice(1));
    idx[k] = i;
  }
  if (missing.length) throw new Error(`Faltan columnas: ${missing.join(", ")}.`);
  const out: Order[] = [];
  rows.slice(1).forEach((r, i) => {
    const sales = num(r[idx.sales] ?? "");
    if (!Number.isFinite(sales) || sales <= 0) return;
    let discount = num(r[idx.discount] ?? "0");
    if (discount > 1) discount /= 100;
    out.push({
      id: i + 1,
      category: (r[idx.category] ?? "").trim() || "Sin dato",
      region: (r[idx.region] ?? "").trim() || "Sin dato",
      segment: (r[idx.segment] ?? "").trim() || "Sin dato",
      sales,
      quantity: num(r[idx.quantity] ?? "0") || 0,
      discount: Number.isFinite(discount) ? discount : 0,
      profit: num(r[idx.profit] ?? "0") || 0,
    });
  });
  if (out.length < 5) throw new Error("No se encontraron suficientes filas válidas.");
  return out;
}
