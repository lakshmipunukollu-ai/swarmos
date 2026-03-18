'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

const PROJECTS = [
  { id: 'fsp-agentic-scheduler', name: 'FSP Scheduler' },
  { id: 'replicated-k8s-analyzer', name: 'K8s Analyzer' },
  { id: 'servicecore-timetracking', name: 'Time Tracking' },
  { id: 'zapier-triggers-api', name: 'Triggers API' },
  { id: 'st6-weekly-commit', name: 'Weekly Commit' },
  { id: 'zeropath-security-scanner', name: 'Security Scanner' },
  { id: 'medbridge-health-coach', name: 'Health Coach' },
  { id: 'companycam-content-detection', name: 'Content Detection' },
  { id: 'upstream-ecommerce', name: 'E-commerce' },
]

const TYPES = [
  { id: 'behavioral', label: 'Behavioral', desc: 'Challenges, decisions, teamwork' },
  { id: 'technical', label: 'Technical', desc: 'Architecture, stack choices, tradeoffs' },
  { id: 'coding', label: 'Live coding', desc: 'Write functions from your project' },
  { id: 'system_design', label: 'System design', desc: 'Scale, reliability, evolution' },
]

const DIFFICULTIES = [
  { id: 'coaching', label: '🟢 Coaching', desc: 'Supportive, hints provided' },
  { id: 'balanced', label: '🟡 Balanced', desc: 'Standard startup interview' },
  { id: 'faang', label: '🔴 FAANG', desc: 'Rigorous, pushes back hard' },
]

type Phase = 'setup' | 'interview' | 'results'

function InterviewContent() {
  const searchParams = useSearchParams()
  const initialProject = searchParams.get('project') || PROJECTS[0].id

  const [phase, setPhase] = useState<Phase>('setup')
  const [projectId, setProjectId] = useState(initialProject)
  const [interviewType, setInterviewType] = useState('technical')
  const [difficulty, setDifficulty] = useState('balanced')
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<{ role: string; content: string; evaluation?: any }[]>([])
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [isFinal, setIsFinal] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [pastSessions, setPastSessions] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    api.getInterviewSessions(projectId).then(setPastSessions).catch(() => {})
  }, [projectId])

  const startInterview = async () => {
    setLoading(true)
    try {
      const result = await api.startInterview(projectId, interviewType, difficulty)
      setSessionId(result.session_id)
      setMessages([{ role: 'interviewer', content: result.opening_message }])
      setPhase('interview')
    } finally {
      setLoading(false)
    }
  }

  const submitAnswer = async () => {
    if (!answer.trim() || !sessionId) return
    const myAnswer = answer
    setAnswer('')
    setMessages(prev => [...prev, { role: 'candidate', content: myAnswer }])
    setLoading(true)
    try {
      const result = await api.submitAnswer(sessionId, myAnswer)
      setMessages(prev => [...prev, {
        role: 'interviewer',
        content: result.message,
        evaluation: result.evaluation,
      }])
      if (result.is_final) setIsFinal(true)
    } finally {
      setLoading(false)
    }
  }

  const finishInterview = async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const result = await api.completeInterview(sessionId)
      setResults(result)
      setPhase('results')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setPhase('setup')
    setMessages([])
    setAnswer('')
    setSessionId(null)
    setIsFinal(false)
    setResults(null)
  }

  const scoreColor = (score: number) =>
    score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)'

  // RESULTS PHASE
  if (phase === 'results' && results) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: scoreColor(results.score) }}>
            {results.score}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>out of 100</div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Interview debrief</div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8 }}>{results.feedback}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {results.strengths?.length > 0 && (
            <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid var(--green)', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>✓ What landed</div>
              {results.strengths.map((s: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '3px 0', lineHeight: 1.6 }}>› {s}</div>
              ))}
            </div>
          )}
          {results.weaknesses?.length > 0 && (
            <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid var(--red)', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>⚠ Needs work</div>
              {results.weaknesses.map((w: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '3px 0', lineHeight: 1.6 }}>› {w}</div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={reset} style={{
            flex: 1, padding: '12px 0', background: 'var(--text)', color: 'var(--bg)',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
          }}>Start new interview</button>
          <Link href={`/projects/${projectId}`} style={{
            flex: 1, padding: '12px 0', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, color: 'var(--muted)', fontFamily: 'monospace',
            textDecoration: 'none', textAlign: 'center',
          }}>← Back to project</Link>
        </div>
      </div>
    )
  }

  // INTERVIEW PHASE
  if (phase === 'interview') {
    const diffLabel = DIFFICULTIES.find(d => d.id === difficulty)?.label || difficulty
    const typeLabel = TYPES.find(t => t.id === interviewType)?.label || interviewType

    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{typeLabel} Interview</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{diffLabel} · {PROJECTS.find(p => p.id === projectId)?.name}</div>
          </div>
          <button onClick={reset} style={{
            padding: '6px 14px', fontSize: 11, borderRadius: 6,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--muted)', cursor: 'pointer', fontFamily: 'monospace',
          }}>End interview</button>
        </div>

        {/* Chat */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: 20, height: 'calc(100vh - 360px)', overflowY: 'auto', marginBottom: 16,
        }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{
                display: 'flex', gap: 10,
                flexDirection: msg.role === 'candidate' ? 'row-reverse' : 'row',
              }}>
                <div style={{
                  fontSize: 10, color: 'var(--border)', flexShrink: 0, marginTop: 4,
                  textTransform: 'uppercase', letterSpacing: 1,
                }}>
                  {msg.role === 'interviewer' ? 'AI' : 'You'}
                </div>
                <div style={{
                  maxWidth: '80%', padding: '12px 16px', borderRadius: 10, fontSize: 13, lineHeight: 1.7,
                  background: msg.role === 'interviewer' ? 'var(--bg)' : 'rgba(74,222,128,0.06)',
                  border: `1px solid ${msg.role === 'interviewer' ? 'var(--border)' : 'var(--green)'}`,
                  color: 'var(--text)',
                }}>
                  {msg.content}
                </div>
              </div>
              {/* Evaluation for candidate messages */}
              {msg.role === 'interviewer' && msg.evaluation && msg.evaluation.score && (
                <div style={{
                  marginLeft: 30, marginTop: 6, fontSize: 11,
                  color: scoreColor(msg.evaluation.score),
                }}>
                  Previous answer: {msg.evaluation.score}/100
                  {msg.evaluation.tip && <span style={{ color: 'var(--muted)', marginLeft: 8 }}>— {msg.evaluation.tip}</span>}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ color: 'var(--muted)', fontSize: 12, fontStyle: 'italic' }}>Interviewer is thinking...</div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Answer input */}
        {!isFinal ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) submitAnswer() }}
              placeholder="Type your answer... (⌘+Enter to send)"
              disabled={loading}
              style={{
                flex: 1, minHeight: 80, padding: '12px 16px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text)', fontSize: 13,
                resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6,
              }}
            />
            <button onClick={submitAnswer} disabled={loading || !answer.trim()} style={{
              padding: '0 20px', background: 'var(--text)', color: 'var(--bg)',
              border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: 'monospace', alignSelf: 'stretch',
            }}>Send</button>
          </div>
        ) : (
          <button onClick={finishInterview} disabled={loading} style={{
            width: '100%', padding: '14px 0', background: 'var(--green)', color: '#000',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            fontSize: 14, fontWeight: 700, fontFamily: 'monospace',
          }}>
            {loading ? 'Generating results...' : 'Get interview results →'}
          </button>
        )}
      </div>
    )
  }

  // SETUP PHASE
  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>AI Interview</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Practice with an AI interviewer that knows your projects. Get scored and coached after each session.
        </div>
      </div>

      {/* Project selector */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Project</div>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{
          width: '100%', padding: '10px 14px', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
          fontSize: 13, fontFamily: 'inherit',
        }}>
          {PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Interview type */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Interview type</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setInterviewType(t.id)} style={{
              padding: '12px 16px', borderRadius: 8, textAlign: 'left',
              border: `1px solid ${interviewType === t.id ? 'var(--green)' : 'var(--border)'}`,
              background: interviewType === t.id ? 'rgba(74,222,128,0.06)' : 'var(--surface)',
              cursor: 'pointer',
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{t.label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Difficulty</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {DIFFICULTIES.map(d => (
            <button key={d.id} onClick={() => setDifficulty(d.id)} style={{
              flex: 1, padding: '10px 12px', borderRadius: 8, textAlign: 'center',
              border: `1px solid ${difficulty === d.id ? 'var(--amber)' : 'var(--border)'}`,
              background: difficulty === d.id ? 'rgba(245,166,35,0.06)' : 'var(--surface)',
              cursor: 'pointer',
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{d.label}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{d.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <button onClick={startInterview} disabled={loading} style={{
        width: '100%', padding: '14px 0', background: 'var(--text)', color: 'var(--bg)',
        border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: 14, fontWeight: 700, fontFamily: 'monospace',
      }}>
        {loading ? 'Starting interview...' : 'Start interview →'}
      </button>

      {/* Past sessions */}
      {pastSessions.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Past sessions</div>
          {pastSessions.map(s => (
            <div key={s.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', background: 'var(--surface)', borderRadius: 8,
              border: '1px solid var(--border)', marginBottom: 6,
            }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text)', textTransform: 'capitalize' }}>{s.interview_type}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{s.difficulty}</span>
              </div>
              {s.score != null && (
                <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(s.score) }}>{s.score}/100</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Interview() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--muted)', padding: 40 }}>Loading...</div>}>
      <InterviewContent />
    </Suspense>
  )
}
