"""Report generation service for OpenCode Monitor."""

from typing import List, Dict, Any, Optional
from datetime import date
from decimal import Decimal
from collections import defaultdict
from rich.console import Console
from rich.panel import Panel

from ..models.session import SessionData
from ..models.analytics import DailyUsage, WeeklyUsage, MonthlyUsage, ModelBreakdownReport, ProjectBreakdownReport
from ..ui.tables import TableFormatter
from ..services.session_analyzer import SessionAnalyzer
from ..config import ModelPricing


class ReportGenerator:
    """Service for generating various types of reports."""

    def __init__(self, analyzer: SessionAnalyzer, console: Optional[Console] = None):
        """Initialize report generator.

        Args:
            analyzer: SessionAnalyzer instance
            console: Rich console for output
        """
        self.analyzer = analyzer
        self.table_formatter = TableFormatter(console)
        self.console = console or Console()

    def _get_model_breakdown_for_sessions(self, sessions: List[SessionData]) -> List[Dict[str, Any]]:
        """Calculate per-model breakdown for a set of sessions.

        Args:
            sessions: List of sessions to analyze

        Returns:
            List of model breakdown dicts sorted by cost descending
        """
        model_data: Dict[str, Dict[str, Any]] = {}

        for session in sessions:
            for file in session.files:
                model = file.model_id
                if model not in model_data:
                    model_data[model] = {
                        'sessions': set(),
                        'interactions': 0,
                        'tokens': 0,
                        'cost': Decimal('0.0')
                    }
                model_data[model]['sessions'].add(session.session_id)
                model_data[model]['interactions'] += 1
                model_data[model]['tokens'] += file.tokens.total
                model_data[model]['cost'] += file.calculate_cost(self.analyzer.pricing_data)

        results = []
        for model, data in model_data.items():
            results.append({
                'model': model,
                'sessions': len(data['sessions']),
                'interactions': data['interactions'],
                'tokens': data['tokens'],
                'cost': data['cost']
            })

        return sorted(results, key=lambda x: x['cost'], reverse=True)

    def generate_single_session_report(self, session_path: str, output_format: str = "table") -> Optional[Dict[str, Any]]:
        """Generate report for a single session.

        Args:
            session_path: Path to session directory
            output_format: Output format ("table", "json", "csv")

        Returns:
            Report data or None if session not found
        """
        session = self.analyzer.analyze_single_session(session_path)
        if not session:
            return None

        # Get detailed statistics
        stats = self.analyzer.get_session_statistics(session)
        health = self.analyzer.validate_session_health(session)

        report_data = {
            'type': 'single_session',
            'session': session,
            'statistics': stats,
            'health': health
        }

        if output_format == "table":
            self._display_single_session_table(session, stats, health)
        elif output_format == "json":
            return self._format_single_session_json(session, stats, health)
        elif output_format == "csv":
            return self._format_single_session_csv(session, stats)

        return report_data

    def generate_sessions_summary_report(self, base_path: str, limit: Optional[int] = None,
                                       output_format: str = "table") -> Dict[str, Any]:
        """Generate summary report for all sessions.

        Args:
            base_path: Path to directory containing sessions
            limit: Maximum number of sessions to analyze
            output_format: Output format ("table", "json", "csv")

        Returns:
            Report data
        """
        sessions = self.analyzer.analyze_all_sessions(base_path, limit)
        summary = self.analyzer.get_sessions_summary(sessions)

        report_data = {
            'type': 'sessions_summary',
            'sessions': sessions,
            'summary': summary
        }

        if output_format == "table":
            self._display_sessions_summary_table(sessions, summary)
        elif output_format == "json":
            return self._format_sessions_summary_json(sessions, summary)
        elif output_format == "csv":
            return self._format_sessions_summary_csv(sessions)

        return report_data

    def generate_daily_report(self, base_path: str, month: Optional[str] = None,
                            output_format: str = "table", breakdown: bool = False) -> Dict[str, Any]:
        """Generate daily breakdown report.

        Args:
            base_path: Path to directory containing sessions
            month: Optional month filter (YYYY-MM format)
            output_format: Output format ("table", "json", "csv")

        Returns:
            Report data
        """
        sessions = self.analyzer.analyze_all_sessions(base_path)

        # Apply month filter if specified
        if month:
            from ..utils.time_utils import TimeUtils
            month_data = TimeUtils.parse_month_string(month)
            if month_data:
                year, month_num = month_data
                start_date, end_date = TimeUtils.get_month_range(year, month_num)
                sessions = self.analyzer.filter_sessions_by_date(sessions, start_date, end_date)

        daily_usage = self.analyzer.create_daily_breakdown(sessions)

        report_data = {
            'type': 'daily_breakdown',
            'daily_usage': daily_usage,
            'filter': {'month': month} if month else None
        }

        if output_format == "table":
            self._display_daily_breakdown_table(daily_usage, breakdown)
        elif output_format == "json":
            return self._format_daily_breakdown_json(daily_usage)
        elif output_format == "csv":
            return self._format_daily_breakdown_csv(daily_usage)

        return report_data

    def generate_weekly_report(self, base_path: str, year: Optional[int] = None,
                              output_format: str = "table", breakdown: bool = False,
                              week_start_day: int = 0) -> Dict[str, Any]:
        """Generate weekly breakdown report.

        Args:
            base_path: Path to directory containing sessions
            year: Optional year filter
            output_format: Output format ("table", "json", "csv")
            breakdown: Show per-model breakdown
            week_start_day: Day to start week on (0=Monday, 6=Sunday)

        Returns:
            Report data
        """
        sessions = self.analyzer.analyze_all_sessions(base_path)

        # Apply year filter if specified
        if year:
            from ..utils.time_utils import TimeUtils
            start_date, end_date = TimeUtils.get_year_range(year)
            sessions = self.analyzer.filter_sessions_by_date(sessions, start_date, end_date)

        weekly_usage = self.analyzer.create_weekly_breakdown(sessions, week_start_day)

        report_data = {
            'type': 'weekly_breakdown',
            'weekly_usage': weekly_usage,
            'filter': {'year': year, 'week_start_day': week_start_day} if year or week_start_day != 0 else None
        }

        if output_format == "table":
            self._display_weekly_breakdown_table(weekly_usage, breakdown, week_start_day)
        elif output_format == "json":
            return self._format_weekly_breakdown_json(weekly_usage)
        elif output_format == "csv":
            return self._format_weekly_breakdown_csv(weekly_usage)

        return report_data

    def generate_monthly_report(self, base_path: str, year: Optional[int] = None,
                              output_format: str = "table", breakdown: bool = False) -> Dict[str, Any]:
        """Generate monthly breakdown report.

        Args:
            base_path: Path to directory containing sessions
            year: Optional year filter
            output_format: Output format ("table", "json", "csv")

        Returns:
            Report data
        """
        sessions = self.analyzer.analyze_all_sessions(base_path)

        # Apply year filter if specified
        if year:
            from ..utils.time_utils import TimeUtils
            start_date, end_date = TimeUtils.get_year_range(year)
            sessions = self.analyzer.filter_sessions_by_date(sessions, start_date, end_date)

        monthly_usage = self.analyzer.create_monthly_breakdown(sessions)

        report_data = {
            'type': 'monthly_breakdown',
            'monthly_usage': monthly_usage,
            'filter': {'year': year} if year else None
        }

        if output_format == "table":
            self._display_monthly_breakdown_table(monthly_usage, breakdown)
        elif output_format == "json":
            return self._format_monthly_breakdown_json(monthly_usage)
        elif output_format == "csv":
            return self._format_monthly_breakdown_csv(monthly_usage)

        return report_data

    def generate_models_report(self, base_path: str, timeframe: str = "all",
                             start_date: Optional[str] = None, end_date: Optional[str] = None,
                             output_format: str = "table") -> Dict[str, Any]:
        """Generate model usage breakdown report.

        Args:
            base_path: Path to directory containing sessions
            timeframe: Timeframe for analysis
            start_date: Start date (YYYY-MM-DD format)
            end_date: End date (YYYY-MM-DD format)
            output_format: Output format ("table", "json", "csv")

        Returns:
            Report data
        """
        sessions = self.analyzer.analyze_all_sessions(base_path)

        # Parse date filters
        from ..utils.time_utils import TimeUtils
        parsed_start_date = TimeUtils.parse_date_string(start_date) if start_date else None
        parsed_end_date = TimeUtils.parse_date_string(end_date) if end_date else None

        model_breakdown = self.analyzer.create_model_breakdown(
            sessions, timeframe, parsed_start_date, parsed_end_date
        )

        report_data = {
            'type': 'models_breakdown',
            'model_breakdown': model_breakdown,
            'filter': {
                'timeframe': timeframe,
                'start_date': start_date,
                'end_date': end_date
            }
        }

        if output_format == "table":
            self._display_models_breakdown_table(model_breakdown)
        elif output_format == "json":
            return self._format_models_breakdown_json(model_breakdown)
        elif output_format == "csv":
            return self._format_models_breakdown_csv(model_breakdown)

        return report_data

    def generate_projects_report(self, base_path: str, timeframe: str = "all",
                               start_date: Optional[str] = None, end_date: Optional[str] = None,
                               output_format: str = "table") -> Dict[str, Any]:
        """Generate project usage breakdown report.

        Args:
            base_path: Path to directory containing sessions
            timeframe: Timeframe for analysis
            start_date: Start date (YYYY-MM-DD format)
            end_date: End date (YYYY-MM-DD format)
            output_format: Output format ("table", "json", "csv")

        Returns:
            Report data
        """
        sessions = self.analyzer.analyze_all_sessions(base_path)

        # Parse date filters
        from ..utils.time_utils import TimeUtils
        parsed_start_date = TimeUtils.parse_date_string(start_date) if start_date else None
        parsed_end_date = TimeUtils.parse_date_string(end_date) if end_date else None

        project_breakdown = self.analyzer.create_project_breakdown(
            sessions, timeframe, parsed_start_date, parsed_end_date
        )

        report_data = {
            'type': 'projects_breakdown',
            'project_breakdown': project_breakdown,
            'filter': {
                'timeframe': timeframe,
                'start_date': start_date,
                'end_date': end_date
            }
        }

        if output_format == "table":
            self._display_projects_breakdown_table(project_breakdown)
        elif output_format == "json":
            return self._format_projects_breakdown_json(project_breakdown)
        elif output_format == "csv":
            return self._format_projects_breakdown_csv(project_breakdown)

        return report_data

    # Table display methods
    def _display_single_session_table(self, session: SessionData, stats: Dict[str, Any], health: Dict[str, Any]):
        """Display single session report as table."""
        # Create session details table
        table = self.table_formatter.create_session_table(session, self.analyzer.pricing_data)
        self.console.print(table)

        # Create summary panel
        summary_panel = self.table_formatter.create_summary_panel([session], self.analyzer.pricing_data)
        self.console.print(summary_panel)

        # Show health warnings if any
        if health['warnings']:
            warning_text = "\n".join([f"⚠️  {warning}" for warning in health['warnings']])
            warning_panel = Panel(warning_text, title="Warnings", border_style="yellow")
            self.console.print(warning_panel)

    def _display_sessions_summary_table(self, sessions: List[SessionData], summary: Dict[str, Any]):
        """Display sessions summary as table."""
        table = self.table_formatter.create_sessions_table(sessions, self.analyzer.pricing_data)
        self.console.print(table)

        summary_panel = self.table_formatter.create_summary_panel(sessions, self.analyzer.pricing_data)
        self.console.print(summary_panel)

    def _display_daily_breakdown_table(self, daily_usage: List[DailyUsage], breakdown: bool = False):
        """Display daily breakdown as table."""
        if breakdown:
            from rich.table import Table
            table = Table(
                title="Daily Usage Breakdown",
                show_header=True,
                header_style="bold blue",
                title_style="bold magenta"
            )
            
            table.add_column("Date / Model", style="cyan", no_wrap=True)
            table.add_column("Sessions", justify="right", style="green")
            table.add_column("Interactions", justify="right", style="yellow")
            table.add_column("Total Tokens", justify="right", style="white")
            table.add_column("Cost", justify="right", style="red")
            
            for day in daily_usage:
                day_cost = day.calculate_total_cost(self.analyzer.pricing_data)
                table.add_row(
                    day.date.strftime('%Y-%m-%d'),
                    f"{len(day.sessions)}",
                    f"{day.total_interactions}",
                    f"{day.total_tokens.total:,}",
                    f"${day_cost:.2f}"
                )
                
                model_breakdown = self._get_model_breakdown_for_sessions(day.sessions)
                for model_data in model_breakdown:
                    table.add_row(
                        f"  ↳ {model_data['model']}",
                        f"{model_data['sessions']}",
                        f"{model_data['interactions']}",
                        f"{model_data['tokens']:,}",
                        f"${model_data['cost']:.2f}",
                        style="dim"
                    )
            
            self.console.print(table)
        else:
            table = self.table_formatter.create_daily_table(daily_usage, self.analyzer.pricing_data)
            self.console.print(table)

    def _display_weekly_breakdown_table(self, weekly_usage: List[WeeklyUsage], breakdown: bool = False, week_start_day: int = 0):
        """Display weekly breakdown as table.
        
        Args:
            weekly_usage: List of weekly usage data
            breakdown: Show per-model breakdown
            week_start_day: Day week starts on (0=Monday, 6=Sunday)
        """
        from rich.table import Table
        from ..utils.time_utils import TimeUtils, WEEKDAY_NAMES
        
        title = "Weekly Usage Breakdown"
        if week_start_day != 0:
            day_name = WEEKDAY_NAMES[week_start_day]
            title += f" (weeks start on {day_name})"
        
        table = Table(
            title=title,
            show_header=True,
            header_style="bold blue",
            title_style="bold magenta"
        )

        table.add_column("Week", style="cyan", no_wrap=True)
        table.add_column("Date Range", style="dim cyan", no_wrap=False)
        table.add_column("Sessions", justify="right", style="green")
        table.add_column("Interactions", justify="right", style="yellow")
        table.add_column("Total Tokens", justify="right", style="white")
        table.add_column("Cost", justify="right", style="red")

        for week in weekly_usage:
            week_cost = week.calculate_total_cost(self.analyzer.pricing_data)
            week_label = f"{week.year}-W{week.week:02d}"
            date_range = TimeUtils.format_week_range(week.start_date, week.end_date)
            
            table.add_row(
                week_label,
                date_range,
                f"{week.total_sessions}",
                f"{week.total_interactions}",
                f"{week.total_tokens.total:,}",
                f"${week_cost:.2f}"
            )
            
            if breakdown:
                week_sessions = []
                for day in week.daily_usage:
                    week_sessions.extend(day.sessions)
                
                model_breakdown = self._get_model_breakdown_for_sessions(week_sessions)
                for model_data in model_breakdown:
                    table.add_row(
                        "",
                        f"  ↳ {model_data['model']}",
                        f"{model_data['sessions']}",
                        f"{model_data['interactions']}",
                        f"{model_data['tokens']:,}",
                        f"${model_data['cost']:.2f}",
                        style="dim"
                    )

        self.console.print(table)

    def _display_monthly_breakdown_table(self, monthly_usage: List[MonthlyUsage], breakdown: bool = False):
        """Display monthly breakdown as table."""
        from rich.table import Table
        table = Table(
            title="Monthly Usage Breakdown",
            show_header=True,
            header_style="bold blue",
            title_style="bold magenta"
        )

        table.add_column("Month / Model", style="cyan", no_wrap=True)
        table.add_column("Sessions", justify="right", style="green")
        table.add_column("Interactions", justify="right", style="yellow")
        table.add_column("Total Tokens", justify="right", style="white")
        table.add_column("Cost", justify="right", style="red")

        for month in monthly_usage:
            month_cost = month.calculate_total_cost(self.analyzer.pricing_data)
            table.add_row(
                f"{month.year}-{month.month:02d}",
                f"{month.total_sessions}",
                f"{month.total_interactions}",
                f"{month.total_tokens.total:,}",
                f"${month_cost:.2f}"
            )
            
            if breakdown:
                month_sessions = []
                for week in month.weekly_usage:
                    for day in week.daily_usage:
                        month_sessions.extend(day.sessions)
                
                model_breakdown = self._get_model_breakdown_for_sessions(month_sessions)
                for model_data in model_breakdown:
                    table.add_row(
                        f"  ↳ {model_data['model']}",
                        f"{model_data['sessions']}",
                        f"{model_data['interactions']}",
                        f"{model_data['tokens']:,}",
                        f"${model_data['cost']:.2f}",
                        style="dim"
                    )

        self.console.print(table)

    def _display_models_breakdown_table(self, model_breakdown: ModelBreakdownReport):
        """Display models breakdown as table."""
        table = self.table_formatter.create_model_breakdown_table(model_breakdown.model_stats)
        self.console.print(table)

    def _display_projects_breakdown_table(self, project_breakdown: ProjectBreakdownReport):
        """Display projects breakdown as table."""
        from rich.table import Table
        table = Table(title="Project Usage Breakdown", show_header=True)

        table.add_column("Project", style="cyan")
        table.add_column("Sessions", justify="right", style="green")
        table.add_column("Interactions", justify="right", style="green")
        table.add_column("Total Tokens", justify="right", style="bold blue")
        table.add_column("Cost", justify="right", style="red")
        table.add_column("Models Used", style="dim cyan")

        for project in project_breakdown.project_stats:
            # Truncate models list if too long
            models_display = ", ".join(project.models_used)
            if len(models_display) > 40:
                models_display = models_display[:37] + "..."
            
            table.add_row(
                project.project_name,
                f"{project.total_sessions}",
                f"{project.total_interactions}",
                f"{project.total_tokens.total:,}",
                f"${project.total_cost:.4f}",
                models_display
            )

        self.console.print(table)

        # Add summary
        from rich.panel import Panel
        summary_text = (
            f"Total: {len(project_breakdown.project_stats)} projects, "
            f"{sum(p.total_sessions for p in project_breakdown.project_stats)} sessions, "
            f"{sum(p.total_interactions for p in project_breakdown.project_stats)} interactions, "
            f"{project_breakdown.total_tokens.total:,} tokens, "
            f"${project_breakdown.total_cost:.2f}"
        )
        summary_panel = Panel(summary_text, title="Summary", border_style="green")
        self.console.print(summary_panel)

    # JSON formatting methods
    def _format_single_session_json(self, session: SessionData, stats: Dict[str, Any], health: Dict[str, Any]) -> Dict[str, Any]:
        """Format single session data as JSON."""
        return {
            'session_id': session.session_id,
            'session_title': session.session_title,
            'project_name': session.project_name,
            'statistics': {
                'interaction_count': stats['interaction_count'],
                'total_tokens': stats['total_tokens'].model_dump(),
                'total_cost': float(stats['total_cost']),
                'models_used': stats['models_used']
            },
            'health': health,
            'interactions': [
                {
                    'file_name': file.file_name,
                    'model_id': file.model_id,
                    'tokens': file.tokens.model_dump(),
                    'cost': float(file.calculate_cost(self.analyzer.pricing_data))
                }
                for file in session.files
            ]
        }

    def _format_sessions_summary_json(self, sessions: List[SessionData], summary: Dict[str, Any]) -> Dict[str, Any]:
        """Format sessions summary as JSON."""
        return {
            'summary': {
                'total_sessions': summary['total_sessions'],
                'total_interactions': summary['total_interactions'],
                'total_tokens': summary['total_tokens'].model_dump(),
                'total_cost': float(summary['total_cost']),
                'models_used': summary['models_used'],
                'date_range': summary['date_range']
            },
            'sessions': [
                {
                    'session_id': session.session_id,
                    'session_title': session.session_title,
                    'project_name': session.project_name,
                    'interaction_count': session.interaction_count,
                    'total_tokens': session.total_tokens.model_dump(),
                    'total_cost': float(session.calculate_total_cost(self.analyzer.pricing_data)),
                    'models_used': session.models_used,
                    'start_time': session.start_time.isoformat() if session.start_time else None,
                    'end_time': session.end_time.isoformat() if session.end_time else None
                }
                for session in sessions
            ]
        }

    def _format_daily_breakdown_json(self, daily_usage: List[DailyUsage]) -> Dict[str, Any]:
        """Format daily breakdown as JSON."""
        return {
            'daily_breakdown': [
                {
                    'date': day.date.isoformat(),
                    'sessions': len(day.sessions),
                    'interactions': day.total_interactions,
                    'tokens': day.total_tokens.model_dump(),
                    'cost': float(day.calculate_total_cost(self.analyzer.pricing_data)),
                    'models_used': day.models_used
                }
                for day in daily_usage
            ]
        }

    def _format_weekly_breakdown_json(self, weekly_usage: List[WeeklyUsage]) -> Dict[str, Any]:
        """Format weekly breakdown as JSON."""
        return {
            'weekly_breakdown': [
                {
                    'year': week.year,
                    'week': week.week,
                    'start_date': week.start_date.isoformat(),
                    'end_date': week.end_date.isoformat(),
                    'sessions': week.total_sessions,
                    'interactions': week.total_interactions,
                    'tokens': week.total_tokens.model_dump(),
                    'cost': float(week.calculate_total_cost(self.analyzer.pricing_data))
                }
                for week in weekly_usage
            ]
        }

    def _format_monthly_breakdown_json(self, monthly_usage: List[MonthlyUsage]) -> Dict[str, Any]:
        """Format monthly breakdown as JSON."""
        return {
            'monthly_breakdown': [
                {
                    'year': month.year,
                    'month': month.month,
                    'sessions': month.total_sessions,
                    'interactions': month.total_interactions,
                    'tokens': month.total_tokens.model_dump(),
                    'cost': float(month.calculate_total_cost(self.analyzer.pricing_data))
                }
                for month in monthly_usage
            ]
        }

    def _format_models_breakdown_json(self, model_breakdown: ModelBreakdownReport) -> Dict[str, Any]:
        """Format models breakdown as JSON."""
        return {
            'timeframe': model_breakdown.timeframe,
            'start_date': model_breakdown.start_date.isoformat() if model_breakdown.start_date else None,
            'end_date': model_breakdown.end_date.isoformat() if model_breakdown.end_date else None,
            'total_cost': float(model_breakdown.total_cost),
            'total_tokens': model_breakdown.total_tokens.model_dump(),
            'models': [
                {
                    'model_name': model.model_name,
                    'sessions': model.total_sessions,
                    'interactions': model.total_interactions,
                    'tokens': model.total_tokens.model_dump(),
                    'cost': float(model.total_cost),
                    'first_used': model.first_used.isoformat() if model.first_used else None,
                    'last_used': model.last_used.isoformat() if model.last_used else None
                }
                for model in model_breakdown.model_stats
            ]
        }

    # CSV formatting methods (returning data structures for export service)
    def _format_single_session_csv(self, session: SessionData, stats: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Format single session data for CSV export."""
        return [
            {
                'session_id': session.session_id,
                'session_title': session.session_title,
                'project_name': session.project_name,
                'file_name': file.file_name,
                'model_id': file.model_id,
                'input_tokens': file.tokens.input,
                'output_tokens': file.tokens.output,
                'cache_write_tokens': file.tokens.cache_write,
                'cache_read_tokens': file.tokens.cache_read,
                'total_tokens': file.tokens.total,
                'cost': float(file.calculate_cost(self.analyzer.pricing_data)),
                'duration_ms': file.time_data.duration_ms if file.time_data else None
            }
            for file in session.files
        ]

    def _format_sessions_summary_csv(self, sessions: List[SessionData]) -> List[Dict[str, Any]]:
        """Format sessions summary for CSV export."""
        rows = []
        for session in sessions:
            model_breakdown = session.get_model_breakdown(self.analyzer.pricing_data)
            for model, stats in model_breakdown.items():
                rows.append({
                    'session_id': session.session_id,
                    'session_title': session.session_title,
                    'project_name': session.project_name,
                    'start_time': session.start_time.isoformat() if session.start_time else None,
                    'duration_ms': session.duration_ms,
                    'model': model,
                    'interactions': stats['files'],
                    'input_tokens': stats['tokens'].input,
                    'output_tokens': stats['tokens'].output,
                    'cache_write_tokens': stats['tokens'].cache_write,
                    'cache_read_tokens': stats['tokens'].cache_read,
                    'total_tokens': stats['tokens'].total,
                    'cost': float(stats['cost'])
                })
        return rows

    def _format_daily_breakdown_csv(self, daily_usage: List[DailyUsage]) -> List[Dict[str, Any]]:
        """Format daily breakdown for CSV export."""
        return [
            {
                'date': day.date.isoformat(),
                'sessions': len(day.sessions),
                'interactions': day.total_interactions,
                'input_tokens': day.total_tokens.input,
                'output_tokens': day.total_tokens.output,
                'cache_write_tokens': day.total_tokens.cache_write,
                'cache_read_tokens': day.total_tokens.cache_read,
                'total_tokens': day.total_tokens.total,
                'cost': float(day.calculate_total_cost(self.analyzer.pricing_data)),
                'models_used': ', '.join(day.models_used)
            }
            for day in daily_usage
        ]

    def _format_weekly_breakdown_csv(self, weekly_usage: List[WeeklyUsage]) -> List[Dict[str, Any]]:
        """Format weekly breakdown for CSV export."""
        return [
            {
                'year': week.year,
                'week': week.week,
                'start_date': week.start_date.isoformat(),
                'end_date': week.end_date.isoformat(),
                'sessions': week.total_sessions,
                'interactions': week.total_interactions,
                'input_tokens': week.total_tokens.input,
                'output_tokens': week.total_tokens.output,
                'cache_write_tokens': week.total_tokens.cache_write,
                'cache_read_tokens': week.total_tokens.cache_read,
                'total_tokens': week.total_tokens.total,
                'cost': float(week.calculate_total_cost(self.analyzer.pricing_data))
            }
            for week in weekly_usage
        ]

    def _format_monthly_breakdown_csv(self, monthly_usage: List[MonthlyUsage]) -> List[Dict[str, Any]]:
        """Format monthly breakdown for CSV export."""
        return [
            {
                'year': month.year,
                'month': month.month,
                'sessions': month.total_sessions,
                'interactions': month.total_interactions,
                'input_tokens': month.total_tokens.input,
                'output_tokens': month.total_tokens.output,
                'cache_write_tokens': month.total_tokens.cache_write,
                'cache_read_tokens': month.total_tokens.cache_read,
                'total_tokens': month.total_tokens.total,
                'cost': float(month.calculate_total_cost(self.analyzer.pricing_data))
            }
            for month in monthly_usage
        ]

    def _format_models_breakdown_csv(self, model_breakdown: ModelBreakdownReport) -> List[Dict[str, Any]]:
        """Format models breakdown for CSV export."""
        return [
            {
                'model_name': model.model_name,
                'sessions': model.total_sessions,
                'interactions': model.total_interactions,
                'input_tokens': model.total_tokens.input,
                'output_tokens': model.total_tokens.output,
                'cache_write_tokens': model.total_tokens.cache_write,
                'cache_read_tokens': model.total_tokens.cache_read,
                'total_tokens': model.total_tokens.total,
                'cost': float(model.total_cost),
                'first_used': model.first_used.isoformat() if model.first_used else None,
                'last_used': model.last_used.isoformat() if model.last_used else None
            }
            for model in model_breakdown.model_stats
        ]

    def _format_projects_breakdown_json(self, project_breakdown: ProjectBreakdownReport) -> Dict[str, Any]:
        """Format projects breakdown as JSON."""
        return {
            'timeframe': project_breakdown.timeframe,
            'start_date': project_breakdown.start_date.isoformat() if project_breakdown.start_date else None,
            'end_date': project_breakdown.end_date.isoformat() if project_breakdown.end_date else None,
            'total_cost': float(project_breakdown.total_cost),
            'total_tokens': project_breakdown.total_tokens.model_dump(),
            'projects': [
                {
                    'project_name': project.project_name,
                    'sessions': project.total_sessions,
                    'interactions': project.total_interactions,
                    'tokens': project.total_tokens.model_dump(),
                    'cost': float(project.total_cost),
                    'models_used': project.models_used,
                    'first_activity': project.first_activity.isoformat() if project.first_activity else None,
                    'last_activity': project.last_activity.isoformat() if project.last_activity else None
                }
                for project in project_breakdown.project_stats
            ]
        }

    def _format_projects_breakdown_csv(self, project_breakdown: ProjectBreakdownReport) -> List[Dict[str, Any]]:
        """Format projects breakdown for CSV export."""
        return [
            {
                'project_name': project.project_name,
                'sessions': project.total_sessions,
                'interactions': project.total_interactions,
                'input_tokens': project.total_tokens.input,
                'output_tokens': project.total_tokens.output,
                'cache_write_tokens': project.total_tokens.cache_write,
                'cache_read_tokens': project.total_tokens.cache_read,
                'total_tokens': project.total_tokens.total,
                'cost': float(project.total_cost),
                'models_used': ', '.join(project.models_used),
                'first_activity': project.first_activity.isoformat() if project.first_activity else None,
                'last_activity': project.last_activity.isoformat() if project.last_activity else None
            }
            for project in project_breakdown.project_stats
        ]