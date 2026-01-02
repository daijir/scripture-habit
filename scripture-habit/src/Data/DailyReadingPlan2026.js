export const DailyReadingPlan2026 = [
    { day: 1, scripts: ["Moses 6:63", "Exodus 16:4", "Exodus 16:11-15", "John 6:35"], date: "2025-12-29" },
    { day: 2, scripts: ["Exodus 12:3-5", "John 1:29"], date: "2025-12-30" },
    { day: 3, scripts: ["Numbers 21:4-10", "John 3:14"], date: "2025-12-31" },
    { day: 4, scripts: ["John 1:4-17", "Matthew 12:38-41"], date: "2026-01-01" },
    { day: 5, scripts: ["The Living Christ", "Exodus 6:3-5", "Exodus 3:13-15", "John 8:58"], date: "2026-01-02" },
    { day: 6, scripts: ["Moses 1:1-11"], date: "2026-01-03" },
    { day: 7, scripts: ["Moses 1:12-23"], date: "2026-01-04" },
    { day: 8, scripts: ["Moses 1:24-35"], date: "2026-01-05" },
    { day: 9, scripts: ["Moses 1:36-42"], date: "2026-01-06" },
    { day: 10, scripts: ["Abraham 3:1-11"], date: "2026-01-07" },
    { day: 11, scripts: ["Abraham 3:12-20"], date: "2026-01-08" },
    { day: 12, scripts: ["Abraham 3:21-28"], date: "2026-01-09" },
];

// Function to retrieve today's reading plan
export const getTodayReadingPlan = () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';
    const now = new Date();
    // Format to YYYY-MM-DD in local time
    const localDate = now.toLocaleDateString('en-CA', { timeZone });

    // Find plan by matching date string
    return DailyReadingPlan2026.find(p => p.date === localDate);
};