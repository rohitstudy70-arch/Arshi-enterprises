const RecordModal = ({ title, children, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="panel w-full max-w-2xl p-6 sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Record Editor</p>
            <h3 className="mt-2 text-2xl font-bold text-ink">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="button-secondary px-4 py-2">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default RecordModal;
