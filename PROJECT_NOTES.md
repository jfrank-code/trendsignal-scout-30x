# Notas de implementación

## Decisiones técnicas

- **Frontend React + Vite + Bootstrap 5** con Bootstrap Icons, estructura modular por vistas y CSS propio de diseño. Paleta clara: marfil, blanco, verde salvia y teal, con acentos coral, azul cielo y dorado suave.
- Frontend y backend arrancan en procesos separados: `npm run dev` en `frontend/` y `python -m uvicorn backend.app.main:app --reload --port 8000` desde la raíz. Vite reenvía `/api` a FastAPI.
- No se crea un entorno virtual de Python. `INICIAR.bat` y `INICIAR_BACKEND.bat` instalan dependencias con el Python activo del sistema, según la preferencia del usuario.
- Backend FastAPI: endpoints tipados, bloqueo de ejecución del motor para evitar solapamientos de recogida y saturación de fuentes.
- Motor v6.6 ejecutado como proceso aislado: los informes temporales no se mezclan entre ejecuciones y el caché/pacing de GDELT se mantiene persistente.
- SQLite para historial, JSON por ejecución para reproducibilidad/exportación.
- OpenAI Responses API para planning/clasificación/síntesis heredados del motor y una llamada separada con Structured Outputs para estrategia editorial. El módulo editorial comprueba IDs de evidencia y rebaja el soporte si faltan fuentes.
- Los datos de demostración están marcados como sintéticos y no se usan como resultados reales.

## Validaciones a ejecutar con las credenciales del usuario

1. Comprobar `/api/health` y que `openai_configured=true`.
2. Hacer una consulta corta (10 elementos/fuente, 7 días, región PE).
3. Verificar `editorial.status=ok`, enlaces de evidencia, exportación JSON/CSV/Markdown y guardado de historial.
4. Revisar la facturación real de OpenAI después de la ejecución.
5. Repetir la captura en otro momento antes de afirmar crecimiento temporal.
