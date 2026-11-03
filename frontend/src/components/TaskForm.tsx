import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTask, type Priority } from '../api';
import { PrioritySelect } from './PrioritySelect';
import styles from './TaskForm.module.css';

export function TaskForm() {
  const queryClient = useQueryClient();
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
      <div className={styles.row}>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setValidationError(null);
          }}
          placeholder="New task title"
          aria-label="Task title"
        />
        <PrioritySelect value={priority} onChange={setPriority} disabled={mutation.isPending} label="Priority" />
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Adding…' : 'Add task'}
        </button>
      </div>
      {validationError && (
        <p className={styles.validation} role="alert">
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
