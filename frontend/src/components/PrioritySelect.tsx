import { PRIORITIES, type Priority } from '../api';

interface Props {
  value: Priority;
  onChange: (priority: Priority) => void;
  disabled?: boolean;
  label: string;
}

export function PrioritySelect({ value, onChange, disabled, label }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value) as Priority)}
      disabled={disabled}
      aria-label={label}
    >
      {PRIORITIES.map((p) => (
        <option key={p.value} value={p.value}>
          {p.label}
        </option>
      ))}
    </select>
  );
}
