# Dashboard de ventas · Sample Superstore (versión HTML)

Dashboard interactivo que responde la pregunta de negocio del proyecto:
**¿qué factores (categoría, región y segmento) explican el nivel de ventas (`Sales`)?**

Todo el dashboard vive en **un solo archivo**, [`docs/index.html`](docs/index.html): datos, gráficos,
estilos e interpretaciones. No necesita servidor ni instalación.

- **Ver en línea:** `https://<tu-usuario>.github.io/<nombre-del-repo>/` (ver [Publicar con GitHub Pages](#publicar-con-github-pages))
- **Descargar:** botón **"↓ Descargar dashboard (HTML)"** en la página publicada, o directamente el archivo
  [`docs/index.html`](docs/index.html) desde GitHub (botón *Download raw file*).

Proyecto: Alex Teran y David Estrada.

---

## Cómo se usa

1. Abre el link o haz **doble clic** en el archivo `.html`. Se abre en Chrome, Edge, Firefox o Safari,
   también en el celular.
2. Usa los filtros de **Categoría**, **Región** y **Segmento**. Los KPIs, todos los gráficos y los textos de
   interpretación se recalculan con los pedidos seleccionados.
3. En **"Venta mediana por pedido"** cambia entre Categoría / Región / Segmento, y en **"Relación de Sales con
   variables numéricas"** entre Profit / Quantity / Discount.
4. Pasa el mouse sobre los gráficos para ver los valores exactos.
5. **Actualizar datos (CSV):** carga otro archivo con las columnas `Category, Region, Segment, Sales, Quantity,
   Discount, Profit` y el dashboard se recalcula con esos datos. El archivo no sale de tu computador: se procesa
   en el navegador.

## Qué muestra

| Sección | Gráfico | Pregunta que responde |
|---|---|---|
| KPIs | Pedidos, ventas, beneficio, venta media, % de pedidos con pérdida | Panorama general |
| 1 · Univariado | Resumen estadístico de Sales | ¿La mayoría de los pedidos son de bajo valor? |
| | Histograma de Sales (≤ $1.000) y densidad de log(Sales) | ¿Cómo se distribuye `Sales`? |
| | Pedidos por categoría, región y segmento | ¿Cómo se distribuyen los pedidos entre grupos? |
| 2 · Bivariado | Venta mediana por pedido | ¿El valor de venta cambia según el grupo? |
| | Factor que explica log(Sales) · η² | ¿Qué factor explica más el nivel de ventas? |
| | Dispersión Sales × Profit / Quantity / Discount | ¿Existe relación entre `Sales` y las variables numéricas? |
| | Pedidos por nivel de descuento | ¿Cómo se relaciona el descuento con la pérdida? |
| 3 · Conclusión | Lo que muestran los datos y lectura de negocio | Respuesta a la pregunta del proyecto |

### De dónde salen las interpretaciones

Las interpretaciones siguen el EDA del proyecto (pestaña *EDA* de la app Dash, `tabs/eda.py`), pero **no son
texto fijo**: cada cifra se calcula con los datos filtrados en el momento. Con el dataset completo reproducen los
resultados del EDA, por ejemplo:

- Media 230 vs. mediana 54,5 y desviación estándar 623 → fuerte asimetría positiva.
- Office Supplies concentra el 60,3% de los pedidos; West el 32,0%; Consumer el 51,9%.
- Venta mediana: Furniture $182 y Technology $166 frente a Office Supplies $27 (medianas de log(Sales): 5,205,
  5,113 y 3,311).
- η²: la categoría explica el 21,6% de la variación de log(Sales); región 0,30% y segmento 0,01%.
- Correlaciones con Sales: Profit 0,48 (moderada), Quantity 0,20 (débil), Discount −0,03 (prácticamente nula).
- El 86,1% de los pedidos tiene descuento de 20% o menos; el 97% de los pedidos con descuento ≥ 30% pierde dinero.

**No incluido:** la sección *Ventas en el tiempo* del EDA. El dataset embebido (`src/data/superstore.json`) no
trae fechas, así que esas tendencias no se pueden calcular aquí.

## Tecnologías y cómo funcionan juntas

| Tecnología | Para qué se usa |
|---|---|
| **React** | Construye la interfaz a partir de componentes (tarjetas, filtros, KPIs). Cuando cambia un filtro, React vuelve a dibujar solo lo necesario. |
| **TypeScript** | JavaScript con tipos: detecta errores (por ejemplo, un campo mal escrito) antes de compilar. |
| **Recharts** | Librería de gráficos para React (barras, áreas, dispersión), con tooltips y animaciones. |
| **Tailwind CSS** | Estilos con clases utilitarias (`rounded-2xl`, `text-sm`…). La paleta azul petróleo está en `src/styles.css`. |
| **Vite** | Herramienta de desarrollo y compilación: servidor local con recarga automática (`npm run dev`) y compilación (`npm run build`). |
| **vite-plugin-singlefile** | Mete todo el JavaScript, el CSS y los datos **dentro de un único `index.html`**. Por eso se puede mandar como archivo. |
| **GitHub Pages** | Publica gratis la carpeta `docs/` como sitio web con un link. |

**Flujo:** `src/data/superstore.json` (datos) → `src/lib/stats.ts` (media, mediana, cuartiles, η²,
correlaciones, histograma, densidad) → `src/App.tsx` (gráficos e interpretaciones) → `npm run build` →
`docs/index.html`.

**¿Por qué funciona sin servidor?** Todos los cálculos ocurren en el navegador con JavaScript. A diferencia de la
app Dash en Python, que necesita un servidor ejecutando los *callbacks*, este archivo no depende de nadie del otro
lado. Por eso sirve para GitHub Pages y para abrirlo sin conexión.

Las fuentes (Inter y JetBrains Mono) se cargan de Google Fonts. Sin internet, el navegador usa fuentes del
sistema y todo lo demás funciona igual.

## Estructura

```
├── docs/index.html        ← el dashboard compilado (lo que se publica y se descarga)
├── index.html             ← plantilla de entrada para Vite
├── src/
│   ├── App.tsx            ← gráficos, filtros e interpretaciones
│   ├── main.tsx           ← punto de arranque de React
│   ├── styles.css         ← tema y colores (Tailwind)
│   ├── lib/stats.ts       ← cálculos estadísticos
│   ├── lib/csv.ts         ← lectura de CSV propios
│   ├── lib/sales-data.ts  ← carga del dataset
│   └── data/superstore.json
├── package.json           ← dependencias y comandos
└── vite.config.ts         ← configuración de compilación (salida a docs/)
```

## Modificar y volver a generar el HTML

Requisito: [Node.js](https://nodejs.org) 20 o superior.

```powershell
npm install        # una sola vez
npm run dev        # vista previa en http://localhost:5173 con recarga automática
npm run build      # genera docs/index.html
```

Después de `npm run build`, sube los cambios a GitHub (`git add . && git commit -m "..." && git push`) y GitHub
Pages se actualiza en 1–2 minutos, con el mismo link.

## Publicar con GitHub Pages

1. Sube este repositorio a GitHub. En la cuenta gratuita el repositorio debe ser **público**.
2. En el repositorio: **Settings → Pages**.
3. **Source:** *Deploy from a branch* · **Branch:** `main` · carpeta **`/docs`** → **Save**.
4. En 1–2 minutos aparece el link `https://<tu-usuario>.github.io/<nombre-del-repo>/`.

> ⚠️ GitHub Pages es público: cualquiera con el link ve el dashboard y sus datos. Para datos privados de un
> cliente, entrega el archivo `.html` directamente en lugar del link.

## Editar el diseño con Lovable

Lovable trabaja con el mismo stack (React + Vite + Tailwind), así que puede editar este proyecto. Lovable
**crea** el repositorio desde su propio proyecto y no importa uno existente, por eso el flujo es:

1. En Lovable, crea un proyecto nuevo y conéctalo a GitHub: **GitHub → Connect → Create repository**.
2. Clona ese repositorio nuevo en tu computador, reemplaza su contenido con los archivos de este proyecto y haz
   `git push`. Lovable toma el código automáticamente.
3. Pide los cambios de diseño en Lovable. Cada cambio se sube solo a GitHub.
4. Para generar el HTML descargable, en tu computador: `git pull` → `npm run build` → `git push`.

Recomendación para el prompt: pide cambios **visuales** y aclara que no modifique `src/lib/` ni
`src/data/`, para que los cálculos e interpretaciones sigan siendo correctos.

## Limitaciones

- **Sin asistente de IA.** Un chat de IA necesita un servidor que guarde la API key de forma segura; en un HTML
  la key quedaría visible para cualquiera. La versión con chat está en el proyecto `dash-src`.
- **Sin sección temporal**, porque el dataset embebido no trae fechas.
- El η² y las correlaciones son descriptivos: indican asociación, no causalidad.
