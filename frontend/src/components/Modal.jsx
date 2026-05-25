import { X } from 'lucide-react';

export function Modal({ title, subtitle, children, onClose, size = 'md' }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className={`modal glass-card ${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">{subtitle}</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-button bordered" type="button" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function ConfirmDeleteModal({ product, busy, onCancel, onConfirm }) {
  return (
    <Modal title="Delete product?" subtitle="Confirmation required" onClose={onCancel} size="sm">
      <div className="confirm-body">
        <p>
          Are you sure you want to delete <strong>{product.name}</strong>? This action removes it from the catalog.
        </p>
        <div className="confirm-actions">
          <button className="secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="danger solid-danger" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting...' : 'Yes, delete'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
