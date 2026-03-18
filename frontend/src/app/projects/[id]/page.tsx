'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api, Project } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const LOG_COLORS: Record<string, string> = {
  error: 'var(--red)',
  warning: 'var(--amber)',
  success: 'var(--green)',
  info: 'var(--muted)',
}

export default function ProjectDetail() {
  const params = useParams()
  const id = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [groupedLogs, setGroupedLogs] = useState<any[]>([])
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set())
  const [logSearch, setLogSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const [logView, setLogView] = useState<'grouped' | 'flat'>('grouped')
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)
  const [liveElapsed, setLiveElapsed] = useState<number>(0)
  const [refreshing, setRefreshing] = useState(false)
  const [hiringLens, setHiringLens] = useState<any>(null)
  const [hiringLoading, setHiringLoading] = useState(false)
  const [readiness, setReadiness] = useState<any>(null)
  const [studyHistory, setStudyHistory] = useState<any>(null)
  const [exportingDoc, setExportingDoc] = useState(false)
  const [pitchText, setPitchText] = useState('')
  const [pitchResult, setPitchResult] = useState<any>(null)
  const [pitchLoading, setPitchLoading] = useState(false)
  const [pitchAudience, setPitchAudience] = useState('technical')
  const [jobDescription, setJobDescription] = useState('')
  const [whyResult, setWhyResult] = useState<any>(null)
  const [whyLoading, setWhyLoading] = useState(false)
  const [feynmanConcept, setFeynmanConcept] = useState('')
  const [feynmanExplanation, setFeynmanExplanation] = useState('')
  const [feynmanResult, setFeynmanResult] = useState<any>(null)
  const [feynmanLoading, setFeynmanLoading] = useState(false)
  const [aiDefense, setAiDefense] = useState<any>(null)
  const [prepSection, setPrepSection] = useState<'pitch' | 'why' | 'feynman' | 'defense'>('pitch')
  const [ragStatus, setRagStatus] = useState<any>(null)
  const [indexingRAG, setIndexingRAG] = useState(false)

  const load = useCallback(async () => {
    const [p, l, gl] = await Promise.all([
      api.getProject(id),
      api.getLogs(id),
      api.getLogsGrouped(id),
    ])
    setProject(p)
    setLogs(l)
    setGroupedLogs(gl)
    setLoading(false)
    api.getReadinessScore(id).then(setReadiness).catch(() => {})
    api.getStudyHistory(id).then(setStudyHistory).catch(() => {})
    api.getRAGChunkCount(id).then(setRagStatus).catch(() => {})
  }, [id])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    api.getAIDefensePrep().then(setAiDefense).catch(() => {})
  }, [])

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  useEffect(() => {
    if (project) setLiveElapsed(project.elapsed_seconds)
  }, [project])

  useEffect(() => {
    if (!project) return
    try {
      const notes = (project as any).hiring_notes
      if (notes) setHiringLens(JSON.parse(notes))
    } catch {}
  }, [project])

  useEffect(() => {
    if (!project || project.status !== 'building') return
    const tick = setInterval(() => setLiveElapsed(e => e + 1), 1000)
    return () => clearInterval(tick)
  }, [project?.status])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await api.refreshProject(id)
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  const handleHiringLens = async () => {
    setHiringLoading(true)
    try {
      const result = await api.getHiringLens(id)
      if (result.hiring_data) setHiringLens(result.hiring_data)
    } finally {
      setHiringLoading(false)
    }
  }

  const handleScroll = () => {
    if (!logsContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50)
  }

  const handleImportLogs = async () => {
    setImporting(true)
    try {
      await api.importProjectLogs(id)
      await load()
    } finally {
      setImporting(false)
    }
  }

  const togglePhase = (phase: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev)
      if (next.has(phase)) next.delete(phase)
      else next.add(phase)
      return next
    })
  }

  if (loading) return <div style={{ color: 'var(--muted)', padding: 40 }}>Loading...</div>
  if (!project) return <div style={{ color: 'var(--red)', padding: 40 }}>Project not found</div>

  const elapsed = liveElapsed
  const estimated = project.estimated_minutes * 60
  const pct = project.status === 'done' ? 100 : Math.min(95, Math.round((elapsed / estimated) * 100))
  const minsRemaining = Math.max(0, Math.round((estimated - elapsed) / 60))

  const errorLogs = logs.filter(l => l.level === 'error')
  const recentLogs = logs.slice(-5)

  return (
    <div style={{ width: '100%' }}>
      <Link href="/" style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'none', display: 'inline-block', marginBottom: 16, letterSpacing: 1 }}>
        ← DASHBOARD
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{project.name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{project.company} · port {project.port} · {project.stack}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span className={`badge-${project.status}`} style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 1 }}>
            {project.status}
          </span>
          {project.status === 'building' && <span style={{ fontSize: 11, color: 'var(--amber)' }}>~{minsRemaining}m remaining</span>}
          {project.status === 'error' && <span style={{ fontSize: 11, color: 'var(--red)' }}>{errorLogs.length} error{errorLogs.length !== 1 ? 's' : ''} detected</span>}
        </div>
      </div>

      <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: project.status === 'error' ? 'var(--red)' : 'var(--green)', transition: 'width 1s' }} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'Files created', value: String(project.files_count) },
          { label: 'Phase', value: project.phase || 'Not started' },
          { label: 'Elapsed', value: `${Math.round(liveElapsed / 60)}m` },
          { label: 'Log entries', value: String(logs.length) },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{m.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Error banner */}
      {errorLogs.length > 0 && (
        <div style={{ background: 'rgba(255,77,106,0.1)', border: '1px solid var(--red)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>⚠ {errorLogs.length} error{errorLogs.length !== 1 ? 's' : ''} detected</div>
          {errorLogs.slice(-3).map((l, i) => (
            <div key={i} style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--red)', padding: '2px 0' }}>{l.message}</div>
          ))}
          <button onClick={() => setTab('logs')} style={{ marginTop: 8, fontSize: 11, color: 'var(--red)', border: '1px solid var(--red)', background: 'transparent', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontFamily: 'monospace' }}>
            View full logs →
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, alignItems: 'center' }}>
        {['overview', 'logs', 'quiz', 'study', 'prep'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 16px', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
            borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'monospace',
            background: tab === t ? 'var(--text)' : 'transparent',
            color: tab === t ? 'var(--bg)' : 'var(--muted)',
          }}>{t}{t === 'logs' && logs.length > 0 ? ` (${logs.length})` : ''}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={handleHiringLens} disabled={hiringLoading} style={{
            padding: '7px 16px', fontSize: 11, letterSpacing: 1,
            borderRadius: 6, border: '1px solid var(--amber)', cursor: hiringLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
            background: hiringLoading ? 'var(--border)' : 'transparent',
            color: hiringLoading ? 'var(--bg)' : 'var(--amber)',
          }}>
            {hiringLoading ? 'Analyzing...' : '★ Hiring lens'}
          </button>
          <button onClick={handleRefresh} disabled={refreshing} style={{
            padding: '7px 16px', fontSize: 11, letterSpacing: 1,
            borderRadius: 6, border: '1px solid var(--border)', cursor: refreshing ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
            background: refreshing ? 'var(--border)' : 'transparent',
            color: refreshing ? 'var(--bg)' : 'var(--muted)',
          }}>
            {refreshing ? 'Refreshing...' : '↻ Refresh'}
          </button>
          <button onClick={async () => {
            setIndexingRAG(true)
            try {
              const result = await api.indexProjectRAG(id)
              setRagStatus({ chunks_indexed: result.indexed, has_rag: result.indexed > 0 })
              alert(`Indexed ${result.indexed} code chunks for smarter questions`)
            } finally {
              setIndexingRAG(false)
            }
          }} disabled={indexingRAG} style={{
            padding: '7px 14px', fontSize: 11, borderRadius: 6,
            border: `1px solid ${ragStatus?.has_rag ? 'var(--green)' : 'var(--border)'}`,
            background: 'transparent',
            color: ragStatus?.has_rag ? 'var(--green)' : 'var(--muted)',
            cursor: indexingRAG ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}>
            {indexingRAG ? 'Indexing...' : ragStatus?.has_rag ? `⚡ ${ragStatus.chunks_indexed} chunks` : '⚡ Index for RAG'}
          </button>
        </div>
      </div>

      {tab === 'overview' && (
        <div>
        {readiness && (
          <div style={{
            background: 'var(--surface)', border: `1px solid var(--${readiness.color === 'green' ? 'green' : readiness.color === 'amber' ? 'amber' : 'border'})`,
            borderRadius: 10, padding: 16, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Interview readiness</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{readiness.label}</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: `var(--${readiness.color === 'green' ? 'green' : readiness.color === 'amber' ? 'amber' : 'muted'})` }}>
                  {readiness.score}
                </span>
              </div>
            </div>

            <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3, transition: 'width 1s',
                width: `${readiness.score}%`,
                background: readiness.score >= 80 ? 'var(--green)' : readiness.score >= 60 ? 'var(--amber)' : 'var(--blue)',
              }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'Quiz accuracy', value: readiness.breakdown.quiz_accuracy, max: 40 },
                { label: 'Interviews', value: readiness.breakdown.interview_score, max: 30 },
                { label: 'Time studied', value: readiness.breakdown.time_studied, max: 15 },
                { label: 'Code review', value: readiness.breakdown.walkthrough, max: 15 },
              ].map(item => (
                <div key={item.label} style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 10px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{item.value}<span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>/{item.max}</span></div>
                </div>
              ))}
            </div>

            {readiness.stats && (
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 16 }}>
                <span>{readiness.stats.total_quiz_attempts} quiz attempts</span>
                <span>{readiness.stats.interview_sessions} interview sessions</span>
                <span>{readiness.stats.total_minutes_studied}m studied</span>
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Project info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Stack', value: project.stack },
                { label: 'Port', value: String(project.port) },
                { label: 'GitHub', value: project.github_url || 'Not yet created', isLink: !!project.github_url },
                { label: 'Live URL', value: project.live_url || 'Not yet deployed', isLink: !!project.live_url },
              ].map(m => (
                <div key={m.label} style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>{m.label}</div>
                  {m.isLink
                    ? <a href={m.value} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--blue)', wordBreak: 'break-all' }}>{m.value}</a>
                    : <div style={{ fontSize: 13, wordBreak: 'break-all' }}>{m.value}</div>
                  }
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Recent activity</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid var(--border)', lineHeight: 2 }}>
              {recentLogs.length === 0 && <div style={{ color: 'var(--muted)' }}>No activity yet</div>}
              {recentLogs.map((l, i) => (
                <div key={i} style={{ color: LOG_COLORS[l.level] || 'var(--muted)' }}>
                  <span style={{ color: 'var(--border)', marginRight: 8 }}>{new Date(l.created_at).toLocaleTimeString()}</span>
                  {l.message}
                </div>
              ))}
            </div>
            {(project as any).build_summary && (
              <div style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid var(--green)', maxHeight: 300, overflowY: 'auto' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>BUILD SUMMARY</div>
                <pre style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'monospace' }}>
                  {(project as any).build_summary}
                </pre>
              </div>
            )}
            {hiringLens && (
              <div style={{ marginTop: 16, border: '1px solid var(--amber)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: 'rgba(245,166,35,0.08)', padding: '12px 16px', borderBottom: '1px solid var(--amber)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)', letterSpacing: 1 }}>★ HIRING LENS</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>How this project reads to a hiring partner</div>
                </div>

                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Strengths */}
                  {hiringLens.strengths?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>✓ Strengths</div>
                      {hiringLens.strengths.map((s: string, i: number) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '4px 0', lineHeight: 1.6, display: 'flex', gap: 8 }}>
                          <span style={{ color: 'var(--green)', flexShrink: 0 }}>›</span> {s}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Talking points */}
                  {hiringLens.talking_points?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>💬 Lead with these</div>
                      {hiringLens.talking_points.map((t: string, i: number) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '5px 10px', marginBottom: 4, background: 'rgba(245,166,35,0.06)', borderRadius: 6, lineHeight: 1.6, borderLeft: '2px solid var(--amber)' }}>
                          {t}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Gaps to fill */}
                  {hiringLens.gaps_to_fill?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--blue)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>⚡ Quick wins</div>
                      {hiringLens.gaps_to_fill.map((g: any, i: number) => (
                        <div key={i} style={{ fontSize: 12, padding: '8px 12px', marginBottom: 6, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 3 }}>{g.what}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 11 }}>{g.why} · <span style={{ color: 'var(--blue)' }}>{g.effort}</span></div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Red flags */}
                  {hiringLens.red_flags?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>⚠ Be ready to defend</div>
                      {hiringLens.red_flags.map((r: string, i: number) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0', lineHeight: 1.6, display: 'flex', gap: 8 }}>
                          <span style={{ color: 'var(--red)', flexShrink: 0 }}>›</span> {r}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {tab === 'logs' && (
        <div style={{ width: '100%' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <input
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              placeholder="Search logs..."
              style={{
                flex: 1, padding: '7px 12px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--text)', fontSize: 12, outline: 'none', fontFamily: 'monospace',
              }}
            />
            <button onClick={() => setLogView(v => v === 'grouped' ? 'flat' : 'grouped')} style={{
              padding: '7px 14px', fontSize: 11, borderRadius: 6,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--muted)', cursor: 'pointer', fontFamily: 'monospace',
            }}>
              {logView === 'grouped' ? 'Flat view' : 'Grouped view'}
            </button>
            <button onClick={handleImportLogs} disabled={importing} style={{
              padding: '7px 14px', fontSize: 11, borderRadius: 6,
              border: '1px solid var(--border)', background: 'transparent',
              color: importing ? 'var(--border)' : 'var(--amber)', cursor: importing ? 'not-allowed' : 'pointer',
              fontFamily: 'monospace',
            }}>
              {importing ? 'Importing...' : '↓ Import logs'}
            </button>
          </div>

          {/* Grouped view */}
          {logView === 'grouped' && (
            <div>
              {groupedLogs.length === 0 && (
                <div style={{ color: 'var(--muted)', fontSize: 12, padding: 16 }}>
                  No logs yet. Click "↓ Import logs" to load agent logs from disk.
                  {project.last_log && <div style={{ marginTop: 8, color: 'var(--text)' }}>Last known: {project.last_log}</div>}
                </div>
              )}
              {groupedLogs
                .filter(g => !logSearch || g.entries.some((e: any) => e.message.toLowerCase().includes(logSearch.toLowerCase())))
                .map((group: any) => {
                  const isExpanded = expandedPhases.has(group.phase)
                  const phaseColor = group.level === 'error' ? 'var(--red)' : group.level === 'warning' ? 'var(--amber)' : group.level === 'success' ? 'var(--green)' : 'var(--muted)'
                  const filteredEntries = logSearch
                    ? group.entries.filter((e: any) => e.message.toLowerCase().includes(logSearch.toLowerCase()))
                    : group.entries

                  return (
                    <div key={group.phase} style={{ marginBottom: 6 }}>
                      {/* Phase header */}
                      <button
                        onClick={() => togglePhase(group.phase)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', background: 'var(--surface)',
                          border: '1px solid var(--border)', borderRadius: isExpanded ? '8px 8px 0 0' : 8,
                          cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 12, color: phaseColor, flexShrink: 0 }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1 }}>
                          [{group.phase}]
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {group.preview}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--border)', flexShrink: 0 }}>
                          {group.count} lines
                        </span>
                      </button>

                      {/* Expanded entries */}
                      {isExpanded && (
                        <div style={{
                          background: 'var(--bg)', border: '1px solid var(--border)',
                          borderTop: 'none', borderRadius: '0 0 8px 8px',
                          fontFamily: 'monospace', fontSize: 11, lineHeight: 1.8,
                          maxHeight: 400, overflowY: 'auto', padding: '8px 14px',
                        }}>
                          {filteredEntries.map((entry: any, i: number) => (
                            <div key={entry.id || i} style={{
                              display: 'flex', gap: 10, padding: '2px 0',
                              borderBottom: '1px solid rgba(255,255,255,0.02)',
                              color: LOG_COLORS[entry.level] || 'var(--text)',
                            }}>
                              <span style={{ color: 'var(--border)', flexShrink: 0, fontSize: 10 }}>
                                {new Date(entry.created_at).toLocaleTimeString()}
                              </span>
                              <span style={{ wordBreak: 'break-word' }}>{entry.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          )}

          {/* Flat view */}
          {logView === 'flat' && (
            <div ref={logsContainerRef} onScroll={handleScroll} style={{
              fontFamily: 'monospace', fontSize: 12, background: 'var(--surface)',
              borderRadius: 8, padding: 16, border: '1px solid var(--border)',
              lineHeight: 1.8, height: 'calc(100vh - 320px)', overflowY: 'auto',
            }}>
              {logs.length === 0 && (
                <div style={{ color: 'var(--muted)' }}>
                  No logs yet. Click "↓ Import logs" to load agent logs from disk.
                </div>
              )}
              {logs
                .filter(l => !logSearch || l.message.toLowerCase().includes(logSearch.toLowerCase()))
                .map((l: any, i: number) => (
                  <div key={l.id || i} style={{
                    display: 'flex', gap: 12, padding: '1px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                  }}>
                    <span style={{ color: 'var(--border)', flexShrink: 0, fontSize: 10 }}>
                      {new Date(l.created_at).toLocaleTimeString()}
                    </span>
                    <span style={{ color: 'var(--border)', flexShrink: 0, fontSize: 10, minWidth: 50, textTransform: 'uppercase' }}>
                      [{l.level}]
                    </span>
                    {l.phase && (
                      <span style={{ color: 'var(--blue)', flexShrink: 0, fontSize: 10 }}>[{l.phase}]</span>
                    )}
                    <span style={{ color: LOG_COLORS[l.level] || 'var(--text)', wordBreak: 'break-word' }}>
                      {l.message}
                    </span>
                  </div>
                ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}

      {tab === 'quiz' && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16 }}>
            {(project as any).build_summary
              ? '✓ Build summary available — quiz uses your actual code'
              : 'Quiz uses project knowledge. More accurate after build completes.'}
          </div>
          <Link href={`/quiz?project=${project.id}`} style={{
            display: 'inline-block', padding: '12px 28px', background: 'var(--green)',
            color: '#000', borderRadius: 6, textDecoration: 'none', fontWeight: 700, fontSize: 14, fontFamily: 'monospace',
          }}>
            Start quiz for {project.name} →
          </Link>
          <Link href={`/interview?project=${project.id}`} style={{
            display: 'inline-block', marginTop: 12, padding: '10px 24px',
            background: 'transparent', color: 'var(--amber)',
            border: '1px solid var(--amber)', borderRadius: 6,
            textDecoration: 'none', fontWeight: 700, fontSize: 13, fontFamily: 'monospace',
          }}>
            Practice interview for {project.name} →
          </Link>
        </div>
      )}

      {tab === 'study' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={async () => {
              setExportingDoc(true)
              try {
                const result = await api.exportStudyDoc(id)
                const blob = new Blob([result.markdown], { type: 'text/markdown' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${result.project_name.replace(/\s+/g, '-')}-study-doc.md`
                a.click()
                URL.revokeObjectURL(url)
              } finally {
                setExportingDoc(false)
              }
            }} disabled={exportingDoc} style={{
              padding: '8px 18px', fontSize: 12, borderRadius: 6,
              border: '1px solid var(--green)', background: 'transparent',
              color: 'var(--green)', cursor: 'pointer', fontFamily: 'monospace',
            }}>
              {exportingDoc ? 'Exporting...' : '↓ Export study doc'}
            </button>
          </div>

          {!studyHistory ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading study history...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { label: 'Time studied', value: `${studyHistory.studied?.total_minutes || 0}m` },
                  { label: 'Questions answered', value: studyHistory.studied?.total_questions || 0 },
                  { label: 'Overall accuracy', value: `${studyHistory.studied?.overall_accuracy || 0}%` },
                  { label: 'Interviews done', value: studyHistory.interview_history?.length || 0 },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>{m.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{m.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid var(--green)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>✓ Mastered</div>
                  {studyHistory.mastered?.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Keep practicing to unlock</div>}
                  {studyHistory.mastered?.map((m: any, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '3px 0', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ textTransform: 'capitalize' }}>{m.type.replace('_', ' ')}</span>
                      <span style={{ color: 'var(--green)' }}>{m.accuracy}%</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid var(--red)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>⚠ Needs work</div>
                  {studyHistory.needs_work?.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Nothing here yet</div>}
                  {studyHistory.needs_work?.map((m: any, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '3px 0', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ textTransform: 'capitalize' }}>{m.type.replace('_', ' ')}</span>
                      <span style={{ color: 'var(--red)' }}>{m.accuracy}%</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>○ Not started</div>
                  {studyHistory.not_started?.length === 0 && <div style={{ fontSize: 11, color: 'var(--green)' }}>All types attempted!</div>}
                  {studyHistory.not_started?.map((t: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--muted)', padding: '3px 0', textTransform: 'capitalize' }}>
                      {t.replace('_', ' ')}
                    </div>
                  ))}
                </div>
              </div>

              {studyHistory.interview_history?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Interview history</div>
                  {studyHistory.interview_history.map((s: any, i: number) => (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, textTransform: 'capitalize' }}>{s.type.replace('_', ' ')} · {s.difficulty}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{s.date}</div>
                        {s.feedback && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>{s.feedback}</div>}
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 700, color: s.score >= 80 ? 'var(--green)' : s.score >= 60 ? 'var(--amber)' : 'var(--red)', flexShrink: 0, marginLeft: 12 }}>
                        {s.score}/100
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {studyHistory.key_concepts?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Key concepts you know</div>
                  {studyHistory.key_concepts.slice(0, 8).map((c: any, i: number) => (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)', marginBottom: 6 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4 }}>{c.concept}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{c.answer}</div>
                    </div>
                  ))}
                </div>
              )}

              {studyHistory.studied?.total_questions === 0 && studyHistory.interview_history?.length === 0 && (
                <div style={{ color: 'var(--muted)', fontSize: 13, padding: 20, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' }}>
                  No study history yet. Start quizzing or do an interview session to build your history.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'prep' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {[
              { id: 'pitch', label: '30-sec pitch' },
              { id: 'why', label: 'Why this company' },
              { id: 'feynman', label: 'Feynman check' },
              { id: 'defense', label: 'AI defense' },
            ].map(s => (
              <button key={s.id} onClick={() => setPrepSection(s.id as 'pitch' | 'why' | 'feynman' | 'defense')} style={{
                padding: '7px 14px', fontSize: 11, borderRadius: 6, letterSpacing: 1,
                border: `1px solid ${prepSection === s.id ? 'var(--text)' : 'var(--border)'}`,
                background: prepSection === s.id ? 'var(--text)' : 'transparent',
                color: prepSection === s.id ? 'var(--bg)' : 'var(--muted)',
                cursor: 'pointer', fontFamily: 'monospace', textTransform: 'uppercase',
              }}>{s.label}</button>
            ))}
          </div>

          {prepSection === 'pitch' && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Write your elevator pitch for {project.name}. Aim for 65-100 words (~30-45 seconds).
                Say what it does, who it&apos;s for, and one impressive technical detail.
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {['technical', 'non-technical', 'executive'].map(a => (
                  <button key={a} onClick={() => setPitchAudience(a)} style={{
                    padding: '5px 12px', fontSize: 11, borderRadius: 20, textTransform: 'capitalize',
                    border: `1px solid ${pitchAudience === a ? 'var(--blue)' : 'var(--border)'}`,
                    background: pitchAudience === a ? 'rgba(56,139,221,0.08)' : 'transparent',
                    color: pitchAudience === a ? 'var(--blue)' : 'var(--muted)',
                    cursor: 'pointer', fontFamily: 'monospace',
                  }}>{a}</button>
                ))}
              </div>

              <textarea
                value={pitchText}
                onChange={e => setPitchText(e.target.value)}
                placeholder={`Write your ${project.name} elevator pitch here...`}
                style={{
                  width: '100%', height: 120, padding: '12px 16px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text)', fontSize: 13,
                  resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.7,
                  marginBottom: 10,
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
                {pitchText.split(/\s+/).filter(Boolean).length} words · ~{Math.round((pitchText.split(/\s+/).filter(Boolean).length / 130) * 60)}s
              </div>

              <button onClick={async () => {
                if (!pitchText.trim()) return
                setPitchLoading(true)
                try {
                  const result = await api.getPitchFeedback(id, pitchText, pitchAudience)
                  setPitchResult(result)
                } finally {
                  setPitchLoading(false)
                }
              }} disabled={pitchLoading || !pitchText.trim()} style={{
                width: '100%', padding: '11px 0', background: 'var(--text)', color: 'var(--bg)',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
                marginBottom: 16,
              }}>
                {pitchLoading ? 'Evaluating...' : 'Get pitch feedback →'}
              </button>

              {pitchResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 32, fontWeight: 700, color: pitchResult.score >= 80 ? 'var(--green)' : pitchResult.score >= 60 ? 'var(--amber)' : 'var(--red)' }}>{pitchResult.score}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{pitchResult.verdict === 'just right' ? '✓ Good length' : pitchResult.verdict === 'too long' ? '↓ Too long' : '↑ Too short'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{pitchResult.word_count} words · ~{pitchResult.estimated_seconds}s</div>
                    </div>
                  </div>

                  {pitchResult.rewritten && (
                    <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid var(--green)', borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>✓ Stronger version</div>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>{pitchResult.rewritten}</div>
                    </div>
                  )}

                  {pitchResult.one_liner && (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--amber)', borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 10, color: 'var(--amber)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>One-liner</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{pitchResult.one_liner}</div>
                    </div>
                  )}

                  {pitchResult.gaps?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Missing</div>
                      {pitchResult.gaps.map((g: string, i: number) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--muted)', padding: '2px 0' }}>› {g}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {prepSection === 'why' && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Paste the job description for {project.company}. Claude will connect your {project.name} project to what they&apos;re building and write a compelling answer.
              </div>

              <textarea
                value={jobDescription}
                onChange={e => setJobDescription(e.target.value)}
                placeholder="Paste the job description here..."
                style={{
                  width: '100%', height: 180, padding: '12px 16px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text)', fontSize: 12,
                  resize: 'none', outline: 'none', fontFamily: 'monospace', lineHeight: 1.7,
                  marginBottom: 10,
                }}
              />

              <button onClick={async () => {
                if (!jobDescription.trim()) return
                setWhyLoading(true)
                try {
                  const result = await api.getWhyThisCompany(id, jobDescription, project.company)
                  setWhyResult(result)
                } finally {
                  setWhyLoading(false)
                }
              }} disabled={whyLoading || !jobDescription.trim()} style={{
                width: '100%', padding: '11px 0', background: 'var(--text)', color: 'var(--bg)',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
                marginBottom: 16,
              }}>
                {whyLoading ? 'Generating...' : 'Generate answer →'}
              </button>

              {whyResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--green)', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Your answer</div>
                    <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8 }}>{whyResult.main_answer}</div>
                  </div>

                  {whyResult.connection && (
                    <div style={{ fontSize: 12, color: 'var(--blue)', padding: '8px 12px', background: 'rgba(56,139,221,0.06)', borderRadius: 6, border: '1px solid rgba(56,139,221,0.3)' }}>
                      🔗 {whyResult.connection}
                    </div>
                  )}

                  {whyResult.talking_points?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>If they ask you to elaborate</div>
                      {whyResult.talking_points.map((p: string, i: number) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '4px 0', lineHeight: 1.6 }}>› {p}</div>
                      ))}
                    </div>
                  )}

                  {whyResult.what_to_avoid && (
                    <div style={{ fontSize: 12, color: 'var(--amber)', padding: '8px 12px', background: 'rgba(245,166,35,0.06)', borderRadius: 6 }}>
                      ⚠ Avoid: {whyResult.what_to_avoid}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {prepSection === 'feynman' && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Pick a concept from {project.name} and explain it like you&apos;re talking to a 12-year-old who has never coded. Claude scores whether they&apos;d actually understand it.
              </div>

              <input
                value={feynmanConcept}
                onChange={e => setFeynmanConcept(e.target.value)}
                placeholder="What concept? e.g. JWT authentication, WebSocket connections, database indexing..."
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
                  fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 10,
                }}
              />

              <textarea
                value={feynmanExplanation}
                onChange={e => setFeynmanExplanation(e.target.value)}
                placeholder="Explain it simply. Use an analogy. Pretend you're talking to someone who has never written code..."
                style={{
                  width: '100%', height: 140, padding: '12px 16px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text)', fontSize: 13,
                  resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.7,
                  marginBottom: 10,
                }}
              />

              <button onClick={async () => {
                if (!feynmanConcept.trim() || !feynmanExplanation.trim()) return
                setFeynmanLoading(true)
                try {
                  const result = await api.evaluateFeynman(id, feynmanConcept, feynmanExplanation)
                  setFeynmanResult(result)
                } finally {
                  setFeynmanLoading(false)
                }
              }} disabled={feynmanLoading || !feynmanConcept.trim() || !feynmanExplanation.trim()} style={{
                width: '100%', padding: '11px 0', background: 'var(--text)', color: 'var(--bg)',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
                marginBottom: 16,
              }}>
                {feynmanLoading ? 'Checking...' : 'Check my explanation →'}
              </button>

              {feynmanResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ fontSize: 32, fontWeight: 700, color: feynmanResult.score >= 80 ? 'var(--green)' : feynmanResult.score >= 60 ? 'var(--amber)' : 'var(--red)' }}>{feynmanResult.score}</span>
                    <span style={{ fontSize: 14, color: feynmanResult.would_12yo_understand ? 'var(--green)' : 'var(--red)' }}>
                      {feynmanResult.would_12yo_understand ? '✓ A 12-year-old would get this' : '✗ Still too technical'}
                    </span>
                  </div>

                  {feynmanResult.simpler_version && (
                    <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid var(--green)', borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Simpler version</div>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>{feynmanResult.simpler_version}</div>
                    </div>
                  )}

                  {feynmanResult.better_analogy && (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--amber)', borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 10, color: 'var(--amber)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Better analogy</div>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>{feynmanResult.better_analogy}</div>
                    </div>
                  )}

                  {feynmanResult.what_confused && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                      <span style={{ color: 'var(--red)' }}>What confused:</span> {feynmanResult.what_confused}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {prepSection === 'defense' && aiDefense && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Prepared answers for common objections about AI-assisted development. Personalize these — don&apos;t recite them.
              </div>

              {aiDefense.objections?.map((obj: any, i: number) => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>&quot;{obj.question}&quot;</div>
                  <div style={{ fontSize: 10, color: 'var(--amber)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Framework: {obj.framework}</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, background: 'var(--bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 10 }}>
                    {obj.answer}
                  </div>
                  {obj.key_points?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Key points</div>
                      {obj.key_points.map((p: string, j: number) => (
                        <div key={j} style={{ fontSize: 11, color: 'var(--muted)', padding: '2px 0', lineHeight: 1.5 }}>› {p}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {aiDefense.preparation_tips?.length > 0 && (
                <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid var(--green)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Preparation tips</div>
                  {aiDefense.preparation_tips.map((tip: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '4px 0', lineHeight: 1.6 }}>› {tip}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
