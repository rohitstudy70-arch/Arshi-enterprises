const DataTable = ({ columns, rows, emptyMessage = "No records found." }) => {
  const getCellValue = (row, key) => {
    const value = row[key];

    if (value === null || value === undefined || value === "") {
      return "--";
    }

    return value;
  };

  return (
    <div className="table-wrap">
      <table className="excel-table hidden min-w-[760px] md:table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row._id || row.id}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {typeof column.render === "function" ? column.render(row) : getCellValue(row, column.key)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="grid gap-3 p-3 md:hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">{emptyMessage}</div>
        ) : (
          rows.map((row) => (
            <article key={row._id || row.id} className="mobile-record-card">
              {columns.map((column) => (
                <div key={column.key} className="mobile-record-row">
                  <span className="mobile-record-label">{column.header}</span>
                  <div className="mobile-record-value">
                    {typeof column.render === "function" ? column.render(row) : getCellValue(row, column.key)}
                  </div>
                </div>
              ))}
            </article>
          ))
        )}
      </div>
    </div>
  );
};

export default DataTable;
