export const DailyReadingPlan2026 = [
    { day: 1, scripts: ["Moses 6:63", "Exodus 16:4", "Exodus 16:11-15", "John 6:35"], date: "2025-12-29" },
    { day: 2, scripts: ["Exodus 12:3-5", "John 1:29"], date: "2025-12-30" },
    { day: 3, scripts: ["Numbers 21:4-10", "John 3:14"], date: "2025-12-31" },
    { day: 4, scripts: ["John 1:4-17", "Matthew 12:38-41"], date: "2026-01-01" },
    { day: 5, scripts: ["The Living Christ", "Exodus 6:3-5", "Exodus 3:13-15", "John 8:58"], date: "2026-01-02" },
    { day: 6, scripts: ["Moses 7:18-19"], date: "2026-01-03"},
    { day: 7, scripts: ["Abraham 3:22-28"], date: "2026-01-04"},
    { day: 8, scripts: ["Moses 1:1-11"], date: "2026-01-05" },
    { day: 9, scripts: ["Moses 1:12-23"], date: "2026-01-06" },
    { day: 10, scripts: ["Moses 1:24-35"], date: "2026-01-07" },
    { day: 11, scripts: ["Moses 1:36-42"], date: "2026-01-08" },
    { day: 12, scripts: ["Abraham 3:1-11"], date: "2026-01-09" },
    { day: 13, scripts: ["Abraham 3:12-20"], date: "2026-01-10" },
    { day: 14, scripts: ["Abraham 3:21-28"], date: "2026-01-11" },
    { day: 15, scripts: ["Genesis 1:1-5", "Moses 2:1-5", "Abraham 4:1-5","Doctrine and Covenants 101:32-34"], date: "2026-01-12" },
    { day: 16, scripts: ["Genesis 1:6-13", "Moses 2:6-13", "Abraham 4:6-13"], date: "2026-01-13" },
    { day: 17, scripts: ["Genesis 1:14-23", "Moses 2:14-23", "Abraham 4:14-23"], date: "2026-01-14" },
    { day: 18, scripts: ["Genesis 1:24-31", "Moses 2:24-31", "Abraham 4:24-31"], date: "2026-01-15" },
    { day: 19, scripts: ["Genesis 2:1-7", "Moses 3:1-7", "Abraham 5:1-7"], date: "2026-01-16" },
    { day: 20, scripts: ["Genesis 2:8-17", "Moses 3:8-17", "Abraham 5:8-13"], date: "2026-01-17" },
    { day: 21, scripts: ["Genesis 2:18-25", "Moses 3:18-25", "Abraham 5:14-21"], date: "2026-01-18" },
    { day: 22, scripts: ["Genesis 3:1-7", "Moses 4:1-11"], date: "2026-01-19" },
    { day: 23, scripts: ["Genesis 3:8-19", "Moses 4:12-25"], date: "2026-01-20" },
    { day: 24, scripts: ["Genesis 3:20-24", "Moses 4:26-32"], date: "2026-01-21" },
];

export const getTodayReadingPlan = () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';
    const now = new Date();
    const localDate = now.toLocaleDateString('en-CA', { timeZone });

    return DailyReadingPlan2026.find(p => p.date === localDate);
};