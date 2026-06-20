import { type ReactNode, useEffect, useId, useLayoutEffect, useRef } from 'react';

import { focusFirstElement, trapFocus } from './focusScope';

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
  const dialogRef = useRef<HTMLElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const dismissible = props.dismissible ?? true;

  useLayoutEffect(() => {
    if (!props.open) {
      return undefined;
    }

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const dialog = dialogRef.current;
    if (dialog) {
      focusFirstElement(dialog);
    }

    return () => {
      const previouslyFocusedElement = previouslyFocusedElementRef.current;
      previouslyFocusedElementRef.current = null;

      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus({ preventScroll: true });
      }
    };
  }, [props.open]);

  useEffect(() => {
    if (!props.open) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (dismissible) {
          event.preventDefault();
          props.onClose();
        }
        return;
      }

      if (event.key === 'Tab') {
        trapFocus(event, dialogRef.current);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dismissible, props.open, props.onClose]);

  if (!props.open) {
    return null;
  }

  return (
    <div className="modalLayer">
      {dismissible ? (
        <button
          type="button"
          className="modalBackdrop"
          aria-label="閉じる"
          tabIndex={-1}
          onClick={props.onClose}
        />
      ) : (
        <div className="modalBackdrop" aria-hidden="true" />
      )}
      <section
        className="modalDialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
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
