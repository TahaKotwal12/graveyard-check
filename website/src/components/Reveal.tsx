import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Fades and slides children in the first time they enter the viewport.
 * Motion is disabled globally via prefers-reduced-motion in index.css.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: Readonly<{
  children: ReactNode;
  delay?: number;
  className?: string;
}>) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${visible ? 'reveal-visible' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
