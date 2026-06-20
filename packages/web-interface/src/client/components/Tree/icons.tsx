import { type ReactNode, type SVGProps, useId } from 'react';

type IconColor = 'success' | 'warning' | 'danger' | 'muted' | 'accent' | 'text' | 'soft';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'color'> & {
  color?: IconColor;
  title?: string;
};

type IconSvgProps = IconProps & {
  children: ReactNode;
};

const iconColors: Record<IconColor, string> = {
  success: 'var(--success)',
  warning: 'var(--warn)',
  danger: 'var(--danger)',
  muted: 'var(--muted)',
  accent: 'var(--accent)',
  text: 'var(--text)',
  soft: 'var(--soft)',
};

function IconSvg({ color, className, style, title, children, ...props }: IconSvgProps) {
  const titleId = useId();

  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: Tree icons are decorative by default.
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={['treeIcon', className].filter(Boolean).join(' ')}
      style={color ? { color: iconColors[color], ...style } : style}
      role={title ? 'img' : undefined}
      aria-labelledby={title ? titleId : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...props}
    >
      {title && <title id={titleId}>{title}</title>}
      {children}
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <IconSvg {...props}>
      <circle cx="7" cy="7" r="5.5" />
      <path d="m4.5 7.1 1.6 1.6 3.4-3.5" />
    </IconSvg>
  );
}

export function IconCross(props: IconProps) {
  return (
    <IconSvg {...props}>
      <circle cx="7" cy="7" r="5.5" />
      <path d="m5 5 4 4" />
      <path d="m9 5-4 4" />
    </IconSvg>
  );
}

export function IconWarning(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M7 1.8 12.4 11a1 1 0 0 1-.9 1.5h-9A1 1 0 0 1 1.6 11z" />
      <path d="M7 5.2v2.8" />
      <path d="M7 10.4h.01" />
    </IconSvg>
  );
}

export function IconQuestion(props: IconProps) {
  return (
    <IconSvg {...props}>
      <circle cx="7" cy="7" r="5.5" />
      <path d="M5.2 5.4a1.8 1.8 0 1 1 2.9 1.5c-.7.5-1.1.9-1.1 1.8" />
      <path d="M7 10.9h.01" />
    </IconSvg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <IconSvg {...props}>
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 6.4v3.6" />
      <path d="M7 4h.01" />
    </IconSvg>
  );
}

export function IconGitCommit(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M7 1v3" />
      <circle cx="7" cy="7" r="3" />
      <path d="M7 10v3" />
    </IconSvg>
  );
}

export function IconHash(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M4.8 2.2 3.8 11.8" />
      <path d="M10.2 2.2 9.2 11.8" />
      <path d="M2.5 5.2h9" />
      <path d="M2 8.8h9" />
    </IconSvg>
  );
}

export function IconPencil(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M8.8 2.2 11.8 5.2" />
      <path d="M3 8 9.5 1.5a1.1 1.1 0 0 1 1.6 0l1.4 1.4a1.1 1.1 0 0 1 0 1.6L6 11l-3.5.8z" />
    </IconSvg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <IconSvg {...props}>
      <rect x="4.5" y="4.5" width="7" height="7" rx="1" />
      <path d="M2.5 8.8V3.5a1 1 0 0 1 1-1h5.3" />
    </IconSvg>
  );
}

export function IconWrap(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M2.5 3.5h6.8a2.2 2.2 0 0 1 0 4.4H4.5" />
      <path d="m6.2 5.9-2 2 2 2" />
      <path d="M2.5 10.5h5" />
    </IconSvg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="m5.5 3.5 3.5 3.5-3.5 3.5" />
    </IconSvg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="m3.5 5.5 3.5 3.5 3.5-3.5" />
    </IconSvg>
  );
}
