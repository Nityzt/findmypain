'use client'

import { createContext, useContext, useState, useCallback } from 'react'

const SessionContext = createContext(null)

export const PHASES = {
  LANDING: 'LANDING',
  INTAKE: 'INTAKE',
  PAIN_SELECT: 'PAIN_SELECT',
  CHAT: 'CHAT',
  REPORT: 'REPORT',
}

export function SessionProvider({ children }) {
  const [phase, setPhase] = useState(PHASES.LANDING)
  const [intake, setIntakeData] = useState({
    age: '',
    biologicalSex: '',
    painOnset: '',
    chronicConditions: '',
    medications: '',
  })
  const [painPoints, setPainPoints] = useState([])
  const [chatHistory, setChatHistory] = useState([])
  const [canvasScreenshot, setCanvasScreenshot] = useState(null)
  // Structured summary from /api/report, plus the history length it was built from
  const [report, setReportState] = useState(null)

  const setIntake = useCallback((data) => {
    setIntakeData((prev) => ({ ...prev, ...data }))
  }, [])

  const addPainPoint = useCallback((region, point3D) => {
    setPainPoints((prev) => {
      if (prev.find((p) => p.region === region)) return prev
      return [...prev, { region, point3D }]
    })
  }, [])

  const removePainPoint = useCallback((region) => {
    setPainPoints((prev) => prev.filter((p) => p.region !== region))
  }, [])

  const addMessage = useCallback((role, content) => {
    setChatHistory((prev) => [...prev, { role, content }])
  }, [])

  // Voice transcripts arrive as several "final" fragments per spoken turn.
  // Merge consecutive fragments from the same speaker into one message.
  const appendTranscript = useCallback((role, content) => {
    const text = content?.trim()
    if (!text) return
    setChatHistory((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.role === role && last.source === 'voice') {
        return [...prev.slice(0, -1), { ...last, content: `${last.content} ${text}` }]
      }
      return [...prev, { role, content: text, source: 'voice' }]
    })
  }, [])

  const setReport = useCallback((data, historyLength) => {
    setReportState(data ? { data, historyLength } : null)
  }, [])

  const setScreenshot = useCallback((dataUrl) => {
    setCanvasScreenshot(dataUrl)
  }, [])

  return (
    <SessionContext.Provider
      value={{
        phase,
        setPhase,
        intake,
        setIntake,
        painPoints,
        addPainPoint,
        removePainPoint,
        chatHistory,
        addMessage,
        appendTranscript,
        canvasScreenshot,
        setScreenshot,
        report,
        setReport,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
