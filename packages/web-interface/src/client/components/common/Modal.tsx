import { type ReactNode, useEffect, useId, useLayoutEffect, useRef } from 'react';

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
      const firstFocusableElement = getFocusableElements(dialog)[0] ?? dialog;
      firstFocusableElement.focus({ preventScroll: true });
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

const focusableSelector = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  'details > summary:first-of-type',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex^="-"])',
].join(',');

function trapFocus(event: KeyboardEvent, dialog: HTMLElement | null) {
  if (!dialog) {
    return;
  }

  const focusableElements = getFocusableElements(dialog);
  if (focusableElements.length === 0) {
    event.preventDefault();
    dialog.focus({ preventScroll: true });
    return;
  }

  const firstFocusableElement = focusableElements[0];
  const lastFocusableElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement;
  const activeElementIsDialog = activeElement === dialog;
  const activeElementIsInsideDialog =
    activeElement instanceof Node && dialog.contains(activeElement);

  if (event.shiftKey) {
    if (
      !activeElementIsInsideDialog ||
      activeElementIsDialog ||
      activeElement === firstFocusableElement
    ) {
      event.preventDefault();
      lastFocusableElement.focus({ preventScroll: true });
    }
    return;
  }

  if (
    !activeElementIsInsideDialog ||
    activeElementIsDialog ||
    activeElement === lastFocusableElement
  ) {
    event.preventDefault();
    firstFocusableElement.focus({ preventScroll: true });
  }
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
    .filter(isFocusableElement)
    .sort((left, right) => compareTabOrder(left, right));
}

function isFocusableElement(element: HTMLElement): boolean {
  if (element.matches(':disabled') || element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  if (element.closest('[inert]')) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.visibility === 'hidden' || style.display === 'none') {
    return false;
  }

  return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

function compareTabOrder(left: HTMLElement, right: HTMLElement): number {
  const leftTabIndex = left.tabIndex;
  const rightTabIndex = right.tabIndex;

  if (leftTabIndex === rightTabIndex) {
    return 0;
  }

  if (leftTabIndex === 0) {
    return 1;
  }

  if (rightTabIndex === 0) {
    return -1;
  }

  return leftTabIndex - rightTabIndex;
}
