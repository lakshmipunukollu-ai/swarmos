const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

export interface Project {
  id: string
  name: string
  company: string
  stack: string
  port: number
  status: 'queued' | 'building' | 'testing' | 'done' | 'error'
  phase: string
  files_count: number
  live_url: string
  github_url: string
  last_log: string
  estimated_minutes: number
  elapsed_seconds: number
  minutes_remaining: number
  has_build_summary: boolean
  build_summary: string
  featured: number
  started_at: string | null
  completed_at: string | null
}

export interface QuizQuestion {
  id: number
  question: string
  correct_answer: string
  wrong_answers: string[]
  explanation: string
  level: number
  type: string
  is_review?: boolean
}

export const api = {
  async getProjects(): Promise<Project[]> {
    const r = await fetch(`${API}/api/projects`, { cache: 'no-store' })
    return r.json()
  },
  async getProject(id: string): Promise<Project> {
    const r = await fetch(`${API}/api/projects/${id}`, { cache: 'no-store' })
    return r.json()
  },
  async updateProject(id: string, data: Partial<Project>) {
    const r = await fetch(`${API}/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return r.json()
  },
  async getLogs(id: string) {
    const r = await fetch(`${API}/api/projects/${id}/logs?limit=200`, { cache: 'no-store' })
    return r.json()
  },
  async importProjectLogs(id: string) {
    const r = await fetch(`${API}/api/projects/${id}/import-logs`, { method: 'POST' })
    return r.json()
  },
  async getLogsGrouped(id: string) {
    const r = await fetch(`${API}/api/projects/${id}/logs?grouped=true&limit=500`, { cache: 'no-store' })
    return r.json()
  },
  async analyzeIntake(brief: string) {
    const r = await fetch(`${API}/api/intake/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief }),
    })
    return r.json()
  },
  async refineIntake(original_brief: string, analysis: object, answers: string) {
    const r = await fetch(`${API}/api/intake/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original_brief, analysis, answers }),
    })
    return r.json()
  },
  async generateQuiz(project_id: string, question_type: string, level: number, count: number = 3) {
    const r = await fetch(`${API}/api/quiz/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id, question_type, level, count }),
    })
    return r.json()
  },
  async submitAttempt(question_id: number, project_id: string, user_answer: string, is_correct: boolean) {
    const r = await fetch(`${API}/api/quiz/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id, project_id, user_answer, is_correct }),
    })
    return r.json()
  },
  async getQuizStats(project_id: string) {
    const r = await fetch(`${API}/api/quiz/stats/${project_id}`, { cache: 'no-store' })
    return r.json()
  },
  async getErrorAnalysis(project_id: string) {
    const r = await fetch(`${API}/api/quiz/error-analysis/${project_id}`, { cache: 'no-store' })
    return r.json()
  },
  async getDueForReview() {
    const r = await fetch(`${API}/api/projects/due-for-review`, { cache: 'no-store' })
    return r.json()
  },
  async logStudySession(project_id: string, session_type: string, duration_seconds: number, questions_answered: number = 0, correct_answers: number = 0) {
    const r = await fetch(
      `${API}/api/projects/${project_id}/study-session?session_type=${session_type}&duration_seconds=${duration_seconds}&questions_answered=${questions_answered}&correct_answers=${correct_answers}`,
      { method: 'POST' }
    )
    return r.json()
  },
  async getReadinessScore(project_id: string) {
    const r = await fetch(`${API}/api/projects/${project_id}/readiness`, { cache: 'no-store' })
    return r.json()
  },
  async getStudyOverview() {
    const r = await fetch(`${API}/api/projects/study-stats/overview`, { cache: 'no-store' })
    return r.json()
  },
  async getStudyHistory(project_id: string) {
    const r = await fetch(`${API}/api/projects/${project_id}/study-history`, { cache: 'no-store' })
    return r.json()
  },
  async exportStudyDoc(project_id: string) {
    const r = await fetch(`${API}/api/projects/${project_id}/study-doc`, { cache: 'no-store' })
    return r.json()
  },
  async checkBraindump(project_id: string, recall_text: string) {
    const r = await fetch(`${API}/api/study/braindump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id, recall_text }),
    })
    return r.json()
  },
  async deleteProject(id: string) {
    const r = await fetch(`${API}/api/projects/${id}`, { method: 'DELETE' })
    return r.json()
  },
  async refreshProject(id: string) {
    const r = await fetch(`${API}/api/projects/${id}/refresh`, { method: 'POST' })
    return r.json()
  },
  async importFromGitHub(repo_url: string, company: string = '', brief: string = '') {
    const r = await fetch(`${API}/api/projects/import-github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_url, company, brief }),
    })
    return r.json()
  },
  async getHiringLens(id: string) {
    const r = await fetch(`${API}/api/projects/${id}/hiring-lens`, { method: 'POST' })
    return r.json()
  },
  async listProjectFiles(id: string): Promise<{ files: { path: string; size: number }[] }> {
    const r = await fetch(`${API}/api/quiz/files/${id}`, { cache: 'no-store' })
    return r.json()
  },
  async codeWalkthrough(project_id: string, file_path: string) {
    const r = await fetch(
      `${API}/api/quiz/walkthrough?project_id=${encodeURIComponent(project_id)}&file_path=${encodeURIComponent(file_path)}`,
      { method: 'POST' }
    )
    return r.json()
  },
  async getFileContent(project_id: string, file_path: string) {
    const r = await fetch(
      `${API}/api/quiz/file-content/${project_id}?file_path=${encodeURIComponent(file_path)}`,
      { cache: 'no-store' }
    )
    return r.json()
  },
  async explainTerm(term: string, context_code: string, project_id: string, depth: string = 'simple') {
    const r = await fetch(`${API}/api/quiz/explain-term`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term, context_code, project_id, depth }),
    })
    return r.json()
  },
  async codeChat(project_id: string, file_path: string, file_content: string, question: string, history: any[]) {
    const r = await fetch(`${API}/api/quiz/code-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id, file_path, file_content, question, history }),
    })
    return r.json()
  },
  async uploadStudyText(title: string, subject: string, content: string) {
    const r = await fetch(`${API}/api/study/upload/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subject, content }),
    })
    return r.json()
  },
  async uploadStudyUrl(title: string, subject: string, url: string) {
    const r = await fetch(`${API}/api/study/upload/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subject, url }),
    })
    return r.json()
  },
  async uploadStudyFile(title: string, subject: string, file_base64: string, media_type: string) {
    const endpoint = media_type === 'application/pdf' ? 'pdf' : 'image'
    const r = await fetch(`${API}/api/study/upload/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subject, file_base64, media_type }),
    })
    return r.json()
  },
  async getStudySessions() {
    const r = await fetch(`${API}/api/study/sessions`, { cache: 'no-store' })
    return r.json()
  },
  async getStudyQuestions(sessionId: number) {
    const r = await fetch(`${API}/api/study/sessions/${sessionId}/questions`, { cache: 'no-store' })
    return r.json()
  },
  async submitStudyAttempt(question_id: number, is_correct: boolean) {
    const r = await fetch(`${API}/api/study/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id, is_correct }),
    })
    return r.json()
  },
  async startInterview(project_id: string, interview_type: string, difficulty: string, target_company: string = '') {
    const r = await fetch(`${API}/api/interview/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id, interview_type, difficulty, target_company }),
    })
    return r.json()
  },
  async getAnswerLibrary(project_id: string) {
    const r = await fetch(`${API}/api/interview/answers/${project_id}`, { cache: 'no-store' })
    return r.json()
  },
  async getWeakSpots(project_id: string) {
    const r = await fetch(`${API}/api/interview/weak-spots/${project_id}`, { cache: 'no-store' })
    return r.json()
  },
  async submitAnswer(session_id: number, answer: string) {
    const r = await fetch(`${API}/api/interview/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id, answer }),
    })
    return r.json()
  },
  async completeInterview(session_id: number) {
    const r = await fetch(`${API}/api/interview/complete/${session_id}`, { method: 'POST' })
    return r.json()
  },
  async getInterviewSessions(project_id: string) {
    const r = await fetch(`${API}/api/interview/sessions/${project_id}`, { cache: 'no-store' })
    return r.json()
  },
  async getDefendQuestion(project_id: string, file_path: string, code_snippet: string, question_focus: string) {
    const r = await fetch(`${API}/api/interview/defend/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id, file_path, code_snippet, question_focus }),
    })
    return r.json()
  },
  async evaluateDefense(project_id: string, file_path: string, code_snippet: string, question: string, answer: string) {
    const r = await fetch(`${API}/api/interview/defend/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id, file_path, code_snippet, question, answer }),
    })
    return r.json()
  },
  async generateAdaptiveQuiz(project_id: string, chat_topics: string[] = []) {
    const r = await fetch(`${API}/api/quiz/adaptive-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id, chat_topics }),
    })
    return r.json()
  },
  async toggleFeatured(project_id: string) {
    const r = await fetch(`${API}/api/projects/${project_id}/toggle-featured`, { method: 'POST' })
    return r.json()
  },
  async getPitchFeedback(project_id: string, pitch_text: string, target_audience: string = 'technical') {
    const r = await fetch(`${API}/api/projects/${project_id}/pitch-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id, pitch_text, target_audience }),
    })
    return r.json()
  },
  async getWhyThisCompany(project_id: string, job_description: string, company_name: string) {
    const r = await fetch(`${API}/api/projects/${project_id}/why-this-company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id, job_description, company_name }),
    })
    return r.json()
  },
  async evaluateFeynman(project_id: string, concept: string, explanation: string) {
    const r = await fetch(`${API}/api/quiz/feynman`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id, concept, explanation }),
    })
    return r.json()
  },
  async getAIDefensePrep() {
    const r = await fetch(`${API}/api/interview/ai-defense-prep`, { cache: 'no-store' })
    return r.json()
  },
}
