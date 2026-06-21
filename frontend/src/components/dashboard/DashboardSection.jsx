export default function DashboardSection({ children, count, title }) {
  return (
    <section className="panel min-h-72 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
