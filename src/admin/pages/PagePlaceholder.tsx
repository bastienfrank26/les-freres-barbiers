export function PagePlaceholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">{title}</h1>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      <div className="mt-6 rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">
        Module à venir — implémentation dans une phase ultérieure.
      </div>
    </div>
  )
}
