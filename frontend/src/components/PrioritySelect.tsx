import { PRIORITIES, type Priority } from '../api';
import styles from './PrioritySelect.module.css';

interface Props {
  value: Priority;
  onChange: (priority: Priority) => void;
  disabled?: boolean;
  label: string;
  large?: boolean; // as tall as the new-task input
}

export function PrioritySelect({ value, onChange, disabled, label, large }: Props) {
  return (
    <select
      className={`${styles.select} ${large ? styles.large : ''}`}
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
