/* Icon set — clean 24x24 stroke icons */
import * as React from 'react';

export interface IconProps {
  size?: number;
  stroke?: number;
  fill?: string;
  d?: string;
  paths?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  title?: string;
}

export const Icon = ({ d, paths, size = 18, fill, stroke = 2, ...rest }: IconProps) => (
  <svg
    className="ico"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill || 'none'}
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}
  >
    {d ? <path d={d} /> : paths}
  </svg>
);

export type IconComponent = (p?: IconProps) => React.JSX.Element;

export const I: Record<string, IconComponent> = {
  dashboard: (p = {}) => <Icon {...p} paths={<><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>} />,
  capture: (p = {}) => <Icon {...p} paths={<><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/></>} />,
  invoice: (p = {}) => <Icon {...p} paths={<><path d="M6 2.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V4a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M14 2.5V7h4"/><path d="M9 13h6M9 16.5h4M9.5 9.5h2"/></>} />,
  approve: (p = {}) => <Icon {...p} paths={<><path d="M9 12.5l2.2 2.2L15.5 10"/><path d="M12 3l7.5 3v5.5c0 4.5-3 7.7-7.5 9.5-4.5-1.8-7.5-5-7.5-9.5V6L12 3Z"/></>} />,
  reports: (p = {}) => <Icon {...p} paths={<><path d="M4 20V4M4 20h16"/><rect x="7.5" y="11" width="3" height="6" rx="0.5"/><rect x="13.5" y="7" width="3" height="10" rx="0.5"/></>} />,
  audit: (p = {}) => <Icon {...p} paths={<><circle cx="11" cy="11" r="7"/><path d="M11 7.5V11l2.5 1.5"/><path d="M20 20l-3.5-3.5"/></>} />,
  users: (p = {}) => <Icon {...p} paths={<><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 5.2a3 3 0 0 1 0 5.6M17 14c2.3.4 4 2.3 4 5"/></>} />,
  search: (p = {}) => <Icon {...p} paths={<><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>} />,
  bell: (p = {}) => <Icon {...p} paths={<><path d="M18 8.5a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5Z"/><path d="M13.5 19a2 2 0 0 1-3.5 0"/></>} />,
  plus: (p = {}) => <Icon {...p} d="M12 5v14M5 12h14" />,
  minus: (p = {}) => <Icon {...p} d="M5 12h14" />,
  upload: (p = {}) => <Icon {...p} paths={<><path d="M12 15V4M8 8l4-4 4 4"/><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></>} />,
  download: (p = {}) => <Icon {...p} paths={<><path d="M12 4v11M8 11l4 4 4-4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></>} />,
  filter: (p = {}) => <Icon {...p} d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" />,
  chevR: (p = {}) => <Icon {...p} d="M9 6l6 6-6 6" />,
  chevD: (p = {}) => <Icon {...p} d="M6 9l6 6 6-6" />,
  chevL: (p = {}) => <Icon {...p} d="M15 6l-6 6 6 6" />,
  check: (p = {}) => <Icon {...p} d="M5 12.5l4.5 4.5L19 7" />,
  x: (p = {}) => <Icon {...p} d="M6 6l12 12M18 6L6 18" />,
  dots: (p = {}) => <Icon {...p} paths={<><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/></>} />,
  clock: (p = {}) => <Icon {...p} paths={<><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>} />,
  doc: (p = {}) => <Icon {...p} paths={<><path d="M6 2.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V4a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M14 2.5V7h4"/></>} />,
  flag: (p = {}) => <Icon {...p} paths={<><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></>} />,
  alert: (p = {}) => <Icon {...p} paths={<><path d="M12 3.5 21 19H3L12 3.5Z"/><path d="M12 9.5v4M12 16.5h.01"/></>} />,
  settings: (p = {}) => <Icon {...p} paths={<><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.4 5.6l-2 2M7.6 16.4l-2 2M18.4 18.4l-2-2M7.6 7.6l-2-2"/></>} />,
  logout: (p = {}) => <Icon {...p} paths={<><path d="M14 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h8"/><path d="M17 8l4 4-4 4M9 12h12"/></>} />,
  arrowUp: (p = {}) => <Icon {...p} d="M12 19V5M6 11l6-6 6 6" size={p.size ?? 14} />,
  arrowDown: (p = {}) => <Icon {...p} d="M12 5v14M6 13l6 6 6-6" size={p.size ?? 14} />,
  arrowR: (p = {}) => <Icon {...p} d="M5 12h14M13 6l6 6-6 6" />,
  scan: (p = {}) => <Icon {...p} paths={<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M4 12h16"/></>} />,
  link: (p = {}) => <Icon {...p} paths={<><path d="M9.5 14.5l5-5M8 11l-2 2a3 3 0 0 0 4.2 4.2l2-2M16 13l2-2a3 3 0 0 0-4.2-4.2l-2 2"/></>} />,
  building: (p = {}) => <Icon {...p} paths={<><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/></>} />,
  calendar: (p = {}) => <Icon {...p} paths={<><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/></>} />,
  tag: (p = {}) => <Icon {...p} paths={<><path d="M3 11V4.5A1.5 1.5 0 0 1 4.5 3H11l9 9-7.5 7.5L3 11Z"/><circle cx="7.5" cy="7.5" r="1.3"/></>} />,
  eye: (p = {}) => <Icon {...p} paths={<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></>} />,
  edit: (p = {}) => <Icon {...p} paths={<><path d="M14 5l5 5M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z"/></>} />,
  trash: (p = {}) => <Icon {...p} paths={<><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></>} />,
  refresh: (p = {}) => <Icon {...p} paths={<><path d="M20 11a8 8 0 0 0-14-4.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4.5L20 15M20 20v-5h-5"/></>} />,
  send: (p = {}) => <Icon {...p} d="M21 4 3 11l7 2.5L13 21l8-17Z" />,
  inbox: (p = {}) => <Icon {...p} paths={<><path d="M4 13l2.5-8h11L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Z"/><path d="M4 13h5l1 2.5h4L15 13h5"/></>} />,
  shield: (p = {}) => <Icon {...p} d="M12 3l7.5 3v5.5c0 4.5-3 7.7-7.5 9.5-4.5-1.8-7.5-5-7.5-9.5V6L12 3Z" />,
  briefcase: (p = {}) => <Icon {...p} paths={<><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M3 12.5h18"/></>} />,
  pin: (p = {}) => <Icon {...p} paths={<><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></>} />,
  history: (p = {}) => <Icon {...p} paths={<><path d="M4 10a8 8 0 1 1 1.5 6"/><path d="M3 20v-5h5"/><path d="M12 8v4.5l3 1.5"/></>} />,
  zap: (p = {}) => <Icon {...p} d="M13 3 5 13h5l-1 8 8-10h-5l1-8Z" />,
  sun: (p = {}) => <Icon {...p} paths={<><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.4 5.6l-1.4 1.4M7 17l-1.4 1.4M18.4 18.4 17 17M7 7 5.6 5.6"/></>} />,
  moon: (p = {}) => <Icon {...p} d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
};
