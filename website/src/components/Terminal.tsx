import type { ReactNode } from 'react';

export function Terminal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-navy-900 shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2 border-b border-white/10 bg-navy-800 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-red-500/80" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
        <span className="h-3 w-3 rounded-full bg-green-500/80" />
        <span className="ml-2 font-mono text-xs text-slate-400">{title}</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-slate-300">
        {children}
      </pre>
    </div>
  );
}

export function CodeBlock({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-navy-900">
      {title && (
        <div className="border-b border-white/10 bg-navy-800 px-4 py-2 font-mono text-xs text-slate-400">
          {title}
        </div>
      )}
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-slate-300">
        {children}
      </pre>
    </div>
  );
}
