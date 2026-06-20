import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

export function Button({ variant = 'secondary', className, children, ...props }: ButtonProps) {
  const classes = ['button', variant, className].filter(Boolean).join(' ');

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}
