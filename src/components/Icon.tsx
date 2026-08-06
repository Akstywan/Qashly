import React from 'react';

const bsIconMap: Record<string, string> = {
  plus: 'plus-lg',
  download: 'download',
  upload: 'upload',
  trash: 'trash3',
  edit: 'pencil-square',
  search: 'search',
  filter: 'funnel',
  wallet: 'wallet2',
  coins: 'cash-coin',
  x: 'x-lg',
  moon: 'moon-stars',
  sun: 'sun',
  user: 'person-circle',
  shield: 'shield-check',
  chart: 'bar-chart-line',
  logout: 'box-arrow-right',
  check: 'check-lg',
  key: 'key',
  'file-text': 'file-earmark-text',
  settings: 'gear',
  transfer: 'arrow-left-right',
  accounts: 'bank',
  warning: 'exclamation-triangle-fill',
  info: 'info-circle-fill',
  success: 'check-circle-fill',
  card: 'credit-card-2-front',
  bank: 'bank'
};

interface IconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Icon: React.FC<IconProps> = ({ name, className = '', style }) => {
  const bsName = bsIconMap[name] || name;
  return (
    <i
      className={`bi bi-${bsName} ${className}`}
      style={{
        fontSize: '1.05em',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        ...style
      }}
      aria-hidden="true"
    />
  );
};

export default Icon;
