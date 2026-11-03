import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PRIORITIES, deleteTask, updateTask, type Priority, type Task, type TaskChanges } from '../api';
import { formatCreated } from '../time';
import { PencilIcon, PriorityIcon, TrashIcon } from './Icons';
import { PrioritySelect } from './PrioritySelect';
import styles from './TaskItem.module.css';

const PRIORITY_TEXT = ['high', 'medium', 'low'] as const;

export function TaskItem({ task, byDay }: { task: Task; byDay: boolean }) {
  const queryClient = useQueryClient();
  const errorId = useId();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const mutation = useMutation({
    mutationFn: updateTask,
    onSuccess: () => {
      setEditing(false);
      return queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const removal = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    onError: () => setConfirmingDelete(false),
  });

  // While a change is pending every control in the row is disabled, so none can start another.
  const pending = mutation.isPending || removal.isPending;
  const change = (changes: TaskChanges) => mutation.mutate({ id: task.id, changes });
  const done = task.done === 1;
  const priorityLabel = PRIORITIES.find((p) => p.value === task.priority)!;

  function startEditing() {
    setTitle(task.title);
    setPriority(task.priority);
    setValidationError(null);
    setConfirmingDelete(false);
    mutation.reset();
    setEditing(true);
  }

  function stopEditing() {
    if (!pending) setEditing(false);
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
    <li className={`${styles.item} ${editing ? styles.editing : ''}`}>
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
          {confirmingDelete ? (
            <span className={styles.confirm}>
              Delete?
              <button type="button" onClick={() => removal.mutate(task.id)} disabled={pending}>
                Yes
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} disabled={pending}>
                No
              </button>
            </span>
          ) : (
            <>
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
                onClick={() => setConfirmingDelete(true)}
                disabled={pending}
                aria-label={`Delete ${task.title}`}
              >
                <TrashIcon />
              </button>
            </>
          )}
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
