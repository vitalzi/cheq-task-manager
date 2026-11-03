import { PRIORITIES, type Priority } from '../api';
import { ChevronDownIcon, PriorityIcon } from './Icons';
import styles from './PrioritySelect.module.css';

interface Props {
  value: Priority;
  onChange: (priority: Priority) => void;
  disabled?: boolean;
}

const TEXT_CLASS = ['high', 'medium', 'low'] as const;

export function PrioritySelect({ value, onChange, disabled }: Props) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>Priority</span>
      <span className={styles.control}>
        <PriorityIcon priority={value} className={styles.icon} />
        <select
          className={`${styles.select} ${styles[TEXT_CLASS[value]]}`}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) as Priority)}
          disabled={disabled}
        >
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className={styles.chevron} />
      </span>
    </label>
  );
}
