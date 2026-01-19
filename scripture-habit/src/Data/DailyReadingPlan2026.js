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
    { day: 25, scripts: ["Moses 5:1-15"], date: "2026-01-22" },
    { day: 26, scripts: ["Genesis 4:1-8", "Moses 5:16-33"], date: "2026-01-23"},
    { day: 27, scripts: ["Genesis 4:9-16", "Moses 5:34-41"], date: "2026-01-24"},
    { day: 28, scripts: ["Genesis 4:17-26", "Moses 5:42-59"], date: "2026-01-25"},
    { day: 29, scripts: ["Moses 6:1-9"], date: "2026-01-26", date: "2026-01-26"},
    { day: 30, scripts: ["Genesis 5:1-11", "Moses 6:10-18"], date: "2026-01-27"},
    { day: 31, scripts: ["Genesis 5:12-20", "Moses 6:19-24"], date: "2026-01-28"},
    { day: 32, scripts: ["Genesis 5:21-24", "Moses 6:25-34"], date: "2026-01-29"},
    { day: 33, scripts: ["Moses 6:35-46"], date: "2026-01-30"},
    { day: 34, scripts: ["Moses 6:47-57"], date: "2026-01-31"},
    { day: 35, scripts: ["Moses 6:58-68"], date: "2026-02-01"},
    { day: 36, scripts: ["Moses 7:1-11"], date: "2026-02-02"},
    { day: 37, scripts: ["Moses 7:12-17"], date: "2026-02-03"},
    { day: 38, scripts: ["Moses 7:18-27"], date: "2026-02-04"},
    { day: 39, scripts: ["Moses 7:28-40"], date: "2026-02-05"},
    { day: 40, scripts: ["Moses 7:41-47"], date: "2026-02-06"},
    { day: 41, scripts: ["Moses 7:48-59"], date: "2026-02-07"},
    { day: 42, scripts: ["Moses 7:60-69"], date: "2026-02-08"},
    { day: 43, scripts: ["Moses 8:1-30"], date: "2026-02-09"},
    { day: 44, scripts: ["Genesis 6:1-22"], date: "2026-02-10"},
    { day: 45, scripts: ["Genesis 7:1-24"], date: "2026-02-11"},
    { day: 46, scripts: ["Genesis 8:1-22"], date: "2026-02-12"}
];

export const getTodayReadingPlan = () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';
    const now = new Date();
    const localDate = now.toLocaleDateString('en-CA', { timeZone });

    return DailyReadingPlan2026.find(p => p.date === localDate);
};