# Proyecto Sample Superstore — Jupyter Book

Análisis exploratorio de datos (EDA) del dataset **Sample Superstore** para responder la
pregunta de negocio: **¿qué factores (categoría, región, segmento) explican el nivel de ventas?**

Es el mismo proyecto de la app Dash ([proyecto_superstorep](https://github.com/AlexT09/proyecto_superstorep)),
entregado como **Jupyter Book**: cada pestaña de la app es un capítulo del libro, y el EDA es un
notebook que se ejecuta al construir el libro.

## Requisitos

- **Python** 3.10 o superior

## Cómo construir el libro

```powershell
python -m venv .venv
.venv\Scripts\activate       # en macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
jupyter-book build .
```

El HTML queda en `_build/html/`. Para verlo con el dashboard 3D funcionando, sírvelo por HTTP:

```powershell
python -m http.server 8000 --directory _build/html
```

Y abre **http://localhost:8000**. Abriendo `_build/html/index.html` con doble clic se ven todos los
capítulos y gráficas, pero el dashboard 3D no carga sus datos (usa `fetch`).

## Publicación (GitHub Pages)

El libro publicado está en **https://alext09.github.io/superstore-jupyterbook/**, servido desde
la rama `gh-pages`, que contiene solo el HTML de `_build/html/` (más un `.nojekyll`, necesario para
que GitHub sirva las carpetas que empiezan con `_`). Para actualizarlo, se construye el libro y se
reemplaza el contenido de esa rama con `_build/html/`.

## Capítulos

| Capítulo | Archivo | Pestaña de la app |
|---|---|---|
| Introducción | `intro.md` | Introducción |
| Contexto | `contexto.md` | Contexto |
| Planteamiento del problema | `problema.md` | Problema |
| Objetivos | `objetivos.md` | Objetivos |
| Marco teórico | `marco_teorico.md` | Marco teórico |
| Metodología (ETL) | `metodologia.ipynb` | Metodología |
| EDA | `eda.ipynb` | EDA |
| Dashboard | `dashboard.md` | Dashboard |
| Limitaciones | `limitaciones.md` | Limitaciones |
| Conclusiones | `conclusiones.md` | Conclusiones |

## Gráficas

Las gráficas son de **Plotly** e interactivas. Para no repetir plotly.js (~4 MB) en cada gráfica, la
función `show()` de `common.py` inserta solo la figura y el libro carga la librería una vez
(`_config.yml` → `html_js_files`). Por eso, si abres los notebooks en Jupyter, las gráficas no se
ven en el notebook: se ven en el libro construido.

## Dashboard

`_static/3d/` es una copia de `3DWebDashboard/` del proyecto Dash, y `_static/3d/dashboard_data.html`
(igual que `_static/dashboard.html`) es el `assets/dashboard.html` que genera
`dashboard/build_dashboard.py`. Si cambian los datos, regenéralo en el proyecto Dash y copia el
archivo a esas dos rutas.

## Estructura

```
├── _config.yml            # Configuración del libro
├── _toc.yml               # Tabla de contenidos (orden de los capítulos)
├── common.py              # Rutas, carga de datos, paleta y show() para las figuras
├── requirements.txt
├── intro.md … conclusiones.md
├── metodologia.ipynb      # ETL
├── eda.ipynb              # Análisis univariado, bivariado y temporal
├── _static/
│   ├── dashboard.html     # Dashboard 2D (Plotly)
│   └── 3d/                # Dashboard 3D
└── data/
    ├── raw/               # Dataset original
    ├── generate_data.py   # Limpieza y transformación
    └── superstore_transformado.csv
```

---

Proyecto: Alex Teran y David Estrada
