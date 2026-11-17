'use client'

import { useState, useEffect, useCallback } from 'react'
import { pdf } from '@react-pdf/renderer'
import { useSession, PHASES } from '@/contexts/SessionContext'
import ReportDocument from '@/components/ui/ReportDocument'
import Button, { cx } from '@/components/ui/Button'
import {
  Alert, ArrowLeft, Download, Info, List, Pin, Question, Refresh, Sparkle, Steps, User,
} from '@/components/ui/icons'

const NOT_MENTIONED = 'Not mentioned'

const URGENCY = {
  low: { label: 'Low urgency', note: 'Book a routine appointment.', box: 'bg-good-soft border-good', dot: 'bg-good', text: 'text-good' },
  moderate: { label: 'Moderate urgency', note: 'Try to see a doctor soon.', box: 'bg-warn-soft border-warn', dot: 'bg-marigold', text: 'text-warn' },
  high: { label: 'High urgency — seek care soon', note: '', box: 'bg-pain-soft border-pain', dot: 'bg-pain', text: 'text-pain-ink' },
}

function SectionCard({ icon: Icon, label, children, tint = 'bg-teal-soft text-teal', delay = 0 }) {
  return (
    <section
      className=" rounded-3xl border border-line bg-white p-5 shadow-warm sm:p-6"
      style={{ animationDelay: `${delay}ms` }}
    >
      <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-semibold text-ink">
        <span className={cx('flex size-8 items-center justify-center rounded-xl', tint)}>
          <Icon size={17} />
        </span>
        {label}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, value }) {
  const missing = !value || value === NOT_MENTIONED
  return (
    <div className="grid grid-cols-[minmax(80px,0.8fr)_minmax(0,1.2fr)] gap-3 border-b border-line py-2 text-[15px] last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className={cx('min-w-0 [overflow-wrap:anywhere]', missing ? 'italic text-muted' : 'text-ink')}>{missing ? 'Not mentioned' : value}</dd>
    </div>
  )
}

function BulletList({ items, numbered }) {
  const Tag = numbered ? 'ol' : 'ul'
  return (
    <Tag className="space-y-2.5">
      {items.map((d, i) => (
        <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink">
          {numbered ? (
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-soft text-xs font-bold text-teal">{i + 1}</span>
          ) : (
            <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-peach" />
          )}
          <span>{d}</span>
        </li>
      ))}
    </Tag>
  )
}

function Skeleton() {
  const bar = 'rounded-full bg-cream-deep'
  return (
    <div role="status" aria-label="Creating your report" className="space-y-4">
      <div className="flex items-center gap-3 rounded-3xl bg-white p-5 shadow-warm">
        <span className="flex size-10 items-center justify-center rounded-full bg-marigold-soft text-warn"><Sparkle size={20} /></span>
        <div>
          <p className="font-semibold text-ink">Putting your report together…</p>
          <p className="text-sm text-muted">Summarising what you told us. This takes a few seconds.</p>
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3 rounded-3xl bg-white p-6">
          <div className={cx(bar, 'h-4 w-1/3')} />
          <div className={cx(bar, 'h-3 w-full')} />
          <div className={cx(bar, 'h-3 w-5/6')} />
          <div className={cx(bar, 'h-3 w-2/3')} />
        </div>
      ))}
    </div>
  )
}

export default function ReportPhase() {
  const { intake, painPoints, chatHistory, canvasScreenshot, report, setReport, setPhase } = useSession()
  const needsFetch = !report || report.historyLength !== chatHistory.length
  const [loading, setLoading] = useState(needsFetch)
  const [error, setError] = useState('')
  const [pdfState, setPdfState] = useState('idle')
  const data = report?.data

  // Fetches the structured summary; state is only set in the promise callbacks.
  const loadReport = useCallback(async () => {
    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intake,
        painPoints: painPoints.map((p) => ({ region: p.region })),
        history: chatHistory.map(({ role, content }) => ({ role, content })),
      }),
    })
    if (!res.ok) throw new Error(`report request failed: ${res.status}`)
    const json = await res.json()
    return json.report
  }, [intake, painPoints, chatHistory])

  const settle = useCallback((promise) => promise
    .then((r) => setReport(r, chatHistory.length))
    .catch((err) => {
      console.warn('[Report] generation failed', err)
      setError('Could not generate the report. Check your connection and try again.')
    })
    .finally(() => setLoading(false)), [chatHistory.length, setReport])

  const fetchReport = () => {
    setLoading(true)
    setError('')
    settle(loadReport())
  }

  // The initial state already shows the loader.
  useEffect(() => {
    if (needsFetch) settle(loadReport())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const downloadPdf = async () => {
    if (!data || pdfState === 'working') return
    setPdfState('working')
    try {
      const blob = await pdf(
        <ReportDocument
          intake={intake}
          painPoints={painPoints}
          chatHistory={chatHistory}
          report={data}
          canvasScreenshot={canvasScreenshot}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `findmypain-report-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      setPdfState('idle')
    } catch (err) {
      console.error('[Report] PDF generation failed', err)
      setPdfState('error')
    }
  }

  const urgency = URGENCY[data?.urgency]
  const regionDetails = data?.regions?.length ? data.regions : painPoints.map((p) => ({ region: p.region }))
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="report-surface scrollbar-soft relative z-10 min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[720px] px-4 pb-10 pt-2 sm:px-6 sm:pt-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted">{today}</p>
            <h1 className="font-display text-[34px] leading-tight font-semibold tracking-[-0.025em] text-ink sm:text-[40px]">Your pain report</h1>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setPhase(PHASES.CHAT)} iconLeft={<ArrowLeft size={16} />}>
            Add more detail
          </Button>
        </div>

        {loading ? (
          <Skeleton />
        ) : error || !data ? (
          <div role="alert" className="flex flex-col items-center gap-4 rounded-3xl bg-white px-6 py-12 text-center shadow-warm">
            <span className="flex size-12 items-center justify-center rounded-full bg-pain-soft text-pain-ink"><Alert size={22} /></span>
            <p className="max-w-sm text-[15px] text-ink">{error || 'There’s no report yet.'}</p>
            <Button onClick={fetchReport} iconLeft={<Refresh size={17} />}>Try again</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {urgency && (
              <div className={cx('flex items-start gap-3.5 rounded-3xl border p-5', urgency.box)}>
                <span className="relative mt-1.5 flex size-3 shrink-0">
                  <span className={cx('relative size-3 rounded-full', urgency.dot)} />
                </span>
                <div>
                  <p className={cx('text-lg font-semibold', urgency.text)}>{urgency.label}</p>
                  <p className="mt-0.5 text-[15px] leading-relaxed text-ink">{data.urgencyReason || urgency.note}</p>
                </div>
              </div>
            )}

            {data.redFlags?.length > 0 && (
              <div role="alert" className=" rounded-3xl border-2 border-pain bg-white p-5">
                <p className="mb-3 flex items-center gap-2 font-semibold text-pain-ink">
                  <Alert size={19} /> Warning signs you mentioned
                </p>
                <BulletList items={data.redFlags} />
                <p className="mt-3 rounded-2xl bg-pain-soft px-4 py-2.5 text-sm font-medium text-pain-ink">
                  If these are severe, sudden, or getting worse, seek emergency care now.
                </p>
              </div>
            )}

            {data.summary && (
              <SectionCard icon={Sparkle} label="Summary" tint="bg-marigold-soft text-warn" delay={60}>
                <p className="text-[16px] leading-relaxed text-ink">{data.summary}</p>
              </SectionCard>
            )}

            <div className="grid gap-4 md:grid-cols-[1fr_200px]">
              <SectionCard icon={User} label="About you" delay={100}>
                <dl>
                  <Row label="Age" value={intake?.age} />
                  <Row label="Sex" value={intake?.biologicalSex} />
                  {intake?.painOnset && <Row label="Onset" value={intake.painOnset} />}
                  <Row label="Conditions" value={intake?.chronicConditions || 'None reported'} />
                  <Row label="Medications" value={intake?.medications || 'None reported'} />
                </dl>
              </SectionCard>
              {canvasScreenshot && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={canvasScreenshot}
                  alt={`Body figure with ${painPoints.length} marked area${painPoints.length === 1 ? '' : 's'}`}
                  className="hidden h-full max-h-[300px] w-full rounded-3xl border border-line bg-cream object-contain shadow-warm md:block"
                />
              )}
            </div>

            <SectionCard icon={Pin} label={`Where it hurts · ${regionDetails.length}`} tint="bg-pain-soft text-pain-ink" delay={140}>
              <div className="space-y-4">
                {regionDetails.map((r, i) => (
                  <div key={`${r.region}-${i}`} className="rounded-2xl bg-cream p-4">
                    <p className="mb-1 flex items-center gap-2 font-semibold text-ink">
                      <span className="size-2.5 rounded-full bg-pain" /> {r.region}
                    </p>
                    <dl>
                      <Row label="Started" value={r.onset} />
                      <Row label="Feels like" value={r.character} />
                      <Row label="Severity" value={r.severity} />
                      <Row label="Spreads to" value={r.radiation} />
                      <Row label="Worse with" value={r.aggravating} />
                      <Row label="Better with" value={r.relieving} />
                      <Row label="Other symptoms" value={r.associated} />
                    </dl>
                  </div>
                ))}
              </div>
            </SectionCard>

            {data.considerations?.length > 0 && (
              <SectionCard icon={List} label="Possibilities for your doctor to consider" delay={180}>
                <BulletList items={data.considerations} />
              </SectionCard>
            )}

            {data.questionsForDoctor?.length > 0 && (
              <SectionCard icon={Question} label="Questions to ask your doctor" tint="bg-marigold-soft text-warn" delay={220}>
                <BulletList items={data.questionsForDoctor} />
              </SectionCard>
            )}

            {data.nextSteps?.length > 0 && (
              <SectionCard icon={Steps} label="Suggested next steps" delay={260}>
                <BulletList items={data.nextSteps} numbered />
              </SectionCard>
            )}

            <p className="flex items-start gap-2.5 rounded-2xl bg-warn-soft px-4 py-3 text-sm leading-relaxed text-warn">
              <Info size={17} className="mt-0.5 shrink-0" />
              This report is AI-generated from your own description and is for information only. It is not medical advice, a diagnosis or treatment. Please talk to a qualified healthcare professional.
            </p>

            {/* Actions */}
            <div className="sticky bottom-3 z-10 pt-2">
              <div className="report-actions flex gap-2 rounded-full border border-white bg-white p-1.5 shadow-lift ">
                <Button
                  size="lg"
                  className="min-w-0 flex-1 px-5"
                  onClick={downloadPdf}
                  loading={pdfState === 'working'}
                  iconLeft={<Download size={19} />}
                >
                  {pdfState === 'working' ? 'Preparing PDF…' : (
                    <>
                      <span className="sm:hidden">Download PDF</span>
                      <span className="hidden sm:inline">Download PDF for your doctor</span>
                    </>
                  )}
                </Button>
                <Button size="lg" variant="quiet" className="px-5" onClick={() => window.location.reload()} iconLeft={<Refresh size={18} />}>
                  Start over
                </Button>
              </div>
              {pdfState === 'error' && (
                <p role="alert" className="mt-2 text-center text-sm font-medium text-pain-ink">Couldn’t create the PDF. Please try again.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
