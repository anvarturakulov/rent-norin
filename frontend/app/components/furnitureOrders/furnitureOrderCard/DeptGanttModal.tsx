'use client';
import type { CSSProperties } from 'react';

export interface WorkBlock {
    workId: number;
    workName: string;
    timeInOrder: number;
    startDate: string;
    endDate: string;
    orderId: number;
    orderNumber: string;
    clientName: string;
    productName?: string;
    isCurrentOrder: boolean;
}

export interface DeptSchedule {
    deptId: number;
    deptName: string;
    works: WorkBlock[];
    currentOrderStartDate: string | null;
    currentOrderEndDate: string | null;
}

interface Props {
    data: DeptSchedule[];
    onClose: () => void;
}

function parseDate(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function getWorkingDays(minDate: Date, maxDate: Date): Date[] {
    const days: Date[] = [];
    const cur = new Date(minDate);
    while (cur <= maxDate) {
        if (cur.getDay() !== 0) {
            days.push(new Date(cur));
        }
        cur.setDate(cur.getDate() + 1);
    }
    return days;
}

function toIsoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(s: string): string {
    return parseDate(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

function isWorkOnDate(work: WorkBlock, day: string): boolean {
    return work.startDate <= day && work.endDate >= day;
}

const NON_CURRENT_ORDER_COLORS = [
    { bg: '#e2e8f0', border: '#94a3b8', text: '#334155' },
    { bg: '#dbeafe', border: '#93c5fd', text: '#1e3a8a' },
    { bg: '#dcfce7', border: '#86efac', text: '#14532d' },
    { bg: '#fef3c7', border: '#fcd34d', text: '#78350f' },
    { bg: '#fae8ff', border: '#e9d5ff', text: '#581c87' },
    { bg: '#ffe4e6', border: '#fda4af', text: '#881337' },
];

export default function DeptGanttModal({ data, onClose }: Props) {
    const sortedDepts = [...data].sort((a, b) => a.deptName.localeCompare(b.deptName, 'ru-RU'));

    if (data.length === 0) {
        return (
            <div style={overlayStyle}>
                <div style={modalStyle}>
                    <div style={headerStyle}>
                        <span style={{ fontWeight: 700, fontSize: 18 }}>Цехлар юкланиши таҳлили</span>
                        <button style={closeBtnStyle} onClick={onClose}>✕</button>
                    </div>
                    <div style={{ padding: 32, color: '#64748b', textAlign: 'center' }}>
                        Ишлаб чиқаришдаги буюртмалар ёки тайинланган ишлар топилмади
                    </div>
                </div>
            </div>
        );
    }

    const allDates = sortedDepts.flatMap(d => d.works.flatMap(w => [w.startDate, w.endDate]));
    const minDateStr = allDates.reduce((a, b) => (a < b ? a : b));
    const maxDateStr = allDates.reduce((a, b) => (a > b ? a : b));
    const workingDays = getWorkingDays(parseDate(minDateStr), parseDate(maxDateStr))
        .map(d => toIsoDate(d));

    const currentEndDates = sortedDepts
        .map(d => d.currentOrderEndDate)
        .filter(Boolean) as string[];
    const globalCurrentEnd = currentEndDates.length ? currentEndDates.reduce((a, b) => (a > b ? a : b)) : null;

    const nonCurrentOrderIds = Array.from(
        new Set(
            sortedDepts
                .flatMap(d => d.works)
                .filter(w => !w.isCurrentOrder)
                .map(w => w.orderId),
        ),
    );
    const nonCurrentColorByOrderId = new Map<number, { bg: string; border: string; text: string }>();
    nonCurrentOrderIds.forEach((orderId, index) => {
        nonCurrentColorByOrderId.set(orderId, NON_CURRENT_ORDER_COLORS[index % NON_CURRENT_ORDER_COLORS.length]);
    });

    return (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={modalStyle}>
                {/* Header */}
                <div style={headerStyle}>
                    <div>
                        <span style={{ fontWeight: 700, fontSize: 18 }}>Цехлар юкланиши таҳлили</span>
                        {globalCurrentEnd && (
                            <span style={{ marginLeft: 16, fontSize: 14, color: '#1d4ed8', fontWeight: 600 }}>
                                Жорий буюртма тугалланади: {formatDisplayDate(globalCurrentEnd)}
                            </span>
                        )}
                    </div>
                    <button style={closeBtnStyle} onClick={onClose}>✕</button>
                </div>

                <div style={{ display: 'flex', gap: 16, padding: '6px 16px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 24, height: 12, borderRadius: 3, background: '#2563eb' }} />
                        <span>Жорий буюртма ишлари</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 24, height: 12, borderRadius: 3, background: '#dbeafe', border: '1px solid #93c5fd' }} />
                        <span>Бошқа буюртмалар (ҳар буюртма учун алоҳида ранг)</span>
                    </div>
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={{ ...headCellStyle, ...stickyHeadCellStyle, minWidth: 120 }}>Сана</th>
                                {sortedDepts.map(dept => (
                                    <th key={dept.deptId} style={{ ...headCellStyle, minWidth: 240 }}>
                                        <div style={{ fontWeight: 700 }}>{dept.deptName}</div>
                                        {dept.currentOrderStartDate && dept.currentOrderEndDate && (
                                            <div style={{ marginTop: 2, fontWeight: 500, color: '#2563eb' }}>
                                                Жорий: {formatDisplayDate(dept.currentOrderStartDate)} → {formatDisplayDate(dept.currentOrderEndDate)}
                                            </div>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {workingDays.map(day => (
                                <tr key={day}>
                                    <td style={{ ...dayCellStyle, ...stickyDayCellStyle }}>{formatDisplayDate(day)}</td>
                                    {sortedDepts.map(dept => {
                                        const dayWorks = dept.works
                                            .filter(w => isWorkOnDate(w, day))
                                            .sort((a, b) => Number(a.isCurrentOrder) - Number(b.isCurrentOrder));

                                        return (
                                            <td key={`${day}-${dept.deptId}`} style={bodyCellStyle}>
                                                {dayWorks.length === 0 ? (
                                                    <span style={emptyTextStyle}>—</span>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        {dayWorks.map(work => (
                                                            (() => {
                                                                const nonCurrentColor = nonCurrentColorByOrderId.get(work.orderId) ?? NON_CURRENT_ORDER_COLORS[0];
                                                                const bg = work.isCurrentOrder ? '#2563eb' : nonCurrentColor.bg;
                                                                const border = work.isCurrentOrder ? '#1e40af' : nonCurrentColor.border;
                                                                const text = work.isCurrentOrder ? '#ffffff' : nonCurrentColor.text;
                                                                return (
                                                            <div
                                                                key={`${day}-${work.workId}`}
                                                                title={`${work.workName} | #${work.orderNumber}${work.clientName ? ` — ${work.clientName}` : ''} | ${work.timeInOrder} соат | ${work.startDate} → ${work.endDate}`}
                                                                style={{
                                                                    borderRadius: 6,
                                                                    padding: '4px 7px',
                                                                    fontSize: 13,
                                                                    lineHeight: 1.25,
                                                                    background: bg,
                                                                    color: text,
                                                                    border: work.isCurrentOrder ? `2px solid ${border}` : `1px solid ${border}`,
                                                                }}
                                                            >
                                                                <div style={{ fontWeight: 700 }}>{work.workName}</div>
                                                                <div style={{ opacity: 0.95 }}>
                                                                    #{work.orderNumber} · {work.timeInOrder} соат
                                                                    {work.productName ? ` · ${work.productName}` : ''}
                                                                </div>
                                                                {work.clientName && <div style={{ opacity: 0.95 }}>{work.clientName}</div>}
                                                            </div>
                                                                );
                                                            })()
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.55)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
};

const modalStyle: CSSProperties = {
    background: '#ffffff',
    borderRadius: 12,
    width: '96vw',
    maxWidth: 1400,
    height: '88vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    fontFamily: `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
    fontSize: 15,
    lineHeight: 1.5,
};

const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
};

const closeBtnStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    fontSize: 20,
    cursor: 'pointer',
    color: '#64748b',
    padding: '2px 6px',
    borderRadius: 4,
    lineHeight: 1,
};

const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    fontSize: 13,
};

const headCellStyle: CSSProperties = {
    background: '#f8fafc',
    color: '#334155',
    borderBottom: '1px solid #cbd5e1',
    borderRight: '1px solid #e2e8f0',
    padding: '8px 10px',
    textAlign: 'left',
    verticalAlign: 'top',
    position: 'sticky',
    top: 0,
    zIndex: 2,
};

const stickyHeadCellStyle: CSSProperties = {
    left: 0,
    zIndex: 3,
};

const dayCellStyle: CSSProperties = {
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 600,
    borderBottom: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    padding: '8px 10px',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
};

const stickyDayCellStyle: CSSProperties = {
    position: 'sticky',
    left: 0,
    zIndex: 1,
};

const bodyCellStyle: CSSProperties = {
    borderBottom: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    padding: 6,
    verticalAlign: 'top',
    minHeight: 48,
};

const emptyTextStyle: CSSProperties = {
    color: '#94a3b8',
    fontSize: 13,
};
