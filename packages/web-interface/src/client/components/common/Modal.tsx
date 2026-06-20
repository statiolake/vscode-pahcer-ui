import { type ReactNode, useEffect, useId } from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
};

export function Modal(props: ModalProps) {
  const titleId = useId();
  const dismissible = props.dismissible ?? true;

  useEffect(() => {
    if (!props.open || !dismissible) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        props.onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dismissible, props.open, props.onClose]);

  if (!props.open) {
    return null;
  }

  return (
    <div className="modalBackdrop">
      {dismissible ? (
        <button
          type="button"
          className="modalBackdropButton"
          aria-label="閉じる"
          onClick={props.onClose}
        />
      ) : (
        <div className="modalBackdropButton" aria-hidden="true" />
      )}
      <section className="modalDialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="modalHeader">
          <h3 id={titleId}>{props.title}</h3>
          {dismissible && (
            <button
              type="button"
              className="modalClose"
              aria-label="閉じる"
              onClick={props.onClose}
            >
              ×
            </button>
          )}
        </header>
        <div className="modalBody">{props.children}</div>
        {props.footer && <footer className="modalFooter">{props.footer}</footer>}
      </section>
    </div>
  );
}
