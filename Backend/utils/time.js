/**
 * Timezone-aware helpers. Uses the cafeteria's timezone, not the server's.
 */

function localDateString(date, timezone = 'UTC') {
    const d = date instanceof Date ? date : new Date(date);
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(d);
    } catch {
        return d.toISOString().slice(0, 10);
    }
}

function todayForCafe(cafe) {
    return localDateString(new Date(), cafe?.timezone || 'Africa/Johannesburg');
}

function daysAgoForCafe(cafe, days) {
    return localDateString(
        new Date(Date.now() - days * 86400000),
        cafe?.timezone || 'Africa/Johannesburg'
    );
}

function startOfWeekForCafe(cafe) {
    const tz = cafe?.timezone || 'Africa/Johannesburg';
    const now = new Date();
    const localStr = now.toLocaleString('en-US', { timeZone: tz });
    const local = new Date(localStr);
    const dow = local.getDay();
    const diff = dow === 0 ? 6 : dow - 1;
    const monday = new Date(local.getTime() - diff * 86400000);
    return localDateString(monday, tz);
}

function ranges(cafe) {
    return {
        today: todayForCafe(cafe),
        week: daysAgoForCafe(cafe, 7),
        twoWeeks: daysAgoForCafe(cafe, 14),
        month: daysAgoForCafe(cafe, 30),
        quarter: daysAgoForCafe(cafe, 90),
        year: daysAgoForCafe(cafe, 365)
    };
}

function isValidTimezone(tz) {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    localDateString,
    todayForCafe,
    daysAgoForCafe,
    startOfWeekForCafe,
    ranges,
    isValidTimezone
};
