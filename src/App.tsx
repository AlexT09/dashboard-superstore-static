import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
  d: "var(--color-chart-4)",
  neg: "var(--color-negative)",
  grid: "var(--color-border)",
  mut: "var(--color-muted-foreground)",
};
const axis = { fontSize: 10, fill: C.mut, fontFamily: "var(--font-mono)" };
const xLabel = (value: string) => ({ value, position: "insideBottom" as const, offset: -4, style: axis });
const yLabel = (value: string) => ({ value, angle: -90, position: "insideLeft" as const, offset: 12, style: axis });

type Dim = "category" | "region" | "segment";
type NumVar = "profit" | "quantity" | "discount";
const DIMS: Dim[] = ["category", "region", "segment"];
const DIM_LABEL: Record<Dim, string> = { category: "Categoría", region: "Región", segment: "Segmento" };
const VAR_LABEL: Record<NumVar, string> = { profit: "Profit", quantity: "Quantity", discount: "Discount" };
const SAMPLE_SOURCE = "Sample Superstore";
const STORAGE = "ventas-dataset-v1";
type Filter = Record<Dim, string | null>;
const NO_FILTER: Filter = { category: null, region: null, segment: null };

/** η² con más decimales cuando es muy pequeño (p. ej. segmento ≈ 0,01%). */
const fmtEta = (v: number) => fmtPct(v, v < 0.01 ? 2 : 1);

/** Fuerza de una correlación lineal, con los mismos cortes que se usan en el EDA. */
function corrStrength(r: number) {
  const a = Math.abs(r);
  const dir = r >= 0 ? "positiva" : "negativa";
  if (a < 0.1) return "prácticamente nula";
  if (a < 0.3) return `débil ${dir}`;
  if (a < 0.5) return `moderada ${dir}`;
  return `fuerte ${dir}`;
}

const DISCOUNT_BUCKETS = [
  { label: "0%", test: (d: number) => d === 0 },
  { label: "1–10%", test: (d: number) => d > 0 && d <= 0.1 },
  { label: "11–20%", test: (d: number) => d > 0.1 && d <= 0.2 },
  { label: "21–30%", test: (d: number) => d > 0.2 && d <= 0.3 },
  { label: "31–50%", test: (d: number) => d > 0.3 && d <= 0.5 },
  { label: ">50%", test: (d: number) => d > 0.5 },
];

export function App() {
  const [data, setData] = useState<{ orders: Order[]; source: string; updated: string | null }>(() => ({
    orders: getOrders(),
    source: SAMPLE_SOURCE,
    updated: null,
  }));
  const [filter, setFilter] = useState<Filter>(NO_FILTER);
  const [scatterVar, setScatterVar] = useState<NumVar>("profit");
  const [medianDim, setMedianDim] = useState<Dim>("category");
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // El botón de descarga solo tiene sentido cuando el dashboard se ve desde un link (GitHub Pages);
  // si ya se abrió como archivo, el usuario ya lo tiene.
  const online = typeof location !== "undefined" && location.protocol.startsWith("http");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setData(JSON.parse(raw));
    } catch {
      /* sin acceso a localStorage: se usa el dataset incluido */
    }
  }, []);

  async function onFile(f: File) {
    setErr(null);
    try {
      const orders = ordersFromCSV(await f.text());
      const next = { orders, source: f.name, updated: new Date().toLocaleString("es-CO") };
      setData(next);
      setFilter(NO_FILTER);
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
    try {
      localStorage.removeItem(STORAGE);
    } catch {
      /* ignorar */
    }
    setData({ orders: getOrders(), source: SAMPLE_SOURCE, updated: null });
    setFilter(NO_FILTER);
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
  const empty = orders.length < 2;
  const s = useMemo(() => computeAll(orders), [orders]);

  // Histograma de Sales hasta $1000, igual que en el EDA (la cola larga se lee en el resumen).
  const hist = useMemo(() => {
    const under = orders.map((o) => o.sales).filter((v) => v <= 1000);
    return { bins: under.length ? histogram(under, 40, 1000) : [], share: under.length / Math.max(1, orders.length) };
  }, [orders]);
  const dens = useMemo(() => (empty ? [] : kde(orders.map((o) => Math.log(o.sales)))), [orders, empty]);
  const peak = useMemo(() => dens.reduce((m, p) => (p.density > m.density ? p : m), { x: 0, density: 0 }), [dens]);
  const scatter = useMemo(() => {
    const step = Math.max(1, Math.floor(orders.length / 1500));
    return orders.filter((_, i) => i % step === 0).map((o) => ({ x: o[scatterVar], y: o.sales }));
  }, [orders, scatterVar]);
  const discounts = useMemo(
    () =>
      DISCOUNT_BUCKETS.map((b) => {
        const g = orders.filter((o) => b.test(o.discount));
        const loss = g.filter((o) => o.profit < 0).length;
        return { label: b.label, orders: g.length, lossPct: g.length ? loss / g.length : 0 };
      }),
    [orders],
  );
  const lowDiscountShare = orders.filter((o) => o.discount <= 0.2).length / Math.max(1, orders.length);

  const groups: Record<Dim, typeof s.byCategory> = { category: s.byCategory, region: s.byRegion, segment: s.bySegment };
  const withPct = (d: Dim) => groups[d].map((g) => ({ ...g, pct: g.orders / Math.max(1, s.n) }));
  const byOrders = (d: Dim) => [...groups[d]].sort((a, b) => b.orders - a.orders);
  const byMedian = (d: Dim) => [...groups[d]].sort((a, b) => b.medianSales - a.medianSales);
  const factors = DIMS.map((k) => ({ k, v: s.eta[k] })).sort((a, b) => b.v - a.v);
  const lowMargin = [...s.byCategory].sort((a, b) => a.margin - b.margin)[0];
  const worstReg = [...s.byRegion].sort((a, b) => a.margin - b.margin)[0];
  const topReg = [...s.byRegion].sort((a, b) => b.totalProfit - a.totalProfit)[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex min-h-14 max-w-[1400px] flex-wrap items-center gap-3 px-5 py-2">
          <span className="grid size-7 place-items-center rounded-md bg-primary font-mono text-xs font-semibold text-primary-foreground">
            S
          </span>
          <span className="font-mono text-sm font-semibold tracking-tight">
            Sample Superstore<span className="text-muted-foreground">/dashboard</span>
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground md:inline">
              {data.source} · <span className="font-mono text-foreground">n = {fmtNum(all.length, 0)}</span>
              {data.updated && <> · {data.updated}</>}
            </span>
            {data.updated && (
              <button
                onClick={resetSample}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-primary-soft"
              >
                Restaurar dataset original
              </button>
            )}
            {online && (
              <a
                href="./index.html"
                download="dashboard_superstore.html"
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-primary-soft"
              >
                ↓ Descargar dashboard (HTML)
              </a>
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
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              ↑ Actualizar datos (CSV)
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 py-6">
        <section className="mb-5">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            ¿Qué factores explican el nivel de ventas?
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Análisis exploratorio de <b className="text-foreground">Sales</b> según categoría, región y segmento, y su
            relación con Discount, Quantity y Profit. Usa los filtros: todos los gráficos, cifras e interpretaciones se
            recalculan con los pedidos seleccionados.
          </p>
        </section>

        {err && (
          <div className="mb-4 rounded-xl bg-negative/10 px-4 py-3 text-sm text-negative">
            {err} El CSV debe tener las columnas: Category, Region, Segment, Sales, Quantity, Discount, Profit.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {DIMS.map((d) => (
            <FilterGroup
              key={d}
              label={DIM_LABEL[d]}
              options={levelsOf(all, d).slice(0, 8)}
              value={filter[d]}
              onChange={(v) => setFilter((f) => ({ ...f, [d]: v }))}
            />
          ))}
          {(filter.category || filter.region || filter.segment) && (
            <button
              onClick={() => setFilter(NO_FILTER)}
              className="rounded-full px-3 py-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Quitar filtros
            </button>
          )}
        </div>

        {empty ? (
          <div className="glass mt-4 rounded-2xl p-8 text-center text-sm text-muted-foreground">
            No hay suficientes pedidos con esta combinación de filtros.
          </div>
        ) : (
          <>
            <div className="glass mt-4 grid grid-cols-2 rounded-2xl lg:grid-cols-5">
              <Kpi label="Pedidos" value={fmtNum(s.n, 0)} sub={`${fmtPct(s.n / Math.max(1, all.length))} del total`} />
              <Kpi label="Ventas" value={fmtMoney(s.totalSales)} />
              <Kpi label="Beneficio" value={fmtMoney(s.totalProfit)} sub={`margen ${fmtPct(s.margin)}`} />
              <Kpi label="Venta media" value={fmtMoney(s.sales.mean)} sub={`mediana ${fmtMoney(s.sales.median)}`} />
              <Kpi label="Pedidos con pérdida" value={fmtPct(s.lossOrdersPct)} tone="neg" />
            </div>

            <SectionTitle n="1" text="Análisis univariado · cómo se distribuyen las ventas" />
            <div className="grid grid-cols-12 gap-4">
              <Card
                className="col-span-12"
                title="Resumen estadístico de Sales"
                insight={
                  <>
                    La media (<b>{fmtNum(s.sales.mean, 0)}</b>) es{" "}
                    <b>{fmtNum(s.sales.mean / Math.max(s.sales.median, 1e-9), 1)} veces</b> la mediana (
                    <b>{fmtNum(s.sales.median, 1)}</b>)
                    {s.sales.sd > s.sales.mean ? (
                      <>
                        {" "}
                        y la desviación estándar (<b>{fmtNum(s.sales.sd, 0)}</b>) supera a la media
                      </>
                    ) : (
                      <>
                        {" "}
                        con una desviación estándar de <b>{fmtNum(s.sales.sd, 0)}</b>
                      </>
                    )}
                    , lo que confirma una {s.sales.skew > 1 ? "fuerte " : ""}asimetría positiva: la mayoría de los
                    pedidos son de bajo valor y unos pocos pedidos muy grandes (hasta <b>{fmtNum(s.sales.max, 0)}</b>)
                    jalan el promedio hacia arriba. El RIC de <b>{fmtNum(s.sales.q3 - s.sales.q1, 0)}</b> (entre Q1 ={" "}
                    {fmtNum(s.sales.q1, 1)} y Q3 = {fmtNum(s.sales.q3, 0)}) muestra el rango del 50% central de los
                    pedidos.
                  </>
                }
              >
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] sm:grid-cols-5 lg:grid-cols-9">
                  {(
                    [
                      ["n", fmtNum(s.n, 0)],
                      ["Media", fmtNum(s.sales.mean, 0)],
                      ["Desv. est.", fmtNum(s.sales.sd, 0)],
                      ["Mediana", fmtNum(s.sales.median, 1)],
                      ["Q1", fmtNum(s.sales.q1, 1)],
                      ["Q3", fmtNum(s.sales.q3, 0)],
                      ["RIC", fmtNum(s.sales.q3 - s.sales.q1, 0)],
                      ["Mínimo", fmtNum(s.sales.min, 1)],
                      ["Máximo", fmtNum(s.sales.max, 0)],
                    ] as const
                  ).map(([l, v]) => (
                    <div key={l} className="rounded-lg border border-border bg-card px-2 py-1.5">
                      <div className="text-muted-foreground">{l}</div>
                      <div className="font-semibold">{v}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card
                className="col-span-12 md:col-span-6"
                title="Histograma de Sales (pedidos hasta $1.000)"
                insight={
                  <>
                    Confirma visualmente el sesgo a la derecha: la gran mayoría de las barras se concentran en valores
                    bajos de venta, con una cola larga hacia la derecha. El <b>{fmtPct(hist.share)}</b> de los pedidos
                    vale $1.000 o menos; el resto forma la cola de pedidos grandes.
                  </>
                }
              >
                <ChartBox h={240}>
                  <BarChart data={hist.bins} margin={{ bottom: 18, left: 6 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="label" tick={axis} interval={7} label={xLabel("Ventas ($)")} />
                    <YAxis tick={axis} width={58} label={yLabel("Pedidos")} />
                    <Tooltip />
                    <Bar dataKey="count" name="Pedidos" fill={C.p} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartBox>
              </Card>

              <Card
                className="col-span-12 md:col-span-6"
                title="Densidad de log(Sales)"
                insight={
                  <>
                    Al aplicar el logaritmo, la distribución se vuelve más simétrica y manejable. La mayor
                    concentración de pedidos está alrededor de <b>log(Sales) = {fmtNum(peak.x, 1)}</b> (≈{" "}
                    {fmtMoney(Math.exp(peak.x))} por pedido), donde la densidad alcanza su máximo (
                    {fmtNum(peak.density, 2)}); después disminuye a medida que aumentan los valores, mostrando una
                    menor concentración de ventas altas.
                  </>
                }
              >
                <ChartBox h={240}>
                  <AreaChart data={dens} margin={{ bottom: 18, left: 6 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="x" tick={axis} interval={11} label={xLabel("Log(Ventas)")} />
                    <YAxis tick={axis} width={58} label={yLabel("Densidad")} />
                    <Tooltip />
                    <Area dataKey="density" name="Densidad" stroke={C.t} fill={C.t} fillOpacity={0.25} strokeWidth={2} />
                  </AreaChart>
                </ChartBox>
              </Card>

              {DIMS.map((d, i) => {
                const rank = byOrders(d);
                const first = rank[0];
                const second = rank[1];
                const last = rank[rank.length - 1];
                return (
                  <Card
                    key={d}
                    className="col-span-12 md:col-span-4"
                    title={`Pedidos por ${DIM_LABEL[d].toLowerCase()}`}
                    insight={
                      rank.length < 2 ? (
                        <>Con el filtro actual solo hay un grupo: {first?.name}.</>
                      ) : (
                        <>
                          <b>{first?.name}</b> concentra el <b>{fmtPct((first?.orders ?? 0) / s.n)}</b> de los pedidos
                          ({fmtNum(first?.orders ?? 0, 0)}), seguida de {second?.name} (
                          {fmtPct((second?.orders ?? 0) / s.n)}). <b>{last?.name}</b> es{" "}
                          {d === "category" ? "la categoría" : d === "region" ? "la región" : "el segmento"} con menos
                          pedidos ({fmtNum(last?.orders ?? 0, 0)}).
                        </>
                      )
                    }
                  >
                    <ChartBox h={220}>
                      <BarChart data={withPct(d)} layout="vertical" margin={{ left: 10, right: 56, bottom: 18 }}>
                        <XAxis type="number" tick={axis} label={xLabel("Pedidos")} />
                        <YAxis type="category" dataKey="name" tick={axis} width={85} />
                        <Tooltip />
                        <Bar dataKey="orders" name="Pedidos" fill={[C.p, C.t, C.a][i]} radius={[0, 3, 3, 0]}>
                          <LabelList
                            dataKey="pct"
                            position="right"
                            formatter={(v: number) => fmtPct(v)}
                            style={{ ...axis, fill: "var(--color-foreground)" }}
                          />
                        </Bar>
                      </BarChart>
                    </ChartBox>
                  </Card>
                );
              })}
            </div>

            <SectionTitle n="2" text="Análisis bivariado · qué explica el valor de un pedido" />
            <div className="grid grid-cols-12 gap-4">
              <Card
                className="col-span-12 lg:col-span-8"
                title="Venta mediana por pedido"
                insight={<MedianInsight dim={medianDim} rank={byMedian(medianDim)} />}
              >
                <Toggle
                  options={DIMS.map((d) => ({ value: d, label: DIM_LABEL[d] }))}
                  value={medianDim}
                  onChange={setMedianDim}
                />
                <ChartBox h={250}>
                  <BarChart data={byMedian(medianDim)} margin={{ bottom: 18, left: 6, top: 18 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="name" tick={axis} label={xLabel(DIM_LABEL[medianDim])} />
                    <YAxis tick={axis} width={58} label={yLabel("Venta mediana ($)")} />
                    <Tooltip formatter={(v: number) => fmtMoney(v)} />
                    <Bar dataKey="medianSales" name="Venta mediana" fill={C.p} radius={[3, 3, 0, 0]}>
                      <LabelList
                        dataKey="medianSales"
                        position="top"
                        formatter={(v: number) => fmtMoney(v)}
                        style={{ ...axis, fill: "var(--color-foreground)" }}
                      />
                    </Bar>
                  </BarChart>
                </ChartBox>
              </Card>

              <Card
                className="col-span-12 lg:col-span-4"
                title="Factor que explica log(Sales) · η²"
                insight={
                  <>
                    <b>{DIM_LABEL[factors[0]!.k]}</b> explica el <b>{fmtEta(factors[0]!.v)}</b> de la variación de
                    log(Sales), frente a {fmtEta(factors[1]!.v)} de {DIM_LABEL[factors[1]!.k].toLowerCase()} y{" "}
                    {fmtEta(factors[2]!.v)} de {DIM_LABEL[factors[2]!.k].toLowerCase()}. η² indica qué parte de las
                    diferencias en el valor de los pedidos se debe a pertenecer a un grupo u otro.
                  </>
                }
              >
                <div className="space-y-4 pt-2">
                  {factors.map((f) => (
                    <div key={f.k}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium">{DIM_LABEL[f.k]}</span>
                        <span className="font-mono text-muted-foreground">{fmtEta(f.v)}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-700"
                          style={{ width: `${Math.max(2, (f.v / Math.max(factors[0]!.v, 0.001)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card
                className="col-span-12 lg:col-span-8"
                title="Relación de Sales con variables numéricas"
                insight={
                  <>
                    Sales y Profit tienen una correlación <b>{corrStrength(s.corr.profit)}</b> (r ={" "}
                    {fmtNum(s.corr.profit)}): a mayor venta, mayor ganancia. Sales y Quantity, una correlación{" "}
                    <b>{corrStrength(s.corr.quantity)}</b> (r = {fmtNum(s.corr.quantity)}). Sales y Discount, una
                    correlación <b>{corrStrength(s.corr.discount)}</b> (r = {fmtNum(s.corr.discount)}) en términos
                    lineales: la correlación solo mide relación lineal, por eso el efecto del descuento se ve mejor en
                    el gráfico de niveles de descuento.
                  </>
                }
              >
                <Toggle
                  options={(["profit", "quantity", "discount"] as const).map((v) => ({
                    value: v,
                    label: `Sales × ${VAR_LABEL[v]} · r = ${fmtNum(s.corr[v])}`,
                  }))}
                  value={scatterVar}
                  onChange={setScatterVar}
                />
                <ChartBox h={280}>
                  <ScatterChart margin={{ bottom: 18, left: 6 }}>
                    <CartesianGrid stroke={C.grid} />
                    <XAxis type="number" dataKey="x" tick={axis} name={VAR_LABEL[scatterVar]} label={xLabel(VAR_LABEL[scatterVar])} />
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
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                    <Scatter data={scatter} fill={C.p} fillOpacity={0.35} />
                  </ScatterChart>
                </ChartBox>
              </Card>

              <Card
                className="col-span-12 lg:col-span-4"
                title="Pedidos por nivel de descuento"
                insight={
                  <>
                    La mayoría de los pedidos se concentra en descuentos bajos: el <b>{fmtPct(lowDiscountShare)}</b>{" "}
                    tiene descuento de 20% o menos. El descuento se relaciona con el beneficio con r ={" "}
                    {fmtNum(s.corr.discountProfit)}, y el <b>{fmtPct(s.highDiscountLossPct, 0)}</b> de los pedidos con
                    descuento ≥ 30% pierde dinero (barras en rojo: más de la mitad de sus pedidos con pérdida).
                  </>
                }
              >
                <ChartBox h={300}>
                  <BarChart data={discounts} margin={{ bottom: 18, left: 6 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="label" tick={axis} label={xLabel("Descuento")} />
                    <YAxis tick={axis} width={52} label={yLabel("Pedidos")} />
                    <Tooltip
                      formatter={(v: number, name: string, item: { payload?: { lossPct: number } }) =>
                        name === "Pedidos" ? [`${fmtNum(v, 0)} (${fmtPct(item.payload?.lossPct ?? 0, 0)} con pérdida)`, name] : [v, name]
                      }
                    />
                    <Bar dataKey="orders" name="Pedidos" radius={[3, 3, 0, 0]}>
                      {discounts.map((b) => (
                        <Cell key={b.label} fill={b.lossPct > 0.5 ? C.neg : C.t} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartBox>
              </Card>
            </div>

            <SectionTitle n="3" text="Conclusión" />
            <div className="grid gap-4 md:grid-cols-2">
              <article className="glass rounded-2xl p-5">
                <h3 className="font-mono text-sm font-semibold tracking-tight">Lo que muestran los datos</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground">
                  Sales tiene una distribución muy sesgada hacia valores bajos, con pocos pedidos de alto valor.{" "}
                  <b>{DIM_LABEL[factors[0]!.k]}</b> es el factor que más explica las diferencias en el valor de venta (
                  {fmtEta(factors[0]!.v)} de η²), mientras que {DIM_LABEL[factors[1]!.k].toLowerCase()} y{" "}
                  {DIM_LABEL[factors[2]!.k].toLowerCase()} muestran diferencias más leves. El descuento casi no se
                  relaciona linealmente con las ventas, pero sí con la pérdida de beneficio.
                </p>
              </article>
              <article className="glass rounded-2xl p-5">
                <h3 className="font-mono text-sm font-semibold tracking-tight">Lectura de negocio</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground">
                  <b>{lowMargin?.name}</b> tiene el margen más bajo ({fmtPct(lowMargin?.margin ?? 0)}) y{" "}
                  <b>{worstReg?.name}</b> es la región menos rentable ({fmtPct(worstReg?.margin ?? 0)}, descuento medio{" "}
                  {fmtPct(worstReg?.meanDiscount ?? 0, 0)}). <b>{topReg?.name}</b> lidera en beneficio (
                  {fmtMoney(topReg?.totalProfit ?? 0)}). Revisar los descuentos altos es la palanca más clara que
                  sugieren los datos.
                </p>
              </article>
            </div>
          </>
        )}
      </main>

      <footer className="mt-10 border-t border-border">
        <div className="mx-auto flex max-w-[1400px] flex-wrap justify-between gap-2 px-5 py-5 font-mono text-[11px] text-muted-foreground">
          <span>Proyecto: Alex Teran y David Estrada · Sample Superstore / dashboard</span>
          <span>{data.source}</span>
        </div>
      </footer>
    </div>
  );
}

/** Interpretación de la venta mediana por grupo, con la lectura del EDA (boxplots de log(Sales)). */
function MedianInsight({ dim, rank }: { dim: Dim; rank: { name: string; medianSales: number }[] }) {
  if (rank.length < 2) return <>Con el filtro actual solo hay un grupo: {rank[0]?.name}.</>;
  const top = rank[0]!;
  const low = rank[rank.length - 1]!;
  const ratio = top.medianSales / Math.max(low.medianSales, 1e-9);
  const gap = Math.log(top.medianSales) - Math.log(low.medianSales);
  if (gap >= 1) {
    const second = rank[1]!;
    return (
      <>
        <b>{top.name}</b> ({fmtMoney(top.medianSales)})
        {rank.length > 2 && second.medianSales / top.medianSales > 0.8 && (
          <>
            {" "}
            y <b>{second.name}</b> ({fmtMoney(second.medianSales)})
          </>
        )}{" "}
        tienen el pedido típico más alto; <b>{low.name}</b> queda muy por debajo ({fmtMoney(low.medianSales)}, casi{" "}
        {fmtNum(gap, 1)} puntos log menos). El pedido típico de {top.name} vale {fmtNum(ratio, 1)} veces el de{" "}
        {low.name}: {DIM_LABEL[dim].toLowerCase()} sí marca diferencias grandes en el valor de venta.
      </>
    );
  }
  return (
    <>
      Las medianas van de {fmtMoney(low.medianSales)} ({low.name}) a {fmtMoney(top.medianSales)} ({top.name}): ningún
      grupo sobresale claramente. A diferencia de la categoría, las diferencias por {DIM_LABEL[dim].toLowerCase()} son
      leves.
    </>
  );
}

function SectionTitle({ n, text }: { n: string; text: string }) {
  return (
    <h2 className="mb-3 mt-8 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
      <span className="text-primary">{n} ·</span> {text}
    </h2>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "neg" }) {
  return (
    <div className="border-b border-r border-border p-5 last:border-r-0 lg:border-b-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={`mt-2 font-mono text-[1.6rem] font-semibold tracking-tight ${tone === "neg" ? "text-negative" : ""}`}>
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
      <span className="px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
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

function Toggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${value === o.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-primary-soft"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Tarjeta de visualización: el gráfico y, justo debajo, su interpretación. */
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
    <section className={`glass rounded-2xl p-5 ${className}`}>
      <h3 className="mb-3 font-mono text-sm font-semibold tracking-tight">{title}</h3>
      {children}
      {insight && (
        <p className="mt-3 border-t border-border pt-3 text-[12.5px] leading-relaxed text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground">
          {insight}
        </p>
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
