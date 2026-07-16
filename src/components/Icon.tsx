import React from 'react';

const icons: Record<string, string> = {
  plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
  download: '<path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>',
  upload: '<path d="M12 15V3"></path><path d="m7 8 5-5 5 5"></path><path d="M5 21h14"></path>',
  trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 15h10l1-15"></path><path d="M10 11v6"></path><path d="M14 11v6"></path>',
  edit: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>',
  search: '<circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path>',
  filter: '<path d="M4 6h16"></path><path d="M7 12h10"></path><path d="M10 18h4"></path>',
  wallet: '<path d="M20 7H5a2 2 0 0 0 0 4h15v8H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16Z"></path><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z"></path>',
  coins: '<circle cx="8" cy="8" r="5"></circle><path d="M13.5 9.5A5 5 0 1 1 10 17"></path><path d="M8 6v4"></path><path d="M15 13v4"></path>',
  x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
  moon: '<path d="M21 13.8A8.5 8.5 0 1 1 10.2 3a7 7 0 0 0 10.8 10.8Z"></path>',
  sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>',
  user: '<path d="M19 21a7 7 0 0 0-14 0"></path><circle cx="12" cy="8" r="4"></circle>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"></path><path d="m9 12 2 2 4-4"></path>',
  chart: '<path d="M3 3v18h18"></path><path d="M7 15v2"></path><path d="M12 10v7"></path><path d="M17 6v11"></path>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="M16 17l5-5-5-5"></path><path d="M21 12H9"></path>',
  check: '<polyline points="20 6 9 17 4 12"></polyline>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>',
  "file-text": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>'
};

interface IconProps {
  name: string;
}

export const Icon: React.FC<IconProps> = ({ name }) => {
  return (
    <span className="icon" data-icon={name}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        dangerouslySetInnerHTML={{ __html: icons[name] || '' }}
      />
    </span>
  );
};
export default Icon;
