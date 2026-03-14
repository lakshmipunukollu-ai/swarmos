'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api, Project } from '@/lib/api'

export default function ProjectDetail() {
  const params = useParams()
  const id = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [p, l] = await Promise.all([api.getProject(id), api.getLogs(id)])
    setProject(p)
    setLogs(l)
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) return <div style={{ color: 'var(--muted)', padding: 40 }}>Loading...</div>
  if (!project) return <div style={{ color: 'var(--red)', padding: 40 }}>Project not found</div>

  const elapsed = project.elapsed_seconds
  const estimated = project.estimated_minutes * 60
  const pct = project.status === 'done' ? 100 : Math.min(95, Math.round((elapsed / estimated) * 100))
  const minsRemaining = Math.max(0, Math.round((estimated - elapsed) / 60))

  return (
    <div>
      <Link href="/" style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}>
        ← back to dashboard
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{project.name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{project.company} · port {project.port}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span className={`badge-${project.status}`} style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase' }}>
            {project.status}
          </span>
          {project.status === 'building' && (
            <span style={{ fontSize: 10, color: 'var(--amber)' }}>~{minsRemaining}m remaining</span>
          )}
        </div>
      </div>

      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 20 }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: project.status === 'error' ? 'var(--red)' : 'var(--green)', transition: 'width 1s' }} />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {['overview', 'logs', 'quiz'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 14px', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
            borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer',
            background: tab === t ? 'var(--surface)' : 'transparent',
            color: tab === t ? 'var(--text)' : 'var(--muted)',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Stack', value: project.stack },
            { label: 'Files created', value: String(project.files_count) },
            { label: 'Phase', value: project.phase || '—' },
            { label: 'GitHub', value: project.github_url || '—' },
          ].map(m => (
            <div key={m.label} style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, wordBreak: 'break-all' }}>
                {m.label === 'GitHub' && project.github_url
                  ? <a href={project.github_url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>{project.github_url}</a>
                  : m.value}
              </div>
            </div>
          ))}
          {project.live_url && (
            <div style={{ gridColumn: '1/-1', background: 'var(--surface)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--green)' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Live URL</div>
              <a href={project.live_url} target="_blank" rel="noreferrer" style={{ color: 'var(--green)', fontSize: 13 }}>{project.live_url}</a>
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--surface)', borderRadius: 8, padding: 16, border: '1px solid var(--border)', lineHeight: 2, maxHeight: 500, overflowY: 'auto' }}>
          {logs.length === 0 && <div style={{ color: 'var(--muted)' }}>No logs yet. Agent hasn't started.</div>}
          {logs.map((l, i) => (
            <div key={l.id || i} style={{ color: l.level === 'error' ? 'var(--red)' : i === logs.length - 1 ? 'var(--green)' : 'var(--muted)' }}>
              <span style={{ color: 'var(--border)', marginRight: 8 }}>{new Date(l.created_at).toLocaleTimeString()}</span>
              {l.message}
            </div>
          ))}
        </div>
      )}

      {tab === 'quiz' && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16 }}>
            {project.has_build_summary
              ? 'Build summary available — quiz questions use your actual code'
              : 'Quiz uses project knowledge. More detailed questions available after build completes.'}
          </div>
          <Link href={`/quiz?project=${project.id}`} style={{
            display: 'inline-block', padding: '10px 24px', background: 'var(--green)',
            color: '#000', borderRadius: 6, textDecoration: 'none', fontWeight: 700, fontSize: 13,
          }}>
            Start quiz for {project.name}
          </Link>
        </div>
      )}
    </div>
  )
}
