// Lightweight toast store (no dependency, no context threading).
// Usage: import { toast } from '../utils/toast'; toast.success('Saved!');

let listeners = [];
let toasts = [];
let idCounter = 0;

const emit = () => {
  listeners.forEach((listener) => listener(toasts));
};

const remove = (id) => {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
};

const push = (message, type, duration) => {
  const id = ++idCounter;
  toasts = [...toasts, { id, message, type }];
  emit();
  if (duration > 0) {
    setTimeout(() => remove(id), duration);
  }
  return id;
};

export const toast = {
  success: (message, duration = 4000) => push(message, 'success', duration),
  error: (message, duration = 6000) => push(message, 'error', duration),
  info: (message, duration = 4000) => push(message, 'info', duration),
  dismiss: remove,
};

export const subscribeToasts = (listener) => {
  listeners.push(listener);
  listener(toasts);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
};
