'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'

const PROJECTS = [
  { id: 'fsp-agentic-scheduler', name: 'FSP Scheduler', company: 'Flight Schedule Pro' },
  { id: 'replicated-k8s-analyzer', name: 'K8s Analyzer', company: 'Replicated' },
  { id: 'servicecore-timetracking', name: 'Time Tracking', company: 'ServiceCore' },
  { id: 'zapier-triggers-api', name: 'Triggers API', company: 'Zapier' },
  { id: 'st6-weekly-commit', name: 'Weekly Commit', company: 'ST6' },
  { id: 'zeropath-security-scanner', name: 'Security Scanner', company: 'ZeroPath' },
  { id: 'medbridge-health-coach', name: 'Health Coach', company: 'Medbridge' },
  { id: 'companycam-content-detection', name: 'Content Detection', company: 'CompanyCam' },
  { id: 'upstream-ecommerce', name: 'E-commerce', company: 'Upstream Literacy' },
]

const TYPES = ['architecture', 'code', 'system_design', 'flashcard']
const LEVELS = [1, 2, 3, 4, 5]
const LEVEL_LABELS = ['What was built', 'Why decisions', 'How code works', 'What breaks', 'How to extend']

interface Question {
  id: number
  question: string
  correct_answer: string
  wrong_answers: string[]
  explanation: string
  level: number
  type: string
}

function QuizContent() {
  const searchParams = useSearchParams()
  const [projectId, setProjectId] = useState(searchParams.get('project') || PROJECTS[0].id)
  const [qtype, setQtype] = useState('architecture')
  const [level, setLevel] = useState(1)
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [answered, setAnswered] = useState<Record<number, string>>({})
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [feedback, setFeedback] = useState<any>(null)

  const generate = useCallback(async (count = 5) => {
    setGenerating(true)
    try {
      const result = await api.generateQuiz(projectId, qtype, level, count)
      setQuestions(prev => [...prev, ...result.questions])
      if (questions.length === 0) setCurrent(0)
    } finally {
      setGenerating(false)
    }
  }, [projectId, qtype, level, questions.length])

  const startFresh = async () => {
    setQuestions([])
    setAnswered({})
    setScore({ correct: 0, total: 0 })
    setCurrent(0)
    setFeedback(null)
    setGenerating(true)
    try {
      const result = await api.generateQuiz(projectId, qtype, level, 5)
      setQuestions(result.questions || [])
    } finally {
      setGenerating(false)
    }
  }

  const q = questions[current]

  const allOptions = q ? [...(q.wrong_answers || []), q.correct_answer].sort(() => Math.random() - 0.5) : []

  const answer = async (chosen: string) => {
    if (!q || answered[current] !== undefined) return
    const isCorrect = chosen === q.correct_answer
    setAnswered(prev => ({ ...prev, [current]: chosen }))
    setScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }))

    const result = await api.submitAttempt(q.id, projectId, chosen, isCorrect)
    setFeedback(result)

    // Auto-generate more questions when nearing end
    if (current >= questions.length - 2) {
      generate(3)
    }
  }

  const next = () => {
    setCurrent(c => c + 1)
    setFeedback(null)
  }

  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Quiz</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
        Study what you built. Questions never run out. Keep going until you know it cold.
      </div>

      {/* Controls */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Project</div>
            <select value={projectId} onChange={e => setProjectId(e.target.value)}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'monospace', fontSize: 12, padding: '7px 10px' }}>
              {PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name} — {p.company}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Level</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {LEVELS.map((l, i) => (
                <button key={l} onClick={() => setLevel(l)} title={LEVEL_LABELS[i]} style={{
                  flex: 1, padding: '6px 4px', fontSize: 11, fontFamily: 'monospace',
                  border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer',
                  background: level === l ? 'var(--text)' : 'transparent',
                  color: level === l ? 'var(--bg)' : 'var(--muted)',
                }}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Question type</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {TYPES.map(t => (
              <button key={t} onClick={() => setQtype(t)} style={{
                padding: '5px 12px', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
                border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer', fontFamily: 'monospace',
                background: qtype === t ? 'var(--text)' : 'transparent',
                color: qtype === t ? 'var(--bg)' : 'var(--muted)',
              }}>{t.replace('_', ' ')}</button>
            ))}
          </div>
        </div>

        <button onClick={startFresh} disabled={generating} style={{
          padding: '9px 20px', background: generating ? 'var(--border)' : 'var(--text)',
          color: 'var(--bg)', border: 'none', borderRadius: 6, cursor: generating ? 'not-allowed' : 'pointer',
          fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
        }}>
          {generating ? 'Generating...' : questions.length > 0 ? 'New session' : 'Start quiz'}
        </button>
      </div>

      {/* Score */}
      {score.total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: accuracy >= 70 ? 'var(--green)' : 'var(--amber)' }}>
            {score.correct}/{score.total}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{accuracy}% accuracy</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              {LEVEL_LABELS[level - 1]} · {qtype.replace('_', ' ')}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>{questions.length - current - 1} more queued</div>
            {generating && <div style={{ fontSize: 10, color: 'var(--amber)' }}>Generating more...</div>}
          </div>
        </div>
      )}

      {/* Question */}
      {q && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            {q.type.replace('_', ' ')} · level {q.level} · question {current + 1}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 16, color: 'var(--text)' }}>
            {q.question}
          </div>

          {q.type === 'flashcard' ? (
            <div>
              {answered[current] === undefined ? (
                <button onClick={() => answer(q.correct_answer)} style={{
                  padding: '10px 20px', background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text)', fontFamily: 'monospace',
                }}>Reveal answer</button>
              ) : (
                <div style={{ padding: 12, background: 'rgba(0,217,126,0.1)', borderRadius: 6, border: '1px solid var(--green)', fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                  {q.correct_answer}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allOptions.map((opt, i) => {
                const userAnswered = answered[current] !== undefined
                const isChosen = answered[current] === opt
                const isCorrect = opt === q.correct_answer
                let bg = 'var(--bg)', border = 'var(--border)', color = 'var(--text)'
                if (userAnswered) {
                  if (isCorrect) { bg = 'rgba(0,217,126,0.1)'; border = 'var(--green)'; color = 'var(--green)' }
                  else if (isChosen) { bg = 'rgba(255,77,106,0.1)'; border = 'var(--red)'; color = 'var(--red)' }
                }
                return (
                  <button key={i} onClick={() => answer(opt)} disabled={userAnswered} style={{
                    textAlign: 'left', padding: '9px 14px', background: bg,
                    border: `1px solid ${border}`, borderRadius: 6, cursor: userAnswered ? 'default' : 'pointer',
                    fontSize: 12, color, fontFamily: 'monospace', lineHeight: 1.5,
                  }}>{opt}</button>
                )
              })}
            </div>
          )}

          {feedback && answered[current] !== undefined && (
            <div style={{ marginTop: 14, padding: 12, background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                {feedback.is_correct ? '✓ Correct' : '✗ Incorrect — here\'s why:'}
              </div>
              {feedback.explanation}
            </div>
          )}

          {answered[current] !== undefined && (
            <button onClick={next} style={{
              marginTop: 14, padding: '9px 20px', background: 'var(--text)', color: 'var(--bg)',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
            }}>
              {current < questions.length - 1 ? 'Next question →' : generating ? 'Loading more...' : 'Generate more →'}
            </button>
          )}
        </div>
      )}

      {questions.length === 0 && !generating && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 60, border: '1px dashed var(--border)', borderRadius: 10 }}>
          Select a project and question type above, then click Start quiz.
        </div>
      )}
    </div>
  )
}

export default function Quiz() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--muted)', padding: 40 }}>Loading quiz...</div>}>
      <QuizContent />
    </Suspense>
  )
}
