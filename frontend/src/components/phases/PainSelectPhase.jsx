'use client'

import { useSession, PHASES } from '@/contexts/SessionContext'
import PainPointChip from '@/components/ui/PainPointChip'

export default function PainSelectPhase() {
  const { painPoints, removePainPoint, setPhase } = useSession()
  const hasPoints = painPoints.length > 0

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      display: 'flex', flexDirection: 'column',
      pointerEvents: 'none',
    }}>
      {/* Subtle top hint */}
      <div style={{
        padding: '18px 20px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
      }}>
        <p style={{
          fontSize: '12px',
          color: 'rgba(160,200,220,0.55)',
          fontWeight: 300, margin: 0,
          letterSpacing: '0.06em',
        }}>
          tap the body to mark where it hurts · drag to rotate
        </p>
        <button
          onClick={() => setPhase(PHASES.INTAKE)}
          style={{
            pointerEvents: 'auto', flexShrink: 0,
            background: 'none', border: '1px solid rgba(0,170,255,0.15)', borderRadius: '6px',
            color: 'rgba(160,200,220,0.55)', fontSize: '11px', letterSpacing: '0.08em',
            padding: '5px 10px', cursor: 'pointer',
          }}
        >
          ← edit details
        </button>
      </div>

      {/* Bottom bar */}
      <div style={{
        marginTop: 'auto',
        padding: '16px 20px 28px',
        background: 'linear-gradient(to top, rgba(3,10,22,0.96) 70%, transparent)',
        pointerEvents: 'auto',
      }}>
        {/* Chips row */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '7px',
          minHeight: hasPoints ? 'auto' : '0',
          marginBottom: hasPoints ? '14px' : '0',
          transition: 'all 0.3s',
        }}>
          {painPoints.map((p) => (
            <PainPointChip key={p.region} region={p.region} onRemove={removePainPoint} />
          ))}
        </div>

        {!hasPoints && (
          <p style={{
            textAlign: 'center',
            color: 'rgba(90,144,176,0.45)',
            fontSize: '13px', fontStyle: 'italic',
            marginBottom: '14px',
          }}>
            no regions selected
          </p>
        )}

        <button
          onClick={() => setPhase(PHASES.CHAT)}
          disabled={!hasPoints}
          style={{
            width: '100%', padding: '12px',
            background: hasPoints ? 'rgba(0,80,200,0.15)' : 'transparent',
            border: `1px solid ${hasPoints ? 'rgba(0,170,255,0.45)' : 'rgba(0,170,255,0.1)'}`,
            borderRadius: '10px',
            color: hasPoints ? '#7dd4f8' : 'rgba(160,200,220,0.22)',
            fontSize: '13px', letterSpacing: '0.07em',
            cursor: hasPoints ? 'pointer' : 'default',
            transition: 'all 0.25s',
            backdropFilter: 'blur(6px)',
          }}
        >
          {hasPoints
            ? `continue with ${painPoints.length} region${painPoints.length > 1 ? 's' : ''} →`
            : 'select at least one region'}
        </button>
      </div>
    </div>
  )
}
