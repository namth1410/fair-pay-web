interface WordmarkProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { text: 'text-xl', dot: 'h-1.5 w-1.5' },
  md: { text: 'text-[28px]', dot: 'h-2 w-2' },
  lg: { text: 'text-[40px]', dot: 'h-3 w-3' },
};

/** "Fair·Pay" — chấm gradient giữa 2 chữ như logo app. */
export function Wordmark({ size = 'md', className = '' }: WordmarkProps) {
  const s = SIZES[size];
  return (
    <span
      className={`inline-flex items-baseline font-bold leading-none tracking-[-0.02em] text-foreground ${s.text} ${className}`}
      aria-label="Fair Pay"
    >
      <span>Fair</span>
      <span
        aria-hidden
        className={`mx-[0.08em] inline-block self-center rounded-full ${s.dot}`}
        style={{ background: 'linear-gradient(135deg, var(--brand-dot-from), var(--brand-dot-to))' }}
      />
      <span>Pay</span>
    </span>
  );
}
