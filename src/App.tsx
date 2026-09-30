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
import photo from "@/assets/superstore.webp";
import { getOrders, type Order } from "@/lib/sales-data";
import { computeAll, fmtMoney, fmtNum, fmtPct, histogram, kde, levelsOf, sum } from "@/lib/stats";
import { ordersFromCSV } from "@/lib/csv";

const C = {
  p: "var(--color-chart-1)",
  grid: "#262a30",
  mut: "#7d858d",
};
const axis = { fontSize: 10, fill: C.mut, fontFamily: "var(--font-mono)" };
const axisLabelStyle = { fontSize: 10, fill: C.mut, fontFamily: "var(--font-mono)" };
const tooltipStyle = {
  contentStyle: {
    background: "#1e2227",
    border: "1px solid #353a41",
    borderRadius: 8,
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "#f2f4f5",
  },
  itemStyle: { color: "#f2f4f5" },
  labelStyle: { color: "#b6bcc2" },
  cursor: { fill: "#3987e514" },
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

const SECTIONS = [
  { id: "resumen", label: "Resumen" },
  { id: "distribucion", label: "Distribución" },
  { id: "factores", label: "Factores" },
  { id: "relaciones", label: "Relaciones" },
  { id: "recomendacion", label: "Recomendación" },
] as const;

/** Dinero con signo delante ("−$135.4K"), para cifras que pueden ser negativas. */
const signedMoney = (v: number) => (v < 0 ? "−" + fmtMoney(-v) : fmtMoney(v));

export function App() {
  const [data, setData] = useState<{ orders: Order[]; source: string; updated: string | null }>(
    () => ({ orders: getOrders(), source: SAMPLE_SOURCE, updated: null }),
  );
  const [filter, setFilter] = useState<Filter>({ category: null, region: null, segment: null });
  const [scatterVar, setScatterVar] = useState<"discount" | "quantity" | "profit">("profit");
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setData(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Marca en el menú la sección que se está leyendo.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const atTop = () => window.scrollY < 80;
    const io = new IntersectionObserver(
      (entries) => {
        if (atTop()) return setActive(SECTIONS[0].id);
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    const onScroll = () => atTop() && setActive(SECTIONS[0].id);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
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
    try {
      localStorage.removeItem(STORAGE);
    } catch {
      /* ignore */
    }
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

  // Cifras de apoyo para justificar las interpretaciones.
  const extra = useMemo(() => {
    const desc = orders.map((o) => o.sales).sort((a, b) => b - a);
    const k = Math.max(1, Math.floor(desc.length * 0.1));
    const hd = orders.filter((o) => o.discount >= 0.3);
    const lo = orders.filter((o) => o.discount <= 0.2);
    const loSales = sum(lo.map((o) => o.sales));
    return {
      top10Share: s.totalSales ? sum(desc.slice(0, k)) / s.totalSales : 0,
      hdN: hd.length,
      hdProfit: sum(hd.map((o) => o.profit)),
      loMargin: loSales ? sum(lo.map((o) => o.profit)) / loSales : 0,
      lossPct: (key: Dim, name: string) => {
        const g = orders.filter((o) => o[key] === name);
        return g.length ? g.filter((o) => o.profit < 0).length / g.length : 0;
      },
    };
  }, [orders, s]);

  const factors = (["category", "region", "segment"] as Dim[])
    .map((k) => ({ k, v: s.eta[k] }))
    .sort((a, b) => b.v - a.v);
  const etaRatio = factors[1]!.v > 0.0005 ? factors[0]!.v / factors[1]!.v : null;
  const byMean = (g: typeof s.byCategory) => [...g].sort((a, b) => b.meanSales - a.meanSales)[0];
  const byOrders = (g: typeof s.byCategory) => [...g].sort((a, b) => b.orders - a.orders)[0];
  const medRange = (g: typeof s.byCategory) => {
    const m = g.map((x) => x.medianSales);
    return [Math.min(...m), Math.max(...m)] as const;
  };
  const topCat = byMean(s.byCategory);
  const topSeg = byMean(s.bySegment);
  const mostOrdersCat = byOrders(s.byCategory);
  const mostOrdersReg = byOrders(s.byRegion);
  const mostOrdersSeg = byOrders(s.bySegment);
  const lowMargin = [...s.byCategory].sort((a, b) => a.margin - b.margin)[0];
  const topReg = [...s.byRegion].sort((a, b) => b.totalProfit - a.totalProfit)[0];
  const bestMarginReg = [...s.byRegion].sort((a, b) => b.margin - a.margin)[0];
  const worstReg = [...s.byRegion].sort((a, b) => a.margin - b.margin)[0];
  const [regMedLo, regMedHi] = medRange(s.byRegion);
  const [segMedLo, segMedHi] = medRange(s.bySegment);
  const share = (part: number, whole: number) => fmtPct(whole ? part / whole : 0);
  const filtered = orders.length !== all.length;

  const csvButton = (compact = false) => (
    <button
      onClick={() => fileRef.current?.click()}
      className={`rounded-md bg-primary font-semibold text-primary-foreground transition-opacity hover:opacity-90 ${compact ? "px-3 py-1.5 text-xs" : "w-full px-3 py-2 text-sm"}`}
    >
      ↑ {compact ? "CSV" : "Actualizar datos (CSV)"}
    </button>
  );

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
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

      {/* ---------- menú lateral (escritorio) ---------- */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 overflow-y-auto border-r border-border bg-surface p-5 lg:flex">
        <PhotoCard className="aspect-[4/3]" />
        <nav className="grid gap-0.5" aria-label="Secciones">
          {SECTIONS.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${active === sec.id ? "bg-surface-2 text-foreground" : "text-soft-foreground hover:bg-surface-2/60 hover:text-foreground"}`}
            >
              <span className={`size-1.5 rounded-[2px] ${active === sec.id ? "bg-accent" : "bg-muted-foreground/50"}`} />
              {sec.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto grid gap-3">
          <dl className="grid gap-1.5 font-mono text-[11.5px] text-muted-foreground">
            <Row k="fuente" v={data.source} />
            <Row k="pedidos" v={fmtNum(all.length, 0)} />
            {filtered && <Row k="en filtro" v={fmtNum(orders.length, 0)} />}
            {data.updated && <Row k="cargado" v={data.updated} />}
          </dl>
          {csvButton()}
          {data.updated && (
            <button
              onClick={resetSample}
              className="w-full rounded-md border border-border px-3 py-2 text-sm text-soft-foreground hover:bg-surface-2"
            >
              Restaurar dataset original
            </button>
          )}
        </div>
      </aside>

      <div className="min-w-0">
        {/* ---------- barra superior (móvil y tableta) ---------- */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <span className="min-w-0 truncate font-mono text-sm font-semibold tracking-tight">
              Sample Superstore<span className="text-muted-foreground">/dashboard</span>
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {data.updated && (
                <button
                  onClick={resetSample}
                  className="rounded-md border border-border px-2.5 py-1.5 text-xs text-soft-foreground"
                >
                  Restaurar
                </button>
              )}
              {csvButton(true)}
            </div>
          </div>
          <nav className="no-scrollbar flex gap-1 overflow-x-auto px-4 pb-2 sm:px-6" aria-label="Secciones">
            {SECTIONS.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className={`shrink-0 rounded-full px-3 py-1 text-xs whitespace-nowrap transition-colors ${active === sec.id ? "bg-accent-soft text-foreground" : "text-soft-foreground"}`}
              >
                {sec.label}
              </a>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-[1280px] px-4 pt-5 pb-12 sm:px-6 lg:px-8 lg:pt-8">
          {/* ---------- resumen ---------- */}
          <section id="resumen">
            <PhotoCard className="mb-5 h-36 sm:h-44 lg:hidden" wide />
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div className="min-w-0">
                <h1 className="text-[1.45rem] leading-tight font-semibold tracking-tight text-balance sm:text-2xl">
                  ¿Qué factor explica el nivel de ventas?
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Categoría, región y segmento sobre {fmtNum(all.length, 0)} pedidos de {data.source}.
                </p>
              </div>
              <p className="flex items-center gap-2 font-mono text-xs text-soft-foreground">
                <span className="size-2 rounded-full bg-accent shadow-[0_0_0_4px_var(--accent-soft)]" />
                {data.updated ? "CSV propio cargado" : "Dataset original"}
                {filtered && <> · {fmtNum(orders.length, 0)} en el filtro</>}
              </p>
            </div>

            {err && (
              <div className="mt-4 rounded-lg border border-negative/40 bg-negative/10 px-4 py-3 text-sm text-negative">
                {err} El CSV debe tener las columnas: Category, Region, Segment, Sales, Quantity,
                Discount, Profit.
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2 xl:flex-row xl:flex-wrap">
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

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
              <Kpi label="Ventas" value={fmtMoney(s.totalSales)} sub={`${fmtNum(s.n, 0)} pedidos`} />
              <Kpi label="Beneficio" value={fmtMoney(s.totalProfit)} sub="después de descuentos" />
              <Kpi label="Margen" value={fmtPct(s.margin)} sub="beneficio / ventas" />
              <Kpi label="Venta media" value={fmtMoney(s.sales.mean)} sub={`mediana ${fmtMoney(s.sales.median)}`} />
              <Kpi
                className="col-span-2 md:col-span-1"
                label="Con pérdida"
                value={fmtPct(s.lossOrdersPct)}
                tone="neg"
                badge="de los pedidos"
              />
            </div>
          </section>

          {/* ---------- distribución ---------- */}
          <section id="distribucion" className="mt-10">
            <SectionHead
              title="Distribución de las ventas"
              text="Cómo se reparte el valor de los pedidos antes de comparar grupos."
            />
            <div className="grid gap-4 xl:grid-cols-12">
              <Card
                className="xl:col-span-7"
                title="Histograma de Sales"
                note={`Pedidos hasta 3 × Q3 (${fmtMoney(s.sales.q3 * 3)}) para que se vea la forma.`}
                insight={
                  <>
                    Asimetría de <b>{fmtNum(s.sales.skew)}</b>: la media (<b>{fmtMoney(s.sales.mean)}</b>) es{" "}
                    {fmtNum(s.sales.median ? s.sales.mean / s.sales.median : 0, 1)} veces la mediana (
                    <b>{fmtMoney(s.sales.median)}</b>). El 10 % de pedidos más grandes genera el{" "}
                    <b>{fmtPct(extra.top10Share)}</b> de las ventas. Como unos pocos pedidos pesan tanto, los
                    grupos se comparan con la mediana o en log(Sales), no con la media.
                  </>
                }
              >
                <ChartBox h={240}>
                  <BarChart data={hist} margin={{ bottom: 18, left: 6, right: 4 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="label" tick={axis} interval={5} label={xLabel("Ventas ($)")} />
                    <YAxis tick={axis} width={58} label={yLabel("Pedidos")} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" name="Pedidos" fill={C.p} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartBox>
              </Card>
              <Card
                className="xl:col-span-5"
                title="Densidad de log(Sales)"
                note="Misma variable en escala logarítmica."
                insight={
                  <>
                    Con el logaritmo la asimetría baja a <b>{fmtNum(s.logSales.skew)}</b> y la curva se parece a
                    una normal. Por eso el análisis de factores (η²) se hace sobre log(Sales): así los pocos
                    pedidos extremos no deciden la comparación.
                  </>
                }
              >
                <ChartBox h={240}>
                  <AreaChart data={dens} margin={{ bottom: 18, left: 6, right: 4 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="x" tick={axis} interval={11} label={xLabel("Log(Ventas)")} />
                    <YAxis tick={axis} width={58} label={yLabel("Densidad")} />
                    <Tooltip {...tooltipStyle} />
                    <Area dataKey="density" name="Densidad" stroke={C.p} fill={C.p} fillOpacity={0.14} strokeWidth={2} />
                  </AreaChart>
                </ChartBox>
              </Card>
              <Card
                className="xl:col-span-12"
                title="Resumen estadístico de Sales"
                insight={
                  <>
                    El 50 % central de los pedidos está entre <b>{fmtMoney(s.sales.q1)}</b> y{" "}
                    <b>{fmtMoney(s.sales.q3)}</b> (rango intercuartílico de {fmtMoney(s.sales.q3 - s.sales.q1)}), mientras
                    que el máximo llega a <b>{fmtMoney(s.sales.max)}</b>. La mayoría de los pedidos son pequeños.
                  </>
                }
              >
                <div className="grid grid-cols-3 gap-2 font-mono sm:grid-cols-6">
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
                    <div key={l} className="rounded-md bg-surface-2 px-3 py-2">
                      <div className="text-[11px] text-muted-foreground">{l}</div>
                      <div className="text-sm font-medium">{fmtMoney(v)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </section>

          {/* ---------- factores ---------- */}
          <section id="factores" className="mt-10">
            <SectionHead
              title="Factores: categoría, región y segmento"
              text="Cuánto explica cada factor el valor de un pedido, y cómo se reparten los pedidos."
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Card
                className="md:col-span-2 xl:col-span-3"
                title="Factor que explica log(Sales) · η²"
                note="Proporción de la variación de log(Sales) que explica cada factor."
                insight={
                  <>
                    <b>{DIM_LABEL[factors[0]!.k]}</b> explica el {fmtPct(factors[0]!.v)} de la variación de
                    log(Sales), frente a {fmtPct(factors[1]!.v)} de {DIM_LABEL[factors[1]!.k].toLowerCase()} y{" "}
                    {fmtPct(factors[2]!.v)} de {DIM_LABEL[factors[2]!.k].toLowerCase()}
                    {etaRatio && etaRatio >= 2 ? <>, unas <b>{fmtNum(etaRatio, 0)} veces</b> más que el siguiente</> : null}.
                    Esta es la respuesta a la pregunta del proyecto. Coincide con el EDA sobre el dataset completo:
                    en los boxplots de log(Sales), Office Supplies queda casi 2 puntos por debajo de Technology y
                    Furniture, mientras que las cajas por región y por segmento casi se superponen.
                  </>
                }
              >
                <div className="grid gap-4 sm:grid-cols-3">
                  {factors.map((f, i) => (
                    <div key={f.k}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">{DIM_LABEL[f.k]}</span>
                        <span className={`font-mono ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                          {fmtPct(f.v)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
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
                title="Pedidos por categoría"
                insight={
                  s.byCategory.length < 2 || !mostOrdersCat || !topCat ? (
                    "Hay una sola categoría en el filtro actual."
                  ) : mostOrdersCat.name === topCat.name ? (
                    <>
                      <b>{topCat.name}</b> concentra más pedidos y además tiene la venta media más alta (
                      {fmtMoney(topCat.meanSales)}).
                    </>
                  ) : (
                    <>
                      <b>{mostOrdersCat.name}</b> reúne el {share(mostOrdersCat.orders, s.n)} de los pedidos pero
                      solo el {share(mostOrdersCat.totalSales, s.totalSales)} de las ventas. <b>{topCat.name}</b>{" "}
                      hace lo contrario: {share(topCat.orders, s.n)} de los pedidos y{" "}
                      {share(topCat.totalSales, s.totalSales)} de las ventas, con una venta mediana de{" "}
                      {fmtMoney(topCat.medianSales)} frente a {fmtMoney(mostOrdersCat.medianSales)}. La categoría
                      cambia el tamaño de cada pedido, no solo cuántos hay.
                    </>
                  )
                }
              >
                <ChartBox h={200}>
                  <BarChart data={s.byCategory.slice(0, 8)} layout="vertical" margin={{ left: 4, right: 8, bottom: 18 }}>
                    <XAxis type="number" tick={axis} label={xLabel("Pedidos")} />
                    <YAxis type="category" dataKey="name" tick={axis} width={96} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="orders" name="Pedidos" fill={C.p} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ChartBox>
              </Card>
              <Card
                title="Pedidos por región"
                insight={
                  s.byRegion.length < 2 || !mostOrdersReg || !bestMarginReg || !worstReg ? (
                    "Hay una sola región en el filtro actual."
                  ) : (
                    <>
                      <b>{mostOrdersReg.name}</b> tiene más pedidos ({share(mostOrdersReg.orders, s.n)}), pero la
                      venta mediana apenas cambia entre regiones ({fmtMoney(regMedLo)} a {fmtMoney(regMedHi)}): la
                      región mueve el volumen, no el valor de cada pedido. Donde sí se separan es en margen:{" "}
                      <b>{bestMarginReg.name}</b> {fmtPct(bestMarginReg.margin)} frente a <b>{worstReg.name}</b>{" "}
                      {fmtPct(worstReg.margin)}.
                    </>
                  )
                }
              >
                <ChartBox h={200}>
                  <BarChart data={s.byRegion.slice(0, 8)} layout="vertical" margin={{ left: 4, right: 8, bottom: 18 }}>
                    <XAxis type="number" tick={axis} label={xLabel("Pedidos")} />
                    <YAxis type="category" dataKey="name" tick={axis} width={96} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="orders" name="Pedidos" fill={C.p} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ChartBox>
              </Card>
              <Card
                className="md:col-span-2 xl:col-span-1"
                title="Pedidos por segmento"
                insight={
                  s.bySegment.length < 2 || !mostOrdersSeg || !topSeg ? (
                    "Hay un solo segmento en el filtro actual."
                  ) : (
                    <>
                      <b>{mostOrdersSeg.name}</b> aporta el {share(mostOrdersSeg.orders, s.n)} de los pedidos. Las
                      medianas van de {fmtMoney(segMedLo)} a {fmtMoney(segMedHi)} y <b>{topSeg.name}</b> tiene la
                      venta media más alta ({fmtMoney(topSeg.meanSales)}), pero con poca diferencia.{" "}
                      {mostOrdersSeg.name} vende más porque tiene más pedidos, no pedidos más caros.
                    </>
                  )
                }
              >
                <ChartBox h={200}>
                  <BarChart data={s.bySegment.slice(0, 8)} layout="vertical" margin={{ left: 4, right: 8, bottom: 18 }}>
                    <XAxis type="number" tick={axis} label={xLabel("Pedidos")} />
                    <YAxis type="category" dataKey="name" tick={axis} width={96} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="orders" name="Pedidos" fill={C.p} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ChartBox>
              </Card>
            </div>
          </section>

          {/* ---------- relaciones ---------- */}
          <section id="relaciones" className="mt-10">
            <SectionHead
              title="Relación con las variables numéricas"
              text="Beneficio, cantidad y descuento frente al valor de venta."
            />
            <div className="grid gap-4 xl:grid-cols-12">
              <Card
                className="xl:col-span-8"
                title="Relación de Sales con variables numéricas"
                insight={
                  <>
                    Beneficio (r = <b>{fmtNum(s.corr.profit)}</b>) es la variable que más acompaña a las ventas;
                    cantidad (r = {fmtNum(s.corr.quantity)}) lo hace débilmente. El descuento casi no se relaciona
                    con el monto vendido (r = {fmtNum(s.corr.discount)}), pero sí con el beneficio (r ={" "}
                    <b>{fmtNum(s.corr.discountProfit)}</b>): su efecto no está en cuánto se vende, sino en cuánto se
                    gana. Como la correlación solo mide relaciones lineales, el EDA lo confirma con el gráfico de
                    bins 2D.
                  </>
                }
              >
                <div className="mb-3 flex flex-wrap gap-2">
                  {(["profit", "quantity", "discount"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setScatterVar(v)}
                      aria-pressed={scatterVar === v}
                      className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${scatterVar === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface-2 text-soft-foreground hover:text-foreground"}`}
                    >
                      Sales × {v === "profit" ? "Profit" : v === "quantity" ? "Quantity" : "Discount"} · r ={" "}
                      {fmtNum(s.corr[v])}
                    </button>
                  ))}
                </div>
                <ChartBox h={280}>
                  <ScatterChart margin={{ bottom: 18, left: 6, right: 8 }}>
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
                    <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: "3 3", stroke: "#353a41" }} />
                    <Scatter data={scatter} fill={C.p} fillOpacity={0.45} />
                  </ScatterChart>
                </ChartBox>
              </Card>
              <Card
                className="xl:col-span-4"
                title="Impacto del descuento"
                insight={
                  extra.hdN ? (
                    <>
                      Un descuento alto no hace más grande el pedido, pero casi siempre lo vuelve una pérdida. Con
                      descuentos de hasta 20 % el margen es <b>{fmtPct(extra.loMargin)}</b>, por encima del margen
                      total de {fmtPct(s.margin)}.
                    </>
                  ) : (
                    "No hay pedidos con descuento de 30 % o más en el filtro actual."
                  )
                }
              >
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
                  <Stat
                    label="Pedidos con descuento ≥ 30 % que pierden dinero"
                    value={extra.hdN ? fmtPct(s.highDiscountLossPct) : "—"}
                    sub={`${fmtNum(extra.hdN, 0)} pedidos`}
                    tone="neg"
                  />
                  <Stat
                    label="Beneficio neto de esos pedidos"
                    value={extra.hdN ? signedMoney(extra.hdProfit) : "—"}
                    sub="suma de todos ellos"
                    tone={extra.hdProfit < 0 ? "neg" : undefined}
                  />
                  <Stat
                    className="col-span-2 xl:col-span-1"
                    label="Margen con descuento ≤ 20 %"
                    value={fmtPct(extra.loMargin)}
                    sub={`margen total ${fmtPct(s.margin)}`}
                  />
                </div>
              </Card>
            </div>
          </section>

          {/* ---------- recomendación ---------- */}
          <section id="recomendacion" className="mt-10">
            <SectionHead title="Qué debería priorizar el negocio" text="Acciones ordenadas por impacto, con la cifra que las respalda." />
            <div className="panel p-5 sm:p-6">
              <ol className="grid gap-5 lg:grid-cols-3 lg:gap-6">
                {extra.hdN > 0 && (
                  <Action n={1} title="Limitar los descuentos de 30 % o más">
                    El {fmtPct(s.highDiscountLossPct, 0)} de esos pedidos pierde dinero y en conjunto restan{" "}
                    <b>{signedMoney(extra.hdProfit)}</b> de beneficio. Con descuentos de hasta 20 % el margen sube a{" "}
                    <b>{fmtPct(extra.loMargin)}</b>.
                  </Action>
                )}
                {lowMargin && (
                  <Action n={extra.hdN > 0 ? 2 : 1} title={`Revisar precios y descuentos de ${lowMargin.name}`}>
                    Tiene el margen más bajo (<b>{fmtPct(lowMargin.margin)}</b>) y el{" "}
                    <b>{fmtPct(extra.lossPct("category", lowMargin.name))}</b> de sus pedidos da pérdida, aunque
                    su venta mediana es alta ({fmtMoney(lowMargin.medianSales)}). Vende bien, pero gana poco.
                  </Action>
                )}
                {topReg && worstReg && topReg.name !== worstReg.name && (
                  <Action n={(extra.hdN > 0 ? 2 : 1) + (lowMargin ? 1 : 0)} title={`Llevar a ${worstReg.name} la política de ${topReg.name}`}>
                    {worstReg.name} aplica un descuento medio de <b>{fmtPct(worstReg.meanDiscount, 0)}</b> y su margen es{" "}
                    {fmtPct(worstReg.margin)}. {topReg.name} descuenta {fmtPct(topReg.meanDiscount, 0)}, logra{" "}
                    {fmtPct(topReg.margin)} de margen y el mayor beneficio (<b>{fmtMoney(topReg.totalProfit)}</b>).
                  </Action>
                )}
              </ol>
              <div className="mt-6 border-t border-border pt-5">
                <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Conclusión del EDA</p>
                <p className="mt-2 max-w-4xl text-[15px] leading-relaxed text-soft-foreground [&_b]:font-semibold [&_b]:text-foreground">
                  La <b>categoría</b> es el factor que más explica el nivel de ventas porque define el tamaño típico
                  del pedido: Technology y Furniture venden pedidos grandes y Office Supplies muchos pedidos
                  pequeños. <b>Región</b> y <b>segmento</b> cambian el número de pedidos, no su valor. El{" "}
                  <b>descuento</b> no aumenta las ventas, pero sí reduce la rentabilidad.
                </p>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-2 px-4 py-5 font-mono text-[11px] text-muted-foreground sm:px-6 lg:px-8">
            <span>Sample Superstore / dashboard</span>
            <span>{data.source}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function PhotoCard({ className = "", wide = false }: { className?: string; wide?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-surface-2 bg-cover ${className}`}
      style={{ backgroundImage: `url(${photo})`, backgroundPosition: wide ? "center 40%" : "30% center" }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: wide
            ? "linear-gradient(90deg, rgba(15,17,20,.92) 0%, rgba(15,17,20,.55) 55%, rgba(15,17,20,.1) 100%)"
            : "linear-gradient(to top, rgba(15,17,20,.9) 0%, rgba(15,17,20,.2) 55%, transparent 100%)",
        }}
      />
      <div className="absolute bottom-3 left-4 right-4">
        <p className="text-base font-semibold text-white">Sample Superstore</p>
        <p className="text-xs text-white/75">Ventas minoristas · EE. UU.</p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-border pb-1.5">
      <dt>{k}</dt>
      <dd className="min-w-0 truncate text-right text-foreground">{v}</dd>
    </div>
  );
}

function SectionHead({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight text-balance">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  badge,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neg";
  badge?: string;
  className?: string;
}) {
  return (
    <div className={`panel min-w-0 p-4 ${className}`}>
      <p className="font-mono text-[10.5px] tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p
        className={`mt-1.5 truncate font-mono text-xl font-medium tracking-tight xl:text-[1.6rem] ${tone === "neg" ? "text-negative" : "text-foreground"}`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-xs text-soft-foreground">{sub}</p>}
      {badge && (
        <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-warning/15 py-0.5 pr-2 pl-1.5 text-xs text-foreground">
          <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
            <path d="M6 .8l5.4 10H.6z" fill="var(--warning)" />
            <path d="M6 4.3v3" stroke="#0f1114" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="6" cy="9" r=".8" fill="#0f1114" />
          </svg>
          {badge}
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neg";
  className?: string;
}) {
  return (
    <div className={`min-w-0 rounded-md bg-surface-2 px-3 py-2.5 ${className}`}>
      <p className="text-xs leading-snug text-soft-foreground">{label}</p>
      <p className={`mt-1 font-mono text-lg font-medium ${tone === "neg" ? "text-negative" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Action({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent">
        {n}
      </span>
      <div className="min-w-0">
        <h3 className="font-semibold text-balance">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-soft-foreground [&_b]:font-semibold [&_b]:text-foreground">
          {children}
        </p>
      </div>
    </li>
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
    <div className="panel flex min-w-0 items-center gap-1 p-1">
      <span className="shrink-0 px-2 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">{label}</span>
      <div className="no-scrollbar flex min-w-0 gap-1 overflow-x-auto">
        {[null, ...options].map((o) => (
          <button
            key={o ?? "all"}
            onClick={() => onChange(o)}
            aria-pressed={value === o}
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition-colors ${value === o ? "bg-accent-soft text-foreground ring-1 ring-accent/50" : "text-soft-foreground hover:bg-surface-2 hover:text-foreground"}`}
          >
            {o ?? "Todas"}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Tarjeta de visualización: el gráfico y, justo debajo, el insight que responde a la pregunta de negocio asociada. */
function Card({
  title,
  note,
  children,
  insight,
  className = "",
}: {
  title: string;
  note?: string;
  children: ReactNode;
  insight?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel min-w-0 p-4 sm:p-5 ${className}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-4">{children}</div>
      {insight && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Interpretación</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-soft-foreground [&_b]:font-semibold [&_b]:text-foreground">
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
