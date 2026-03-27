/**
 * FORMATTING UTILITIES
 * Date, money, time, and percentage formatters.
 */

/**
 * Format a date string as "Mon DD" (e.g., "Apr 15").
 * @param {string|null} dateStr - ISO date string (YYYY-MM-DD)
 */
export function formatShortDate(dateStr) {
  if (!dateStr) return '\u2014';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date string as "Wed, Apr 15, 2026".
 * @param {string|null} dateStr - ISO date string
 */
export function formatFullDate(dateStr) {
  if (!dateStr) return 'TBD';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a number as currency (e.g., "$1,200").
 * @param {number|null} amount
 */
export function formatMoney(amount) {
  if (typeof amount === 'number' && amount > 0) {
    return `$${amount.toLocaleString()}`;
  }
  return amount === 0 ? '$0' : '\u2014';
}

/**
 * Calculate days from today to an event date.
 * @param {string|null} dateStr - ISO date string
 * @returns {number|null} Days until event, or null if no date
 */
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const eventDate = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate percentage (safe division).
 * @param {number} part
 * @param {number} whole
 * @returns {number} Percentage (0-100), or 0 if whole is 0
 */
export function percentage(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Format time from Monday hour column value.
 * Monday hour columns return { hour: number, minute: number }.
 * @param {object|string|null} hourValue
 * @returns {string} Formatted time (e.g., "2:00 PM") or "TBD"
 */
export function formatTime(hourValue) {
  if (!hourValue) return 'TBD';
  if (typeof hourValue === 'string') return hourValue;
  const { hour, minute } = hourValue;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  const displayMinute = String(minute).padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
}
