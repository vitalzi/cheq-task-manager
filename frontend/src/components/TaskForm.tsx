import { useId, useState, type FormEvent, type Ref } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTask, type Priority } from '../api';
import { PrioritySelect } from './PrioritySelect';
import styles from './TaskForm.module.css';

export function TaskForm({ inputRef }: { inputRef?: Ref<HTMLInputElement> }) {
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
      setPriority(1);
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
      <div className={styles.composer}>
        <label className="sr-only" htmlFor={inputId}>
          New task
        </label>
        <input
          id={inputId}
          ref={inputRef}
          className={styles.input}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setValidationError(null);
          }}
          placeholder="Add a task…"
          aria-invalid={validationError !== null}
          aria-describedby={validationError ? errorId : undefined}
        />
        <div className={styles.footer}>
          <PrioritySelect value={priority} onChange={setPriority} disabled={mutation.isPending} />
          <div className={styles.actions}>
            <span className={styles.hint} aria-hidden="true">
              Enter ↵
            </span>
            <button className={styles.submit} type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </div>
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
