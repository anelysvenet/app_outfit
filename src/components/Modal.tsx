"use client";

import { AnimatePresence, motion } from "framer-motion";

export default function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-night/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className={`relative w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-ivory p-6 sm:p-8 shadow-lift`}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <h2 className="font-display text-2xl">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-full border border-ink/10 px-3 py-1 text-sm text-smoke hover:border-gold hover:text-gold transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
