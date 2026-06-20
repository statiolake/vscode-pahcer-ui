type FocusTrapKeyboardEvent = {
  preventDefault: () => void;
  shiftKey: boolean;
};

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

export function focusFirstElement(container: HTMLElement) {
  const firstFocusableElement = getFocusableElements(container)[0] ?? container;
  firstFocusableElement.focus({ preventScroll: true });
}

export function trapFocus(event: FocusTrapKeyboardEvent, container: HTMLElement | null) {
  if (!container) {
    return;
  }

  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) {
    event.preventDefault();
    container.focus({ preventScroll: true });
    return;
  }

  const firstFocusableElement = focusableElements[0];
  const lastFocusableElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement;
  const activeElementIsContainer = activeElement === container;
  const activeElementIsInsideContainer =
    activeElement instanceof Node && container.contains(activeElement);

  if (event.shiftKey) {
    if (
      !activeElementIsInsideContainer ||
      activeElementIsContainer ||
      activeElement === firstFocusableElement
    ) {
      event.preventDefault();
      lastFocusableElement.focus({ preventScroll: true });
    }
    return;
  }

  if (
    !activeElementIsInsideContainer ||
    activeElementIsContainer ||
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
