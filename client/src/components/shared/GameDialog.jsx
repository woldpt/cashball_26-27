import { useEffect, useRef } from "react";
import { ModalShell } from "./ModalShell.jsx";
import { Button } from "./Button.jsx";

/**
 * Custom in-game dialog replacing window.prompt / window.confirm.
 *
 * @param {{
 *   dialog: {
 *     mode: "prompt"|"confirm",
 *    title: string,
 *    description?: string,
 *    stats?: { label: string, value: string, className?: string }[],
 *    defaultValue?: string,
 *    confirmLabel?: string,
 *    cancelLabel?: string,
 *    danger?: boolean,
 *     onConfirm: (value?: string) => void,
 *     onCancel: () => void,
 *   } | null,
 *   onClose: () => void,
 * }} props
 */
export function GameDialog({ dialog, onClose }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (dialog?.mode === "prompt" && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [dialog]);

  const handleConfirm = () => {
    if (!dialog) return;
    if (dialog.mode === "prompt") {
      dialog.onConfirm(inputRef.current?.value ?? "");
    } else {
      dialog.onConfirm();
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") {
      dialog?.onCancel?.();
      onClose();
    }
  };

  return (
    <ModalShell
      visible={!!dialog}
      onClose={onClose}
      z={200}
      variant="card"
      dismissable
    >
      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-outline-variant/15">
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black mb-1">
            {dialog?.mode === "prompt" ? "Inserir valor" : "Confirmação"}
          </p>
          <h3 className="text-base font-black text-on-surface leading-snug">
            {dialog?.title}
          </h3>
          {dialog?.description && (
            <p className="text-xs text-on-surface-variant mt-1">
              {dialog.description}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {dialog?.mode === "confirm" && dialog?.stats?.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {dialog.stats.map((stat, i) => (
                <span
                  key={i}
                  className={`rounded-md border border-outline-variant/20 bg-surface px-2 py-1 text-[11px] font-bold text-on-surface-variant ${stat.className ?? ""}`}
                >
                  <span className="mr-1 uppercase tracking-wide opacity-70">
                    {stat.label}
                  </span>
                  {stat.value}
                </span>
              ))}
            </div>
          )}
          {dialog?.mode === "prompt" && (
            <input
              ref={inputRef}
              type="number"
              min="0"
              defaultValue={dialog.defaultValue ?? ""}
              className="w-full rounded-md border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-colors"
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              dialog?.onCancel?.();
              onClose();
            }}
          >
            {dialog?.cancelLabel ?? "Cancelar"}
          </Button>
          <Button
            variant={dialog?.danger ? "dangerSoft" : "success"}
            className="flex-1"
            onClick={handleConfirm}
          >
            {dialog?.confirmLabel ?? "Confirmar"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
