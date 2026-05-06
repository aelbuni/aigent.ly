/** Homepage visual panel — Terminal Precision: light base, dot grid, flat borders (no glow). */
export function HomeBrandPanel({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative h-[400px] w-full overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest md:w-[45%] ${className}`}
    >
      <div className="dot-grid absolute inset-0 opacity-60" />
      <div className="absolute inset-0 flex items-center justify-center">
        <svg className="h-full w-full text-primary/25" viewBox="0 0 400 400" aria-hidden>
          <defs>
            <pattern id="home-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#home-grid)" />
          <circle cx="200" cy="200" r="100" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="5,5" />
          <circle cx="200" cy="200" r="150" fill="none" stroke="currentColor" strokeWidth="0.25" />
        </svg>
        <div className="absolute left-1/3 top-1/4 h-3 w-3 animate-pulse rounded-full border border-error bg-error-container" />
        <div className="absolute bottom-1/3 right-1/4 h-3 w-3 animate-pulse rounded-full border border-error bg-error-container" />
        <div className="absolute right-1/2 top-1/2 h-4 w-4 animate-ping rounded-full border-2 border-primary bg-primary-fixed-dim/30" />
      </div>
      <div className="absolute bottom-4 left-4 right-4 border border-outline-variant bg-surface-container-low p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono-label text-on-surface">Real-time threat scanner</span>
          <span className="font-mono-data text-primary">Active</span>
        </div>
      </div>
    </div>
  );
}
