import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteTask, updateTask, type Task, type TaskChanges } from '../api';
import { dayLabel } from '../filters';
import { PencilIcon, TrashIcon } from './Icons';
import { PrioritySelect } from './PrioritySelect';
import styles from './TaskItem.module.css';

// Today and Yesterday show the time of day, older tasks the date.
function formatCreated(createdAt: string): string {
  const date = new Date(createdAt);
  return dayLabel(createdAt, new Date()) === 'Earlier'
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function TaskItem({ task }: { task: Task }) {
  const queryClient = useQueryClient();
  const errorId = useId();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateTask,
    onSuccess: () => {
      setEditing(false);
      return queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const removal = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    onError: () => setConfirmingDelete(false),
  });

  // While a change is pending every control in the row is disabled, so none can start another.
  const pending = mutation.isPending || removal.isPending;
  const change = (changes: TaskChanges) => mutation.mutate({ id: task.id, changes });

  function startEditing() {
    setTitle(task.title);
    setValidationError(null);
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
    change({ title });
  }

  return (
    <li className={`${styles.item} ${editing ? styles.editing : ''}`}>
      {editing ? (
        <form className={styles.edit} onSubmit={handleSave} noValidate>
          <div className={styles.editRow}>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setValidationError(null);
              }}
              onKeyDown={(e) => e.key === 'Escape' && stopEditing()}
              aria-label="Edit task title"
              aria-invalid={validationError !== null}
              aria-describedby={validationError ? errorId : undefined}
              autoFocus
            />
            <button className={styles.save} type="submit" disabled={pending}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button className={styles.cancel} type="button" onClick={stopEditing} disabled={pending}>
              Cancel
            </button>
          </div>
          {validationError && (
            <p className={styles.validation} id={errorId} role="alert">
              {validationError}
            </p>
          )}
          <p className={styles.hint}>Enter to save · Esc to cancel</p>
        </form>
      ) : (
        <div className={styles.row}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={task.done === 1}
              onChange={(e) => change({ done: e.target.checked ? 1 : 0 })}
              disabled={pending}
              aria-label={`${task.done === 1 ? 'Mark as not done' : 'Mark as done'}: ${task.title}`}
            />
          </label>
          <span className={`${styles.title} ${task.done === 1 ? styles.done : ''}`}>{task.title}</span>
          <PrioritySelect
            value={task.priority}
            onChange={(priority) => change({ priority })}
            disabled={pending}
            label={`Priority of "${task.title}"`}
          />
          <time className={styles.time} dateTime={task.createdAt}>
            {formatCreated(task.createdAt)}
          </time>
          <button
            className={styles.icon}
            type="button"
            onClick={startEditing}
            disabled={pending}
            aria-label={`Edit ${task.title}`}
          >
            <PencilIcon />
          </button>
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
            <button
              className={styles.icon}
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={pending}
              aria-label={`Delete ${task.title}`}
            >
              <TrashIcon />
            </button>
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
