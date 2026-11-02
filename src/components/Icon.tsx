/** Ícones de traço arredondado (24×24), no estilo Iconly */
const PATHS = {
  bolt: <path d="M13 2.75 5.5 13.25h6l-1 8 7.5-10.5h-6l1-8Z" />,
  drop: <path d="M12 3.25s-6.25 6.6-6.25 11a6.25 6.25 0 0 0 12.5 0c0-4.4-6.25-11-6.25-11Z" />,
  copy: (
    <>
      <rect x="8.75" y="8.75" width="11.5" height="11.5" rx="3" />
      <path d="M15.25 8.75v-2a3 3 0 0 0-3-3h-5.5a3 3 0 0 0-3 3v5.5a3 3 0 0 0 3 3h2" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11.25m0 0-4.25-4.25M12 15.25l4.25-4.25" />
      <path d="M4.75 15.5v1.25a3 3 0 0 0 3 3h8.5a3 3 0 0 0 3-3V15.5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15.25V4m0 0L7.75 8.25M12 4l4.25 4.25" />
      <path d="M4.75 14.5v2.25a3 3 0 0 0 3 3h8.5a3 3 0 0 0 3-3V14.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.75 12S6 5.75 12 5.75 21.25 12 21.25 12 18 18.25 12 18.25 2.75 12 2.75 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </>
  ),
  chat: (
    <path d="M4.2 19.8 5.3 16A8.25 8.25 0 1 1 8 18.7l-3.8 1.1ZM9 10.25h.01M12 10.25h.01M15 10.25h.01" />
  ),
  mail: (
    <>
      <rect x="3.25" y="5.25" width="17.5" height="13.5" rx="3.5" />
      <path d="m6.75 9.25 4.3 3.1a1.6 1.6 0 0 0 1.9 0l4.3-3.1" />
    </>
  ),
  share: (
    <>
      <path d="M12 3.75v11m0-11L8.25 7.5M12 3.75l3.75 3.75" />
      <path d="M8.25 11h-1.5a2 2 0 0 0-2 2v5.25a2 2 0 0 0 2 2h10.5a2 2 0 0 0 2-2V13a2 2 0 0 0-2-2h-1.5" />
    </>
  ),
  check: <path d="m5.75 12.5 4 4 8.5-9" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="m8.5 12.25 2.5 2.5 4.5-5" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.6 3.4 16.8a2 2 0 0 0 1.7 3h13.8a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v3.75M12 16.5h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 7.75V12l2.75 1.75" />
    </>
  ),
  trend: (
    <>
      <path d="m3.75 16.25 5-5 3.5 3.5 7.5-7.5" />
      <path d="M14.75 7.25h5v5" />
    </>
  ),
  bell: (
    <>
      <path d="M6.25 16.75V11a5.75 5.75 0 0 1 11.5 0v5.75l1.25 1.5H5l1.25-1.5Z" />
      <path d="M10 20.25a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  doc: (
    <>
      <path d="M14 3.25H8.25a3 3 0 0 0-3 3v11.5a3 3 0 0 0 3 3h7.5a3 3 0 0 0 3-3V8L14 3.25Z" />
      <path d="M13.75 3.5v3.25a1.5 1.5 0 0 0 1.5 1.5h3.25M9 12.75h6M9 16.25h4" />
    </>
  ),
  home: (
    <>
      <path d="M4.25 10.2 12 4l7.75 6.2v8.05a2.5 2.5 0 0 1-2.5 2.5H6.75a2.5 2.5 0 0 1-2.5-2.5V10.2Z" />
      <path d="M9.75 15.75h4.5" />
    </>
  ),
  chart: (
    <>
      <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5" />
      <path d="M8 15.5v-3M12 15.5v-7M16 15.5v-4.5" />
    </>
  ),
  list: (
    <>
      <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5" />
      <path d="M8 8.75h8M8 12h8M8 15.25h5" />
    </>
  ),
  logout: (
    <>
      <path d="M14.75 7.5V6.25a3 3 0 0 0-3-3h-4.5a3 3 0 0 0-3 3v11.5a3 3 0 0 0 3 3h4.5a3 3 0 0 0 3-3V16.5" />
      <path d="M20.25 12H9.75m10.5 0-3-3m3 3-3 3" />
    </>
  ),
  link: (
    <>
      <path d="M10.5 13.5a3.75 3.75 0 0 0 5.3 0l3-3a3.75 3.75 0 0 0-5.3-5.3l-1 1" />
      <path d="M13.5 10.5a3.75 3.75 0 0 0-5.3 0l-3 3a3.75 3.75 0 0 0 5.3 5.3l1-1" />
    </>
  ),
  plus: <path d="M12 5.25v13.5M5.25 12h13.5" />,
  x: <path d="m6.75 6.75 10.5 10.5m0-10.5-10.5 10.5" />,
  chevron: <path d="m9.5 6.25 5.75 5.75-5.75 5.75" />,
  back: <path d="m14.5 6.25-5.75 5.75 5.75 5.75" />,
  user: (
    <>
      <circle cx="12" cy="8.25" r="3.75" />
      <path d="M5 19.25c.9-3 3.6-4.75 7-4.75s6.1 1.75 7 4.75" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.25 12a7.25 7.25 0 1 1-2.12-5.13" />
      <path d="M19.5 4.5v3.75h-3.75" />
    </>
  ),
  trash: (
    <>
      <path d="M4.75 6.75h14.5M9.25 6.5V5.25a1.5 1.5 0 0 1 1.5-1.5h2.5a1.5 1.5 0 0 1 1.5 1.5V6.5" />
      <path d="m6.25 6.75.8 11.6a2.5 2.5 0 0 0 2.5 2.4h4.9a2.5 2.5 0 0 0 2.5-2.4l.8-11.6" />
    </>
  ),
  receipt: (
    <>
      <path d="M6.25 3.25h11.5v17.5l-2.9-1.75-2.85 1.75-2.85-1.75-2.9 1.75V3.25Z" />
      <path d="M9.25 8.25h5.5M9.25 11.75h5.5M9.25 15.25h3" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
