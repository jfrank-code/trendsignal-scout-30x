# Inicio rápido — TrendSignal Scout 30X

El proyecto usa **React + Vite + Bootstrap** para el frontend y **FastAPI + Python** para el backend. Puedes arrancar cada parte por separado y **no se crea ningún entorno virtual de Python**: los paquetes se instalan en el Python activo de Windows.

## 1. Requisitos

- Python 3.10 o superior.
- Node.js compatible con Vite 8 (Node 20.19+ o 22.12+; una versión LTS reciente es lo recomendado), que incluye `npm`.
- Una clave de OpenAI API para habilitar la clasificación/síntesis del motor y la estrategia editorial automática.

## 2. Configura OpenAI una sola vez

En la carpeta raíz, ejecuta `INICIAR_BACKEND.bat`. Si no existe, creará `.env` a partir de `.env.example` y lo abrirá. Añade tu clave en `OPENAI_API_KEY=...`, guarda y vuelve a ejecutar el archivo.

No pegues la clave en el frontend ni la subas a GitHub. La clave la lee Python en el backend.

## 3. Arranca backend y frontend en terminales separadas

**Terminal 1 — backend, desde la carpeta raíz `TrendSignal_Scout`:**

```powershell
python -m pip install -r requirements.txt
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — frontend:**

```powershell
cd frontend
npm install
npm run dev
```

Abre **http://127.0.0.1:5173**. El frontend usa el proxy de Vite para enviar `/api` a `http://127.0.0.1:8000`.

## Alternativas Windows

- `INICIAR.bat`: instala lo que falta y abre backend y frontend en ventanas independientes.
- `INICIAR_BACKEND.bat`: solo backend.
- `INICIAR_FRONTEND.bat`: solo frontend; instala paquetes npm la primera vez.
- `TESTS.bat`: pruebas del motor y del backend.

## Primer ejemplo

> Dame los 10 temas más relevantes de esta semana sobre IA aplicada a equipos de empresa en Perú y Latinoamérica. Incluye evidencias, distingue tendencias consistentes de indicios exploratorios y propón ideas editoriales con ganchos, formatos y mini-guiones.

La primera investigación puede tardar unos minutos. Para recorrer la interfaz sin consultar fuentes, pulsa **Ver demo sintética**; sus cifras se identifican expresamente como datos ficticios.

## Direcciones útiles

- Frontend React: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:8000`
- Documentación FastAPI: `http://127.0.0.1:8000/docs`
- Estado de servicios: `http://127.0.0.1:8000/api/health`
