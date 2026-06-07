'use client';

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const confirmClass = tone === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-indigo-600 hover:bg-indigo-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border bg-background p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg" aria-hidden="true">⚠</span>
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition hover:bg-background-elevated active:scale-[0.99]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition active:scale-[0.99] ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
