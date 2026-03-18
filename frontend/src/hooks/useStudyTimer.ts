import { useEffect, useRef } from 'react'
import { api } from '@/lib/api'

export function useStudyTimer(
  projectId: string,
  sessionType: string,
  active: boolean,
  questionsAnswered: number = 0,
  correctAnswers: number = 0
) {
  const startTime = useRef<number | null>(null)
  const logged = useRef(false)

  useEffect(() => {
    if (active && !startTime.current) {
      startTime.current = Date.now()
      logged.current = false
    }
  }, [active])

  useEffect(() => {
    return () => {
      if (startTime.current && !logged.current && projectId) {
        const duration = Math.round((Date.now() - startTime.current) / 1000)
        if (duration > 30) { // only log if studied for more than 30 seconds
          logged.current = true
          api.logStudySession(projectId, sessionType, duration, questionsAnswered, correctAnswers).catch(() => {})
        }
      }
    }
  }, [projectId, sessionType, questionsAnswered, correctAnswers])
}
