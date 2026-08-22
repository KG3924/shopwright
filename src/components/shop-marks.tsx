export function TrySquareMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M3.5 3.5h9.2v3.2H6.8v13.8H3.5V3.5zm9.2 13.6h8.8v3.2h-8.8v-3.2z" />
    </svg>
  );
}

export function SawMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5h11.5l6 8.5H9.2L3 8.5z" />
      <path d="M14.5 8.5l-1.4 2.2 2.2.2-1.5 2.1 2.3.2-1.4 2.2" />
    </svg>
  );
}

export function ChiselMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6v8l-3 10-3-10V3z" />
      <path d="M9 8h6" />
    </svg>
  );
}
