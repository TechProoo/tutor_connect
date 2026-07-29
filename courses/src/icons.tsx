interface IconProps {
  size?: number
  className?: string
}

function Svg({
  size = 16,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const LockIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Svg>
)

export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
)

export const PhoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <path d="M12 18h.01" />
  </Svg>
)

export const ArrowIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7" />
    <path d="M7 7h10v10" />
  </Svg>
)

export const ChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
)

export const ChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18l6-6-6-6" />
  </Svg>
)

export const ChevronUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 15l-6-6-6 6" />
  </Svg>
)

export const ChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
)

export const ExitIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Svg>
)

export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Svg>
)

export const MinusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
)

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const FitIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    <path d="M8 12h8M10 10l-2 2 2 2M14 10l2 2-2 2" />
  </Svg>
)

export const PagesIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="3" width="14" height="8" rx="1.5" />
    <rect x="5" y="15" width="14" height="6" rx="1.5" />
  </Svg>
)

export const SinglePageIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <path d="M8 7h8M8 11h8M8 15h5" />
  </Svg>
)

export const FullscreenIcon = ({
  active,
  ...p
}: IconProps & { active?: boolean }) => (
  <Svg {...p}>
    {active ? (
      <>
        <path d="M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M8 21v-3a2 2 0 0 0-2-2H3M16 21v-3a2 2 0 0 1 2-2h3" />
      </>
    ) : (
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    )}
  </Svg>
)

export const BookmarkIcon = ({
  filled,
  ...p
}: IconProps & { filled?: boolean }) => (
  <svg
    width={p.size ?? 16}
    height={p.size ?? 16}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={p.className}
    aria-hidden="true"
  >
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
  </svg>
)

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
)

export const ContentsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3 6h.01M3 12h.01M3 18h.01" />
  </Svg>
)

export const NotesIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M8 13h8M8 17h6" />
  </Svg>
)

export const FocusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)

export const ThemeIcon = ({
  theme,
  ...p
}: IconProps & { theme: 'cloud' | 'paper' | 'midnight' }) => (
  <Svg {...p}>
    {theme === 'midnight' ? (
      <path d="M20.5 14.4A8.4 8.4 0 0 1 9.6 3.5 8.5 8.5 0 1 0 20.5 14.4Z" />
    ) : theme === 'paper' ? (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
      </>
    ) : (
      <>
        <path d="M17.5 19H7a5 5 0 1 1 1.6-9.74A6 6 0 0 1 20 12a3.5 3.5 0 0 1-2.5 7Z" />
      </>
    )}
  </Svg>
)

/** Four-point sparkle cluster, matching the marketing site's decoration. */
export function Sparkle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 140" fill="none" aria-hidden="true">
      <path
        d="M40 0v140M104 0v140M0 36h140M0 100h140"
        stroke="#111827"
        strokeWidth="1"
        opacity="0.35"
      />
      <path d="M40 24l4 12 12 4-12 4-4 12-4-12-12-4 12-4 4-12Z" fill="#111827" />
      <path d="M104 88l4 12 12 4-12 4-4 12-4-12-12-4 12-4 4-12Z" fill="#111827" />
      <path
        d="M104 24l2.6 8 8 2.6-8 2.6-2.6 8-2.6-8-8-2.6 8-2.6 2.6-8Z"
        fill="#f47b20"
      />
    </svg>
  )
}
