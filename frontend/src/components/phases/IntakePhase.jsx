'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession, PHASES } from '@/contexts/SessionContext'
import { useVapi } from '@/contexts/VapiContext'
import Button from '@/components/ui/Button'
import { TextField, ChoicePills } from '@/components/ui/Fields'
import { ArrowRight, ArrowLeft } from '@/components/ui/icons'

const CARDS = 2

export default function IntakePhase() {
  const { intake, setIntake, setPhase } = useSession()
  const { stopSession } = useVapi()
  const [form, setForm] = useState(intake)
  const [card, setCard] = useState(0)
  const [touchedAge, setTouchedAge] = useState(false)
  const ageRef = useRef(null)
  const firstOptionalRef = useRef(null)

  const ageNum = Number(form.age)
  const ageValid = form.age !== '' && Number.isInteger(ageNum) && ageNum >= 1 && ageNum <= 120
  const aboutValid = ageValid && Boolean(form.biologicalSex)
  const update = (key, val) => setForm((p) => ({ ...p, [key]: val }))
  const hasOptional = Boolean(form.painOnset || form.chronicConditions.trim() || form.medications.trim())

  // Focus the first field on desktop; on touch screens this would pop the
  // keyboard over the card before the patient has read it.
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: fine)').matches) return
    const el = card === 0 ? ageRef.current : firstOptionalRef.current
    el?.focus({ preventScroll: true })
  }, [card])

  const next = () => {
    setTouchedAge(true)
    if (aboutValid) setCard(1)
  }

  const submit = () => {
    if (!aboutValid) { setCard(0); return }
    stopSession()
    setIntake(form)
    setPhase(PHASES.PAIN_SELECT)
  }

  const showAgeError = (touchedAge || form.age.length >= 3) && form.age !== '' && !ageValid

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => { e.preventDefault(); if (card === 0) { next() } else { submit() } }}
      noValidate
    >
      {/* Progress within this step */}
      <div className="flex items-center gap-3 px-6 pt-6 sm:px-8 sm:pt-8">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {Array.from({ length: CARDS }).map((_, i) => (
            <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
              <span className={`block h-full rounded-full bg-teal transition-transform duration-500 ${i <= card ? 'w-full' : 'w-0'}`} />
            </span>
          ))}
        </div>
        <span className="text-xs font-semibold text-muted">{card + 1} of {CARDS}</span>
      </div>

      <div className="panel-scroll scrollbar-soft min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-5 sm:px-8">
        {card === 0 ? (
          <div key="about">
            <h2 className="font-display text-[28px] leading-tight font-semibold tracking-[-0.02em]">A little about you</h2>
            <p className="mt-1.5 text-[15px] text-muted">This helps the questions fit you. Just two things.</p>

            <TextField
              ref={ageRef}
              className="mt-6"
              label="How old are you?"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={3}
              placeholder="e.g. 34"
              value={form.age}
              onChange={(e) => update('age', e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={() => setTouchedAge(true)}
              error={showAgeError ? 'Please enter an age between 1 and 120.' : ''}
              inputClassName="max-w-[160px]"
            />

            <ChoicePills
              className="mt-6"
              label="Biological sex"
              options={['Male', 'Female', 'Other']}
              value={form.biologicalSex}
              onChange={(v) => update('biologicalSex', v)}
            />
          </div>
        ) : (
          <div key="more">
            <h2 className="font-display text-[28px] leading-tight font-semibold tracking-[-0.02em]">Anything else worth knowing?</h2>
            <p className="mt-1.5 text-[15px] text-muted">All optional. Skip anything you’re not sure about.</p>

            <ChoicePills
              className="mt-6"
              label="How did the pain start?"
              optional
              options={['Sudden', 'Gradual', 'On and off']}
              value={form.painOnset}
              onChange={(v) => update('painOnset', v)}
            />

            <TextField
              ref={firstOptionalRef}
              className="mt-6"
              label="Ongoing health conditions"
              optional
              placeholder="e.g. diabetes, arthritis"
              value={form.chronicConditions}
              onChange={(e) => update('chronicConditions', e.target.value)}
            />

            <TextField
              className="mt-5"
              label="Medicines you take"
              optional
              placeholder="e.g. ibuprofen, metformin"
              value={form.medications}
              onChange={(e) => update('medications', e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-line px-6 py-4 sm:px-8">
        {card === 1 && (
          <Button variant="quiet" onClick={() => setCard(0)} iconLeft={<ArrowLeft size={18} />}>
            Back
          </Button>
        )}
        <Button
          type="submit"
          className="ml-auto min-w-[150px] flex-1 sm:flex-none"
          disabled={card === 0 && !aboutValid}
          iconRight={<ArrowRight size={18} />}
        >
          {card === 0 ? 'Next' : hasOptional ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
    </form>
  )
}
