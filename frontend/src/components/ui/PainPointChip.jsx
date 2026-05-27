'use client'

export default function PainPointChip({ region, onRemove }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '3px 10px',
      background: 'rgba(0,40,90,0.4)',
      border: '1px solid rgba(0,170,255,0.2)',
      borderRadius: '20px',
      fontSize: '12px',
      color: 'rgba(125,212,248,0.85)',
      whiteSpace: 'nowrap',
      fontWeight: 300,
      backdropFilter: 'blur(4px)',
    }}>
      <span style={{
        width: '5px', height: '5px', borderRadius: '50%',
        background: '#ef4444', display: 'inline-block',
        boxShadow: '0 0 5px rgba(239,68,68,0.7)',
        animation: 'pulse 2s ease-in-out infinite',
        flexShrink: 0,
      }} />
      {region}
      {onRemove && (
        <button
          onClick={() => onRemove(region)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(160,200,220,0.4)', fontSize: '13px', lineHeight: 1,
            padding: '0 1px', marginLeft: '1px',
            transition: 'color 0.2s',
          }}
        >×</button>
      )}
    </span>
  )
}
