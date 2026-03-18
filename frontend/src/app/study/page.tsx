'use client'
import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'

type UploadMode = 'text' | 'url' | 'file' | 'braindump'
type StudyState = 'upload' | 'quiz'

export default function Study() {
  const [mode, setMode] = useState<UploadMode>('text')
  const [state, setState] = useState<StudyState>('upload')
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [textContent, setTextContent] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<any[]>([])
  const [session, setSession] = useState<any>(null)
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<any>(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [shuffled, setShuffled] = useState<string[]>([])
  const [fileName, setFileName] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [braindumpProject, setBraindumpProject] = useState('')
  const [braindumpProjects, setBraindumpProjects] = useState<any[]>([])
  const [braindumpResult, setBraindumpResult] = useState<any>(null)

  useEffect(() => {
    api.getProjects().then(data => {
      const withSummary = data.filter((p: any) => p.has_build_summary)
      setBraindumpProjects(withSummary)
      if (withSummary.length > 0) setBraindumpProject(withSummary[0].id)
    }).catch(() => {})
  }, [])

  const shuffle = (q: any) => {
    const opts = [q.correct_answer, ...(q.wrong_answers || [])].sort(() => Math.random() - 0.5)
    setShuffled(opts)
  }

  const handleBraindump = async () => {
    if (!textContent.trim() || !braindumpProject) return
    setLoading(true)
    try {
      const result = await api.checkBraindump(braindumpProject, textContent)
      setBraindumpResult(result)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async () => {
    if (!title.trim() || !subject.trim()) return
    setLoading(true)
    try {
      let result: any
      if (mode === 'text') {
        if (!textContent.trim()) return
        result = await api.uploadStudyText(title, subject, textContent)
      } else if (mode === 'url') {
        if (!url.trim()) return
        result = await api.uploadStudyUrl(title, subject, url)
      } else if (mode === 'file' && fileRef.current?.files?.[0]) {
        const file = fileRef.current.files[0]
        const base64 = await new Promise<string>((res, rej) => {
          const reader = new FileReader()
          reader.onload = () => res((reader.result as string).split(',')[1])
          reader.onerror = rej
          reader.readAsDataURL(file)
        })
        result = await api.uploadStudyFile(title, subject, base64, file.type)
      }
      if (result?.questions?.length > 0) {
        setQuestions(result.questions)
        setSession(result.session)
        shuffle(result.questions[0])
        setState('quiz')
        setCurrent(0)
        setScore({ correct: 0, total: 0 })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = async (answer: string) => {
    if (selected) return
    setSelected(answer)
    const q = questions[current]
    const correct = answer === q.correct_answer
    const result = await api.submitStudyAttempt(q.id, correct)
    setFeedback(result)
    setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }))
  }

  const next = () => {
    if (current < questions.length - 1) {
      setCurrent(i => i + 1)
      setSelected(null)
      setFeedback(null)
      shuffle(questions[current + 1])
    }
  }

  const reset = () => {
    setState('upload')
    setTitle('')
    setSubject('')
    setTextContent('')
    setUrl('')
    setFileName('')
    setQuestions([])
    setSession(null)
    setCurrent(0)
    setSelected(null)
    setFeedback(null)
    setScore({ correct: 0, total: 0 })
  }

  const q = questions[current]

  if (state === 'quiz' && q) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{session?.title}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{session?.subject}</div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {score.correct}/{score.total} correct · Q{current + 1}/{questions.length}
            </div>
            <button onClick={reset} style={{
              padding: '6px 14px', fontSize: 11, borderRadius: 6,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--muted)', cursor: 'pointer', fontFamily: 'monospace',
            }}>New session</button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 24 }}>
          <div style={{ height: '100%', width: `${((current + 1) / questions.length) * 100}%`, background: 'var(--green)', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>

        {/* Question */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.6, marginBottom: 20 }}>{q.question}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {shuffled.map((opt, i) => {
              const isSelected = selected === opt
              const isCorrect = opt === q.correct_answer
              let bg = 'var(--bg)'
              let border = 'var(--border)'
              let color = 'var(--text)'
              if (selected) {
                if (isCorrect) { bg = 'rgba(74,222,128,0.1)'; border = 'var(--green)'; color = 'var(--green)' }
                else if (isSelected) { bg = 'rgba(248,113,113,0.1)'; border = 'var(--red)'; color = 'var(--red)' }
              }
              return (
                <button key={i} onClick={() => handleAnswer(opt)} disabled={!!selected} style={{
                  padding: '12px 16px', borderRadius: 8, border: `1px solid ${border}`,
                  background: bg, color, cursor: selected ? 'default' : 'pointer',
                  textAlign: 'left', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}>
                  {opt}
                </button>
              )
            })}
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div style={{
            background: feedback.is_correct ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)',
            border: `1px solid ${feedback.is_correct ? 'var(--green)' : 'var(--red)'}`,
            borderRadius: 10, padding: 16, marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: feedback.is_correct ? 'var(--green)' : 'var(--red)', marginBottom: 8 }}>
              {feedback.is_correct ? '✓ Correct!' : '✗ Not quite'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>{q.explanation}</div>
          </div>
        )}

        {selected && (
          <button onClick={next} disabled={current === questions.length - 1} style={{
            width: '100%', padding: '12px 0', background: 'var(--text)', color: 'var(--bg)',
            border: 'none', borderRadius: 8, cursor: current === questions.length - 1 ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
          }}>
            {current === questions.length - 1 ? `Done — ${score.correct}/${score.total} correct` : 'Next question →'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Study mode</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Upload anything — PDF, notes, article, or paste text. Claude generates quiz questions instantly.
        </div>
      </div>

      {/* Title + Subject */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Title</div>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Chapter 5 Notes"
            style={{
              width: '100%', padding: '10px 14px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
              fontSize: 13, outline: 'none', fontFamily: 'inherit',
            }} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Subject</div>
          <input value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="e.g. SAT Math, AP History, Biology"
            style={{
              width: '100%', padding: '10px 14px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
              fontSize: 13, outline: 'none', fontFamily: 'inherit',
            }} />
        </div>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {([['text', 'Paste text'], ['url', 'URL'], ['file', 'Upload file'], ['braindump', 'Brain dump']] as const).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '7px 16px', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
            borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
            fontFamily: 'monospace',
            background: mode === m ? 'var(--text)' : 'transparent',
            color: mode === m ? 'var(--bg)' : 'var(--muted)',
          }}>{label}</button>
        ))}
      </div>

      {/* Input area */}
      {mode === 'text' && (
        <textarea value={textContent} onChange={e => setTextContent(e.target.value)}
          placeholder="Paste your notes, textbook excerpt, homework assignment, or any study material here..."
          style={{
            width: '100%', height: 220, background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
            fontSize: 13, padding: 16, resize: 'none', outline: 'none',
            lineHeight: 1.7, fontFamily: 'inherit', marginBottom: 16,
          }} />
      )}

      {mode === 'url' && (
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://..."
          style={{
            width: '100%', padding: '12px 16px', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
            fontSize: 13, outline: 'none', fontFamily: 'monospace', marginBottom: 16,
          }} />
      )}

      {mode === 'file' && (
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: '2px dashed var(--border)', borderRadius: 10, padding: 40,
            textAlign: 'center', cursor: 'pointer', marginBottom: 16,
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
            Click to upload PDF or image of handwritten notes
          </div>
          <div style={{ fontSize: 11, color: 'var(--border)' }}>PDF, PNG, JPG supported</div>
          <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
            onChange={() => {
              const f = fileRef.current?.files?.[0]
              if (f) {
                if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
                setFileName(f.name)
              }
            }} />
          {fileName && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--green)' }}>
              ✓ {fileName}
            </div>
          )}
        </div>
      )}

      {mode === 'braindump' && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Project</div>
            <select value={braindumpProject} onChange={e => setBraindumpProject(e.target.value)} style={{
              width: '100%', padding: '10px 14px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
            }}>
              {braindumpProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <textarea
            value={textContent}
            onChange={e => setTextContent(e.target.value)}
            placeholder="Write everything you remember about this project from scratch — architecture, tech stack, key features, how it works, challenges you faced, decisions you made. Don't look anything up."
            style={{
              width: '100%', height: 260, background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
              fontSize: 13, padding: 16, resize: 'none', outline: 'none',
              lineHeight: 1.7, fontFamily: 'inherit', marginBottom: 16,
            }}
          />
          <button onClick={handleBraindump} disabled={loading || !textContent.trim() || !braindumpProject} style={{
            width: '100%', padding: '12px 0', background: loading ? 'var(--border)' : 'var(--text)',
            color: 'var(--bg)', border: 'none', borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
          }}>
            {loading ? 'Checking your recall...' : 'Check my recall →'}
          </button>

          {braindumpResult && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1, background: 'rgba(74,222,128,0.06)', border: '1px solid var(--green)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>✓ You remembered</div>
                  {(braindumpResult.remembered || []).map((r: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '3px 0', lineHeight: 1.6 }}>› {r}</div>
                  ))}
                </div>
                <div style={{ flex: 1, background: 'rgba(248,113,113,0.06)', border: '1px solid var(--red)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>✗ You forgot</div>
                  {(braindumpResult.forgot || []).map((f: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '3px 0', lineHeight: 1.6 }}>› {f}</div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid var(--border)', lineHeight: 1.7 }}>
                {braindumpResult.feedback}
              </div>
            </div>
          )}
        </div>
      )}

      {mode !== 'braindump' && <button onClick={handleUpload} disabled={loading || !title.trim() || !subject.trim()} style={{
        width: '100%', padding: '12px 0', background: loading ? 'var(--border)' : 'var(--text)',
        color: 'var(--bg)', border: 'none', borderRadius: 8,
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
      }}>
        {loading ? 'Generating questions...' : 'Generate quiz →'}
      </button>}
    </div>
  )
}
