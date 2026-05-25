import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export function ToastStack({ toasts, onClose }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast ${toast.type}`} key={toast.id}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
          <button className="icon-button" type="button" onClick={() => onClose(toast.id)} aria-label="Close notification">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
