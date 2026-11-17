'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useVapi } from '@/contexts/VapiContext'
import { useSession } from '@/contexts/SessionContext'
import PainPointChip from './PainPointChip'
import Button, { IconButton, cx } from './Button'
import { Alert, FileText, Mic, Refresh, Send, Spinner, Stop } from './icons'

const READY_PATTERN = /enough to generate (your|the) report/i
const MIN_ANSWERS_FOR_REPORT = 2

async function requestReply(intake, painPoints, history) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intake,
      painPoints: painPoints.map((p) => ({ region: p.region })),
      history: history.map(({ role, content }) => ({ role, content })),
    }),
  })
  if (!res.ok) throw new Error(`chat request failed: ${res.status}`)
  return res.json()
}

export default function ChatPanel({ onReadyForReport }) {
  const { intake, painPoints, chatHistory, addMessage } = useSession()
  const {
    isSpeaking, isListening, isConnected, isConnecting, mode, hasVoice,
    startSession, stopSession, sendToCall, voiceError, setVoiceError, micPermission,
  } = useVapi()
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [textError, setTextError] = useState('')
  const [apiReady, setApiReady] = useState(false)
  const messagesEndRef = useRef(null)
  const historyRef = useRef(chatHistory)
  useEffect(() => { historyRef.current = chatHistory }, [chatHistory])

  const inCall = isConnected && mode === 'interview'
  const answers = chatHistory.filter((m) => m.role === 'user').length

  // Text mode: ask the server for the next question (or the opening one).
  const fetchReply = useCallback(async (history) => {
    setIsTyping(true)
    setTextError('')
    try {
      const data = await requestReply(intake, painPoints, history)
      addMessage('assistant', data.reply)
      if (data.readyForReport) setApiReady(true)
    } catch (err) {
      console.warn('[Chat] reply failed', err)
      setTextError('Could not reach the assistant. Check your connection and try again.')
    } finally {
      setIsTyping(false)
    }
  }, [intake, painPoints, addMessage])

  const startVoiceOrText = useCallback(async () => {
    const started = await startSession({
      mode: 'interview', intake, painPoints,
      history: historyRef.current.map(({ role, content }) => ({ role, content })),
    })
    if (!started && !historyRef.current.some((m) => m.role === 'assistant')) {
      fetchReply(historyRef.current)
    }
  }, [startSession, intake, painPoints, fetchReply])

  // On entering the chat: use voice only if the patient already allowed the
  // mic (they enabled it on the landing screen). Otherwise start in text and
  // let them opt in with the mic button, rather than blocking on a browser
  // permission prompt they may not notice.
  useEffect(() => {
    if (micPermission === 'granted') {
      startVoiceOrText()
    } else if (!historyRef.current.some((m) => m.role === 'assistant')) {
      fetchReply(historyRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The agent signals it has enough detail by ending its latest turn with a
  // fixed closing phrase. Ignore a closing line that was already there when the
  // chat was (re)opened, so "add more detail" doesn't bounce straight back.
  const [initialLast] = useState(() => chatHistory[chatHistory.length - 1]?.content)
  const lastMsg = chatHistory[chatHistory.length - 1]
  const phraseReady = lastMsg?.role === 'assistant' && lastMsg.content !== initialLast &&
    READY_PATTERN.test(lastMsg.content)
  const readyPending = apiReady || phraseReady

  // A voice call that fails after starting should not leave an empty chat.
  useEffect(() => {
    if (voiceError && !inCall && !isConnecting && !isTyping &&
        !historyRef.current.some((m) => m.role === 'assistant')) {
      fetchReply(historyRef.current)
    }
  }, [voiceError, inCall, isConnecting]) // eslint-disable-line react-hooks/exhaustive-deps

  // Move on to the report once the agent has finished speaking its last line.
  useEffect(() => {
    if (!readyPending || isSpeaking) return
    const t = setTimeout(() => onReadyForReport?.(), 1500)
    return () => clearTimeout(t)
  }, [readyPending, isSpeaking, onReadyForReport])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [chatHistory, isTyping])

  const handleSend = async () => {
    const text = inputText.trim()
    if (!text || isTyping) return
    setInputText('')
    setApiReady(false)
    addMessage('user', text)
    if (sendToCall(text)) return // the voice agent answers out loud
    await fetchReply([...historyRef.current, { role: 'user', content: text }])
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleMicClick = () => {
    if (inCall || isConnecting) {
      stopSession()
      return
    }
    setVoiceError('')
    startVoiceOrText()
  }

  const status = isConnecting ? 'Connecting voice…'
    : inCall ? (isSpeaking ? 'Assistant is speaking' : isListening ? 'Listening — just talk' : 'Voice is on')
    : hasVoice ? 'Voice off · type, or tap the mic to talk' : 'Type your answers below'
  const canSend = Boolean(inputText.trim()) && !isTyping
  const showDone = answers >= MIN_ANSWERS_FOR_REPORT || readyPending

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="chat-header shrink-0 border-b border-line px-5 pb-3 pt-4 sm:px-7 sm:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[22px] leading-tight font-semibold tracking-[-0.02em] sm:text-[26px]">Let’s talk it through</h2>
            <p className="mt-0.5 hidden text-sm text-muted sm:block">A few short questions about your pain.</p>
          </div>
          <span
            role="status"
            className={cx(
              'mt-1 inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold',
              inCall ? 'bg-teal-soft text-teal' : isConnecting ? 'bg-marigold-soft text-warn' : 'bg-cream-deep text-muted',
            )}
          >
            <span className={cx('size-2 rounded-full', inCall ? 'bg-teal' : isConnecting ? 'animate-pulse bg-marigold' : 'bg-muted', inCall && isListening && 'animate-pulse')} />
            <span className="max-w-[150px] truncate sm:max-w-none">{inCall ? (isSpeaking ? 'Speaking' : isListening ? 'Listening' : 'Voice on') : isConnecting ? 'Connecting' : 'Text mode'}</span>
          </span>
        </div>
        {painPoints.length > 0 && (
          <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {painPoints.map((p) => (
              <PainPointChip key={p.region} region={p.region} size="sm" />
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="chat-messages scrollbar-soft flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
        {chatHistory.length === 0 && !isTyping && (
          <div className="m-auto flex flex-col items-center gap-3 text-center text-sm text-muted">
            <Spinner size={22} className="text-teal" />
            {isConnecting ? 'Connecting to your assistant…' : 'Getting your first question ready…'}
          </div>
        )}

        {chatHistory.map((msg, i) => {
          const mine = msg.role === 'user'
          return (
            <div key={i} className={cx('flex items-end gap-2', mine ? 'justify-end' : 'justify-start')}>
              {!mine && (
                <span aria-hidden="true" className="mb-0.5 size-7 shrink-0 rounded-full bg-peach" />
              )}
              <div
                className={cx(
                  'max-w-[82%] px-4 py-2.5 text-[15px] leading-relaxed [overflow-wrap:anywhere]',
                  mine
                    ? 'rounded-[20px] rounded-br-md bg-teal text-white'
                    : 'rounded-[20px] rounded-bl-md bg-peach-soft text-ink',
                )}
              >
                <span className="sr-only">{mine ? 'You: ' : 'Assistant: '}</span>
                {msg.content}
              </div>
            </div>
          )
        })}

        {isTyping && (
          <div className="flex items-end gap-2" aria-label="Assistant is typing">
            <span aria-hidden="true" className="mb-0.5 size-7 shrink-0 rounded-full bg-peach" />
            <div className="flex h-10 items-center gap-1.5 rounded-[20px] rounded-bl-md bg-peach-soft px-4">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-2 animate-bob rounded-full bg-peach" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {textError && (
          <div role="alert" className="flex items-center gap-3 rounded-2xl bg-pain-soft px-4 py-3 text-sm text-pain-ink">
            <Alert size={18} className="shrink-0" />
            <span className="flex-1">{textError}</span>
            <Button size="sm" variant="secondary" onClick={() => fetchReply(historyRef.current)} iconLeft={<Refresh size={15} />}>
              Retry
            </Button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="chat-composer shrink-0 border-t border-line bg-white px-4 pb-4 pt-3 sm:px-6">
        {showDone && (
          <Button
            block
            className="mb-3 "
            variant={readyPending ? 'primary' : 'soft'}
            loading={readyPending}
            onClick={() => onReadyForReport?.()}
            iconRight={readyPending ? null : <FileText size={18} />}
          >
            {readyPending ? 'Preparing your report…' : 'I’m done — create my report'}
          </Button>
        )}

        <div className="flex items-center gap-2.5">
          {hasVoice && (
            <IconButton
              label={inCall || isConnecting ? 'Turn voice off' : 'Talk instead of typing'}
              onClick={handleMicClick}
              aria-pressed={inCall}
              className={cx(
                'size-12',
                inCall
                  ? 'bg-teal text-white shadow-button'
                  : isConnecting
                    ? 'bg-marigold-soft text-warn'
                    : 'border border-line bg-white text-teal hover:border-teal hover:bg-teal-soft',
                inCall && isListening && !isSpeaking && '',
              )}
            >
              {isConnecting ? <Spinner size={18} /> : inCall ? (isSpeaking ? <MiniWave /> : <Stop size={18} />) : <Mic size={20} />}
            </IconButton>
          )}

          <div className="relative min-w-0 flex-1">
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={inCall ? 'Or type here…' : 'Type your answer…'}
              aria-label="Your answer"
              className="h-12 w-full rounded-full border border-line bg-cream pl-5 pr-14 text-base text-ink outline-none transition-transform placeholder:text-muted hover:border-teal focus:border-teal focus:bg-white focus:ring-4 focus:ring-teal"
            />
            <IconButton
              label="Send"
              onClick={handleSend}
              disabled={!canSend}
              className={cx(
                'absolute right-1.5 top-1/2 size-9 -translate-y-1/2 active:scale-95',
                canSend ? 'bg-teal text-white hover:bg-teal-hover' : 'bg-cream-deep text-muted',
              )}
            >
              <Send size={18} strokeWidth={2.4} />
            </IconButton>
          </div>
        </div>

        {(hasVoice || inCall) && (
          <p className={cx('mt-2 px-1 text-xs', inCall ? 'font-medium text-teal' : 'text-muted')}>{status}</p>
        )}

        {voiceError && (
          <p role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-pain-soft px-3 py-2 text-xs text-pain-ink">
            <Alert size={15} className="mt-px shrink-0" /> {voiceError}
          </p>
        )}
      </div>
    </div>
  )
}

function MiniWave() {
  return (
    <span aria-hidden="true" className="flex h-4 items-center gap-[3px]">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="h-4 w-[3px] animate-wave rounded-full bg-current" style={{ animationDelay: `${i * 0.13}s` }} />
      ))}
    </span>
  )
}
