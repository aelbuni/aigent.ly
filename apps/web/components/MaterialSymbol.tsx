export function MaterialSymbol({
  name,
  className = "",
  fill = false,
}: {
  name: string;
  className?: string;
  /** Match Stitch prototype star row (`FILL` 1). */
  fill?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined align-middle ${fill ? "material-symbols-outlined--fill" : ""} ${className}`}
      aria-hidden
    >
      {name}
    </span>
  );
}
