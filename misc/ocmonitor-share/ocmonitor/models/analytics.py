"""Analytics data models for OpenCode Monitor."""

from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from decimal import Decimal
from pydantic import BaseModel, Field, computed_field
from collections import defaultdict
from .session import SessionData, TokenUsage


class DailyUsage(BaseModel):
    """Model for daily usage statistics."""
    date: date
    sessions: List[SessionData] = Field(default_factory=list)

    @computed_field
    @property
    def total_tokens(self) -> TokenUsage:
        """Calculate total tokens for the day."""
        total = TokenUsage()
        for session in self.sessions:
            session_tokens = session.total_tokens
            total.input += session_tokens.input
            total.output += session_tokens.output
            total.cache_write += session_tokens.cache_write
            total.cache_read += session_tokens.cache_read
        return total

    @computed_field
    @property
    def total_interactions(self) -> int:
        """Calculate total interactions for the day."""
        return sum(session.interaction_count for session in self.sessions)

    @computed_field
    @property
    def models_used(self) -> List[str]:
        """Get unique models used on this day."""
        models = set()
        for session in self.sessions:
            models.update(session.models_used)
        return list(models)

    def calculate_total_cost(self, pricing_data: Dict[str, Any]) -> Decimal:
        """Calculate total cost for the day."""
        return sum((session.calculate_total_cost(pricing_data) for session in self.sessions), Decimal('0.0'))


class WeeklyUsage(BaseModel):
    """Model for weekly usage statistics."""
    year: int
    week: int
    start_date: date
    end_date: date
    daily_usage: List[DailyUsage] = Field(default_factory=list)

    @computed_field
    @property
    def total_tokens(self) -> TokenUsage:
        """Calculate total tokens for the week."""
        total = TokenUsage()
        for day in self.daily_usage:
            day_tokens = day.total_tokens
            total.input += day_tokens.input
            total.output += day_tokens.output
            total.cache_write += day_tokens.cache_write
            total.cache_read += day_tokens.cache_read
        return total

    @computed_field
    @property
    def total_sessions(self) -> int:
        """Calculate total sessions for the week."""
        return sum(len(day.sessions) for day in self.daily_usage)

    @computed_field
    @property
    def total_interactions(self) -> int:
        """Calculate total interactions for the week."""
        return sum(day.total_interactions for day in self.daily_usage)

    def calculate_total_cost(self, pricing_data: Dict[str, Any]) -> Decimal:
        """Calculate total cost for the week."""
        return sum((day.calculate_total_cost(pricing_data) for day in self.daily_usage), Decimal('0.0'))


class MonthlyUsage(BaseModel):
    """Model for monthly usage statistics."""
    year: int
    month: int
    weekly_usage: List[WeeklyUsage] = Field(default_factory=list)

    @computed_field
    @property
    def total_tokens(self) -> TokenUsage:
        """Calculate total tokens for the month."""
        total = TokenUsage()
        for week in self.weekly_usage:
            week_tokens = week.total_tokens
            total.input += week_tokens.input
            total.output += week_tokens.output
            total.cache_write += week_tokens.cache_write
            total.cache_read += week_tokens.cache_read
        return total

    @computed_field
    @property
    def total_sessions(self) -> int:
        """Calculate total sessions for the month."""
        return sum(week.total_sessions for week in self.weekly_usage)

    @computed_field
    @property
    def total_interactions(self) -> int:
        """Calculate total interactions for the month."""
        return sum(week.total_interactions for week in self.weekly_usage)

    def calculate_total_cost(self, pricing_data: Dict[str, Any]) -> Decimal:
        """Calculate total cost for the month."""
        return sum((week.calculate_total_cost(pricing_data) for week in self.weekly_usage), Decimal('0.0'))


class ModelUsageStats(BaseModel):
    """Model for model-specific usage statistics."""
    model_name: str
    total_tokens: TokenUsage = Field(default_factory=TokenUsage)
    total_sessions: int = Field(default=0)
    total_interactions: int = Field(default=0)
    total_cost: Decimal = Field(default=Decimal('0.0'))
    first_used: Optional[datetime] = Field(default=None)
    last_used: Optional[datetime] = Field(default=None)


class ModelBreakdownReport(BaseModel):
    """Model for model usage breakdown report."""
    timeframe: str  # "daily", "weekly", "monthly", "all"
    start_date: Optional[date] = Field(default=None)
    end_date: Optional[date] = Field(default=None)
    model_stats: List[ModelUsageStats] = Field(default_factory=list)

    @computed_field
    @property
    def total_cost(self) -> Decimal:
        """Calculate total cost across all models."""
        return sum((model.total_cost for model in self.model_stats), Decimal('0.0'))

    @computed_field
    @property
    def total_tokens(self) -> TokenUsage:
        """Calculate total tokens across all models."""
        total = TokenUsage()
        for model in self.model_stats:
            total.input += model.total_tokens.input
            total.output += model.total_tokens.output
            total.cache_write += model.total_tokens.cache_write
            total.cache_read += model.total_tokens.cache_read
        return total


class ProjectUsageStats(BaseModel):
    """Model for project-specific usage statistics."""
    project_name: str
    total_tokens: TokenUsage = Field(default_factory=TokenUsage)
    total_sessions: int = Field(default=0)
    total_interactions: int = Field(default=0)
    total_cost: Decimal = Field(default=Decimal('0.0'))
    models_used: List[str] = Field(default_factory=list)
    first_activity: Optional[datetime] = Field(default=None)
    last_activity: Optional[datetime] = Field(default=None)


class ProjectBreakdownReport(BaseModel):
    """Model for project usage breakdown report."""
    timeframe: str  # "daily", "weekly", "monthly", "all"
    start_date: Optional[date] = Field(default=None)
    end_date: Optional[date] = Field(default=None)
    project_stats: List[ProjectUsageStats] = Field(default_factory=list)

    @computed_field
    @property
    def total_cost(self) -> Decimal:
        """Calculate total cost across all projects."""
        return sum(project.total_cost for project in self.project_stats)

    @computed_field
    @property
    def total_tokens(self) -> TokenUsage:
        """Calculate total tokens across all projects."""
        total = TokenUsage()
        for project in self.project_stats:
            total.input += project.total_tokens.input
            total.output += project.total_tokens.output
            total.cache_write += project.total_tokens.cache_write
            total.cache_read += project.total_tokens.cache_read
        return total


class TimeframeAnalyzer:
    """Analyzer for different timeframe breakdowns."""

    @staticmethod
    def create_daily_breakdown(sessions: List[SessionData]) -> List[DailyUsage]:
        """Create daily breakdown from sessions."""
        daily_data = defaultdict(list)

        for session in sessions:
            if session.start_time:
                session_date = session.start_time.date()
                daily_data[session_date].append(session)

        return [
            DailyUsage(date=date_key, sessions=sessions_list)
            for date_key, sessions_list in sorted(daily_data.items())
        ]

    @staticmethod
    def create_weekly_breakdown(daily_usage: List[DailyUsage], week_start_day: int = 0) -> List[WeeklyUsage]:
        """Create weekly breakdown from daily usage.
        
        Args:
            daily_usage: List of daily usage records
            week_start_day: Day to start week on (0=Monday, 6=Sunday)
        
        Returns:
            List of WeeklyUsage objects
        """
        from ..utils.time_utils import TimeUtils
        
        weekly_data = defaultdict(list)

        for day in daily_usage:
            # Get the week start date for this day
            week_start, week_end = TimeUtils.get_custom_week_range(day.date, week_start_day)
            
            # Use (week_start, week_end) tuple as key for grouping
            week_key = (week_start, week_end)
            weekly_data[week_key].append(day)

        weekly_breakdown = []
        for (week_start, week_end), days in sorted(weekly_data.items()):
            # For display purposes, calculate ISO week number for the week_start
            year, week, _ = week_start.isocalendar()
            
            weekly_breakdown.append(WeeklyUsage(
                year=year,
                week=week,
                start_date=week_start,
                end_date=week_end,
                daily_usage=sorted(days, key=lambda d: d.date)
            ))

        return weekly_breakdown

    @staticmethod
    def create_monthly_breakdown(weekly_usage: List[WeeklyUsage]) -> List[MonthlyUsage]:
        """Create monthly breakdown from weekly usage."""
        monthly_data = defaultdict(list)

        for week in weekly_usage:
            # Assign week to month based on start date
            month_key = (week.start_date.year, week.start_date.month)
            monthly_data[month_key].append(week)

        return [
            MonthlyUsage(year=year, month=month, weekly_usage=weeks)
            for (year, month), weeks in sorted(monthly_data.items())
        ]

    @staticmethod
    def create_model_breakdown(
        sessions: List[SessionData],
        pricing_data: Dict[str, Any],
        timeframe: str = "all",
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> ModelBreakdownReport:
        """Create model usage breakdown."""
        # Filter sessions by date range if specified
        filtered_sessions = sessions
        if start_date or end_date:
            filtered_sessions = []
            for session in sessions:
                if session.start_time:
                    session_date = session.start_time.date()
                    if start_date and session_date < start_date:
                        continue
                    if end_date and session_date > end_date:
                        continue
                    filtered_sessions.append(session)

        model_data = defaultdict(lambda: {
            'tokens': TokenUsage(),
            'sessions': set(),
            'interactions': 0,
            'cost': Decimal('0.0'),
            'first_used': None,
            'last_used': None
        })

        for session in filtered_sessions:
            for model in session.models_used:
                model_files = [f for f in session.files if f.model_id == model]
                model_stats = model_data[model]

                # Update token counts
                for file in model_files:
                    model_stats['tokens'].input += file.tokens.input
                    model_stats['tokens'].output += file.tokens.output
                    model_stats['tokens'].cache_write += file.tokens.cache_write
                    model_stats['tokens'].cache_read += file.tokens.cache_read
                    model_stats['interactions'] += 1
                    model_stats['cost'] += file.calculate_cost(pricing_data)

                # Track sessions
                model_stats['sessions'].add(session.session_id)

                # Update first/last used times
                if session.start_time:
                    if (model_stats['first_used'] is None or
                        session.start_time < model_stats['first_used']):
                        model_stats['first_used'] = session.start_time

                if session.end_time:
                    if (model_stats['last_used'] is None or
                        session.end_time > model_stats['last_used']):
                        model_stats['last_used'] = session.end_time

        # Convert to ModelUsageStats objects
        model_stats = []
        for model_name, stats in model_data.items():
            model_stats.append(ModelUsageStats(
                model_name=model_name,
                total_tokens=stats['tokens'],
                total_sessions=len(stats['sessions']),
                total_interactions=stats['interactions'],
                total_cost=stats['cost'],
                first_used=stats['first_used'],
                last_used=stats['last_used']
            ))

        # Sort by total cost descending
        model_stats.sort(key=lambda x: x.total_cost, reverse=True)

        return ModelBreakdownReport(
            timeframe=timeframe,
            start_date=start_date,
            end_date=end_date,
            model_stats=model_stats
        )

    @staticmethod
    def create_project_breakdown(
        sessions: List[SessionData],
        pricing_data: Dict[str, Any],
        timeframe: str = "all",
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> 'ProjectBreakdownReport':
        """Create project usage breakdown."""
        # Filter sessions by date range if specified
        filtered_sessions = sessions
        if start_date or end_date:
            filtered_sessions = []
            for session in sessions:
                if session.start_time:
                    session_date = session.start_time.date()
                    if start_date and session_date < start_date:
                        continue
                    if end_date and session_date > end_date:
                        continue
                    filtered_sessions.append(session)

        project_data = defaultdict(lambda: {
            'tokens': TokenUsage(),
            'sessions': 0,
            'interactions': 0,
            'cost': Decimal('0.0'),
            'models_used': set(),
            'first_activity': None,
            'last_activity': None
        })

        for session in filtered_sessions:
            project_name = session.project_name or "Unknown"
            project_stats = project_data[project_name]
            
            # Update aggregated data
            session_tokens = session.total_tokens
            project_stats['tokens'].input += session_tokens.input
            project_stats['tokens'].output += session_tokens.output
            project_stats['tokens'].cache_write += session_tokens.cache_write
            project_stats['tokens'].cache_read += session_tokens.cache_read
            
            project_stats['sessions'] += 1
            project_stats['interactions'] += session.interaction_count
            project_stats['cost'] += session.calculate_total_cost(pricing_data)
            project_stats['models_used'].update(session.models_used)
            
            # Track first/last activity times
            if session.start_time:
                if (project_stats['first_activity'] is None or 
                    session.start_time < project_stats['first_activity']):
                    project_stats['first_activity'] = session.start_time
                    
            if session.end_time:
                if (project_stats['last_activity'] is None or 
                    session.end_time > project_stats['last_activity']):
                    project_stats['last_activity'] = session.end_time

        # Convert to ProjectUsageStats objects
        project_stats = []
        for project_name, stats in project_data.items():
            project_stats.append(ProjectUsageStats(
                project_name=project_name,
                total_tokens=stats['tokens'],
                total_sessions=stats['sessions'],
                total_interactions=stats['interactions'],
                total_cost=stats['cost'],
                models_used=list(stats['models_used']),
                first_activity=stats['first_activity'],
                last_activity=stats['last_activity']
            ))

        # Sort by total cost descending
        project_stats.sort(key=lambda x: x.total_cost, reverse=True)

        return ProjectBreakdownReport(
            timeframe=timeframe,
            start_date=start_date,
            end_date=end_date,
            project_stats=project_stats
        )