'use client'

export default function PainPointChip({ region, onRemove }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 12px',
      background: '#0b2040',
      border: '1px solid #00aaff',
      borderRadius: '20px',
      fontSize: '12px',
      color: '#00d0ff',
      fontFamily: 'monospace',
      letterSpacing: '0.03em',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: '#ef4444', display: 'inline-block',
        boxShadow: '0 0 6px #ef4444',
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
      {region}
      {onRemove && (
        <button
          onClick={() => onRemove(region)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#5a90b0', fontSize: '14px', lineHeight: 1,
            padding: '0 2px', marginLeft: '2px',
          }}
        >×</button>
      )}
    </span>
  )
}
