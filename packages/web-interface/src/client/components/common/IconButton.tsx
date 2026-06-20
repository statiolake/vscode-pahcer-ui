import type { ReactNode } from 'react';

type IconButtonVariant = 'ghost' | 'primary';
type IconButtonSize = 'sm' | 'md';

type IconButtonProps = {
  icon: ReactNode;
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  active = false,
  disabled = false,
  onClick,
}: IconButtonProps) {
  const classes = ['iconButton', variant, size, active ? 'active' : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}
