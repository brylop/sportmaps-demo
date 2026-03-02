/**
 * Utility functions for exporting data to CSV and handling PDF printing.
 */

export const exportToCSV = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
            const cellValue = cell === null || cell === undefined ? '' : String(cell);
            // Escape commas and quotes
            if (cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n')) {
                return `"${cellValue.replace(/"/g, '""')}"`;
            }
            return cellValue;
        }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

export const printReport = () => {
    window.print();
};
