# TrendSignal Scout — Radar de investigación y decisiones editoriales para 30X

**Aplicación web local con backend FastAPI, interfaz de chat/dashboard, motor de investigación multifuente, segunda capa de OpenAI para estrategia editorial, evidencia enlazada e informes exportables.**

> **Importante:** las métricas cuantitativas son calculadas por el motor `v6.6`; OpenAI las interpreta, pero no puede sustituirlas ni inventar cifras. La aplicación produce investigación exploratoria, no un censo de Internet ni una probabilidad de viralidad. El modo demo está etiquetado como sintético.

## 1. Arranque rápido en Windows

1. Descomprime la carpeta `TrendSignal_Scout`.
2. Instala Python 3.10 o superior (activa **Add Python to PATH**) y Node.js compatible con Vite 8: Node 20.19+ o 22.12+; se recomienda una versión LTS reciente.
3. Ejecuta `INICIAR.bat`. Instala las dependencias de Python en tu instalación activa y React/Bootstrap en `frontend/node_modules`; no crea entorno virtual.
4. En `.env`, sustituye `pon_aqui_tu_clave_de_openai` por tu clave de API real. Guarda el archivo y ejecuta `INICIAR.bat` otra vez.
5. El frontend se abre en `http://127.0.0.1:5173`; escribe arriba tu pregunta y pulsa **Investigar**. El backend escucha en `http://127.0.0.1:8000`.

También puedes iniciar ambas partes a la vez con `INICIAR.bat`, o ejecutar los servicios por separado.

### Arranque manual (sin entorno virtual)

**Terminal 1 — desde la raíz del proyecto:**

```powershell
python -m pip install -r requirements.txt
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — frontend React:**

```powershell
cd frontend
npm install
npm run dev
```

Abre `http://127.0.0.1:5173`. Vite reenvía `/api` al backend, por lo que no hace falta configurar CORS para este uso local. La documentación interactiva de FastAPI está en `http://127.0.0.1:8000/docs`.

## 2. Qué incluye

### Experiencia de producto
- **Frontend React + Bootstrap 5** con Vite, Bootstrap Icons y una paleta clara de marfil, verde salvia, blanco y teal, con acentos coral, azul y dorado suave.
- **Landing page** editorial y minimalista, presentación del método y acceso a la aplicación.
- **Compositor tipo chat** en la parte superior: pregunta en lenguaje natural, atajos de consulta y ajustes de ventana, región, fuentes y límite por fuente.
- **Dashboard** con indicadores, distribución temática, cobertura por fuente, señales, resumen ejecutivo y control de calidad.
- **Radar de temas** con prevalencia, cambio dentro de la muestra, variación de cuota por fuente y subtemas de IA.
- **Explorador de evidencia** con búsqueda, enlaces, metadatos, fechas, fuente, dominio y señales para revisión.
- **Estrategia editorial con OpenAI**: ángulo, hook, formato, público, mini-guion, CTA, localización, riesgos, validaciones previas y fuentes asociadas. Las propuestas se generan mediante una segunda llamada de OpenAI a partir del resultado de investigación.
- **Informes** en Markdown, CSV y JSON, además de historial local de ejecuciones.
- **Modo demo** claramente indicado y totalmente sintético, para enseñar el producto antes de configurar la API.
- **Interfaz adaptable** a escritorio y móvil, navegación por módulos y estados de carga/error.

### Motor y fuentes
Conserva el motor de investigación exploratoria v6.6, incluyendo consultas con fallback, consolidación/deduplicación, clasificación semántica, validación de fechas y cálculo de métricas antes de la síntesis.

- Google News RSS
- Hacker News
- GitHub
- OpenAlex
- arXiv
- YouTube Data API (requiere `YOUTUBE_API_KEY` para búsquedas y estadísticas de vídeo)
- Google Trends (requiere acceso de red; el conector puede tener limitaciones propias)
- GDELT (opt-in: se deja desactivado por defecto para evitar esperas y límites de tasa)
- Reddit (opt-in: requiere `REDDIT_CLIENT_ID` y `REDDIT_CLIENT_SECRET`)
- Descubrimiento web mediante herramienta `web_search` de OpenAI Responses API, habilitado cuando `OPENAI_API_KEY` está configurada y seleccionado el modo correspondiente.

Una fuente puede estar configurada y seguir devolviendo cero resultados o no estar disponible por cambios de API, cuota, rate limit o red. El estado se muestra por conector; no se debe confundir «cero resultados» con «conector roto».

## 3. OpenAI: uso de API y control de coste

La aplicación usa la clave local en `.env`. La arquitectura separa modelos por tarea: `gpt-5.4-mini` es el valor predeterminado para planificación, clasificación por lotes, síntesis y búsqueda del motor; una segunda llamada con `gpt-5.5` genera la estrategia editorial en JSON estructurado. Si tu organización no tiene habilitado `gpt-5.5`, configura `OPENAI_EDITORIAL_MODEL=gpt-5.4-mini` en `.env`. Ambos valores son configurables.

El coste de una ejecución depende de los registros recuperados, el número de lotes de clasificación, los tokens de entrada/salida, el modelo y las llamadas a búsqueda web. **No hay un coste fijo por investigación.** Para empezar con un ensayo corto, selecciona 10 resultados por fuente, una ventana de 7 días y deja GDELT/Reddit desactivados. Revisa la página de uso y facturación de OpenAI tras las primeras ejecuciones.

Variables admitidas:

```dotenv
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
OPENAI_EDITORIAL_MODEL=gpt-5.5
YOUTUBE_API_KEY=...
GITHUB_TOKEN=...
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
TRENDSIGNAL_GDELT_MIN_INTERVAL=6.25
TRENDSIGNAL_GDELT_COOLDOWN_SECONDS=300
```

No pongas credenciales dentro del código, no las compartas por chat y no subas `.env` a GitHub. `.gitignore` ya lo excluye.

## 4. Cómo trabaja la estrategia editorial

1. El motor recoge las fuentes y conserva procedencia.
2. Consolida duplicados, revisa fechas y separa las páginas añadidas por descubrimiento web de las métricas de fuentes fijas.
3. Calcula temas, subtemas, prevalencia y comparaciones temporales; exige mínimos de soporte para llamar a una señal de crecimiento candidata.
4. OpenAI recibe las métricas calculadas y un conjunto acotado de registros para producir la síntesis cualitativa.
5. La segunda llamada de OpenAI recibe la pregunta, el contexto de audiencia, las métricas y registros con IDs de evidencia. Genera oportunidades en formato estructurado.
6. El backend elimina las referencias a IDs que no existan, enlaza cada referencia con la fuente original y reduce a soporte «insuficiente» las propuestas sin evidencia asociada.
7. La interfaz presenta la idea, evidencia y validaciones antes de publicación. Las cifras oficiales siempre siguen siendo las del motor.

El campo de confianza editorial es cualitativo y no está calibrado como probabilidad. Una idea puede ser creativa aunque su evidencia temporal sea insuficiente; en ese caso debe tratarse como hipótesis, no como una tendencia demostrada.

## 5. Ejecutar pruebas

En PowerShell desde la raíz del proyecto, sin activar ningún entorno virtual:

```powershell
python -m py_compile backend\app\main.py backend\app\editorial.py backend\engine\trendsignal_scout_v6_6.py
python backend\engine\trendsignal_scout_v6_6.py --self-test
python -m unittest discover -s tests -v
```

También puedes ejecutar `TESTS.bat` en Windows para correr estas pruebas sin escribir los comandos a mano.

Comprobación del frontend React: dentro de `frontend/`, ejecuta `npm run build`. Esto valida JSX, dependencias y empaquetado de producción.

`--self-test` prueba lógica sintética y llamadas simuladas del motor: no demuestra que todos los servicios remotos estén disponibles hoy. Una ejecución real comprueba el estado de cada fuente al momento de la consulta.

## 6. API del backend

- `GET /api/health`: estado del servidor, motor y variables de credenciales configuradas (nunca devuelve secretos).
- `POST /api/analyze`: ejecuta la investigación y estrategia editorial. JSON: `question`, `days`, `region`, `max_items`, `sources`, `use_openai`, `discover_web`, `include_gdelt`, `use_reddit`.
- `GET /api/history`: historial local limitado.
- `GET /api/runs/{run_id}`: recupera un informe guardado.
- `GET /api/runs/{run_id}/download?format=json|csv|md`: exporta los resultados.
- `GET /docs`: documentación interactiva de FastAPI.

Ejemplo de petición:

```json
{
  "question": "Dame 10 temas de IA para líderes de equipos en Perú esta semana, con evidencia y propuestas editoriales.",
  "days": 7,
  "region": "PE",
  "max_items": 20,
  "sources": ["news", "hn", "github", "openalex", "arxiv", "youtube", "trends"],
  "use_openai": true,
  "discover_web": true,
  "include_gdelt": false,
  "use_reddit": false
}
```

## 7. Seguridad, datos y despliegue

- El arranque predeterminado escucha en `127.0.0.1`, solo en el equipo local.
- Las claves se leen del entorno backend; no se envían al frontend ni se escriben en los informes.
- El historial se guarda en `backend/data/history.sqlite3`; las ejecuciones se guardan en `backend/data/runs/`. Es almacenamiento local, no una base compartida entre equipos.
- La API no tiene autenticación multiusuario ni protección antiabuso para exposición pública. **No la publiques en Railway o en una IP pública tal cual.** Antes de desplegar, añade autenticación, límites por usuario, aislamiento de ejecuciones, almacenamiento privado de secretos y protección de uso/coste. No se incluye una falsa promesa de producción segura.
- Esta versión no hace scraping automatizado de TikTok, Instagram, LinkedIn o X ni inventa métricas de visualizaciones, likes o comentarios. Para esas plataformas se requieren integraciones/autorizaciones específicas o captura manual trazable de observaciones.

## 8. Alcance y limitaciones científicas

- Las fuentes consultadas son heterogéneas y tienen coberturas diferentes; sus conteos no son magnitudes intercambiables.
- Las cifras describen los registros recuperados por consultas limitadas, no un muestreo aleatorio ni el universo de publicaciones.
- El cambio entre mitades es un indicador descriptivo y depende de ordenamientos de fuentes y fechas disponibles.
- Las fechas ausentes o sospechosas no se usan como evidencia temporal válida.
- Los datos de Google Trends se conservan como serie aparte, no se suman como artículos.
- Las piezas de búsqueda web complementaria se etiquetan y se excluyen del cálculo de crecimiento de fuentes fijas.
- No se puede inferir que un contenido tendrá más rendimiento por ser un tema presente en las fuentes; la idea creativa y la validación de engagement son decisiones separadas.

## Estructura

```text
TrendSignal_Scout/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── styles.css
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   └── editorial.py
│   ├── engine/trendsignal_scout_v6_6.py
│   └── data/                  # informes, caché e historial local
├── tests/
├── .env.example
├── .gitignore
├── requirements.txt
├── INICIAR.bat
├── run.ps1
└── README.md
```


## Referencias técnicas oficiales

- [OpenAI Responses API](https://developers.openai.com/api/reference/python/resources/responses)
- [OpenAI Structured Outputs / JSON Schema](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Web Search en Responses API](https://developers.openai.com/api/docs/guides/tools-web-search)
- [Modelo GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini) · [Modelo GPT-5.5](https://developers.openai.com/api/docs/models/gpt-5.5)
