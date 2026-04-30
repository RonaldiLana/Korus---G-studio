import React from 'react';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface CrmNotification {
  id: number;
  agency_id: number;
  rule_name: string;
  message: string;
  process_id: number | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationPopupProps {
  notifications: CrmNotification[];
  onDismiss: (id: number) => void;
  onDismissAll: () => void;
}

export const NotificationPopup: React.FC<NotificationPopupProps> = ({
  notifications,
  onDismiss,
  onDismissAll,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[125] w-full max-w-sm space-y-3 pointer-events-none">
      <AnimatePresence initial={false}>
        {notifications.slice(0, 5).map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 80, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="pointer-events-auto rounded-2xl border border-emerald-500/30 bg-[var(--bg-card)] shadow-2xl backdrop-blur-md px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 rounded-xl bg-emerald-500/15 p-2">
                <Bell size={14} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400 truncate">
                  {notif.rule_name}
                </p>
                <p className="text-sm text-[var(--text-main)] leading-snug mt-0.5">
                  {notif.message}
                </p>
                {notif.process_id && (
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Processo #{notif.process_id}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(notif.id)}
                className="shrink-0 p-1 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] transition-all"
                aria-label="Dispensar notificação"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {notifications.length > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-auto flex justify-end pr-1"
        >
          <button
            type="button"
            onClick={onDismissAll}
            className="text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-emerald-400 transition-all px-2 py-1"
          >
            Dispensar todas
          </button>
        </motion.div>
      )}
    </div>
  );
};
