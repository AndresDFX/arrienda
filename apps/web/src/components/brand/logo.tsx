import { cn } from '@/lib/utils'

/**
 * Marca de ARRIENDA+: una casa con un "+" (servicios incluidos), en degradado teal.
 * SVG inline (sin assets externos), escalable y nítido.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="ARRIENDA+"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="arr-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#0E7490" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#arr-grad)" />
      {/* Casa */}
      <path
        d="M20 8.5 L31.5 18 V30.2 a1.3 1.3 0 0 1 -1.3 1.3 H9.8 a1.3 1.3 0 0 1 -1.3 -1.3 V18 Z"
        fill="white"
        fillOpacity="0.96"
      />
      {/* Plus (servicios +) */}
      <path
        d="M20 20.4 V27 M16.7 23.7 H23.3"
        stroke="#0E7490"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Logo completo: marca + wordmark "Arrienda+". */
export function Logo({
  className,
  markClassName,
  showWordmark = true,
}: {
  className?: string
  markClassName?: string
  showWordmark?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={cn('size-8', markClassName)} />
      {showWordmark && (
        <span className="text-lg font-extrabold tracking-tight leading-none">
          Arrienda<span className="text-primary">+</span>
        </span>
      )}
    </span>
  )
}
