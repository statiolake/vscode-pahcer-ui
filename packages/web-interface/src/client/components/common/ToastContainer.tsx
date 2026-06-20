import { Toast, type ToastVariant } from './Toast';

export type ToastItem = {
  id: number;
  variant: ToastVariant;
  message: string;
  closing: boolean;
};

type ToastContainerProps = {
  toasts: ToastItem[];
  onClose: (id: number) => void;
};

export function ToastContainer(props: ToastContainerProps) {
  if (props.toasts.length === 0) {
    return null;
  }

  return (
    <div className="toastContainer" aria-live="polite" aria-relevant="additions">
      {props.toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          message={toast.message}
          closing={toast.closing}
          onClose={() => props.onClose(toast.id)}
        />
      ))}
    </div>
  );
}

export type { ToastVariant };
