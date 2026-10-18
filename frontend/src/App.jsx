import { useCallback, useEffect, useMemo, useState } from 'react';

const NAV_ITEMS = [
  { id: 'overview', label: 'Resumen', icon: 'bi-grid-1x2' },
  { id: 'radar', label: 'Radar de temas', icon: 'bi-activity' },
  { id: 'evidence', label: 'Evidencias', icon: 'bi-link-45deg' },
  { id: 'opportunities', label: 'Estrategia editorial', icon: 'bi-stars' },
  { id: 'reports', label: 'Informes e historial', icon: 'bi-file-earmark-bar-graph' },
];
const SOURCE_OPTIONS = [
  ['news', 'Google News RSS'], ['hn', 'Hacker News'], ['github', 'GitHub'],
  ['openalex', 'OpenAlex'], ['arxiv', 'arXiv'], ['youtube', 'YouTube'], ['trends', 'Google Trends'],
];
const STARTER_QUESTIONS = [
  'Dame los 10 temas más relevantes de esta semana sobre IA aplicada a equipos de empresa en Perú y Latinoamérica.',
  '¿Qué usos de agentes de IA para equipos tienen evidencia reciente y qué falta validar?',
  'Compara señales de IA para productividad empresarial y propón tres ideas editoriales prácticas.',
];

function n(value) {
  if (value === null || value === undefined || value === '') return '—';
  const valueNum = Number(value);
  return Number.isFinite(valueNum) ? new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(valueNum) : String(value);
}
function percent(value) {
  if (value === null || value === undefined || value === '') return 'N/D';
  return `${n(value)} %`;
}
function dateLabel(value) {
  if (!value) return 'Fecha no disponible';
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? String(value) : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}
function textValue(value, fallback = 'No disponible') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}
function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
function slug(value) {
  return String(value || 'trendsignal').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'trendsignal';
}
function downloadText(content, mime, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function makeDemo() {
  return {
    run_id: 'DEMO-SYNTHETIC', created_at: new Date().toISOString(), question: 'Ejemplo ilustrativo: cómo investigar temas de IA para equipos de empresa', region: 'PE', days: 7,
    status: 'demo', is_synthetic: true,
    metrics: { raw_records: 128, unique_content: 94, fixed_content: 88, discovery_records: 6, google_trends_points: 14, sources_responding: 6, sources_requested: 7, date_coverage_pct: 81, records_with_dates: 76, undated_records: 12, excluded_future_dates: 1, excluded_outside_window: 4, topics_count: 5, growth_candidates_count: 0, items_with_links: 87 },
    topics: [
      { topic: 'Artificial intelligence', count: 35, share_pct: 39.8, source_count: 4, domain_count: 21, sample_change_pct: 18.8, mean_source_share_delta_pp: 4.2, trend_direction: 'positive_consistent', evidence_status: 'insufficient_support', growth_candidate: false },
      { topic: 'Software and developer tools', count: 20, share_pct: 22.7, source_count: 3, domain_count: 13, sample_change_pct: 22.2, mean_source_share_delta_pp: 2.3, trend_direction: 'positive_consistent', evidence_status: 'minimum_support', growth_candidate: false },
      { topic: 'Business and work', count: 14, share_pct: 15.9, source_count: 3, domain_count: 10, sample_change_pct: -25, mean_source_share_delta_pp: -3.1, trend_direction: 'negative_consistent', evidence_status: 'minimum_support', growth_candidate: false },
      { topic: 'Science and space', count: 11, share_pct: 12.5, source_count: 2, domain_count: 8, sample_change_pct: 75, mean_source_share_delta_pp: 1.8, trend_direction: 'positive_consistent', evidence_status: 'insufficient_support', growth_candidate: false },
      { topic: 'Cybersecurity', count: 8, share_pct: 9.1, source_count: 2, domain_count: 6, sample_change_pct: 0, mean_source_share_delta_pp: 0, trend_direction: 'mixed_or_flat', evidence_status: 'insufficient_support', growth_candidate: false },
    ],
    ai_subtopics: [
      { subtopic: 'AI agents and multi-agent systems', count: 12, share_pct: 13.6, source_count: 3, sample_change_pct: 40, trend_direction: 'positive_consistent', evidence_status: 'insufficient_support' },
      { subtopic: 'AI coding and software engineering', count: 9, share_pct: 10.2, source_count: 3, sample_change_pct: 25, trend_direction: 'positive_consistent', evidence_status: 'insufficient_support' },
      { subtopic: 'Enterprise AI adoption', count: 6, share_pct: 6.8, source_count: 2, sample_change_pct: -50, trend_direction: 'negative_consistent', evidence_status: 'insufficient_support' },
    ],
    growth_candidates: [],
    sources: SOURCE_OPTIONS.map(([key, name], index) => ({ key, name, status: index < 6 ? 'ok' : 'not_selected', records: index < 6 ? [29, 22, 18, 10, 12, 11, 0][index] : 0, detail: 'Dato sintético de la vista de demostración' })),
    items: [
      { evidence_id: 'D001', title: 'Ejemplo de ficha de evidencia: workflow con revisión humana', summary: 'Registro sintético para mostrar cómo se presenta una fuente. No es una publicación real ni debe citarse.', source: 'YouTube (demo)', url: '', published: new Date().toISOString(), topic: 'Artificial intelligence', subtopic: 'Enterprise AI adoption', collection_method: 'fixed', needs_review: true },
      { evidence_id: 'D002', title: 'Ejemplo de ficha: agentes de software y tareas verificables', summary: 'Esta ficha es ilustrativa. Una investigación real debe recuperar y enlazar una publicación original.', source: 'Google News RSS (demo)', url: '', published: '', topic: 'Artificial intelligence', subtopic: 'AI agents and multi-agent systems', collection_method: 'fixed', needs_review: true },
    ],
    narrative: 'Vista de demostración: el sistema real producirá un resumen a partir de las fuentes que respondan. Los datos mostrados aquí son sintéticos y no representan la actualidad.',
    editorial: {
      status: 'demo', model: '—', overall_signal: 'insufficient_evidence', evidence_pool_size: 2,
      executive_summary: 'La demostración ilustra cómo una consulta puede acabar en decisiones editoriales. No se ha ejecutado una investigación real y no existen tendencias validadas en este ejemplo.',
      priority_actions: ['Recuperar evidencia primaria y comprobar fechas.', 'Contrastar al menos dos fuentes independientes.', 'Validar los casos de uso antes de publicar.'],
      audience_insights: ['La audiencia necesita procedimientos y criterios de evaluación, no promesas genéricas.', 'La adaptación local debe basarse en ejemplos verificables.'],
      opportunities: [{ title: 'Del titular al workflow verificable', topic: 'IA para equipos', angle: 'Convertir una afirmación amplia sobre IA en un ejemplo práctico con pasos y puntos de revisión.', hook: 'Antes de automatizarlo todo, enseña qué parte del proceso funciona y cómo comprobarlo.', format: 'Demostración paso a paso', target_audience: 'Responsables de equipo y profesionales que evalúan IA', why_now: 'Hipótesis creativa de demo; no es un hallazgo real.', evidence_summary: 'Esta propuesta solo muestra el formato esperado. No tiene evidencia externa asociada.', evidence_strength: 'insufficient', confidence_level: 'low', confidence_rationale: 'Datos sintéticos de demostración.', evidence: [], outline: ['Define una tarea concreta.', 'Muestra el flujo con un ejemplo.', 'Señala los controles humanos y errores posibles.', 'Propón una prueba pequeña y medible.'], cta: '¿Qué tarea probarías primero?', content_pillar: 'IA aplicada al trabajo', localization: 'Añadir un caso local solo si se valida con fuentes de Perú o Latinoamérica.', validation_needed: ['Sustituir este ejemplo por evidencia recuperada y revisada.'], risks: ['No presentar la hipótesis como tendencia ni como resultado validado.'] }],
      limitations: ['Todos los datos de esta pantalla son sintéticos.', 'No hay investigación actual asociada a esta demostración.'], editorial_method: 'Demo visual; no se ha llamado a OpenAI.',
    },
  };
}

function Brand({ small = false, onClick }) {
  return <button className={`brand-lockup ${small ? 'brand-small' : ''}`} onClick={onClick} aria-label="Volver a inicio">
    <span className="brand-symbol"><i /><i /><i /><i /></span>
    <span>TrendSignal <b>Scout</b><small>RADAR EDITORIAL · 30X</small></span>
  </button>;
}
function Eyebrow({ children, className = '' }) { return <div className={`eyebrow ${className}`}><span className="eyebrow-dot" />{children}</div>; }
function StatusPill({ status, label }) {
  const good = ['ok', 'ok_after_fallback', 'healthy'].includes(status);
  const caution = ['partial', 'no_results', 'not_selected', 'unavailable', 'unknown', 'demo'].includes(status);
  return <span className={`status-pill ${good ? 'status-good' : caution ? 'status-warn' : 'status-bad'}`}><i />{label || status || 'Sin estado'}</span>;
}
function MetricCard({ icon, label, value, hint, tone = 'mint' }) {
  return <div className="metric-card card h-100"><div className="metric-top"><span className={`metric-icon tone-${tone}`}><i className={`bi ${icon}`} /></span><span className="metric-hint">{hint}</span></div><div className="metric-value">{value}</div><div className="metric-label">{label}</div></div>;
}
function EmptyPanel({ icon = 'bi-search', title, detail }) {
  return <div className="empty-panel"><span className="empty-icon"><i className={`bi ${icon}`} /></span><h5>{title}</h5><p>{detail}</p></div>;
}

export default function App() {
  const [workspace, setWorkspace] = useState(false);
  const [view, setView] = useState('overview');
  const [result, setResult] = useState(null);
  const [question, setQuestion] = useState(STARTER_QUESTIONS[0]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ status: 'idle', stage: 'idle', label: 'Listo para investigar', percent: 0, detail: 'Escribe una pregunta para iniciar una investigación.' });
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [history, setHistory] = useState([]);
  const [health, setHealth] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [settings, setSettings] = useState({ days: 7, region: 'PE', max_items: 20, sources: ['news', 'hn', 'github', 'openalex', 'arxiv', 'youtube', 'trends'], use_openai: true, discover_web: true, include_gdelt: false, use_reddit: false });

  const showToast = useCallback((message) => { setToast(message); window.setTimeout(() => setToast(''), 3200); }, []);
  const refreshHealth = useCallback(async () => {
    try { const res = await fetch('/api/health', { cache: 'no-store' }); if (!res.ok) throw new Error('API no disponible'); setHealth(await res.json()); }
    catch { setHealth({ status: 'offline', engine: false, openai_configured: false }); }
  }, []);
  const loadHistory = useCallback(async () => {
    try { const res = await fetch('/api/history?limit=10'); if (res.ok) setHistory((await res.json()).runs || []); }
    catch { /* historial local opcional si el backend no está iniciado */ }
  }, []);

  useEffect(() => { if (workspace) { refreshHealth(); loadHistory(); } }, [workspace, refreshHealth, loadHistory]);
  useEffect(() => {
    if (!busy) return undefined;
    let active = true;
    const readProgress = async () => {
      try {
        const response = await fetch('/api/progress', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (active) setProgress(data);
      } catch { /* La llamada principal mostrará el error final si el backend no responde. */ }
    };
    readProgress();
    const timer = window.setInterval(readProgress, 1400);
    return () => { active = false; window.clearInterval(timer); };
  }, [busy]);
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timer); }, [toast]);

  const analyze = async (input = question) => {
    const clean = input.trim();
    if (clean.length < 3) { setError('Escribe una pregunta algo más concreta para empezar.'); return; }
    setQuestion(clean); setError(''); setProgress({ status: 'running', stage: 'starting', label: 'Preparando la investigación', percent: 2, detail: 'Conectando con el backend…' }); setBusy(true); setWorkspace(true); setView('overview'); setSidebarOpen(false);
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: clean, ...settings }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || `La API respondió con el código ${response.status}.`);
      setResult({ ...data, is_synthetic: false });
      await loadHistory(); await refreshHealth();
      setView('overview');
    } catch (e) {
      setError(e.message || 'No se pudo completar la investigación. Comprueba que el backend esté activo en el puerto 8000.');
    } finally { setBusy(false); }
  };

  const chooseDemo = () => { setResult(makeDemo()); setWorkspace(true); setView('overview'); setError(''); setQuestion(STARTER_QUESTIONS[0]); setSidebarOpen(false); };
  const newAnalysis = () => { setResult(null); setQuestion(''); setError(''); setView('overview'); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const changeView = (id) => { setView(id); setSidebarOpen(false); };

  const loadRun = async (id) => {
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(id)}`); const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo recuperar el informe.');
      setResult({ ...data, is_synthetic: false }); setQuestion(data.question || ''); setView('overview'); setWorkspace(true); setSidebarOpen(false); showToast('Investigación recuperada del historial.');
    } catch (e) { showToast(e.message || 'No se pudo abrir la investigación.'); }
  };

  const exportReport = (format) => {
    if (!result) { showToast('Primero ejecuta una investigación.'); return; }
    if (!result.is_synthetic && result.run_id) { window.location.href = `/api/runs/${encodeURIComponent(result.run_id)}/download?format=${encodeURIComponent(format)}`; return; }
    const base = `trendsignal-demo-${format}`;
    if (format === 'json') downloadText(JSON.stringify(result, null, 2), 'application/json;charset=utf-8', `${base}.json`);
    else if (format === 'csv') {
      const keys = ['evidence_id', 'source', 'title', 'summary', 'url', 'published', 'topic', 'subtopic'];
      const csv = [keys.join(','), ...(result.items || []).map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\r\n');
      downloadText('\ufeff' + csv, 'text/csv;charset=utf-8', `${base}.csv`);
    } else downloadText(`# TrendSignal Scout · DEMO\n\n${result.question}\n\n${result.editorial?.executive_summary || result.narrative}\n\nDatos sintéticos: no utilizar como evidencia real.`, 'text/markdown;charset=utf-8', `${base}.md`);
    showToast('Exportación de demostración: contiene datos sintéticos.');
  };

  const copyOpportunity = async (opportunity) => {
    const brief = [opportunity.title, '', `Ángulo: ${opportunity.angle || ''}`, `Gancho: ${opportunity.hook || ''}`, `Formato: ${opportunity.format || ''}`, `Audiencia: ${opportunity.target_audience || ''}`, `Por qué ahora: ${opportunity.why_now || ''}`, '', `Evidencia: ${opportunity.evidence_summary || ''}`, ...(opportunity.evidence || []).map(e => `- ${e.title} — ${e.source}: ${e.url}`), '', 'Mini-guion:', ...(opportunity.outline || []).map((x, i) => `${i + 1}. ${x}`), '', `CTA: ${opportunity.cta || ''}`, '', 'Validaciones:', ...(opportunity.validation_needed || []).map(x => `- ${x}`), '', 'Riesgos:', ...(opportunity.risks || []).map(x => `- ${x}`)].join('\n');
    try { await navigator.clipboard.writeText(brief); showToast('Brief editorial copiado.'); }
    catch { downloadText(brief, 'text/plain;charset=utf-8', `${slug(opportunity.title)}.txt`); showToast('He descargado el brief porque el portapapeles no está disponible.'); }
  };

  const topics = result?.topics || result?.raw_metrics?.topics || [];
  const items = result?.items || [];
  const filteredEvidence = useMemo(() => items.filter((item) => {
    if (item.is_time_series) return false;
    const bySource = sourceFilter === 'all' || String(item.source || '').toLowerCase().includes(sourceFilter);
    const q = search.trim().toLowerCase();
    const byQuery = !q || [item.title, item.summary, item.source, item.topic, item.subtopic, item.domain_group].some(v => String(v || '').toLowerCase().includes(q));
    return bySource && byQuery;
  }), [items, search, sourceFilter]);

  if (!workspace) return <Landing onEnter={() => { setWorkspace(true); setTimeout(() => document.getElementById('query-box')?.focus(), 100); }} onDemo={chooseDemo} onSelectPrompt={(prompt) => { setQuestion(prompt); setWorkspace(true); }} />;

  const m = result?.metrics || {};
  const editorial = result?.editorial || {};
  const opportunities = editorial.opportunities || [];
  const sourceList = result?.sources || [];

  return <div className="app-shell">
    <aside className={`app-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand-row"><Brand small onClick={() => { setWorkspace(false); setSidebarOpen(false); }} /><button className="btn btn-light border-0 mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú"><i className="bi bi-x-lg" /></button></div>
      <button className="btn btn-primary-soft new-research" onClick={newAnalysis}><i className="bi bi-plus-lg" /> Nueva investigación</button>
      <div className="side-caption">ESPACIO DE TRABAJO</div>
      <nav className="side-navigation">
        {NAV_ITEMS.map(item => <button key={item.id} onClick={() => changeView(item.id)} className={`side-nav-item ${view === item.id ? 'active' : ''}`}><i className={`bi ${item.icon}`} /><span>{item.label}</span>{item.id === 'opportunities' && result && <span className="nav-count">{opportunities.length}</span>}</button>)}
      </nav>
      <div className="side-caption recent-caption">INVESTIGACIONES RECIENTES</div>
      <div className="history-list">
        {history.length ? history.slice(0, 6).map(run => <button key={run.id} className="history-item" onClick={() => loadRun(run.id)} title={run.question}><span className="history-item-dot" /><span>{run.question}</span></button>) : <p className="history-empty">Tus investigaciones aparecerán aquí cuando ejecutes una consulta real.</p>}
      </div>
      <div className="sidebar-bottom">
        <div className="connection-card"><span className={`connection-dot ${health?.status === 'ok' && health?.engine ? 'connected' : ''}`} /><div><b>{health?.status === 'ok' && health?.engine ? 'Motor conectado' : health?.status === 'offline' ? 'Backend sin conexión' : 'Comprobando conexión'}</b><small>{health?.openai_configured ? 'OpenAI configurado' : 'OpenAI: configura .env'}</small></div><button className="btn btn-sm btn-light" onClick={refreshHealth} aria-label="Actualizar conexión"><i className="bi bi-arrow-clockwise" /></button></div>
        <div className="sidebar-footer"><span>TrendSignal Scout · 30X</span><span>v1.1 · React</span></div>
      </div>
    </aside>

    <main className="workspace-main">
      <header className="workspace-topbar"><div className="d-flex align-items-center gap-3"><button className="btn btn-light mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Abrir menú"><i className="bi bi-list" /></button><div><div className="breadcrumb-kicker">TREND SIGNAL <span>/</span> {NAV_ITEMS.find(x => x.id === view)?.label.toUpperCase()}</div><div className="topbar-subtitle">Investigación con evidencia · estrategia editorial</div></div></div><div className="topbar-actions"><span className="topbar-badge"><i className="bi bi-stars" /> IA + evidencia</span><button className="icon-square" title="Actualizar estado" onClick={refreshHealth}><i className="bi bi-arrow-repeat" /></button><div className="user-avatar">TS</div></div></header>
      <div className="workspace-content">
        <section className="chat-composer card border-0">
          <div className="composer-topline"><div><Eyebrow>ASISTENTE DE INVESTIGACIÓN</Eyebrow><h2>¿Qué quieres descubrir hoy?</h2><p>Formula una pregunta. El radar reúne fuentes, mide señales y prepara decisiones editoriales.</p></div><div className="composer-illustration"><i className="bi bi-search-heart" /><span /><span /><span /></div></div>
          <form onSubmit={(e) => { e.preventDefault(); analyze(); }}>
            <label className="visually-hidden" htmlFor="query-box">Pregunta de investigación</label>
            <div className="question-box"><textarea id="query-box" value={question} maxLength={800} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); analyze(); } }} placeholder="Ej.: Dame los 10 temas más relevantes de esta semana sobre IA aplicada a negocios…" rows={2} /><div className="question-tools"><span><i className="bi bi-lightbulb" /> Sé específico: tema, público, región y periodo.</span><div><span className="char-count">{question.length}/800</span><button className="btn btn-primary send-button" type="submit" disabled={busy}><span>{busy ? 'Investigando…' : 'Investigar'}</span><i className={`bi ${busy ? 'bi-hourglass-split' : 'bi-arrow-up-right'}`} /></button></div></div></div>
          </form>
          <div className="prompt-chips"><span>Prueba una idea</span>{STARTER_QUESTIONS.map((prompt, i) => <button key={prompt} type="button" onClick={() => setQuestion(prompt)}>{['IA para equipos', 'Agentes y evidencia', 'Oportunidades editoriales'][i]} <i className="bi bi-arrow-up-left" /></button>)}</div>
          <div className="composer-settings"><button type="button" className="settings-link" onClick={() => setAdvanced(!advanced)}><i className="bi bi-sliders2" /> Ajustes de búsqueda <i className={`bi ${advanced ? 'bi-chevron-up' : 'bi-chevron-down'}`} /></button><span className="settings-summary"><i className="bi bi-globe-americas" /> {settings.region} <span>·</span> {settings.days} días <span>·</span> {settings.sources.length} fuentes</span></div>
          {advanced && <div className="advanced-settings"><div className="row g-3 mb-3"><div className="col-6 col-md-3"><label className="form-label">Región</label><select className="form-select" value={settings.region} onChange={e => setSettings({ ...settings, region: e.target.value })}><option value="PE">Perú</option><option value="WORLD">Mundo</option><option value="MX">México</option><option value="CO">Colombia</option><option value="AR">Argentina</option><option value="CL">Chile</option><option value="BR">Brasil</option></select></div><div className="col-6 col-md-3"><label className="form-label">Periodo</label><select className="form-select" value={settings.days} onChange={e => setSettings({ ...settings, days: Number(e.target.value) })}><option value={3}>3 días</option><option value={7}>7 días</option><option value={14}>14 días</option><option value={30}>30 días</option><option value={90}>90 días</option></select></div><div className="col-6 col-md-3"><label className="form-label">Máximo por fuente</label><select className="form-select" value={settings.max_items} onChange={e => setSettings({ ...settings, max_items: Number(e.target.value) })}><option value={10}>10 registros</option><option value={20}>20 registros</option><option value={30}>30 registros</option><option value={50}>50 registros</option></select></div><div className="col-6 col-md-3"><label className="form-label">Síntesis con IA</label><select className="form-select" value={String(settings.use_openai)} onChange={e => setSettings({ ...settings, use_openai: e.target.value === 'true' })}><option value="true">Activada</option><option value="false">Solo análisis</option></select></div></div>
            <div className="source-options"><div className="form-label">Fuentes que consultar</div><div className="source-checkboxes">{SOURCE_OPTIONS.map(([key, label]) => <label key={key} className="form-check"><input className="form-check-input" type="checkbox" checked={settings.sources.includes(key)} onChange={e => setSettings(prev => ({ ...prev, sources: e.target.checked ? [...prev.sources, key] : prev.sources.filter(s => s !== key) }))} /><span>{label}</span></label>)}</div><div className="source-checkboxes extra-sources"><label className="form-check"><input className="form-check-input" type="checkbox" checked={settings.discover_web} onChange={e => setSettings({ ...settings, discover_web: e.target.checked })} /><span>Descubrimiento web con OpenAI</span></label><label className="form-check"><input className="form-check-input" type="checkbox" checked={settings.include_gdelt} onChange={e => setSettings({ ...settings, include_gdelt: e.target.checked })} /><span>Incluir GDELT (puede tardar por límites de tasa)</span></label><label className="form-check"><input className="form-check-input" type="checkbox" checked={settings.use_reddit} onChange={e => setSettings({ ...settings, use_reddit: e.target.checked })} /><span>Incluir Reddit (requiere OAuth)</span></label></div></div>
          </div>}
        </section>

        {error && <div className="alert alert-warning alert-dismissible fade show alert-soft" role="alert"><i className="bi bi-exclamation-triangle me-2" /><strong>No se pudo completar.</strong> {error}<button type="button" className="btn-close" onClick={() => setError('')} aria-label="Cerrar" /></div>}
        {busy && <div className="research-progress card border-0"><div className="spinner-border text-success" role="status"><span className="visually-hidden">Cargando…</span></div><div className="research-progress-main"><div className="d-flex flex-wrap align-items-center justify-content-between gap-2"><b>{progress.label || 'Estamos investigando tu pregunta'}</b><span className="progress-percent">{Math.min(100, Math.max(0, Number(progress.percent || 0)))}%</span></div><p>{progress.detail || 'Recopilación → clasificación → validación temporal → métricas → estrategia editorial.'}</p><div className="progress progress-soft" role="progressbar" aria-label="Avance de la investigación" aria-valuenow={Number(progress.percent || 0)} aria-valuemin="0" aria-valuemax="100"><div className={`progress-bar ${progress.status === 'running' ? 'progress-bar-striped progress-bar-animated' : ''}`} style={{ width: `${Math.min(100, Math.max(2, Number(progress.percent || 0)))}%` }} /></div><small className="progress-detail-line">{progress.elapsed_seconds ? `Tiempo transcurrido: ${Math.floor(progress.elapsed_seconds / 60)} min ${Math.floor(progress.elapsed_seconds % 60)} s` : 'Progreso en tiempo real' }{Number(progress.stalled_for_seconds || 0) >= 35 ? ' · Esta fase está esperando una respuesta externa; el tiempo de espera está controlado.' : ''}</small></div><span className="progress-side-note">{Number(progress.percent || 0) >= 94 ? 'Preparando entrega' : 'Progreso en tiempo real'}</span></div>}
        {!result && !busy && <EmptyWelcome onDemo={chooseDemo} onSelectPrompt={setQuestion} onEnter={() => analyze()} health={health} />}
        {result && !busy && <>
          {result.is_synthetic && <div className="demo-banner"><i className="bi bi-info-circle-fill" /><div><b>Estás viendo una demostración</b><span>Los números, temas y fichas son sintéticos; no son hallazgos reales de la semana.</span></div><button className="btn btn-sm" onClick={newAnalysis}>Nueva investigación real <i className="bi bi-arrow-up-right" /></button></div>}
          {result.status === 'partial' && <div className="alert alert-warning alert-soft"><i className="bi bi-exclamation-circle me-2" />La ejecución es parcial. Revisa el estado de las fuentes antes de interpretar los resultados.</div>}
          <div className="result-heading"><div><Eyebrow>INFORME DE INVESTIGACIÓN <span className="result-id">{result.is_synthetic ? 'DEMO' : String(result.run_id || '').slice(0, 8).toUpperCase()}</span></Eyebrow><h1>{result.is_synthetic ? 'Vista de demostración' : 'Tu radar editorial'}</h1><p>{result.question} <span>·</span> {result.region} <span>·</span> {result.days} días <span>·</span> {dateLabel(result.created_at)}</p></div><div className="result-actions"><button className="btn btn-outline-secondary" onClick={() => exportReport('md')}><i className="bi bi-download me-2" />Informe</button><button className="btn btn-primary" onClick={() => changeView('opportunities')}><i className="bi bi-stars me-2" />Ver decisiones</button></div></div>
          <div className="view-tabs">{NAV_ITEMS.map(item => <button key={item.id} onClick={() => changeView(item.id)} className={view === item.id ? 'active' : ''}><i className={`bi ${item.icon}`} />{item.label}{item.id === 'opportunities' && <span>{opportunities.length}</span>}</button>)}</div>
          {view === 'overview' && <Overview result={result} topics={topics} sourceList={sourceList} opportunities={opportunities} changeView={changeView} />}
          {view === 'radar' && <RadarView result={result} topics={topics} />}
          {view === 'evidence' && <EvidenceView items={filteredEvidence} allCount={items.filter(x => !x.is_time_series).length} search={search} setSearch={setSearch} sourceFilter={sourceFilter} setSourceFilter={setSourceFilter} />}
          {view === 'opportunities' && <OpportunitiesView editorial={editorial} copyOpportunity={copyOpportunity} changeView={changeView} />}
          {view === 'reports' && <ReportsView result={result} history={history} exportReport={exportReport} loadRun={loadRun} refreshHistory={loadHistory} showToast={showToast} />}
          <footer className="app-footer"><span>TrendSignal Scout · 30X</span><span>Las métricas describen la muestra recuperada, no un censo de Internet.</span><button onClick={() => changeView('reports')}>Método y exportaciones <i className="bi bi-arrow-up-right" /></button></footer>
        </>}
      </div>
    </main>
    {sidebarOpen && <button aria-label="Cerrar menú" className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
    {toast && <div className="app-toast" role="status"><i className="bi bi-check-circle-fill" />{toast}</div>}
  </div>;
}

function Landing({ onEnter, onDemo, onSelectPrompt }) {
  return <div className="landing-page">
    <nav className="landing-navbar container-xxl"><Brand onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} /><div className="landing-nav-links"><a href="#metodo">Cómo funciona</a><a href="#producto">El producto</a><button className="btn btn-primary" onClick={onEnter}>Abrir el radar <i className="bi bi-arrow-up-right ms-2" /></button></div></nav>
    <main>
      <section className="landing-hero container-xxl" id="producto"><div className="hero-copy"><Eyebrow>INTELIGENCIA EDITORIAL PARA 30X</Eyebrow><h1>De señales dispersas a <span>decisiones que merecen publicarse.</span></h1><p className="hero-lead">Investiga qué merece atención, verifica la evidencia y conviértela en contenido útil para quienes lideran y construyen en Latinoamérica.</p><div className="hero-cta"><button className="btn btn-primary btn-lg" onClick={onEnter}>Empezar una investigación <i className="bi bi-arrow-up-right ms-2" /></button><button className="btn btn-outline-primary btn-lg" onClick={onDemo}>Explorar la demo <i className="bi bi-play-circle ms-2" /></button></div><div className="hero-proof"><span className="proof-icon"><i className="bi bi-shield-check" /></span><div><b>Evidencia antes que afirmaciones</b><small>Fuentes, fechas y límites de la muestra a la vista.</small></div><span className="proof-separator" /><span className="proof-icon coral"><i className="bi bi-stars" /></span><div><b>IA con criterio editorial</b><small>Oportunidades trazables, no ideas aleatorias.</small></div></div></div>
        <div className="hero-art"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="hero-art-glow" /><div className="mock-dashboard"><div className="mock-header"><div className="mock-brand"><span className="brand-symbol"><i /><i /><i /><i /></span> Radar semanal</div><span className="mock-tag">VISTA DE EJEMPLO</span></div><div className="mock-kicker">INTELIGENCIA ARTIFICIAL · EMPRESA</div><div className="mock-title-row"><h3>De la novedad<br />a lo que importa.</h3><span className="mock-date">07<br /><small>DÍAS</small></span></div><div className="mock-stats"><div><small>REGISTROS</small><b>128</b><span>ilustrativo</span></div><div><small>FUENTES</small><b>06</b><span>ejemplo visual</span></div><div><small>IDEAS</small><b>04</b><span>no validadas</span></div></div><div className="mock-chart-header"><b>Señales por tema</b><span>DEMO SINTÉTICA</span></div><div className="mock-chart"><div style={{ height: '40%' }} /><div style={{ height: '57%' }} /><div style={{ height: '49%' }} /><div style={{ height: '72%' }} /><div style={{ height: '64%' }} /><div style={{ height: '91%' }} /><div style={{ height: '77%' }} /><div style={{ height: '100%' }} /><div style={{ height: '69%' }} /><div style={{ height: '84%' }} /><div style={{ height: '62%' }} /><div style={{ height: '92%' }} /></div><div className="mock-topic"><span className="topic-spark"><i className="bi bi-stars" /></span><div><small>PROPUESTA EDITORIAL · DEMO</small><b>Del titular al workflow real</b><span>Hipótesis creativa · evidencia por validar</span></div><i className="bi bi-arrow-up-right" /></div><div className="mock-disclaimer"><i className="bi bi-info-circle" /> Cifras sintéticas para mostrar la interfaz, no resultados reales.</div></div><div className="floating-sticker sticker-top"><i className="bi bi-check2-circle" /><span><b>Fuentes trazables</b><small>abre y comprueba</small></span></div><div className="floating-sticker sticker-bottom"><i className="bi bi-lightbulb" /><span><b>Decisiones prácticas</b><small>del dato al brief</small></span></div></div>
      </section>
      <section className="capability-strip"><div className="container-xxl capability-grid"><div><span>01 / DETECTAR</span><b>Radar de señales</b><p>Explora fuentes públicas diversas.</p></div><div><span>02 / VALIDAR</span><b>Evidencia visible</b><p>Fecha, procedencia y cobertura.</p></div><div><span>03 / DECIDIR</span><b>Estrategia editorial</b><p>Ángulos, formatos y mini-guiones.</p></div><div><span>04 / PRODUCIR</span><b>Informes exportables</b><p>De la consulta al siguiente paso.</p></div></div></section>
      <section className="method-section container-xxl" id="metodo"><div className="method-copy"><Eyebrow>UNA METODOLOGÍA TRANSPARENTE</Eyebrow><h2>Una señal no es una tendencia. <span>Una idea no es evidencia.</span></h2><p>TrendSignal separa las métricas calculadas por el motor de la interpretación de OpenAI. Así puedes explorar oportunidades sin confundir conversación, interés de búsqueda, investigación y crecimiento real.</p><button className="btn btn-primary" onClick={onEnter}>Probar una consulta real <i className="bi bi-arrow-right ms-2" /></button></div><div className="method-cards"><div className="method-card"><span className="method-num">01</span><div><b>Investigación multifuente</b><p>Noticias, repositorios, publicaciones científicas, YouTube y Google Trends cuando están disponibles.</p></div><i className="bi bi-search" /></div><div className="method-card"><span className="method-num">02</span><div><b>Controles de calidad</b><p>Deduplicación, revisión temporal, diagnóstico de conectores y soporte mínimo.</p></div><i className="bi bi-shield-check" /></div><div className="method-card"><span className="method-num">03</span><div><b>IA para decidir y producir</b><p>Ideas editoriales conectadas a evidencias y con validaciones pendientes visibles.</p></div><i className="bi bi-stars" /></div></div></section>
      <section className="landing-cta"><div className="container-xxl cta-content"><div><Eyebrow>EL SIGUIENTE PASO ES TUYO</Eyebrow><h2>Pregunta. Investiga.<br /><span>Decide qué publicar.</span></h2></div><button className="btn btn-light btn-lg" onClick={onEnter}>Abrir TrendSignal Scout <i className="bi bi-arrow-up-right ms-2" /></button></div></section>
    </main>
    <footer className="landing-footer container-xxl"><Brand onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} /><span>Un radar de investigación y criterio editorial para 30X.</span><span>v1.1 · REACT + BOOTSTRAP</span></footer>
  </div>;
}

function EmptyWelcome({ onDemo, onSelectPrompt, onEnter, health }) {
  return <section className="welcome-panel"><div className="welcome-copy"><div className="welcome-icon"><i className="bi bi-compass" /></div><Eyebrow>EL RADAR ESTÁ LISTO</Eyebrow><h2>Empieza con una pregunta.<br /><span>Termina con un plan.</span></h2><p>Recopila señales públicas, comprueba la calidad de la evidencia y deja que la IA te ayude a convertirla en una propuesta editorial concreta.</p><div className="welcome-actions"><button className="btn btn-primary" onClick={onEnter}>Lanzar investigación <i className="bi bi-arrow-up-right ms-2" /></button><button className="btn btn-outline-secondary" onClick={onDemo}><i className="bi bi-play-circle me-2" />Ver demo sintética</button></div><div className="welcome-state"><StatusPill status={health?.engine ? 'ok' : health?.status === 'offline' ? 'unavailable' : 'unknown'} label={health?.engine ? 'Motor detectado' : 'Estado del backend pendiente'} /><span>La demo no necesita llamar a ninguna API.</span></div></div><div className="welcome-suggestions"><span className="suggestions-heading">PREGUNTAS PARA EMPEZAR</span>{STARTER_QUESTIONS.map((p, i) => <button key={p} onClick={() => onSelectPrompt(p)}><span className={`suggestion-icon suggestion-${i}`}><i className={`bi ${['bi-briefcase', 'bi-diagram-3', 'bi-lightning-charge'][i]}`} /></span><span><b>{['IA aplicada a empresa', 'Agentes con evidencia', 'Ideas editoriales con potencial'][i]}</b><small>{p}</small></span><i className="bi bi-arrow-up-right suggestion-arrow" /></button>)}</div></section>;
}

function Overview({ result, topics, sourceList, opportunities, changeView }) {
  const m = result.metrics || {};
  const maxCount = Math.max(...topics.map(t => Number(t.count || 0)), 1);
  return <div className="result-view">
    <div className="metric-grid row g-3"><div className="col-6 col-xl-3"><MetricCard icon="bi-files" label="Contenido único" value={n(m.fixed_content ?? m.unique_content)} hint="muestra fija" tone="mint" /></div><div className="col-6 col-xl-3"><MetricCard icon="bi-broadcast" label="Fuentes con datos" value={`${n(m.sources_responding)} / ${n(m.sources_requested)}`} hint="cobertura" tone="blue" /></div><div className="col-6 col-xl-3"><MetricCard icon="bi-calendar2-check" label="Cobertura temporal" value={percent(m.date_coverage_pct)} hint="registros fechados" tone="yellow" /></div><div className="col-6 col-xl-3"><MetricCard icon="bi-stars" label="Ideas editoriales" value={n(opportunities.length)} hint={result.is_synthetic ? 'demo' : 'generadas con IA'} tone="coral" /></div></div>
    <div className="row g-3 mt-1"><div className="col-12 col-xl-7"><section className="content-card h-100"><div className="section-head"><div><Eyebrow>SEÑALES DE LA MUESTRA</Eyebrow><h3>Qué temas aparecen</h3><p>Distribución descriptiva de los registros recuperados; no equivale a crecimiento global.</p></div><button className="btn btn-link link-action" onClick={() => changeView('radar')}>Ver radar <i className="bi bi-arrow-up-right ms-1" /></button></div>{topics.length ? <div className="topic-chart-list">{topics.slice(0, 7).map((topic, i) => <div key={topic.topic || i} className="topic-chart-row"><div className="topic-name"><span className={`topic-index tone-${i % 5}`}>{String(i + 1).padStart(2, '0')}</span><span>{topic.topic || topic.subtopic || 'Tema sin clasificar'}</span></div><div className="topic-bar-track"><div className={`topic-bar-fill bar-${i % 5}`} style={{ width: `${Math.max(2, Number(topic.count || 0) / maxCount * 100)}%` }} /></div><div className="topic-number">{n(topic.count)}</div></div>)}</div> : <EmptyPanel title="Aún no hay temas calculados" detail="Cuando una fuente entregue registros clasificables, aparecerán aquí." />}<div className="chart-legend"><span><i className="legend-dot dot-mint" />Número de registros</span><span><i className="bi bi-info-circle" /> Muestra recuperada, no volumen global.</span></div></section></div>
    <div className="col-12 col-xl-5"><section className="content-card h-100"><div className="section-head"><div><Eyebrow>ESTADO DE CONECTORES</Eyebrow><h3>Fuentes de investigación</h3><p>Disponibilidad observada en esta ejecución.</p></div><span className="tiny-counter">{sourceList.filter(s => ['ok', 'ok_after_fallback'].includes(s.status) && s.records > 0).length} activas</span></div><div className="source-status-list">{sourceList.map((source) => <div className="source-row" key={source.key || source.name}><div className={`source-icon source-${source.key}`}><SourceIcon source={source.key} /></div><div className="source-name"><b>{source.name}</b><small>{source.detail || (source.records ? `${n(source.records)} registros` : 'Sin detalle adicional')}</small></div><div className="source-side"><b>{n(source.records)}</b><StatusPill status={source.status} label={sourceStatusLabel(source.status)} /></div></div>)}</div><div className="source-footnote"><i className="bi bi-shield-check" /> Las fuentes opcionales necesitan claves o autorización para responder.</div></section></div></div>
    <div className="row g-3 mt-1"><div className="col-12 col-xl-7"><section className="content-card"><div className="section-head"><div><Eyebrow>LECTURA DEL SISTEMA</Eyebrow><h3>Interpretación preliminar</h3></div><span className="ai-label"><i className="bi bi-stars" /> {result.editorial?.status === 'ok' ? 'OpenAI' : result.editorial?.status === 'demo' ? 'Demo' : 'Sin estrategia IA'}</span></div><p className="editorial-summary">{textValue(result.editorial?.executive_summary, textValue(result.narrative, 'No hay una síntesis disponible para esta ejecución.'))}</p>{(result.editorial?.limitations || []).length > 0 && <div className="soft-note"><i className="bi bi-info-circle" /><div><b>Limitaciones a considerar</b><ul>{result.editorial.limitations.slice(0, 3).map((x, i) => <li key={i}>{x}</li>)}</ul></div></div>}<button className="btn btn-primary-outline mt-3" onClick={() => changeView('opportunities')}>Revisar decisiones editoriales <i className="bi bi-arrow-right ms-2" /></button></section></div><div className="col-12 col-xl-5"><section className="content-card"><div className="section-head"><div><Eyebrow>PRÓXIMOS PASOS</Eyebrow><h3>Antes de publicar</h3></div><i className="bi bi-clipboard-check section-head-icon" /></div><div className="review-steps">{[{ title: 'Comprobar la cobertura', desc: `${n(m.sources_responding)} fuentes respondieron en esta ejecución.`, good: Number(m.sources_responding || 0) >= 3 }, { title: 'Verificar fechas y enlaces', desc: `${n(m.items_with_links)} registros con enlace; cobertura temporal ${percent(m.date_coverage_pct)}.`, good: Number(m.date_coverage_pct || 0) >= 60 }, { title: 'Validar crecimiento', desc: Number(m.growth_candidates_count || 0) ? `${n(m.growth_candidates_count)} candidatos cumplen los criterios internos.` : 'No hay señales de crecimiento confirmadas en esta muestra.', good: Number(m.growth_candidates_count || 0) > 0 }].map((s, i) => <div className="review-step" key={s.title}><span className={s.good ? 'step-icon good' : 'step-icon caution'}><i className={`bi ${s.good ? 'bi-check-lg' : 'bi-exclamation-lg'}`} /></span><div><b>{s.title}</b><small>{s.desc}</small></div></div>)}</div></section></div></div>
  </div>;
}
function SourceIcon({ source }) {
  const map = { news: 'bi-newspaper', hn: 'bi-chat-square-text', github: 'bi-github', openalex: 'bi-journal-bookmark', arxiv: 'bi-mortarboard', youtube: 'bi-youtube', trends: 'bi-graph-up-arrow', gdelt: 'bi-globe2', reddit: 'bi-reddit' };
  return <i className={`bi ${map[source] || 'bi-link-45deg'}`} />;
}
function sourceStatusLabel(status) { return ({ ok: 'Activa', ok_after_fallback: 'Activa', not_selected: 'Omitida', no_results: 'Sin datos', unavailable: 'No disponible', error: 'Error', unknown: 'Desconocida' })[status] || status || 'Desconocida'; }

function RadarView({ result, topics }) {
  const subtopics = result.ai_subtopics || result.raw_metrics?.ai_subtopics || [];
  const candidates = result.growth_candidates || result.raw_metrics?.candidate_signals || [];
  const max = Math.max(...topics.map(t => Number(t.count || 0)), 1);
  return <div className="result-view"><div className="row g-3"><div className="col-12 col-xl-7"><section className="content-card"><div className="section-head"><div><Eyebrow>CLASIFICACIÓN Y PRESENCIA</Eyebrow><h3>Temas principales</h3><p>Señales ordenadas por su presencia en los registros de esta muestra.</p></div><span className="tiny-counter">{topics.length} temas</span></div>{topics.length ? <div className="topic-table-wrap"><table className="table align-middle radar-table"><thead><tr><th>Tema</th><th>Registros</th><th>Cuota muestra</th><th>Fuentes</th><th>Lectura temporal</th></tr></thead><tbody>{topics.map((t, i) => <tr key={t.topic || i}><td><span className="table-topic-index">{i + 1}</span><b>{t.topic || t.subtopic}</b><div className="radar-inline-bar"><span style={{ width: `${Math.max(2, Number(t.count || 0) / max * 100)}%` }} /></div></td><td>{n(t.count)}</td><td>{percent(t.share_pct)}</td><td>{n(t.source_count)}</td><td><SignalLabel value={t.trend_direction} /></td></tr>)}</tbody></table></div> : <EmptyPanel title="Sin resultados temáticos" detail="Prueba otras fuentes o amplía la ventana de búsqueda." />}</section></div><div className="col-12 col-xl-5"><section className="content-card h-100"><div className="section-head"><div><Eyebrow>LECTURA CAUTELOSA</Eyebrow><h3>Señales de crecimiento</h3><p>Solo se muestran candidatos que superan los criterios definidos por el motor.</p></div></div>{candidates.length ? <div className="candidate-list">{candidates.map((c, i) => <div className="candidate-card" key={c.topic || c.subtopic || i}><div className="candidate-symbol"><i className="bi bi-graph-up-arrow" /></div><div><b>{c.topic || c.subtopic}</b><p>{textValue(c.evidence_status, 'Candidato del motor')}</p><div className="candidate-meta"><span>{n(c.count)} registros</span><span>{percent(c.share_pct)} de la muestra</span></div></div></div>)}</div> : <div className="no-candidate"><span className="no-candidate-icon"><i className="bi bi-shield-check" /></span><b>No hay señales confirmadas en esta muestra</b><p>Eso no significa que el tema no esté creciendo: significa que esta ejecución no ha encontrado evidencia suficiente para afirmarlo con los criterios del sistema.</p></div>}</section></div></div>
    <div className="row g-3 mt-1"><div className="col-12 col-lg-6"><section className="content-card"><div className="section-head"><div><Eyebrow>SUBTEMAS</Eyebrow><h3>Detalle de la conversación</h3></div></div>{subtopics.length ? <div className="subtopic-list">{subtopics.slice(0, 12).map((t, i) => <div className="subtopic-row" key={t.subtopic || i}><div><b>{t.subtopic || t.topic}</b><small>{n(t.source_count)} fuentes · {textValue(t.evidence_status, 'estado no disponible')}</small></div><div className="subtopic-right"><b>{n(t.count)}</b><small>{percent(t.share_pct)}</small></div></div>)}</div> : <EmptyPanel title="Sin subtemas clasificados" detail="El motor no devolvió detalle por subtema en esta ejecución." />}</section></div><div className="col-12 col-lg-6"><section className="content-card"><div className="section-head"><div><Eyebrow>METODOLOGÍA</Eyebrow><h3>Cómo interpretar la lectura</h3></div><i className="bi bi-info-circle section-head-icon" /></div><div className="interpretation-list"><div><span className="legend-chip chip-green" /><div><b>Señal consistente</b><p>Solo cuando el motor encuentra soporte temporal y de cuota dentro de la muestra comparable.</p></div></div><div><span className="legend-chip chip-yellow" /><div><b>Indicio exploratorio</b><p>Puede orientar una investigación posterior, pero no se debe presentar como tendencia confirmada.</p></div></div><div><span className="legend-chip chip-gray" /><div><b>Datos heterogéneos</b><p>Noticias, código, papers, vídeos y búsquedas no representan la misma actividad y no deben sumarse como equivalentes.</p></div></div></div></section></div></div></div>;
}
function SignalLabel({ value }) {
  const map = { positive_consistent: ['Positiva en muestra', 'signal-positive'], negative_consistent: ['Negativa en muestra', 'signal-negative'], mixed_or_flat: ['Mixta / estable', 'signal-neutral'], not_comparable: ['No comparable', 'signal-neutral'] };
  const [label, cls] = map[value] || [value || 'Sin datos', 'signal-neutral'];
  return <span className={`signal-label ${cls}`}>{label}</span>;
}

function EvidenceView({ items, allCount, search, setSearch, sourceFilter, setSourceFilter }) {
  const sourceNames = [...new Set(items.map(x => x.source).filter(Boolean))].sort();
  return <div className="result-view"><section className="content-card"><div className="section-head evidence-heading"><div><Eyebrow>EXPLORADOR DE FUENTES</Eyebrow><h3>Abre la evidencia original</h3><p>Revisa título, resumen, fuente, fecha y etiquetas antes de confiar en una afirmación.</p></div><span className="tiny-counter">{items.length} / {allCount} registros</span></div><div className="evidence-filters"><div className="input-group evidence-search"><span className="input-group-text"><i className="bi bi-search" /></span><input className="form-control" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar título, resumen, fuente o tema…" aria-label="Buscar evidencia" /></div><select className="form-select source-filter" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}><option value="all">Todas las fuentes</option>{sourceNames.map(name => <option value={name.toLowerCase()} key={name}>{name}</option>)}</select></div>{items.length ? <div className="evidence-results">{items.slice(0, 120).map((item, i) => <EvidenceCard item={item} key={item.evidence_id || item.url || i} />)}</div> : <EmptyPanel icon="bi-journal-x" title="No hay registros para este filtro" detail="Prueba otra palabra, selecciona otra fuente o ejecuta una investigación." />}{items.length > 120 && <div className="soft-note mt-3"><i className="bi bi-info-circle" /><div>Se muestran los primeros 120 resultados filtrados. Exporta el CSV para revisar el conjunto completo.</div></div>}</section></div>;
}
function EvidenceCard({ item }) {
  const link = safeUrl(item.url);
  return <article className="evidence-card"><div className="evidence-card-main"><div className="evidence-source-line"><span className="evidence-id">{item.evidence_id || 'REGISTRO'}</span><span>{item.source || 'Fuente desconocida'}</span>{item.collection_method === 'discovery' && <span className="badge-soft badge-lilac">Descubrimiento web</span>}{item.needs_review && <span className="badge-soft badge-amber">Revisar clasificación</span>}{(item.date_status === 'missing' || !item.published) && <span className="badge-soft badge-gray">Sin fecha</span>}{item.date_status === 'future_anomaly' && <span className="badge-soft badge-coral">Fecha anómala</span>}</div><h4>{link ? <a href={link} target="_blank" rel="noopener noreferrer">{textValue(item.title, 'Sin título')} <i className="bi bi-box-arrow-up-right" /></a> : textValue(item.title, 'Sin título')}</h4><p>{textValue(item.summary, 'Esta fuente no incluye un resumen textual en los metadatos recuperados.')}</p><div className="evidence-tags">{item.topic && <span>{item.topic}</span>}{item.subtopic && <span>{item.subtopic}</span>}{item.domain_group && <span>{item.domain_group}</span>}</div></div><div className="evidence-date"><i className="bi bi-calendar3" /><span>{dateLabel(item.published)}</span>{item.metric_eligible !== undefined && <small className={item.metric_eligible ? 'eligible' : 'not-eligible'}>{item.metric_eligible ? 'Elegible para métricas' : 'Fuera de métricas temporales'}</small>}</div></article>;
}

function OpportunitiesView({ editorial, copyOpportunity, changeView }) {
  const ops = editorial.opportunities || [];
  const signalText = { clear_opportunity: 'Oportunidad con respaldo', promising_but_early: 'Prometedor, por validar', mixed_signals: 'Señales mixtas', insufficient_evidence: 'Evidencia insuficiente', demo: 'Demostración' }[editorial.overall_signal] || 'Lectura exploratoria';
  return <div className="result-view"><section className="editorial-hero card border-0"><div className="editorial-hero-copy"><Eyebrow>OPENAI · CAPA EDITORIAL</Eyebrow><h3>{textValue(editorial.executive_summary, 'La estrategia editorial aparecerá cuando la capa de IA se complete.')}</h3><div className="editorial-meta"><span className="editorial-signal"><i className="bi bi-activity" />{signalText}</span><span><i className="bi bi-link-45deg" />{n(editorial.evidence_pool_size)} registros en el conjunto de evidencia</span><span><i className="bi bi-cpu" />{editorial.model || 'Modelo no disponible'}</span></div></div><div className="editorial-orb"><i className="bi bi-stars" /><span /><span /><span /></div></section>
    {editorial.status !== 'ok' && editorial.status !== 'demo' && <div className="alert alert-warning alert-soft mt-3"><i className="bi bi-exclamation-triangle me-2" />La estrategia editorial automática no se completó en esta ejecución. Revisa `OPENAI_API_KEY`, el modelo configurado y los detalles de la API. No se generan propuestas manuales de sustitución.</div>}
    <div className="priority-grid row g-3 mt-1">{(editorial.priority_actions || []).length ? editorial.priority_actions.slice(0, 4).map((action, i) => <div className="col-12 col-md-6 col-xl-4" key={action}><div className="priority-card"><span>{String(i + 1).padStart(2, '0')}</span><p>{action}</p></div></div>) : <div className="col-12"><div className="soft-note"><i className="bi bi-info-circle" /><div>El modelo no devolvió acciones prioritarias para esta investigación.</div></div></div>}</div>
    <div className="section-head opportunities-heading"><div><Eyebrow>PROPUESTAS CON TRAZABILIDAD</Eyebrow><h3>Oportunidades editoriales</h3><p>Cada tarjeta distingue respaldo, confianza cualitativa y verificaciones pendientes.</p></div><span className="tiny-counter">{ops.length} propuestas</span></div>
    {ops.length ? <div className="opportunity-stack">{ops.map((op, index) => <OpportunityCard key={`${op.title}-${index}`} op={op} index={index} onCopy={() => copyOpportunity(op)} />)}</div> : <EmptyPanel icon="bi-stars" title="No hay propuestas editoriales en esta ejecución" detail="Comprueba si OpenAI está configurado y si hay evidencia suficiente en los resultados. Luego puedes volver a investigar con una consulta más específica." />}
    {(editorial.audience_insights || []).length > 0 && <section className="content-card mt-3"><div className="section-head"><div><Eyebrow>RELEVANCIA PARA 30X</Eyebrow><h3>Qué necesita la audiencia</h3></div></div><div className="audience-insights">{editorial.audience_insights.map((x, i) => <div key={x}><span>{i + 1}</span><p>{x}</p></div>)}</div></section>}
    {(editorial.limitations || []).length > 0 && <section className="content-card mt-3"><div className="section-head"><div><Eyebrow>TRANSPARENCIA</Eyebrow><h3>Limitaciones y validaciones</h3></div></div><ul className="limitation-list">{editorial.limitations.map((x, i) => <li key={i}>{x}</li>)}</ul><p className="method-note">{editorial.editorial_method || 'Método no descrito por el modelo.'}</p></section>}
    <div className="mt-3 text-end"><button className="btn btn-outline-primary" onClick={() => changeView('evidence')}>Volver a las evidencias <i className="bi bi-arrow-right ms-2" /></button></div>
  </div>;
}
function OpportunityCard({ op, index, onCopy }) {
  const strength = { strong: ['Respaldo alto', 'strength-strong'], moderate: ['Respaldo moderado', 'strength-moderate'], exploratory: ['Exploratorio', 'strength-exploratory'], insufficient: ['Evidencia insuficiente', 'strength-insufficient'] }[op.evidence_strength] || ['Por evaluar', 'strength-insufficient'];
  const confidence = { high: 'Alta · cualitativa', medium: 'Media · cualitativa', low: 'Baja · cualitativa' }[op.confidence_level] || 'No disponible';
  return <article className="opportunity-card"><div className="opportunity-number">{String(index + 1).padStart(2, '0')}</div><div className="opportunity-main"><div className="opportunity-card-head"><div><span className="opportunity-topic">{textValue(op.topic, 'Tema no especificado')} {op.content_pillar && `· ${op.content_pillar}`}</span><h4>{op.title}</h4></div><button className="btn btn-outline-secondary btn-sm brief-button" onClick={onCopy}><i className="bi bi-copy me-1" />Copiar brief</button></div><div className="opportunity-badges"><span className={`strength-badge ${strength[1]}`}><i className="bi bi-shield-check" />{strength[0]}</span><span className="confidence-badge"><i className="bi bi-speedometer2" />Confianza: {confidence}</span><span className="format-badge"><i className="bi bi-camera-video" />{textValue(op.format, 'Formato por definir')}</span></div><div className="opportunity-body-grid"><div className="opportunity-field"><label>Ángulo</label><p>{textValue(op.angle)}</p></div><div className="opportunity-field"><label>Gancho propuesto</label><p className="hook-quote">“{textValue(op.hook)}”</p></div><div className="opportunity-field"><label>Audiencia</label><p>{textValue(op.target_audience)}</p></div><div className="opportunity-field"><label>Por qué ahora</label><p>{textValue(op.why_now)}</p></div></div><div className="evidence-strength-note"><div><i className="bi bi-link-45deg" /><b>Respaldo:</b> {textValue(op.evidence_summary)}</div>{(op.evidence || []).length > 0 ? <div className="opportunity-evidence-links">{op.evidence.map((ev, i) => <a href={safeUrl(ev.url) || undefined} target="_blank" rel="noopener noreferrer" key={ev.id || i}>{ev.title || ev.source || 'Abrir evidencia'} <i className="bi bi-box-arrow-up-right" /></a>)}</div> : <small className="no-evidence-message">No hay evidencias vinculadas. La propuesta debe tratarse como hipótesis creativa hasta validarla.</small>}</div>
    <details className="opportunity-details"><summary><i className="bi bi-list-ol me-2" />Ver mini-guion, CTA, riesgos y validaciones</summary><div className="details-grid"><div><label>MINI-GUION</label><ol>{(op.outline || []).map((x, i) => <li key={i}>{x}</li>)}</ol><label>LLAMADA A LA ACCIÓN</label><p>{textValue(op.cta)}</p>{op.localization && <><label>ADAPTACIÓN LOCAL</label><p>{op.localization}</p></>}</div><div><label>VALIDACIONES PENDIENTES</label>{(op.validation_needed || []).length ? <ul>{op.validation_needed.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p>No indicadas por el modelo; verifica igualmente los datos críticos.</p>}<label>RIESGOS EDITORIALES</label>{(op.risks || []).length ? <ul>{op.risks.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p>No se han listado riesgos concretos.</p>}<label>JUSTIFICACIÓN DE CONFIANZA</label><p>{textValue(op.confidence_rationale)}</p></div></div></details></div></article>;
}

function ReportsView({ result, history, exportReport, loadRun, refreshHistory, showToast }) {
  const limitations = result?.editorial?.limitations || [];
  const copyLimitations = async () => {
    const content = limitations.join('\n') || 'No hay limitaciones editoriales registradas.';
    try { await navigator.clipboard.writeText(content); showToast('Notas metodológicas copiadas.'); }
    catch { downloadText(content, 'text/plain;charset=utf-8', 'notas-metodologicas.txt'); showToast('Notas descargadas en un archivo de texto.'); }
  };
  return <div className="result-view"><div className="row g-3"><div className="col-12 col-xl-7"><section className="content-card h-100"><div className="section-head"><div><Eyebrow>EXPORTAR INVESTIGACIÓN</Eyebrow><h3>Llévate el informe</h3><p>Descarga la evidencia, las métricas y las propuestas para revisarlas fuera de la aplicación.</p></div><span className="export-card-icon"><i className="bi bi-download" /></span></div><div className="export-options">{[{ id: 'md', name: 'Informe ejecutivo', desc: 'Resumen, métricas, oportunidades y método.', icon: 'bi-markdown', ext: 'MD' }, { id: 'csv', name: 'Registros de evidencia', desc: 'Un registro por fila, listo para una hoja de cálculo.', icon: 'bi-filetype-csv', ext: 'CSV' }, { id: 'json', name: 'Datos completos', desc: 'Resultados, estado de conectores y estrategia editorial.', icon: 'bi-filetype-json', ext: 'JSON' }].map(option => <button key={option.id} className="export-option" onClick={() => exportReport(option.id)}><span className="export-option-icon"><i className={`bi ${option.icon}`} /></span><span className="export-option-text"><b>{option.name}</b><small>{option.desc}</small></span><span className="export-extension">.{option.ext}</span><i className="bi bi-arrow-down-circle export-download-icon" /></button>)}</div><button className="btn btn-outline-primary mt-3" onClick={copyLimitations}><i className="bi bi-clipboard-check me-2" />Copiar notas metodológicas</button></section></div><div className="col-12 col-xl-5"><section className="content-card h-100"><div className="section-head"><div><Eyebrow>REVISIÓN PREVIA</Eyebrow><h3>Lista de control</h3><p>Chequeos rápidos antes de convertir los hallazgos en una publicación.</p></div></div><div className="review-steps">{[{ title: 'Fuentes independientes', desc: `${n(result.metrics?.sources_responding)} fuentes con datos de ${n(result.metrics?.sources_requested)} solicitadas.`, good: Number(result.metrics?.sources_responding || 0) >= 3 }, { title: 'Fechas de los registros', desc: `Cobertura temporal: ${percent(result.metrics?.date_coverage_pct)}.`, good: Number(result.metrics?.date_coverage_pct || 0) >= 60 }, { title: 'Crecimiento respaldado', desc: `${n(result.metrics?.growth_candidates_count)} señales cumplen los criterios internos.`, good: Number(result.metrics?.growth_candidates_count || 0) > 0 }, { title: 'Estrategia editorial', desc: result.editorial?.status === 'ok' ? `${(result.editorial?.opportunities || []).length} propuestas de OpenAI.` : 'No se completó o es una demo sintética.', good: result.editorial?.status === 'ok' }].map((x, i) => <div className="review-step" key={i}><span className={`step-icon ${x.good ? 'good' : 'caution'}`}><i className={`bi ${x.good ? 'bi-check-lg' : 'bi-exclamation-lg'}`} /></span><div><b>{x.title}</b><small>{x.desc}</small></div></div>)}</div></section></div></div>
    <section className="content-card mt-3"><div className="section-head"><div><Eyebrow>HISTORIAL LOCAL</Eyebrow><h3>Investigaciones anteriores</h3><p>Las ejecuciones se guardan en este equipo y se pueden recuperar desde aquí.</p></div><button className="btn btn-outline-secondary btn-sm" onClick={refreshHistory}><i className="bi bi-arrow-clockwise me-1" />Actualizar</button></div>{history.length ? <div className="history-table-wrap"><table className="table align-middle history-table"><thead><tr><th>CONSULTA</th><th>FECHA</th><th>REGIÓN</th><th>REGISTROS</th><th>ESTADO</th><th /></tr></thead><tbody>{history.map(run => <tr key={run.id}><td><span className="history-question">{run.question}</span></td><td>{dateLabel(run.created_at)}</td><td>{run.region}</td><td>{n(run.records_count)}</td><td><StatusPill status={run.status} label={run.status === 'ok' ? 'Completado' : run.status === 'partial' ? 'Parcial' : run.status} /></td><td><button className="btn btn-sm btn-primary-outline" onClick={() => loadRun(run.id)}>Abrir <i className="bi bi-arrow-up-right ms-1" /></button></td></tr>)}</tbody></table></div> : <EmptyPanel icon="bi-clock-history" title="Todavía no hay investigaciones guardadas" detail="Tras realizar una consulta real, el historial aparecerá aquí." />}</section>
    <section className="method-notes content-card mt-3"><div className="section-head"><div><Eyebrow>GUÍA DE INTERPRETACIÓN</Eyebrow><h3>Qué significa y qué no significa</h3></div></div><div className="row g-3"><div className="col-12 col-md-4"><b><i className="bi bi-bar-chart-line me-2" />Métricas</b><p>Describen la muestra recuperada y los cálculos del motor; no son un censo de todo Internet.</p></div><div className="col-12 col-md-4"><b><i className="bi bi-stars me-2" />Interpretación de IA</b><p>Es una propuesta cualitativa. No sustituye la comprobación de cifras, contexto ni referencias.</p></div><div className="col-12 col-md-4"><b><i className="bi bi-graph-up me-2" />Crecimiento</b><p>Una sola ejecución no basta para probar un cambio sostenido. Hay que comparar muestras comparables en el tiempo.</p></div></div></section>
  </div>;
}
