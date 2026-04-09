import React from 'react';

const BADGE_STYLES = {
  inbox:     { background: '#E6F1FB', color: '#0C447C', label: 'INBOX' },
  spam:      { background: '#FCEBEB', color: '#791F1F', label: 'SPAM' },
  personal:  { background: '#FAEEDA', color: '#633806', label: 'PERSONAL' },
  important: { background: '#EAF3DE', color: '#27500A', label: 'IMPORTANT' },
};

export function Badge({ type }) {
  const style = BADGE_STYLES[type] || { background: '#F1EFE8', color: '#444441', label: type.toUpperCase() };
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 500,
      padding: '2px 7px',
      borderRadius: 4,
      background: style.background,
      color: style.color,
      whiteSpace: 'nowrap',
    }}>
      {style.label}
    </span>
  );
}
