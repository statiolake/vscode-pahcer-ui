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

export function IconExternal(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M5.2 2.5H3.5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8.8" />
      <path d="M8 2.5h3.5V6" />
      <path d="m7 7 4.5-4.5" />
    </IconSvg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M11.5 5.1A4.7 4.7 0 0 0 3.2 3.4L2 4.8" />
      <path d="M2.1 2.2v2.6h2.6" />
      <path d="M2.5 8.9a4.7 4.7 0 0 0 8.3 1.7L12 9.2" />
      <path d="M11.9 11.8V9.2H9.3" />
    </IconSvg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M4.5 2.8v8.4L10.6 7z" fill="currentColor" stroke="none" />
    </IconSvg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <IconSvg {...props}>
      <circle cx="7" cy="7" r="1.8" />
      <path d="M7 1.8v1.4" />
      <path d="M7 10.8v1.4" />
      <path d="m3.3 3.3 1 1" />
      <path d="m9.7 9.7 1 1" />
      <path d="M1.8 7h1.4" />
      <path d="M10.8 7h1.4" />
      <path d="m3.3 10.7 1-1" />
      <path d="m9.7 4.3 1-1" />
    </IconSvg>
  );
}

export function IconList(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M5 3.5h7" />
      <path d="M5 7h7" />
      <path d="M5 10.5h7" />
      <path d="M2.2 3.5h.01" />
      <path d="M2.2 7h.01" />
      <path d="M2.2 10.5h.01" />
    </IconSvg>
  );
}

export function IconTree(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M2.5 2.5v9" />
      <path d="M2.5 4.5H5" />
      <path d="M2.5 9.5H5" />
      <path d="M5 2.8h6.5" />
      <path d="M5 6.5h5" />
      <path d="M5 10.2h6.5" />
    </IconSvg>
  );
}

export function IconSortAsc(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M4 11.5V2.5" />
      <path d="m1.8 4.7 2.2-2.2 2.2 2.2" />
      <path d="M8 4h4" />
      <path d="M8 7h3" />
      <path d="M8 10h2" />
    </IconSvg>
  );
}

export function IconSortDesc(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M4 2.5v9" />
      <path d="m1.8 9.3 2.2 2.2 2.2-2.2" />
      <path d="M8 4h2" />
      <path d="M8 7h3" />
      <path d="M8 10h4" />
    </IconSvg>
  );
}

export function IconGroup(props: IconProps) {
  return (
    <IconSvg {...props}>
      <circle cx="3.2" cy="3.5" r="1.2" />
      <circle cx="10.8" cy="3.5" r="1.2" />
      <circle cx="7" cy="10.5" r="1.2" />
      <path d="M4.3 4.4 6.1 8.9" />
      <path d="M9.7 4.4 7.9 8.9" />
      <path d="M4.4 3.5h5.2" />
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
