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
      <table className="excel-table min-w-[640px] sm:min-w-full">
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
    </div>
  );
};

export default DataTable;
