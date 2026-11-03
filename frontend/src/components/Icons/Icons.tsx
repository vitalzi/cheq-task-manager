import type { Priority } from '../../api/api';
import styles from './Icons.module.css';

// Small inline icons, drawn on a 24px grid; they take their colour from the text (currentColor).
const props = {
  'aria-hidden': true,
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
} as const;

export const SearchIcon = ({ className }: { className?: string }) => (
  <svg {...props} className={className} width="16" height="16" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg {...props} className={className} width="14" height="14" strokeWidth="2">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const PencilIcon = () => (
  <svg {...props} width="18" height="18" strokeWidth="1.8">
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

export const TrashIcon = () => (
  <svg {...props} width="18" height="18" strokeWidth="1.8">
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13h10l1-13" />
  </svg>
);

const PRIORITY_CLASS = ['high', 'medium', 'low'] as const;

interface PriorityIconProps {
  priority: Priority;
  muted?: boolean; // a done task: every filled bar is grey
  label?: string; // when set the icon is announced as an image; otherwise it is decoration
  className?: string;
}

// Three bars like a signal meter: Low fills one, Medium two, High three.
export function PriorityIcon({ priority, muted, label, className }: PriorityIconProps) {
  const filled = 3 - priority;
  const bars = [
    { x: 0, y: 7, height: 5 },
    { x: 4.5, y: 4, height: 8 },
    { x: 9, y: 1, height: 11 },
  ];
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className={`${styles.priority} ${muted ? styles.muted : styles[PRIORITY_CLASS[priority]]} ${className ?? ''}`}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {bars.map((bar, i) => (
        <rect key={bar.x} {...bar} width="3" rx="1" className={i < filled ? styles.on : styles.off} />
      ))}
    </svg>
  );
}
