export type ToastVariant = 'info' | 'success' | 'error';

type ToastProps = {
  variant: ToastVariant;
  message: string;
  closing?: boolean;
  onClose: () => void;
};

export function Toast(props: ToastProps) {
  const classes = ['toast', props.variant, props.closing ? 'closing' : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role={props.variant === 'error' ? 'alert' : 'status'}>
      <span>{props.message}</span>
      {props.variant === 'error' && (
        <button type="button" className="toastClose" aria-label="閉じる" onClick={props.onClose}>
          ×
        </button>
      )}
    </div>
  );
}
