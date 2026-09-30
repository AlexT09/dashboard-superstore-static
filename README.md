# Dashboard de ventas · Sample Superstore (versión HTML)

Dashboard interactivo que responde la pregunta de negocio del proyecto:
**¿qué factores (categoría, región y segmento) explican el nivel de ventas (`Sales`)?**

Es el mismo dashboard de `dash-src` (mismos gráficos, cifras e interpretaciones), **sin el asistente de IA**, y
empaquetado en **un solo archivo**: [`docs/index.html`](docs/index.html). No necesita servidor ni instalación.

- **Ver en línea:** `https://<tu-usuario>.github.io/<nombre-del-repo>/` (ver [Publicar con GitHub Pages](#publicar-con-github-pages))
- **Descargar:** abre [`docs/index.html`](docs/index.html) en GitHub y usa el botón *Download raw file* (↓).
  Ese único archivo es el dashboard completo: se puede enviar por correo, WhatsApp, Drive o USB.

Proyecto: Alex Teran y David Estrada.

---

## Cómo se usa

1. Abre el link o haz **doble clic** en el archivo `.html`. Se abre en Chrome, Edge, Firefox o Safari, también
   en el celular.
2. Usa los filtros de **Categoría**, **Región** y **Segmento**. Los KPIs, los gráficos y los textos de
   interpretación se recalculan con los pedidos seleccionados.
3. En **"Relación de Sales con variables numéricas"** cambia entre Profit, Quantity y Discount.
4. Pasa el mouse sobre los gráficos para ver los valores exactos.
5. **Actualizar datos (CSV):** carga otro archivo con las columnas `Category, Region, Segment, Sales, Quantity,
   Discount, Profit` y el dashboard se recalcula con esos datos. El archivo se procesa en el navegador; no se
   envía a ningún lado. **Restaurar dataset original** vuelve a los datos de Sample Superstore.

## Qué muestra

| Sección | Contenido |
|---|---|
| KPIs | Ventas, Beneficio, Margen, Venta media (y mediana), Pedidos con pérdida |
| Histograma de Sales | Distribución del valor de los pedidos y su asimetría |
| Densidad de log(Sales) | La misma distribución en escala logarítmica |
| Pedidos por categoría, región y segmento | Dónde se concentran los pedidos y dónde está el valor |
| Relación de Sales con variables numéricas | Dispersión de Sales frente a Profit, Quantity o Discount, con su correlación (r) |
| Factor que explica log(Sales) · η² | Qué factor explica más el nivel de ventas, más Mín, Q1, Mediana, Media, Q3 y Máx |
| Qué debería priorizar el negocio | Recomendación con base en margen, región menos rentable y descuentos |

Cada gráfico trae debajo su interpretación. Las cifras de esas interpretaciones **no son texto fijo**: se
calculan con los datos filtrados en ese momento.

## Tecnologías y cómo funcionan juntas

| Tecnología | Para qué se usa |
|---|---|
| **React** | Construye la interfaz con componentes (tarjetas, filtros, KPIs). Cuando cambia un filtro, vuelve a dibujar solo lo necesario. |
| **TypeScript** | JavaScript con tipos: detecta errores antes de compilar. |
| **Recharts** | Gráficos para React (barras, áreas, dispersión), con tooltips y animaciones. |
| **Tailwind CSS** | Estilos con clases utilitarias. La paleta azul petróleo está en `src/styles.css`. |
| **Vite** | Servidor local con recarga automática (`npm run dev`) y compilación (`npm run build`). |
| **vite-plugin-singlefile** | Mete el JavaScript, el CSS y los datos **dentro de un único `index.html`**. Por eso se puede mandar como archivo. |
| **GitHub Pages** | Publica gratis la carpeta `docs/` como página web con un link. |

**Flujo:** `src/data/superstore.json` (datos) → `src/lib/stats.ts` (media, mediana, cuartiles, asimetría, η²,
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
├── index.html             ← plantilla de entrada para Vite (título y descripción)
├── src/
│   ├── App.tsx            ← gráficos, filtros e interpretaciones (igual que dash-src, sin la IA)
│   ├── main.tsx           ← punto de arranque de React
│   ├── styles.css         ← tema y colores
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

Después de `npm run build`, sube los cambios (`git add .`, `git commit -m "..."`, `git push`) y GitHub Pages se
actualiza en 1–2 minutos, con el mismo link.

## Publicar con GitHub Pages

1. Sube este repositorio a GitHub. En la cuenta gratuita debe ser **público**.
2. En el repositorio: **Settings → Pages**.
3. **Source:** *Deploy from a branch* · **Branch:** `main` · carpeta **`/docs`** → **Save**.
4. En 1–2 minutos aparece el link `https://<tu-usuario>.github.io/<nombre-del-repo>/`.

> ⚠️ GitHub Pages es público: cualquiera con el link ve el dashboard y sus datos. Para datos privados de un
> cliente, entrega el archivo `.html` directamente en lugar del link.

## Editar el diseño con Lovable

Lovable trabaja con el mismo stack (React + Vite + Tailwind). Lovable **crea** el repositorio desde su propio
proyecto y no importa uno existente, así que el flujo es:

1. En Lovable, crea un proyecto nuevo y conéctalo a GitHub: **GitHub → Connect → Create repository**.
2. Clona ese repositorio en tu computador, reemplaza su contenido con los archivos de este proyecto y haz
   `git push`. Lovable toma el código.
3. Pide los cambios de diseño en Lovable. Cada cambio se sube solo a GitHub.
4. Para regenerar el HTML descargable: `git pull` → `npm run build` → `git push`.

En el prompt, pide cambios **visuales** y aclara que no modifique `src/lib/` ni `src/data/`, para que los cálculos
e interpretaciones sigan siendo correctos.

## Limitaciones

- **Sin asistente de IA.** Un chat de IA necesita un servidor que guarde la API key de forma segura; dentro de un
  HTML la key quedaría visible para cualquiera. La versión con chat es `dash-src`.
- η² y las correlaciones son descriptivos: indican asociación, no causalidad.
