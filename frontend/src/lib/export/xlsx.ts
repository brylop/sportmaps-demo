/**
 * Excel real (.xlsx) con formato — no CSV. Multi-hoja, encabezados con color
 * de marca, columnas de moneda formateadas, celdas de estado pintadas.
 *
 * Sin gráficos embebidos: exceljs los soporta muy mal en la edición gratuita
 * (API experimental, sin leyenda ni ejes configurables). Para gráficos ver
 * `executivePdf.tsx`, que genera un documento aparte pensado para eso.
 */
import ExcelJS from 'exceljs';

export type XlsxColType = 'text' | 'currency' | 'number' | 'integer';

export interface XlsxColumn {
    header: string;
    key: string;
    width?: number;
    type?: XlsxColType;
    /** Valor de la celda (string/number) → color ARGB de fondo. Para columnas de estado. */
    statusColors?: Record<string, string>;
}

export interface XlsxSheet {
    /** Excel corta el nombre de hoja a 31 caracteres — se trunca acá para no fallar en silencio. */
    name: string;
    columns: XlsxColumn[];
    rows: Record<string, any>[];
}

const HEADER_FILL = 'FF1A6118'; // verde de marca SportMaps
const HEADER_FONT = 'FFFFFFFF';
const CURRENCY_FMT = '"$"#,##0';

export async function buildWorkbook(sheets: XlsxSheet[]): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SportMaps';
    wb.created = new Date();

    for (const sheet of sheets) {
        const ws = wb.addWorksheet(sheet.name.slice(0, 31));
        ws.columns = sheet.columns.map(c => ({ header: c.header, key: c.key, width: c.width ?? 18 }));

        const headerRow = ws.getRow(1);
        headerRow.height = 20;
        headerRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: HEADER_FONT } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
            cell.alignment = { vertical: 'middle' };
        });

        sheet.rows.forEach(rowData => {
            const row = ws.addRow(rowData);
            sheet.columns.forEach((col, i) => {
                const cell = row.getCell(i + 1);
                const raw = rowData[col.key];
                if (col.type === 'currency' && typeof raw === 'number') {
                    cell.numFmt = CURRENCY_FMT;
                } else if (col.type === 'integer' && typeof raw === 'number') {
                    cell.numFmt = '0';
                }
                const colorKey = raw == null ? undefined : String(raw);
                const fill = colorKey ? col.statusColors?.[colorKey] : undefined;
                if (fill) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
                }
            });
        });

        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
        ws.views = [{ state: 'frozen', ySplit: 1 }];
    }

    return wb;
}

export async function downloadWorkbook(sheets: XlsxSheet[], filename: string) {
    const wb = await buildWorkbook(sheets);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

/** Colores ARGB reutilizables para columnas de estado de pago/deportista. */
export const STATUS_FILL_COLORS: Record<string, string> = {
    paid: 'FFD1FAE5',
    active: 'FFD1FAE5',
    partial: 'FFFFEDD5',
    pending: 'FFFEF3C7',
    overdue: 'FFFEE2E2',
    inactive: 'FFF3F4F6',
};
