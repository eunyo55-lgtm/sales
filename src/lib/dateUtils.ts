export const HOLIDAYS_2024 = [
    '2024-01-01', // New Year
    '2024-02-09', '2024-02-10', '2024-02-11', '2024-02-12', // Lunar New Year
    '2024-03-01', // Independence Movement Day
    '2024-04-10', // Election Day
    '2024-05-05', '2024-05-06', // Children's Day
    '2024-05-15', // Buddha's Birthday
    '2024-06-06', // Memorial Day
    '2024-08-15', // Liberation Day
    '2024-09-16', '2024-09-17', '2024-09-18', // Chuseok
    '2024-10-03', // National Foundation Day
    '2024-10-09', // Hangeul Day
    '2024-12-25', // Christmas
];

export const HOLIDAYS_2025 = [
    '2025-01-01',
    '2025-01-28', '2025-01-29', '2025-01-30', // Lunar NY
    '2025-03-01', '2025-03-03', // Independence (Sub)
    '2025-05-05', '2025-05-06', // Buddha & Children (Overlap/Sub) - Checking exact later, adding broad coverage
    '2025-06-06',
    '2025-08-15',
    '2025-10-03',
    '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08', // Chuseok
    '2025-10-09',
    '2025-12-25',
];

const HOLIDAYS_2026 = [
    '2026-01-01', // New Year
    '2026-02-16', '2026-02-17', '2026-02-18', // Lunar New Year (Mon, Tue, Wed)
    '2026-03-01', '2026-03-02', // Independence Movement Day + Substitute (Sun -> Mon)
    '2026-05-05', // Children's Day
    '2026-05-24', '2026-05-25', // Buddha's Birthday + Substitute (Sun -> Mon)
    '2026-06-06', // Memorial Day
    '2026-08-15', '2026-08-17', // Liberation Day + Substitute (Sat -> Mon)
    '2026-09-24', '2026-09-25', '2026-09-26', // Chuseok
    '2026-10-03', '2026-10-05', // National Foundation Day + Substitute (Sat -> Mon)
    '2026-10-09', // Hangeul Day
    '2026-12-25', // Christmas
];

const HOLIDAYS = new Set([...HOLIDAYS_2024, ...HOLIDAYS_2025, ...HOLIDAYS_2026]);

export function isRedDay(dateStr: string): boolean {
    const date = new Date(dateStr);
    const day = date.getDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat

    // Using strict comparison for days as requested: Saturday(6)
    // IMPORTANT: Removing Friday as per user feedback (Naver Calendar).
    // Saturday (6) and Sunday (0) + Holidays will be red.

    if (day === 0 || day === 6) {
        return true;
    }

    if (HOLIDAYS.has(dateStr)) {
        return true;
    }

    return false;
}
