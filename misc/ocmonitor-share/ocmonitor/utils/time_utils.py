"""Time utility functions for OpenCode Monitor."""

from datetime import datetime, date, timedelta
from typing import Optional, Tuple

WEEKDAY_MAP = {
    'monday': 0,
    'tuesday': 1,
    'wednesday': 2,
    'thursday': 3,
    'friday': 4,
    'saturday': 5,
    'sunday': 6
}

WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

WEEKDAY_MAP = {
    'monday': 0,
    'tuesday': 1,
    'wednesday': 2,
    'thursday': 3,
    'friday': 4,
    'saturday': 5,
    'sunday': 6
}

WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


class TimeUtils:
    """Utility functions for time operations."""

    @staticmethod
    def format_timestamp(timestamp_ms: Optional[int]) -> str:
        """Convert timestamp in milliseconds to readable format.

        Args:
            timestamp_ms: Timestamp in milliseconds

        Returns:
            Formatted timestamp string
        """
        if timestamp_ms is None:
            return 'N/A'

        try:
            dt = datetime.fromtimestamp(timestamp_ms / 1000)
            return dt.strftime('%Y-%m-%d %H:%M:%S')
        except (ValueError, OSError):
            return 'Invalid'

    @staticmethod
    def format_duration(milliseconds: Optional[int]) -> str:
        """Format duration in milliseconds to hours and minutes format (e.g., "1h 30m").

        Args:
            milliseconds: Duration in milliseconds

        Returns:
            Formatted duration string in "Xh Ym" format
        """
        return TimeUtils.format_duration_hm(milliseconds)

    @staticmethod
    def format_duration_hm(milliseconds: Optional[int]) -> str:
        """Format duration in milliseconds to hours and minutes format (e.g., "1h 30m").

        Args:
            milliseconds: Duration in milliseconds

        Returns:
            Formatted duration string in "Xh Ym" format
        """
        if milliseconds is None or milliseconds < 0:
            return 'N/A'

        total_seconds = milliseconds / 1000
        total_minutes = total_seconds / 60

        if total_minutes < 1:
            return f"{total_seconds:.0f}s"
        elif total_minutes < 60:
            return f"{total_minutes:.0f}m"
        else:
            hours = int(total_minutes // 60)
            minutes = int(total_minutes % 60)
            if minutes == 0:
                return f"{hours}h"
            else:
                return f"{hours}h {minutes}m"

    @staticmethod
    def parse_date_string(date_str: str) -> Optional[date]:
        """Parse date string in YYYY-MM-DD format.

        Args:
            date_str: Date string to parse

        Returns:
            Date object or None if parsing failed
        """
        try:
            return datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return None

    @staticmethod
    def parse_month_string(month_str: str) -> Optional[Tuple[int, int]]:
        """Parse month string in YYYY-MM format.

        Args:
            month_str: Month string to parse

        Returns:
            Tuple of (year, month) or None if parsing failed
        """
        try:
            dt = datetime.strptime(month_str, '%Y-%m')
            return dt.year, dt.month
        except ValueError:
            return None

    @staticmethod
    def get_month_range(year: int, month: int) -> Tuple[date, date]:
        """Get the start and end dates for a given month.

        Args:
            year: Year
            month: Month (1-12)

        Returns:
            Tuple of (start_date, end_date) for the month
        """
        start_date = date(year, month, 1)

        # Get the first day of next month, then subtract one day
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)

        end_date = next_month - timedelta(days=1)
        return start_date, end_date

    @staticmethod
    def get_week_range(year: int, week: int) -> Tuple[date, date]:
        """Get the start and end dates for a given ISO week.

        Args:
            year: Year
            week: Week number (1-53)

        Returns:
            Tuple of (start_date, end_date) for the week
        """
        # January 4th is always in the first week of the year
        jan_4 = date(year, 1, 4)
        week_start = jan_4 - timedelta(days=jan_4.weekday()) + timedelta(weeks=week-1)
        week_end = week_start + timedelta(days=6)
        return week_start, week_end

    @staticmethod
    def get_year_range(year: int) -> Tuple[date, date]:
        """Get the start and end dates for a given year.

        Args:
            year: Year

        Returns:
            Tuple of (start_date, end_date) for the year
        """
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)
        return start_date, end_date

    @staticmethod
    def get_current_month_range() -> Tuple[date, date]:
        """Get the start and end dates for the current month.

        Returns:
            Tuple of (start_date, end_date) for current month
        """
        today = date.today()
        return TimeUtils.get_month_range(today.year, today.month)

    @staticmethod
    def get_current_week_range() -> Tuple[date, date]:
        """Get the start and end dates for the current week.

        Returns:
            Tuple of (start_date, end_date) for current week
        """
        today = date.today()
        year, week, _ = today.isocalendar()
        return TimeUtils.get_week_range(year, week)

    @staticmethod
    def get_custom_week_start(target_date: date, week_start_day: int = 0) -> date:
        """Get the start date of the week containing target_date.

        Args:
            target_date: The date to find the week start for
            week_start_day: Day of week to start on (0=Monday, 6=Sunday)

        Returns:
            Date of the week's start day

        Example:
            If target_date is 2025-10-23 (Thursday) and week_start_day is 6 (Sunday):
            Returns 2025-10-19 (the previous Sunday)
        """
        current_weekday = target_date.weekday()
        days_back = (current_weekday - week_start_day) % 7
        week_start = target_date - timedelta(days=days_back)
        return week_start

    @staticmethod
    def get_custom_week_range(target_date: date, week_start_day: int = 0) -> Tuple[date, date]:
        """Get the start and end dates for the week containing target_date.

        Args:
            target_date: Date within the week
            week_start_day: Day of week to start on (0=Monday, 6=Sunday)

        Returns:
            Tuple of (start_date, end_date) for the week
        """
        week_start = TimeUtils.get_custom_week_start(target_date, week_start_day)
        week_end = week_start + timedelta(days=6)
        return week_start, week_end

    @staticmethod
    def format_week_range(start_date: date, end_date: date) -> str:
        """Format week range as readable string.

        Args:
            start_date: Week start date
            end_date: Week end date

        Returns:
            Formatted string like "Oct 19 - Oct 25, 2025"
        """
        if start_date.year == end_date.year:
            if start_date.month == end_date.month:
                return f"{start_date.strftime('%b %d')} - {end_date.strftime('%d, %Y')}"
            else:
                return f"{start_date.strftime('%b %d')} - {end_date.strftime('%b %d, %Y')}"
        else:
            return f"{start_date.strftime('%b %d, %Y')} - {end_date.strftime('%b %d, %Y')}"

    @staticmethod
    def date_in_range(check_date: date, start_date: Optional[date], end_date: Optional[date]) -> bool:
        """Check if a date falls within a given range.

        Args:
            check_date: Date to check
            start_date: Start of range (inclusive), None means no start limit
            end_date: End of range (inclusive), None means no end limit

        Returns:
            True if date is in range, False otherwise
        """
        if start_date and check_date < start_date:
            return False
        if end_date and check_date > end_date:
            return False
        return True

    @staticmethod
    def datetime_in_range(check_datetime: datetime, start_date: Optional[date], end_date: Optional[date]) -> bool:
        """Check if a datetime falls within a given date range.

        Args:
            check_datetime: Datetime to check
            start_date: Start of range (inclusive), None means no start limit
            end_date: End of range (inclusive), None means no end limit

        Returns:
            True if datetime is in range, False otherwise
        """
        check_date = check_datetime.date()
        return TimeUtils.date_in_range(check_date, start_date, end_date)

    @staticmethod
    def get_relative_time_description(dt: datetime) -> str:
        """Get a human-readable description of how long ago a datetime was.

        Args:
            dt: Datetime to describe

        Returns:
            Human-readable relative time description
        """
        now = datetime.now()
        diff = now - dt

        if diff.total_seconds() < 60:
            return "just now"
        elif diff.total_seconds() < 3600:
            minutes = int(diff.total_seconds() / 60)
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        elif diff.total_seconds() < 86400:
            hours = int(diff.total_seconds() / 3600)
            return f"{hours} hour{'s' if hours != 1 else ''} ago"
        elif diff.days < 7:
            return f"{diff.days} day{'s' if diff.days != 1 else ''} ago"
        elif diff.days < 30:
            weeks = diff.days // 7
            return f"{weeks} week{'s' if weeks != 1 else ''} ago"
        else:
            months = diff.days // 30
            return f"{months} month{'s' if months != 1 else ''} ago"

    @staticmethod
    def format_date_range(start_date: Optional[date], end_date: Optional[date]) -> str:
        """Format a date range as a human-readable string.

        Args:
            start_date: Start date (None means open-ended)
            end_date: End date (None means open-ended)

        Returns:
            Formatted date range string
        """
        if start_date is None and end_date is None:
            return "All time"
        elif start_date is None:
            return f"Up to {end_date.strftime('%Y-%m-%d')}"
        elif end_date is None:
            return f"From {start_date.strftime('%Y-%m-%d')}"
        elif start_date == end_date:
            return start_date.strftime('%Y-%m-%d')
        else:
            return f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}"