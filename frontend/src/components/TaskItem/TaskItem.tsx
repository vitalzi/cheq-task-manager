import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PRIORITIES, deleteTask, updateTask, type Priority, type Task, type TaskChanges } from '../../api/api';
import { formatCreated } from '../../lib/time';
import { PencilIcon, PriorityIcon, TrashIcon } from '../Icons/Icons';
import { PrioritySelect } from '../PrioritySelect/PrioritySelect';
import styles from './TaskItem.module.css';

const PRIORITY_TEXT = ['high', 'medium', 'low'] as const;

export type RowMode = 'view' | 'edit' | 'confirm';

interface Props {
  task: Task;
  byDay: boolean;
  mode: RowMode;
  onModeChange: (mode: RowMode) => void;
  onDeleted: () => void;
}

export function TaskItem({ task, byDay, mode, onModeChange, onDeleted }: Props) {
  const queryClient = useQueryClient();
  const errorId = useId();
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateTask,
    onSuccess: () => {
      onModeChange('view');
      return queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const removal = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      onDeleted();
      return queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // While a change is pending every control in the row is disabled, so none can start another.
  const pending = mutation.isPending || removal.isPending;
  const change = (changes: TaskChanges) => mutation.mutate({ id: task.id, changes });
  const editing = mode === 'edit';
  const confirming = mode === 'confirm';
  const done = task.done === 1;
  const priorityLabel = PRIORITIES.find((p) => p.value === task.priority)!;

  function startEditing() {
    setTitle(task.title);
    setPriority(task.priority);
    setValidationError(null);
    mutation.reset();
    onModeChange('edit');
  }

  function startConfirming() {
    removal.reset();
    onModeChange('confirm');
  }

  function stopEditing() {
    if (!pending) onModeChange('view');
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    if (title.trim() === '') {
      setValidationError('Title must not be empty.');
      return;
    }
    setValidationError(null);
    change({ title, priority });
  }

  return (
    <li className={`${styles.item} ${editing ? styles.editing : ''} ${confirming ? styles.confirming : ''}`} data-task-id={task.id}>
      {editing ? (
        <form
          className={styles.edit}
          onSubmit={handleSave}
          onKeyDown={(e) => e.key === 'Escape' && stopEditing()}
          noValidate
        >
          <input
            className={styles.editInput}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setValidationError(null);
            }}
            aria-label="Edit task title"
            aria-invalid={validationError !== null}
            aria-describedby={validationError ? errorId : undefined}
            autoFocus
          />
          {validationError && (
            <p className={styles.validation} id={errorId} role="alert">
              {validationError}
            </p>
          )}
          <div className={styles.editFooter}>
            <PrioritySelect value={priority} onChange={setPriority} disabled={pending} />
            <div className={styles.editActions}>
              <span className={styles.hint} aria-hidden="true">
                Esc to cancel
              </span>
              <button className={styles.cancel} type="button" onClick={stopEditing} disabled={pending}>
                Cancel
              </button>
              <button className={styles.save} type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      ) : confirming ? (
        <div
          className={styles.confirm}
          role="group"
          aria-label={`Confirm deleting ${task.title}`}
          aria-busy={removal.isPending}
          onKeyDown={(e) => e.key === 'Escape' && !pending && onModeChange('view')}
        >
          <span className={styles.confirmText}>
            Delete <strong>{task.title}</strong>?
          </span>
          <div className={styles.confirmActions}>
            <button className={styles.confirmCancel} type="button" onClick={() => onModeChange('view')} disabled={pending} autoFocus>
              Cancel
            </button>
            <button className={styles.confirmDelete} type="button" onClick={() => removal.mutate(task.id)} disabled={pending}>
              {removal.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.row}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={done}
              onChange={(e) => change({ done: e.target.checked ? 1 : 0 })}
              disabled={pending}
              aria-label={`${done ? 'Mark as not done' : 'Mark as done'}: ${task.title}`}
            />
          </label>
          <div className={styles.text}>
            <span className={`${styles.title} ${done ? styles.done : ''}`}>{task.title}</span>
            <div className={styles.meta}>
              <PriorityIcon priority={task.priority} muted={done} label={`${priorityLabel.label} priority`} />
              <span className={done ? undefined : styles[PRIORITY_TEXT[task.priority]]} aria-hidden="true">
                {priorityLabel.short}
              </span>
              <span aria-hidden="true">·</span>
              <time dateTime={task.createdAt}>{formatCreated(task.createdAt, byDay)}</time>
            </div>
          </div>
          <button
            className={styles.icon}
            type="button"
            onClick={startEditing}
            disabled={pending}
            aria-label={`Edit ${task.title}`}
          >
            <PencilIcon />
          </button>
          <button
            className={styles.icon}
            type="button"
            onClick={startConfirming}
            disabled={pending}
            aria-label={`Delete ${task.title}`}
          >
            <TrashIcon />
          </button>
        </div>
      )}
      {removal.isError && (
        <div className={styles.alert} role="alert">
          Could not delete task: {removal.error.message}
        </div>
      )}
      {mutation.isError && (
        <div className={styles.alert} role="alert">
          Could not update task: {mutation.error.message}
        </div>
      )}
    </li>
  );
}
