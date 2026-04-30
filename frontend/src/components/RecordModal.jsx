const RecordModal = ({ title, children, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-2 sm:items-center sm:p-4">
      <div className="panel max-h-[calc(100vh-1rem)] w-full max-w-3xl overflow-y-auto p-4 sm:max-h-[calc(100vh-2rem)] sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Record Editor</p>
            <h3 className="mt-2 text-xl font-bold text-ink sm:text-2xl">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="button-secondary px-4 py-2 sm:shrink-0">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default RecordModal;
