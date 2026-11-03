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
