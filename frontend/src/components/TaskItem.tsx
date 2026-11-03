import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTask, type Task, type TaskChanges } from '../api';
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

  // While a change is pending every control in the row is disabled, so none can start another.
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
          disabled={mutation.isPending}
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
            <button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={mutation.isPending}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <span className={task.done === 1 ? styles.done : undefined}>{task.title}</span>
            <button type="button" onClick={startEditing} disabled={mutation.isPending}>
              Edit
            </button>
          </>
        )}
        <PrioritySelect
          value={task.priority}
          onChange={(priority) => change({ priority })}
          disabled={mutation.isPending}
          label={`Priority of "${task.title}"`}
        />
        <time dateTime={task.createdAt}>{new Date(task.createdAt).toLocaleString()}</time>
      </div>
      {validationError && (
        <p className={styles.validation} role="alert">
          {validationError}
        </p>
      )}
      {mutation.isError && (
        <div className={styles.alert} role="alert">
          Could not update task: {mutation.error.message}
        </div>
      )}
    </li>
  );
}
