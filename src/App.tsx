import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getOrders, type Order } from "@/lib/sales-data";
import { computeAll, fmtMoney, fmtNum, fmtPct, histogram, kde, levelsOf } from "@/lib/stats";
import { ordersFromCSV } from "@/lib/csv";

const C = {
  p: "var(--color-chart-1)",
  t: "var(--color-chart-2)",
  a: "var(--color-chart-3)",
  grid: "#262626",
  mut: "#8f8f8f",
};
const axis = { fontSize: 10, fill: C.mut, fontFamily: "var(--font-mono)" };
const axisLabelStyle = { fontSize: 10, fill: C.mut, fontFamily: "var(--font-mono)" };
const tooltipStyle = {
  contentStyle: {
    background: "#141414",
    border: "1px solid #d4af374d",
    borderRadius: 12,
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "#e5e5e5",
  },
  cursor: { fill: "#d4af3708" },
} as const;
const xLabel = (value: string) => ({ value, position: "insideBottom" as const, offset: -4, style: axisLabelStyle });
const yLabel = (value: string) => ({ value, angle: -90, position: "insideLeft" as const, offset: 12, style: axisLabelStyle });
type Dim = "category" | "region" | "segment";
const DIM_LABEL: Record<Dim, string> = {
  category: "Categoría",
  region: "Región",
  segment: "Segmento",
};
const SAMPLE_SOURCE = "Sample Superstore";
const STORAGE = "ventas-dataset-v1";
type Filter = Record<Dim, string | null>;

export function App() {
  const [data, setData] = useState<{ orders: Order[]; source: string; updated: string | null }>(
    () => ({ orders: getOrders(), source: SAMPLE_SOURCE, updated: null }),
  );
  const [filter, setFilter] = useState<Filter>({ category: null, region: null, segment: null });
  const [scatterVar, setScatterVar] = useState<"discount" | "quantity" | "profit">("profit");
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setData(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  async function onFile(f: File) {
    setErr(null);
    try {
      const orders = ordersFromCSV(await f.text());
      const next = { orders, source: f.name, updated: new Date().toLocaleString("es-CO") };
      setData(next);
      setFilter({ category: null, region: null, segment: null });
      try {
        localStorage.setItem(STORAGE, JSON.stringify(next));
      } catch {
        /* archivo muy grande: solo en memoria */
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  }
  function resetSample() {
    localStorage.removeItem(STORAGE);
    setData({ orders: getOrders(), source: SAMPLE_SOURCE, updated: null });
    setFilter({ category: null, region: null, segment: null });
  }

  const all = data.orders;
  const orders = useMemo(
    () =>
      all.filter(
        (o) =>
          (!filter.category || o.category === filter.category) &&
          (!filter.region || o.region === filter.region) &&
          (!filter.segment || o.segment === filter.segment),
      ),
    [all, filter],
  );
  const s = useMemo(() => computeAll(orders), [orders]);
  const hist = useMemo(
    () =>
      histogram(
        orders.map((o) => o.sales).filter((v) => v <= s.sales.q3 * 3),
        24,
      ),
    [orders, s],
  );
  const dens = useMemo(() => kde(orders.map((o) => Math.log(o.sales))), [orders]);
  const scatter = useMemo(() => {
    const step = Math.max(1, Math.floor(orders.length / 1500));
    return orders.filter((_, i) => i % step === 0).map((o) => ({ x: o[scatterVar], y: o.sales }));
  }, [orders, scatterVar]);

  const factors = (["category", "region", "segment"] as Dim[])
    .map((k) => ({ k, v: s.eta[k] }))
    .sort((a, b) => b.v - a.v);
  const byMean = (g: typeof s.byCategory) => [...g].sort((a, b) => b.meanSales - a.meanSales)[0];
  const byOrders = (g: typeof s.byCategory) => [...g].sort((a, b) => b.orders - a.orders)[0];
  const topCat = byMean(s.byCategory);
  const topSeg = byMean(s.bySegment);
  const mostOrdersCat = byOrders(s.byCategory);
  const mostOrdersReg = byOrders(s.byRegion);
  const lowMargin = [...s.byCategory].sort((a, b) => a.margin - b.margin)[0];
  const topReg = [...s.byRegion].sort((a, b) => b.totalProfit - a.totalProfit)[0];
  const worstReg = [...s.byRegion].sort((a, b) => a.margin - b.margin)[0];

  return (
    <div className="hero-glow min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-6">
          <span className="grid size-8 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
            S
          </span>
          <span className="font-display text-sm font-bold tracking-tight">
            Sample Superstore<span className="text-muted-foreground"> / dashboard</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:inline">
              {data.source} ·{" "}
              <span className="font-mono text-foreground">n = {fmtNum(all.length, 0)}</span>
              {data.updated && <> · {data.updated}</>}
            </span>
            {data.updated && (
              <button
                onClick={resetSample}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:border-primary/40"
              >
                Restaurar dataset original
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-[#b8952d]"
            >
              ↑ Actualizar datos (CSV)
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        {err && (
          <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-negative">
            {err} El CSV debe tener las columnas: Category, Region, Segment, Sales, Quantity,
            Discount, Profit.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {(["category", "region", "segment"] as Dim[]).map((d) => (
            <FilterGroup
              key={d}
              label={DIM_LABEL[d]}
              options={levelsOf(all, d).slice(0, 8)}
              value={filter[d]}
              onChange={(v) => setFilter((f) => ({ ...f, [d]: v }))}
            />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Kpi label="Ventas" value={fmtMoney(s.totalSales)} />
          <Kpi label="Beneficio" value={fmtMoney(s.totalProfit)} />
          <Kpi label="Margen" value={fmtPct(s.margin)} tone="gold" />
          <Kpi
            label="Venta media"
            value={fmtMoney(s.sales.mean)}
            sub={`mediana ${fmtMoney(s.sales.median)}`}
          />
          <Kpi label="Pedidos con pérdida" value={fmtPct(s.lossOrdersPct)} tone="neg" />
        </div>

        <h2 className="mb-3 mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Visualizaciones e insights · qué factor explica el nivel de ventas
        </h2>
        <div className="grid grid-cols-12 gap-4">
          <Card
            className="col-span-12 md:col-span-8"
            title="Histograma de Sales"
            insight={
              <>
                Asimetría de <b>{fmtNum(s.sales.skew)}</b>: la media (
                <b>{fmtMoney(s.sales.mean)}</b>) supera a la mediana (
                <b>{fmtMoney(s.sales.median)}</b>). Pocos pedidos grandes concentran el ingreso.
              </>
            }
          >
            <ChartBox h={230}>
              <BarChart data={hist} margin={{ bottom: 18, left: 6 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="label" tick={axis} interval={5} label={xLabel("Ventas ($)")} />
                <YAxis tick={axis} width={58} label={yLabel("Pedidos")} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" name="Pedidos" fill={C.p} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartBox>
          </Card>
          <Card
            className="col-span-12 md:col-span-4"
            title="Densidad de log(Sales)"
            insight="En escala logarítmica la distribución se acerca a la normal, lo que facilita comparar el valor típico de un pedido entre grupos sin que los pocos pedidos extremos dominen la lectura."
          >
            <ChartBox h={230}>
              <AreaChart data={dens} margin={{ bottom: 18, left: 6 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="x" tick={axis} interval={11} label={xLabel("Log(Ventas)")} />
                <YAxis tick={axis} width={58} label={yLabel("Densidad")} />
                <Tooltip {...tooltipStyle} />
                <Area
                  dataKey="density"
                  name="Densidad"
                  stroke={C.p}
                  fill={C.p}
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartBox>
          </Card>

          <Card
            className="col-span-12 md:col-span-4"
            title="Pedidos por categoría"
            insight={
              <>
                <b>{mostOrdersCat?.name}</b> concentra más pedidos, pero <b>{topCat?.name}</b> tiene
                la venta media más alta ({fmtMoney(topCat?.meanSales ?? 0)}).
              </>
            }
          >
            <ChartBox h={220}>
              <BarChart data={s.byCategory.slice(0, 8)} layout="vertical" margin={{ left: 10, bottom: 18 }}>
                <XAxis type="number" tick={axis} label={xLabel("Pedidos")} />
                <YAxis type="category" dataKey="name" tick={axis} width={85} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="orders" name="Pedidos" fill={C.p} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ChartBox>
          </Card>
          <Card
            className="col-span-12 md:col-span-4"
            title="Pedidos por región"
            insight={
              <>
                <b>{mostOrdersReg?.name}</b> es la región con más pedidos, con una venta media de{" "}
                {fmtMoney(mostOrdersReg?.meanSales ?? 0)} por pedido.
              </>
            }
          >
            <ChartBox h={220}>
              <BarChart data={s.byRegion.slice(0, 8)} layout="vertical" margin={{ left: 10, bottom: 18 }}>
                <XAxis type="number" tick={axis} label={xLabel("Pedidos")} />
                <YAxis type="category" dataKey="name" tick={axis} width={85} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="orders" name="Pedidos" fill={C.t} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ChartBox>
          </Card>
          <Card
            className="col-span-12 md:col-span-4"
            title="Pedidos por segmento"
            insight={
              <>
                <b>{topSeg?.name}</b> es el segmento de mayor ticket, con venta media de{" "}
                {fmtMoney(topSeg?.meanSales ?? 0)} por pedido.
              </>
            }
          >
            <ChartBox h={220}>
              <BarChart data={s.bySegment.slice(0, 8)} layout="vertical" margin={{ left: 10, bottom: 18 }}>
                <XAxis type="number" tick={axis} label={xLabel("Pedidos")} />
                <YAxis type="category" dataKey="name" tick={axis} width={85} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="orders" name="Pedidos" fill={C.a} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ChartBox>
          </Card>

          <Card
            className="col-span-12 lg:col-span-8"
            title="Relación de Sales con variables numéricas"
            insight={
              <>
                Beneficio (r = {fmtNum(s.corr.profit)}) y cantidad (r = {fmtNum(s.corr.quantity)})
                acompañan a las ventas. El descuento se relaciona con el beneficio con r ={" "}
                {fmtNum(s.corr.discountProfit)}; el {fmtPct(s.highDiscountLossPct, 0)} de los
                pedidos con descuento ≥ 30% pierde dinero.
              </>
            }
          >
            <div className="mb-3 flex flex-wrap gap-2">
              {(["profit", "quantity", "discount"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setScatterVar(v)}
                  className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${scatterVar === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40"}`}
                >
                  Sales × {v === "profit" ? "Profit" : v === "quantity" ? "Quantity" : "Discount"} ·
                  r = {fmtNum(s.corr[v])}
                </button>
              ))}
            </div>
            <ChartBox h={280}>
              <ScatterChart margin={{ bottom: 18, left: 6 }}>
                <CartesianGrid stroke={C.grid} />
                <XAxis
                  type="number"
                  dataKey="x"
                  tick={axis}
                  name={scatterVar}
                  label={xLabel(scatterVar === "profit" ? "Profit" : scatterVar === "quantity" ? "Quantity" : "Discount")}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  tick={axis}
                  width={45}
                  name="Sales"
                  scale="log"
                  domain={["auto", "auto"]}
                  label={yLabel("Sales (log)")}
                />
                <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={scatter} fill={C.p} fillOpacity={0.45} />
              </ScatterChart>
            </ChartBox>
          </Card>

          <Card
            className="col-span-12 lg:col-span-4"
            title="Factor que explica log(Sales) · η²"
            insight={
              <>
                <b>{DIM_LABEL[factors[0]!.k]}</b> explica el {fmtPct(factors[0]!.v)} de la variación
                de log(Sales), frente a {fmtPct(factors[1]!.v)} de{" "}
                {DIM_LABEL[factors[1]!.k].toLowerCase()} y {fmtPct(factors[2]!.v)} de{" "}
                {DIM_LABEL[factors[2]!.k].toLowerCase()}.
              </>
            }
          >
            <div className="space-y-4 pt-2">
              {factors.map((f) => (
                <div key={f.k}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium">{DIM_LABEL[f.k]}</span>
                    <span className="font-mono text-muted-foreground">{fmtPct(f.v)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{
                        width: `${Math.max(2, (f.v / Math.max(factors[0]!.v, 0.001)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2 pt-2 font-mono text-[11px]">
                {(
                  [
                    ["Mín", s.sales.min],
                    ["Q1", s.sales.q1],
                    ["Mediana", s.sales.median],
                    ["Media", s.sales.mean],
                    ["Q3", s.sales.q3],
                    ["Máx", s.sales.max],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-border bg-card px-2 py-1.5">
                    <div className="text-muted-foreground">{l}</div>
                    <div className="font-semibold">{fmtMoney(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <h2 className="mb-3 mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Qué debería priorizar el negocio
        </h2>
        <div className="relative overflow-hidden rounded-2xl bg-primary p-8 text-primary-foreground">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -right-10 size-64 rounded-full bg-black/10 blur-3xl"
          />
          <div className="relative">
            <div className="mb-3 flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary-foreground/90" />
              <h3 className="font-display text-xs font-bold uppercase tracking-[0.16em]">
                Recomendación con base en los datos
              </h3>
            </div>
            <p className="max-w-4xl text-lg font-medium leading-relaxed [&_b]:font-bold">
              <b>{lowMargin?.name}</b> tiene el margen más bajo ({fmtPct(lowMargin?.margin ?? 0)}) y{" "}
              <b>{worstReg?.name}</b> es la región menos rentable ({fmtPct(worstReg?.margin ?? 0)},
              descuento medio {fmtPct(worstReg?.meanDiscount ?? 0, 0)}). <b>{topReg?.name}</b> lidera
              en beneficio ({fmtMoney(topReg?.totalProfit ?? 0)}): controlar descuentos altos y
              replicar lo que funciona allí es la palanca más clara.
            </p>
          </div>
        </div>
      </main>

      <footer className="mt-12 border-t border-border">
        <div className="mx-auto flex max-w-[1400px] justify-between px-6 py-5 font-mono text-[11px] text-muted-foreground">
          <span>Sample Superstore / dashboard</span>
          <span>{data.source}</span>
        </div>
      </footer>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neg" | "gold";
}) {
  return (
    <div className="glass card-hover rounded-2xl border-l-4 p-5 border-l-transparent">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 font-display text-[1.7rem] font-bold tracking-tight ${
          tone === "neg" ? "text-negative" : tone === "gold" ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-card p-1">
      <span className="px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {[null, ...options].map((o) => (
        <button
          key={o ?? "all"}
          onClick={() => onChange(o)}
          className={`rounded-full px-2.5 py-1 text-xs transition-colors ${value === o ? "bg-primary text-primary-foreground" : "hover:bg-primary-soft"}`}
        >
          {o ?? "Todas"}
        </button>
      ))}
    </div>
  );
}

/** Tarjeta de visualización: el gráfico y, justo debajo, el insight que responde a la pregunta de negocio asociada. */
function Card({
  title,
  children,
  insight,
  className = "",
}: {
  title: string;
  children: ReactNode;
  insight?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass card-hover rounded-2xl p-6 ${className}`}>
      <h3 className="mb-4 font-display text-[13px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
      {children}
      {insight && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-[12.5px] leading-relaxed text-muted-foreground [&_b]:font-semibold [&_b]:text-primary">
            {insight}
          </p>
        </div>
      )}
    </section>
  );
}

function ChartBox({ children, h = 200 }: { children: ReactElement; h?: number }) {
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
