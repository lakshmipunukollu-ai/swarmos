'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function Intake() {
  const router = useRouter()
  const [brief, setBrief] = useState('')
  const [analysis, setAnalysis] = useState<any>(null)
  const [answers, setAnswers] = useState('')
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)

  const analyze = async () => {
    if (!brief.trim()) return
    setLoading(true)
    try {
      const result = await api.analyzeIntake(brief)
      setAnalysis(result)
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
          id, name: analysis.project_name, company: analysis.company || 'Unknown',
          stack: analysis.recommended_stack || 'TBD',
          estimated_minutes: analysis.estimated_minutes || 120,
        }),
      })
      router.push('/')
    } finally {
      setAdding(false)
    }
  }

  const confColor = { high: 'var(--green)', medium: 'var(--amber)', low: 'var(--red)' }[analysis?.confidence as string] || 'var(--muted)'

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Add new project</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
        Paste anything — an email, a brief, or just a rough idea. Claude figures out the rest.
      </div>

      <textarea value={brief} onChange={e => setBrief(e.target.value)}
        placeholder="Paste your project brief, email from company, or rough idea here..."
        style={{
          width: '100%', minHeight: 120, background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--text)', fontFamily: 'monospace', fontSize: 12,
          padding: 12, resize: 'vertical', outline: 'none', marginBottom: 10,
        }} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={analyze} disabled={loading || !brief.trim()} style={{
          padding: '8px 18px', background: loading ? 'var(--border)' : 'var(--text)',
          color: 'var(--bg)', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
        }}>
          {loading ? 'Analyzing...' : 'Analyze brief'}
        </button>
        <button onClick={() => { setBrief(''); setAnalysis(null) }} style={{
          padding: '8px 18px', background: 'transparent', border: '1px solid var(--border)',
          borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace',
        }}>Clear</button>
      </div>

      {analysis && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{analysis.project_name || 'Unnamed project'}</div>
            <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, border: `1px solid ${confColor}`, color: confColor }}>
              {analysis.confidence} confidence
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Company', value: analysis.company },
              { label: 'Stack', value: analysis.recommended_stack },
              { label: 'Est. build time', value: `${analysis.estimated_minutes} min` },
              { label: 'Ready to build', value: analysis.ready_to_build ? 'Yes' : 'Not yet' },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text)' }}>{m.value || '—'}</div>
              </div>
            ))}
          </div>

          {analysis.key_features?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>Key features</div>
              {analysis.key_features.map((f: string, i: number) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--muted)', padding: '2px 0' }}>&gt; {f}</div>
              ))}
            </div>
          )}

          {analysis.follow_up_questions?.length > 0 && !analysis.ready_to_build && (
            <div style={{ background: 'rgba(245,166,35,0.1)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Need more info
              </div>
              {analysis.follow_up_questions.map((q: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--amber)', padding: '3px 0' }}>&gt; {q}</div>
              ))}
              <textarea value={answers} onChange={e => setAnswers(e.target.value)}
                placeholder="Answer the questions above..."
                style={{
                  width: '100%', minHeight: 80, background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text)', fontFamily: 'monospace', fontSize: 12,
                  padding: 10, resize: 'vertical', outline: 'none', marginTop: 10,
                }} />
              <button onClick={refine} disabled={loading || !answers.trim()} style={{
                marginTop: 8, padding: '7px 16px', background: 'var(--amber)', color: '#000',
                border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
              }}>
                Submit answers
              </button>
            </div>
          )}

          {analysis.ready_to_build && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: 'var(--green)' }}>&gt; Brief complete. Ready to add to swarm.</span>
              <button onClick={addToSwarm} disabled={adding} style={{
                padding: '8px 18px', background: 'var(--green)', color: '#000',
                border: 'none', borderRadius: 6, cursor: adding ? 'not-allowed' : 'pointer',
                fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
              }}>
                {adding ? 'Adding...' : 'Add to swarm →'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
