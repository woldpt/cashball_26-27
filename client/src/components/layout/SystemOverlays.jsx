import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../../contexts/GameContext.jsx";

/**
 * Camada de sistema: toasts, flash de reconnect, erro fatal de render e
 * sessão deslocada. Não recebe props — lê tudo do `useGame()`.
 */
export function SystemOverlays() {
  const { toasts, dismissToast, reconnectFlash, renderError, sessionDisplaced } =
    useGame();

  return (
    <>
      {/* Flash de reconnect (ex-toast 5): modal que desvanece sozinho. */}
      <AnimatePresence initial={false}>
        {reconnectFlash && (
          <motion.div
            key={reconnectFlash.id}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="pointer-events-none fixed inset-0 z-[99998] flex items-center justify-center px-4"
          >
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container px-6 py-4 text-center shadow-2xl">
              <span
                aria-hidden
                className="material-symbols-outlined animate-spin text-2xl leading-none text-primary"
              >
                sync
              </span>
              <p className="mt-1 text-sm font-bold text-on-surface">
                Ligação restabelecida — a sincronizar…
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {renderError && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99999 }}
          className="flex flex-col items-center justify-center bg-black/95 gap-4 p-8 overflow-auto"
        >
          <p className="text-4xl">💥</p>
          <h2 className="text-xl font-bold text-red-400">
            Erro de Renderização
          </h2>
          <pre className="text-xs text-zinc-400 max-w-xl overflow-auto p-3 bg-zinc-900 rounded whitespace-pre-wrap">
            {(() => {
              try {
                return renderError?.stack || String(renderError);
              } catch (e) {
                return `[ERROR DISPLAY] ${String(e)}`;
              }
            })()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-2 rounded-lg bg-red-500 text-white font-bold text-sm"
          >
            Recarregar
          </button>
        </div>
      )}
      {sessionDisplaced && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999 }}
          className="flex flex-col items-center justify-center bg-black/90 gap-6 p-8"
        >
          <p className="text-5xl">📱</p>
          <h2 className="text-xl font-bold text-white text-center">
            Sessão aberta noutro dispositivo
          </h2>
          <p className="text-gray-400 text-sm text-center max-w-xs leading-relaxed">
            A tua sessão foi assumida por outro dispositivo ou janela.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-2 rounded-lg bg-yellow-500 text-black font-bold text-sm"
          >
            Retomar aqui
          </button>
        </div>
      )}
      {/* Toast notifications — AnimatePresence para o exit; o container fica
          sempre montado (pointer-events-none) para os toasts poderem sair. */}
      <div className="fixed top-[calc(var(--header-h)+0.5rem)] right-4 z-100 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
          <motion.div
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => dismissToast(t.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") dismissToast(t.id);
            }}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-surface-container border border-outline-variant/60 text-on-surface text-sm font-bold px-5 py-3 rounded-md shadow-2xl pointer-events-auto cursor-pointer select-none flex items-center gap-3"
          >
            <span className="flex-1">{t.msg}</span>
            <span
              className="material-symbols-outlined text-base opacity-50 hover:opacity-100 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                dismissToast(t.id);
              }}
              aria-label="Fechar notificação"
            >
              close
            </span>
          </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
