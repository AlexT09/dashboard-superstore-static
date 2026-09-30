# Dashboard de ventas · Sample Superstore

Dashboard interactivo que responde: **¿qué factores (categoría, región y segmento) explican el nivel de ventas?**

Todo el dashboard está en un solo archivo HTML: **[`docs/dashboard_superstore.html`](docs/dashboard_superstore.html)**.

## Cómo verlo

1. Abre [`docs/dashboard_superstore.html`](docs/dashboard_superstore.html) y haz clic en **Download raw file** (↓).
2. Haz **doble clic** en el archivo descargado: se abre en el navegador (Chrome, Edge, Firefox o Safari).
3. Usa los filtros de **Categoría**, **Región** y **Segmento**: los gráficos, cifras e interpretaciones se
   actualizan solos.

No necesita instalar nada ni internet. El archivo se puede enviar por correo, WhatsApp o Drive.

## Tecnologías

| Tecnología | Para qué sirve |
|---|---|
| **React** | Arma la página con componentes (filtros, tarjetas, KPIs) y la actualiza al cambiar un filtro. |
| **TypeScript** | JavaScript con tipos, para evitar errores en el código. |
| **Recharts** | Dibuja los gráficos (barras, áreas, dispersión) con animaciones y tooltips. |
| **Tailwind CSS** | Da el diseño y los colores. |
| **Vite** | Compila el proyecto. |
| **vite-plugin-singlefile** | Junta datos, gráficos y estilos en **un solo archivo HTML**. |

Todos los cálculos se hacen en el navegador, por eso el archivo funciona solo, sin servidor.

## Estructura

```
├── docs/
│   ├── dashboard_superstore.html  ← el dashboard (archivo para descargar y enviar)
│   └── index.html                 ← copia idéntica, la que muestra el link web
├── src/                           ← código fuente (gráficos, cálculos y datos)
├── index.html                     ← plantilla que usa Vite para compilar (no es el dashboard)
├── package.json                   ← dependencias y comandos
└── vite.config.ts                 ← configuración de compilación
```

**Ramas:** `main` tiene el código; `gh-pages` tiene solo el HTML publicado en
https://alext09.github.io/dashboard-superstore-static/ (se actualiza con `npm run build` y
`ghp-import -n -p -f docs`).

---

Proyecto: Alex Teran y David Estrada.
