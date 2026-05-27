'use client'

import { useSession, PHASES } from '@/contexts/SessionContext'
import PainPointChip from '@/components/ui/PainPointChip'

export default function PainSelectPhase() {
  const { painPoints, removePainPoint, setPhase } = useSession()

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      display: 'flex', flexDirection: 'column',
      pointerEvents: 'none',
    }}>
      {/* Top instruction bar */}
      <div style={{
        padding: '16px 20px',
        background: 'linear-gradient(to bottom, rgba(4,13,26,0.9), transparent)',
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: '11px', color: '#00aaff', fontFamily: 'monospace', letterSpacing: '0.2em', marginBottom: '4px' }}>
          PAIN SELECTION MODE
        </div>
        <div style={{ fontSize: '15px', color: '#a0cce0', fontWeight: 300 }}>
          Click on the body to mark your pain points
        </div>
      </div>

      {/* Bottom panel: chips + continue */}
      <div style={{
        marginTop: 'auto',
        padding: '16px 20px 24px',
        background: 'linear-gradient(to top, rgba(4,13,26,0.97) 80%, transparent)',
        pointerEvents: 'auto',
      }}>
        {/* Selected chips */}
        {painPoints.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', color: '#5a90b0', fontFamily: 'monospace', marginBottom: '8px', letterSpacing: '0.1em' }}>
              SELECTED REGIONS ({painPoints.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {painPoints.map((p) => (
                <PainPointChip key={p.region} region={p.region} onRemove={removePainPoint} />
              ))}
            </div>
          </div>
        )}

        {painPoints.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '12px 0',
            color: '#3a6080', fontSize: '13px', fontStyle: 'italic',
          }}>
            No pain points selected yet — click on the body
          </div>
        )}

        <button
          onClick={() => setPhase(PHASES.CHAT)}
          disabled={painPoints.length === 0}
          style={{
            width: '100%', padding: '14px',
            background: painPoints.length > 0
              ? 'linear-gradient(135deg, #0055cc, #0033aa)'
              : '#0a1a2e',
            border: `1px solid ${painPoints.length > 0 ? '#00aaff' : 'rgba(0,170,255,0.15)'}`,
            borderRadius: '10px',
            color: painPoints.length > 0 ? '#e0f4ff' : '#3a6080',
            fontSize: '14px', fontFamily: 'monospace', letterSpacing: '0.1em',
            cursor: painPoints.length > 0 ? 'pointer' : 'default',
            boxShadow: painPoints.length > 0 ? '0 0 20px rgba(0,85,204,0.3)' : 'none',
            transition: 'all 0.3s',
          }}
        >
          {painPoints.length > 0
            ? `CONTINUE WITH ${painPoints.length} REGION${painPoints.length > 1 ? 'S' : ''} →`
            : 'SELECT AT LEAST ONE REGION'}
        </button>
      </div>
    </div>
  )
}
