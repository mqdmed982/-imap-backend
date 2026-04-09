import React from 'react';

const CIRCUMFERENCE = 2 * Math.PI * 22;

export function DonutChart({ percent = 0, color = '#378ADD', label }) {
  const dash = (percent / 100) * CIRCUMFERENCE;
  return (
    <div style={{ textAlign: 'center', padding: '12px 8px' }}>
      <svg width={64} height={64} viewBox="0 0 56 56" style={{ display: 'block', margin: '0 auto 6px' }}>
        <circle cx={28} cy={28} r={22} fill="none" stroke="#e5e7eb" strokeWidth={7} />
        <circle
          cx={28} cy={28} r={22}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
          strokeDashoffset={CIRCUMFERENCE * 0.25}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x={28} y={33} textAnchor="middle" fontSize={13} fontWeight={500} fill="#374151">
          {Math.round(percent)}%
        </text>
      </svg>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
    </div>
  );
}
