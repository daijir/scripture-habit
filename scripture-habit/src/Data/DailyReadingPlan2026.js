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
    { day: 13, scripts: ["Genesis 1:1-25", "Moses 2:1-25", "Abraham 4:1-25","Doctrine and Covenants 101:32-34"], date: "2026-01-10" },
    { day: 14, scripts: ["Genesis 1:26-27", "Moses 2:26-27", "Abraham 4:26-27"], date: "2026-01-11" },
    { day: 15, scripts: ["Mosiah 3:19", "Ether 12:27"], date: "2026-01-12" },
    { day: 16, scripts: ["Genesis 1:27-28", "Genesis 2:18-25"], date: "2026-01-13" },
    { day: 17, scripts: ["Genesis 2:26-28", "Genesis 3:1-15", "1 Corinthians 11:11"], date: "2026-01-14" },
    { day: 18, scripts: ["Moses 3:18, 21-24", "Abraham 5:14-18", "The Family: A Proclamation to the World"], date: "2026-01-15" },
    { day: 19, scripts: ["Genesis 2:2-3", "Moses 3:2-3", "Abraham 5:2-3", "Doctrine and Covenants 59:9-13"], date: "2026-01-16" },
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