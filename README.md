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

---

Proyecto: Alex Teran y David Estrada.
