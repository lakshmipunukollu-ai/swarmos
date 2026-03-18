'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const STORAGE_KEY = 'swarmos_intake'

export default function Intake() {
  const router = useRouter()
  const [brief, setBrief] = useState('')
  const [analysis, setAnalysis] = useState<any>(null)
  const [answers, setAnswers] = useState('')
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [restored, setRestored] = useState(false)
  const [importMode, setImportMode] = useState<'brief' | 'github'>('brief')
  const [repoUrl, setRepoUrl] = useState('')
  const [repoCompany, setRepoCompany] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const { brief: b, analysis: a } = JSON.parse(saved)
        if (b) setBrief(b)
        if (a) { setAnalysis(a); setRestored(true) }
      }
    } catch {}
  }, [])

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ brief, analysis }))
    } catch {}
  }, [brief, analysis])

  const clear = () => {
    setBrief('')
    setAnalysis(null)
    setAnswers('')
    setRestored(false)
    localStorage.removeItem(STORAGE_KEY)
  }

  const analyze = async () => {
    if (!brief.trim()) return
    setLoading(true)
    try {
      const result = await api.analyzeIntake(brief)
      setAnalysis(result)
      setRestored(false)
    } finally {
      setLoading(false)
    }
  }

  const refine = async () => {
    if (!answers.trim()) return
    setLoading(true)
    try {
      const result = await api.refineIntake(brief, analysis, answers)
      setAnalysis(result)
      setAnswers('')
    } finally {
      setLoading(false)
    }
  }

  const addToSwarm = async () => {
    if (!analysis?.ready_to_build) return
    setAdding(true)
    try {
      const id = analysis.project_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: analysis.project_name,
          company: analysis.company || 'Unknown',
          stack: analysis.recommended_stack || 'TBD',
          brief: brief,
          estimated_minutes: analysis.estimated_minutes || 120,
        }),
      })
      localStorage.removeItem(STORAGE_KEY)
      router.push('/')
    } finally {
      setAdding(false)
    }
  }

  const confColor: Record<string, string> = {
    high: '#4ade80',
    medium: '#f59e0b',
    low: '#f87171',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: analysis ? '1fr 1fr' : '1fr', alignItems: 'start', gap: 32 }}>

      {/* Left column — brief input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Add new project</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Paste anything — an email, a brief, or a rough idea. Claude figures out the rest.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[
            { id: 'brief', label: 'Paste brief' },
            { id: 'github', label: 'Import from GitHub' },
          ].map(m => (
            <button key={m.id} onClick={() => setImportMode(m.id as any)} style={{
              padding: '7px 18px', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
              borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
              fontFamily: 'monospace',
              background: importMode === m.id ? 'var(--text)' : 'transparent',
              color: importMode === m.id ? 'var(--bg)' : 'var(--muted)',
            }}>{m.label}</button>
          ))}
        </div>

        {importMode === 'github' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              Import any public GitHub repository. SwarmOS reads the codebase, generates a build summary,
              and sets up quiz + interview prep automatically.
            </div>

            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>GitHub repo URL</div>
              <input
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repo-name"
                style={{
                  width: '100%', padding: '11px 14px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
                  fontSize: 13, outline: 'none', fontFamily: 'monospace',
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Company <span style={{ color: 'var(--border)' }}>(optional)</span></div>
              <input
                value={repoCompany}
                onChange={e => setRepoCompany(e.target.value)}
                placeholder="e.g. Replicated, Personal, Side project..."
                style={{
                  width: '100%', padding: '11px 14px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
                  fontSize: 13, outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>

            <button
              onClick={async () => {
                if (!repoUrl.trim()) return
                setImporting(true)
                setImportResult(null)
                try {
                  const result = await api.importFromGitHub(repoUrl, repoCompany)
                  if (result.detail) {
                    setImportResult({ error: result.detail })
                  } else {
                    setImportResult(result)
                  }
                } finally {
                  setImporting(false)
                }
              }}
              disabled={importing || !repoUrl.trim()}
              style={{
                padding: '12px 0', background: importing ? 'var(--border)' : 'var(--text)',
                color: 'var(--bg)', border: 'none', borderRadius: 8,
                cursor: importing ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
              }}
            >
              {importing ? 'Importing... (this takes ~30 seconds)' : 'Import from GitHub →'}
            </button>

            {importResult?.error && (
              <div style={{ fontSize: 13, color: 'var(--red)', padding: '10px 14px', background: 'rgba(248,113,113,0.08)', borderRadius: 8, border: '1px solid var(--red)' }}>
                {importResult.error}
              </div>
            )}

            {importResult && !importResult.error && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--green)', borderRadius: 10, padding: 18 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>✓ {importResult.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                  {importResult.company} · {importResult.stack} · {importResult.files_count} files
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
                  {importResult.message} · {importResult.files_scanned} files analyzed
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href="/" style={{
                    flex: 1, padding: '10px 0', background: 'var(--green)', color: '#000',
                    border: 'none', borderRadius: 8, cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
                    textDecoration: 'none', textAlign: 'center',
                  }}>
                    View on dashboard →
                  </a>
                  <a href={`/quiz?project=${importResult.id}`} style={{
                    flex: 1, padding: '10px 0', background: 'transparent',
                    border: '1px solid var(--amber)', borderRadius: 8,
                    fontSize: 13, color: 'var(--amber)', fontFamily: 'monospace',
                    textDecoration: 'none', textAlign: 'center',
                  }}>
                    Start quiz →
                  </a>
                </div>
              </div>
            )}

            {/* Quick links for your own repos */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Quick import</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'SwarmOS', url: 'https://github.com/lakshmipunukollu-ai/swarmos', company: 'Personal' },
                  { label: 'SwarmOS Community', url: 'https://github.com/lakshmipunukollu-ai/swarmos-community', company: 'Personal' },
                ].map(repo => (
                  <button key={repo.url} onClick={() => { setRepoUrl(repo.url); setRepoCompany(repo.company) }} style={{
                    padding: '8px 12px', textAlign: 'left', background: 'var(--surface)',
                    border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
                    fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace',
                  }}>
                    ↗ {repo.label} <span style={{ color: 'var(--border)' }}>{repo.url}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {importMode === 'brief' && (
          <>
        {restored && (
          <div style={{ fontSize: 11, color: 'var(--amber)', background: 'rgba(245,166,35,0.08)', border: '1px solid var(--amber)', borderRadius: 6, padding: '6px 12px' }}>
            ↩ Restored from your last session
          </div>
        )}

        <textarea
          value={brief}
          onChange={e => setBrief(e.target.value)}
          placeholder="Paste your project brief, email from company, or rough idea here..."
          style={{
            width: '100%',
            height: 220,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text)',
            fontFamily: 'monospace',
            fontSize: 13,
            padding: 16,
            resize: 'none',
            outline: 'none',
            lineHeight: 1.7,
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
          <button
            onClick={analyze}
            disabled={loading || !brief.trim()}
            style={{
              flex: 1,
              padding: '11px 0',
              background: loading ? 'var(--border)' : 'var(--text)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'monospace',
            }}
          >
            {loading ? 'Analyzing...' : 'Analyze brief'}
          </button>
          <button
            onClick={clear}
            style={{
              padding: '11px 20px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--muted)',
              fontFamily: 'monospace',
            }}
          >
            Clear
          </button>
        </div>
          </>
        )}
      </div>

      {/* Right column — analysis result */}
      {analysis && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{analysis.project_name || 'Unnamed project'}</div>
            <span style={{
              fontSize: 10, padding: '4px 12px', borderRadius: 20,
              border: `1px solid ${confColor[analysis.confidence] || 'var(--muted)'}`,
              color: confColor[analysis.confidence] || 'var(--muted)',
            }}>
              {analysis.confidence} confidence
            </span>
          </div>

          {/* Metadata grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Company', value: analysis.company },
              { label: 'Stack', value: analysis.recommended_stack },
              { label: 'Est. build time', value: `${analysis.estimated_minutes} min` },
              { label: 'Ready to build', value: analysis.ready_to_build ? '✓ Yes' : 'Not yet' },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{m.label}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{m.value || '—'}</div>
              </div>
            ))}
          </div>

          {/* Problem statement */}
          {analysis.problem_statement && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Problem</div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{analysis.problem_statement}</div>
            </div>
          )}

          {/* Key features */}
          {analysis.key_features?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Key features</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {analysis.key_features.map((f: string, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '4px 0', display: 'flex', gap: 8 }}>
                    <span style={{ color: 'var(--muted)' }}>›</span> {f}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up questions */}
          {analysis.follow_up_questions?.length > 0 && !analysis.ready_to_build && (
            <div style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                Need more info
              </div>
              {analysis.follow_up_questions.map((q: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--amber)', padding: '3px 0', lineHeight: 1.6 }}>› {q}</div>
              ))}
              <textarea
                value={answers}
                onChange={e => setAnswers(e.target.value)}
                placeholder="Answer the questions above..."
                style={{
                  width: '100%', minHeight: 90,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text)', fontFamily: 'monospace',
                  fontSize: 12, padding: 12, resize: 'vertical', outline: 'none', marginTop: 12,
                }}
              />
              <button
                onClick={refine}
                disabled={loading || !answers.trim()}
                style={{
                  marginTop: 10, padding: '9px 20px',
                  background: 'var(--amber)', color: '#000',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                }}
              >
                {loading ? 'Refining...' : 'Submit answers'}
              </button>
            </div>
          )}

          {/* Ready to build */}
          {analysis.ready_to_build && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: 'var(--green)' }}>› Brief complete. Ready to add to swarm.</span>
              <button
                onClick={addToSwarm}
                disabled={adding}
                style={{
                  padding: '10px 22px', background: 'var(--green)', color: '#000',
                  border: 'none', borderRadius: 8, cursor: adding ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 700, fontFamily: 'monospace', marginLeft: 'auto',
                }}
              >
                {adding ? 'Adding...' : 'Add to swarm →'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
