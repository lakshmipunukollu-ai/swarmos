'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api, Project } from '@/lib/api'

const STATUS_COLORS: Record<string, string> = {
  queued: 'var(--muted)', building: 'var(--green)',
  testing: 'var(--blue)', done: 'var(--green)', error: 'var(--red)',
}

function TimeEstimate({ project }: { project: Project }) {
  const [elapsed, setElapsed] = useState(project.elapsed_seconds)

  useEffect(() => {
    if (project.status !== 'building') return
    const interval = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(interval)
  }, [project.status])

  if (project.status === 'done') return <span style={{ color: 'var(--green)', fontSize: 10 }}>Done</span>
  if (project.status === 'queued') return <span style={{ color: 'var(--muted)', fontSize: 10 }}>Waiting</span>
  if (project.status === 'error') return <span style={{ color: 'var(--red)', fontSize: 10 }}>Error</span>

  const estimated = project.estimated_minutes * 60
  const remaining = Math.max(0, estimated - elapsed)
  const mins = Math.round(remaining / 60)
  const pct = Math.min(100, Math.round((elapsed / estimated) * 100))

  return (
    <span style={{ color: 'var(--amber)', fontSize: 10 }}>
      ~{mins}m remaining ({pct}%)
    </span>
  )
}

function ProjectCard({ project, onUpdate }: { project: Project; onUpdate: () => void }) {
  const pct = project.status === 'done' ? 100
    : project.status === 'building' ? Math.min(95, Math.round((project.elapsed_seconds / (project.estimated_minutes * 60)) * 100))
    : project.status === 'testing' ? 90
    : 0

  return (
    <div className="card" style={{ padding: 14, cursor: 'pointer' }}
      onClick={() => window.location.href = `/projects/${project.id}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{project.name}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{project.company}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className={`badge-${project.status}`} style={{
            fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            textTransform: 'uppercase', letterSpacing: 1,
          }}>{project.status}</span>
          {project.live_url && (
            <a href={project.live_url} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 9, color: 'var(--green)', border: '1px solid var(--green)', padding: '1px 6px', borderRadius: 3, textDecoration: 'none' }}>
              live
            </a>
          )}
        </div>
      </div>

      <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2, width: `${pct}%`,
          background: project.status === 'error' ? 'var(--red)' : 'var(--green)',
          transition: 'width 1s ease',
          ...(project.status === 'building' ? { animation: 'progress-pulse 2s ease-in-out infinite' } : {}),
        }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        {project.stack.split('+').map(s => (
          <span key={s} style={{ fontSize: 9, padding: '1px 5px', background: 'var(--border)', borderRadius: 3, color: 'var(--muted)' }}>
            {s.trim()}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{project.files_count} files</span>
        <TimeEstimate project={project} />
      </div>

      {project.last_log && (
        <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--muted)', padding: '4px 6px', background: 'rgba(0,0,0,0.1)', borderRadius: 3, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          &gt; {project.last_log}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await api.getProjects()
      setProjects(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 8000)
    return () => clearInterval(interval)
  }, [load])

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter)
  const done = projects.filter(p => p.status === 'done').length
  const building = projects.filter(p => p.status === 'building' || p.status === 'testing').length

  const totalCost = projects.reduce((sum, p) => {
    const hours = p.elapsed_seconds / 3600
    return sum + hours * 6
  }, 0)

  if (loading) return <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>Loading projects...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'done', value: done, color: 'var(--green)' },
            { label: 'building', value: building, color: 'var(--amber)' },
            { label: 'total', value: projects.length, color: 'var(--text)' },
            { label: 'est. cost', value: `$${totalCost.toFixed(2)}`, color: 'var(--muted)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', borderRadius: 8, padding: '8px 14px', textAlign: 'center', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'building', 'done', 'queued', 'error'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 12px', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
              borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer',
              background: filter === f ? 'var(--text)' : 'transparent',
              color: filter === f ? 'var(--bg)' : 'var(--muted)',
            }}>{f}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {filtered.map(p => (
          <ProjectCard key={p.id} project={p} onUpdate={load} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 60 }}>
          No projects with status "{filter}"
        </div>
      )}
    </div>
  )
}
