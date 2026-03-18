'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useStudyTimer } from '@/hooks/useStudyTimer'

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

type Phase = 'setup' | 'interview' | 'results' | 'library' | 'weakspots'

function InterviewContent() {
  const searchParams = useSearchParams()
  const initialProject = searchParams.get('project') || PROJECTS[0].id

  const [phase, setPhase] = useState<Phase>('setup')
  const [projectId, setProjectId] = useState(initialProject)
  const [interviewType, setInterviewType] = useState('technical')
  const [difficulty, setDifficulty] = useState('balanced')
  const [targetCompany, setTargetCompany] = useState('')
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<{ role: string; content: string; evaluation?: any }[]>([])
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [isFinal, setIsFinal] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [pastSessions, setPastSessions] = useState<any[]>([])
  const [answerLibrary, setAnswerLibrary] = useState<any[]>([])
  const [weakSpots, setWeakSpots] = useState<any[]>([])
  const [expandedAnswer, setExpandedAnswer] = useState<number | null>(null)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [videoChunks, setVideoChunks] = useState<Blob[]>([])
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const recognitionRef = useRef<any>(null)

  useStudyTimer(projectId, 'interview', phase === 'interview')

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    api.getInterviewSessions(projectId).then(setPastSessions).catch(() => {})
  }, [projectId])

  // Mic: Web Speech API
  const startMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setAnswer(transcript)
    }

    recognition.onend = () => setIsRecording(false)
    recognition.start()
    recognitionRef.current = recognition
    setIsRecording(true)
  }

  const stopMic = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsRecording(false)
  }

  const speak = (text: string) => {
    if (!ttsEnabled) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1
    utterance.volume = 1
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Samantha') || v.name.includes('Daniel'))
    )
    if (preferred) utterance.voice = preferred
    window.speechSynthesis.speak(utterance)
  }

  const toggleMic = () => {
    if (isRecording) stopMic()
    else startMic()
  }

  // Video: MediaRecorder API
  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      recorder.ondataavailable = e => chunks.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        setVideoUrl(url)
      }
      recorder.start()
      setMediaRecorder(recorder)
      setVideoChunks(chunks)
      setIsVideoOn(true)
    } catch (e) {
      alert('Could not access camera. Please allow camera permissions.')
    }
  }

  const stopVideo = () => {
    if (mediaRecorder) {
      mediaRecorder.stop()
      const stream = mediaRecorder.stream
      stream.getTracks().forEach(t => t.stop())
      setMediaRecorder(null)
    }
    setIsVideoOn(false)
  }

  const startInterview = async () => {
    setLoading(true)
    try {
      const result = await api.startInterview(projectId, interviewType, difficulty, targetCompany)
      setSessionId(result.session_id)
      setMessages([{ role: 'interviewer', content: result.opening_message }])
      if (ttsEnabled) speak(result.opening_message)
      setPhase('interview')
      setVideoUrl(null)
    } finally {
      setLoading(false)
    }
  }

  const submitAnswer = async () => {
    if (!answer.trim() || !sessionId) return
    if (isRecording) stopMic()
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
      if (result.message) speak(result.message)
      if (result.is_final) setIsFinal(true)
    } finally {
      setLoading(false)
    }
  }

  const finishInterview = async () => {
    if (!sessionId) return
    window.speechSynthesis.cancel()
    if (isVideoOn) stopVideo()
    setLoading(true)
    try {
      const result = await api.completeInterview(sessionId)
      setResults(result)
      setPhase('results')
    } finally {
      setLoading(false)
    }
  }

  const loadLibrary = async () => {
    const result = await api.getAnswerLibrary(projectId)
    setAnswerLibrary(result.answers || [])
    setPhase('library')
  }

  const loadWeakSpots = async () => {
    const result = await api.getWeakSpots(projectId)
    setWeakSpots(result.weak_spots || [])
    setPhase('weakspots')
  }

  const reset = () => {
    if (isRecording) stopMic()
    if (isVideoOn) stopVideo()
    setPhase('setup')
    setMessages([])
    setAnswer('')
    setSessionId(null)
    setIsFinal(false)
    setResults(null)
    setVideoUrl(null)
  }

  const scoreColor = (score: number) =>
    score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)'

  // WEAK SPOTS PAGE
  if (phase === 'weakspots') {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Weak spot tracker</div>
          <button onClick={() => setPhase('setup')} style={{ padding: '6px 14px', fontSize: 11, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'monospace' }}>← Back</button>
        </div>

        {weakSpots.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: 20, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
            Complete at least one interview session to see your weak spots.
          </div>
        ) : (
          weakSpots.map((ws, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: `1px solid ${ws.needs_work ? 'var(--red)' : 'var(--border)'}`, borderRadius: 10, padding: 18, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{ws.interview_type.replace('_', ' ')}</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{ws.sessions_count} session{ws.sessions_count !== 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: scoreColor(ws.avg_score) }}>{ws.avg_score}/100</span>
                </div>
              </div>
              {ws.top_weaknesses.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Focus areas</div>
                  {ws.top_weaknesses.map((w: string, j: number) => (
                    <div key={j} style={{ fontSize: 12, color: 'var(--text)', padding: '3px 0', display: 'flex', gap: 8 }}>
                      <span style={{ color: ws.needs_work ? 'var(--red)' : 'var(--amber)' }}>›</span> {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    )
  }

  // ANSWER LIBRARY PAGE
  if (phase === 'library') {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Answer library</div>
          <button onClick={() => setPhase('setup')} style={{ padding: '6px 14px', fontSize: 11, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'monospace' }}>← Back</button>
        </div>

        {answerLibrary.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: 20, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
            No saved answers yet. Complete an interview session to build your library.
          </div>
        ) : (
          answerLibrary.map((item, i) => (
            <div key={item.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
              <button onClick={() => setExpandedAnswer(expandedAnswer === item.id ? null : item.id)} style={{
                width: '100%', display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px',
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: scoreColor(item.score), flexShrink: 0, minWidth: 40 }}>{item.score}</span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.question}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>{item.interview_type?.replace('_', ' ')}</div>
                </div>
                <span style={{ color: 'var(--muted)', fontSize: 12, flexShrink: 0 }}>{expandedAnswer === item.id ? '▼' : '▶'}</span>
              </button>

              {expandedAnswer === item.id && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ marginTop: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Question</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{item.question}</div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Your answer</div>
                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, background: 'var(--bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>{item.answer}</div>
                  </div>
                  {item.ideal_answer && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Ideal answer</div>
                      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, background: 'rgba(74,222,128,0.06)', padding: 12, borderRadius: 8, border: '1px solid var(--green)' }}>{item.ideal_answer}</div>
                    </div>
                  )}
                  {item.tip && (
                    <div style={{ fontSize: 12, color: 'var(--amber)', padding: '8px 12px', background: 'rgba(245,166,35,0.06)', borderRadius: 6, border: '1px solid rgba(245,166,35,0.3)' }}>
                      💡 {item.tip}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    )
  }

  // RESULTS PAGE
  if (phase === 'results' && results) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 52, fontWeight: 700, color: scoreColor(results.score) }}>{results.score}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>out of 100</div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Interview debrief</div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8 }}>{results.feedback}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {results.strengths?.length > 0 && (
            <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid var(--green)', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>✓ What landed</div>
              {results.strengths.map((s: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '3px 0', lineHeight: 1.6 }}>› {s}</div>
              ))}
            </div>
          )}
          {results.weaknesses?.length > 0 && (
            <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid var(--red)', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>⚠ Needs work</div>
              {results.weaknesses.map((w: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '3px 0', lineHeight: 1.6 }}>› {w}</div>
              ))}
            </div>
          )}
        </div>

        {/* Per-question breakdown */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Question by question</div>
          {messages.filter(m => m.role === 'interviewer' && m.evaluation?.score).map((msg, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Q{i + 1}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: scoreColor(msg.evaluation.score) }}>{msg.evaluation.score}/100</div>
              </div>
              {msg.evaluation.tip && (
                <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 6 }}>💡 {msg.evaluation.tip}</div>
              )}
              {msg.evaluation.ideal_answer && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Ideal answer</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{msg.evaluation.ideal_answer}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Video review */}
        {videoUrl && (
          <div style={{ marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Your recording</div>
            <video src={videoUrl} controls style={{ width: '100%', borderRadius: 8 }} />
            <a href={videoUrl} download="interview-recording.webm" style={{
              display: 'inline-block', marginTop: 10, padding: '8px 16px',
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--muted)', fontSize: 12,
              textDecoration: 'none', fontFamily: 'monospace',
            }}>
              ↓ Download recording
            </a>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={reset} style={{ flex: 1, padding: '12px 0', background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
            New interview
          </button>
          <button onClick={loadLibrary} style={{ flex: 1, padding: '12px 0', background: 'transparent', border: '1px solid var(--amber)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--amber)', fontFamily: 'monospace' }}>
            View answer library
          </button>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{typeLabel} Interview{ttsEnabled && <span style={{ fontSize: 11, color: 'var(--green)' }}> 🔊</span>}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {diffLabel} · {PROJECTS.find(p => p.id === projectId)?.name}
              {targetCompany && <span style={{ color: 'var(--blue)', marginLeft: 8 }}>· {targetCompany}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isVideoOn ? (
              <button onClick={startVideo} style={{ padding: '6px 12px', fontSize: 11, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'monospace' }}>
                📹 Record
              </button>
            ) : (
              <span style={{ padding: '6px 12px', fontSize: 11, color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 6 }}>● Recording</span>
            )}
            <button onClick={reset} style={{ padding: '6px 12px', fontSize: 11, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'monospace' }}>
              End
            </button>
          </div>
        </div>

        {/* Video preview (small, top right) */}
        {isVideoOn && (
          <video ref={videoRef} muted style={{ position: 'fixed', bottom: 20, right: 20, width: 160, height: 120, borderRadius: 8, border: '2px solid var(--red)', objectFit: 'cover', zIndex: 100 }} />
        )}

        {/* Chat */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, height: 'calc(100vh - 320px)', overflowY: 'auto', marginBottom: 12 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 10, flexDirection: msg.role === 'candidate' ? 'row-reverse' : 'row' }}>
                <div style={{ fontSize: 10, color: 'var(--border)', flexShrink: 0, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
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
            </div>
          ))}
          {loading && <div style={{ color: 'var(--muted)', fontSize: 12, fontStyle: 'italic' }}>Interviewer is thinking...</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* Answer input */}
        {!isFinal ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) submitAnswer() }}
              placeholder={isRecording ? '🎤 Listening... speak your answer' : 'Type your answer or click 🎤 to speak (⌘+Enter to send)'}
              disabled={loading}
              style={{
                flex: 1, minHeight: 70, padding: '10px 14px',
                background: isRecording ? 'rgba(248,113,113,0.06)' : 'var(--surface)',
                border: `1px solid ${isRecording ? 'var(--red)' : 'var(--border)'}`,
                borderRadius: 8, color: 'var(--text)', fontSize: 13,
                resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6,
                transition: 'border-color 0.2s, background 0.2s',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={toggleMic} style={{
                padding: '10px 14px', borderRadius: 8, border: `1px solid ${isRecording ? 'var(--red)' : 'var(--border)'}`,
                background: isRecording ? 'rgba(248,113,113,0.1)' : 'var(--surface)',
                color: isRecording ? 'var(--red)' : 'var(--muted)', cursor: 'pointer', fontSize: 16,
              }}>
                {isRecording ? '⏹' : '🎤'}
              </button>
              <button onClick={submitAnswer} disabled={loading || !answer.trim()} style={{
                padding: '10px 16px', background: 'var(--text)', color: 'var(--bg)',
                border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
              }}>Send</button>
            </div>
          </div>
        ) : (
          <button onClick={finishInterview} disabled={loading} style={{
            width: '100%', padding: '14px 0', background: 'var(--green)', color: '#000',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'monospace',
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
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>AI Interview</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Practice with an AI interviewer that knows your projects. Get scored, coached, and debrief after every session.
        </div>
      </div>

      {/* Project */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Project</div>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}>
          {PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Target company */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Target company <span style={{ color: 'var(--border)' }}>(optional)</span></div>
        <input
          value={targetCompany}
          onChange={e => setTargetCompany(e.target.value)}
          placeholder="e.g. Stripe, Google, Airbnb, Startup..."
          style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      {/* Interview type */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Interview type</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setInterviewType(t.id)} style={{ padding: '12px 16px', borderRadius: 8, textAlign: 'left', border: `1px solid ${interviewType === t.id ? 'var(--green)' : 'var(--border)'}`, background: interviewType === t.id ? 'rgba(74,222,128,0.06)' : 'var(--surface)', cursor: 'pointer' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{t.label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Difficulty</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {DIFFICULTIES.map(d => (
            <button key={d.id} onClick={() => setDifficulty(d.id)} style={{ flex: 1, padding: '10px 12px', borderRadius: 8, textAlign: 'center', border: `1px solid ${difficulty === d.id ? 'var(--amber)' : 'var(--border)'}`, background: difficulty === d.id ? 'rgba(245,166,35,0.06)' : 'var(--surface)', cursor: 'pointer' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{d.label}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{d.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <button onClick={() => setTtsEnabled(v => !v)} style={{
        width: '100%', padding: '11px 0', marginBottom: 12,
        background: ttsEnabled ? 'rgba(74,222,128,0.1)' : 'transparent',
        border: `1px solid ${ttsEnabled ? 'var(--green)' : 'var(--border)'}`,
        borderRadius: 8, cursor: 'pointer', fontSize: 13,
        color: ttsEnabled ? 'var(--green)' : 'var(--muted)', fontFamily: 'monospace',
      }}>
        {ttsEnabled ? '🔊 Voice on — interviewer will speak' : '🔇 Voice off — click to enable'}
      </button>
      <button onClick={startInterview} disabled={loading} style={{ width: '100%', padding: '14px 0', background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'monospace', marginBottom: 12 }}>
        {loading ? 'Starting...' : 'Start interview →'}
      </button>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={loadLibrary} style={{ flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid var(--amber)', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--amber)', fontFamily: 'monospace' }}>
          Answer library
        </button>
        <button onClick={loadWeakSpots} style={{ flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid var(--red)', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--red)', fontFamily: 'monospace' }}>
          Weak spot tracker
        </button>
      </div>

      {/* Past sessions */}
      {pastSessions.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Past sessions</div>
          {pastSessions.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text)', textTransform: 'capitalize' }}>{s.interview_type?.replace('_', ' ')}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{s.difficulty}</span>
              </div>
              {s.score != null && <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(s.score) }}>{s.score}/100</span>}
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
