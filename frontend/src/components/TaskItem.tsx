import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteTask, updateTask, type Task, type TaskChanges } from '../api';
import { PrioritySelect } from './PrioritySelect';
import styles from './TaskItem.module.css';

export function TaskItem({ task }: { task: Task }) {
  const queryClient = useQueryClient();
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
    <li className={styles.item}>
      <div className={styles.row}>
        <input
          type="checkbox"
          checked={task.done === 1}
          onChange={(e) => change({ done: e.target.checked ? 1 : 0 })}
          disabled={pending}
          aria-label={`Mark "${task.title}" as done`}
        />
        {editing ? (
          <form className={styles.edit} onSubmit={handleSave} noValidate>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setValidationError(null);
              }}
              aria-label="Task title"
              autoFocus
            />
            <button type="submit" disabled={pending}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <span className={task.done === 1 ? styles.done : undefined}>{task.title}</span>
            <button type="button" onClick={startEditing} disabled={pending}>
              Edit
            </button>
          </>
        )}
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
          <button type="button" onClick={() => setConfirmingDelete(true)} disabled={pending}>
            Delete
          </button>
        )}
        <PrioritySelect
          value={task.priority}
          onChange={(priority) => change({ priority })}
          disabled={pending}
          label={`Priority of "${task.title}"`}
        />
        <time dateTime={task.createdAt}>{new Date(task.createdAt).toLocaleString()}</time>
      </div>
      {validationError && (
        <p className={styles.validation} role="alert">
          {validationError}
        </p>
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
