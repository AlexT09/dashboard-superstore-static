# Dashboard

*Dashboard de ventas interactivo — insights que responden a los objetivos del proyecto*

El dashboard 3D muestra un anillo de tarjetas con los KPIs que abre la vista de gráficos, con filtros
por categoría, región, segmento y año. Lo genera `dashboard/build_dashboard.py` del proyecto Dash, a
partir del mismo dataset transformado que usa el [EDA](eda.ipynb).

```{raw} html
<iframe src="_static/3d/3DWebDashboard.html" title="Dashboard 3D de ventas · Sample Superstore"
        style="width:100%;height:820px;border:0;border-radius:12px" loading="lazy"></iframe>
```

<a href="_static/3d/3DWebDashboard.html" target="_blank">Abrir el dashboard 3D en pantalla completa</a> ·
<a href="_static/dashboard.html" target="_blank">abrir la versión 2D</a>

```{note}
El dashboard 3D lee sus datos con `fetch`, así que solo funciona cuando el libro se sirve por HTTP
(GitHub Pages o `python -m http.server`), no abriendo el HTML con doble clic. También necesita
internet: React, Plotly y las fuentes se cargan desde un CDN.
```
