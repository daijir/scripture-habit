import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTodayReadingPlan } from './DailyReadingPlan';

// Mock the data files directly
vi.mock('./DailyReadingPlan2025', () => ({
    DailyReadingPlan2025: [
        { date: '2025-01-01', scripts: ['Test Scripture 2025'] },
        { date: '2025-12-28', scripts: ['End 2025'] }
    ]
}));

vi.mock('./DailyReadingPlan2026', () => ({
    DailyReadingPlan2026: [
        { date: '2025-12-29', scripts: ['Start 2026'] },
        { date: '2026-01-01', scripts: ['Test Scripture 2026'] }
    ]
}));

describe('getTodayReadingPlan', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns the correct plan for a 2025 date (before cutoff)', () => {
        // Set date to 2025-01-01
        const date = new Date('2025-01-01T12:00:00Z');
        vi.setSystemTime(date);

        const plan = getTodayReadingPlan();
        expect(plan).toBeDefined();
        expect(plan.scripts).toContain('Test Scripture 2025');
    });

    it('returns the correct plan for a 2026 date (after cutoff)', () => {
        // Set date to 2025-12-29 (start of 2026 plan logic)
        const date = new Date('2025-12-29T12:00:00Z');
        vi.setSystemTime(date);

        const plan = getTodayReadingPlan();
        expect(plan).toBeDefined();
        expect(plan.scripts).toContain('Start 2026');
    });

    it('returns correct plan for actual 2026 date', () => {
        const date = new Date('2026-01-01T12:00:00Z');
        vi.setSystemTime(date);

        const plan = getTodayReadingPlan();
        expect(plan).toBeDefined();
        expect(plan.scripts).toContain('Test Scripture 2026');
    });

    it('returns undefined if no plan matches the date', () => {
        const date = new Date('2024-01-01T12:00:00Z');
        vi.setSystemTime(date);

        const plan = getTodayReadingPlan();
        expect(plan).toBeUndefined();
    });
});
