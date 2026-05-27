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
  const [sessionId, setSessionId] = useState(null)
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
  const [assessment, setAssessment] = useState(null)

  const setIntake = useCallback((data) => {
    setIntakeData((prev) => ({ ...prev, ...data }))
  }, [])

  const addPainPoint = useCallback((region, point3D, severity = 'moderate') => {
    setPainPoints((prev) => {
      if (prev.find((p) => p.region === region)) return prev
      return [...prev, { region, point3D, severity }]
    })
  }, [])

  const removePainPoint = useCallback((region) => {
    setPainPoints((prev) => prev.filter((p) => p.region !== region))
  }, [])

  const updatePainPointSeverity = useCallback((region, severity) => {
    setPainPoints((prev) =>
      prev.map((p) => (p.region === region ? { ...p, severity } : p))
    )
  }, [])

  const addMessage = useCallback((role, content) => {
    setChatHistory((prev) => [...prev, { role, content }])
  }, [])

  const setScreenshot = useCallback((dataUrl) => {
    setCanvasScreenshot(dataUrl)
  }, [])

  return (
    <SessionContext.Provider
      value={{
        phase,
        setPhase,
        sessionId,
        setSessionId,
        intake,
        setIntake,
        painPoints,
        addPainPoint,
        removePainPoint,
        updatePainPointSeverity,
        chatHistory,
        addMessage,
        canvasScreenshot,
        setScreenshot,
        assessment,
        setAssessment,
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
