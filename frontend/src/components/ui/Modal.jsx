import { X } from "lucide-react";

export default function Modal({ children, isOpen, onClose, title, description, closeDisabled = false }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4">
      <section className="w-full max-w-md rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description ? <p className="text-sm text-stone-600">{description}</p> : null}
          </div>
          <button className="btn-secondary h-10 w-10 px-0" type="button" onClick={onClose} disabled={closeDisabled} aria-label="סגירה">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">{children}</div>
      </section>
    </div>
  );
}
