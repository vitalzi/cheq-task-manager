import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTask, type Priority } from '../api';
import { PrioritySelect } from './PrioritySelect';
import styles from './TaskForm.module.css';

export function TaskForm() {
  const queryClient = useQueryClient();
  const inputId = useId();
  const errorId = useId();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      setTitle('');
      return queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Enter key submits even when the button is disabled, so guard here too.
    if (mutation.isPending) return;
    if (title.trim() === '') {
      setValidationError('Title must not be empty.');
      return;
    }
    setValidationError(null);
    mutation.mutate({ title, priority });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.label} htmlFor={inputId}>
        New task
      </label>
      <div className={styles.row}>
        <input
          id={inputId}
          className={styles.input}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setValidationError(null);
          }}
          placeholder="Type a task and press Enter"
          aria-invalid={validationError !== null}
          aria-describedby={validationError ? errorId : undefined}
        />
        <PrioritySelect value={priority} onChange={setPriority} disabled={mutation.isPending} label="Priority" large />
        <button className={styles.submit} type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
      {validationError && (
        <p className={styles.validation} id={errorId} role="alert">
          {validationError}
        </p>
      )}
      {mutation.isError && (
        <div className={styles.alert} role="alert">
          Could not add task: {mutation.error.message}
        </div>
      )}
    </form>
  );
}
