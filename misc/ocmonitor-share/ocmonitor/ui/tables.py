"""Rich table formatting for OpenCode Monitor."""

from typing import List, Dict, Any, Optional
from decimal import Decimal
from rich.console import Console
from rich.table import Table
from rich.text import Text
from rich.panel import Panel
from rich.columns import Columns
from rich.progress import Progress, BarColumn, TextColumn, TimeRemainingColumn

from ..models.session import SessionData, TokenUsage
from ..models.analytics import DailyUsage, WeeklyUsage, MonthlyUsage, ModelUsageStats
from ..utils.time_utils import TimeUtils


class TableFormatter:
    """Formatter for creating Rich tables."""

    def __init__(self, console: Optional[Console] = None):
        """Initialize table formatter.

        Args:
            console: Rich console instance. If None, creates a new one.
        """
        self.console = console or Console()

    def format_number(self, number: int) -> str:
        """Format numbers with thousands separators."""
        return f"{number:,}"

    def format_currency(self, amount: Decimal) -> str:
        """Format currency amounts."""
        return f"${amount:.2f}"

    def format_percentage(self, value: float, total: float) -> str:
        """Format percentage values."""
        if total == 0:
            return "0.0%"
        percentage = (value / total) * 100
        return f"{percentage:.1f}%"

    def get_cost_color(self, cost: Decimal, quota: Optional[Decimal] = None) -> str:
        """Get color for cost based on quota."""
        if quota is None:
            return "white"

        percentage = float(cost / quota) * 100
        if percentage >= 90:
            return "red"
        elif percentage >= 75:
            return "yellow"
        elif percentage >= 50:
            return "orange"
        else:
            return "green"

    def create_sessions_table(self, sessions: List[SessionData], pricing_data: Dict[str, Any]) -> Table:
        """Create a table for multiple sessions."""
        table = Table(
            title="OpenCode Sessions Summary",
            show_header=True,
            header_style="bold blue",
            title_style="bold magenta"
        )

        # Add columns
        table.add_column("Started", style="cyan", no_wrap=True)
        table.add_column("Duration", style="cyan", no_wrap=True)
        table.add_column("Session", style="magenta", max_width=35)
        table.add_column("Model", style="yellow", max_width=25)
        table.add_column("Interactions", justify="right", style="green")
        table.add_column("Input Tokens", justify="right", style="blue")
        table.add_column("Output Tokens", justify="right", style="blue")
        table.add_column("Total Tokens", justify="right", style="bold blue")
        table.add_column("Cost", justify="right", style="red")

        # Sort sessions by start time
        sorted_sessions = sorted(sessions, key=lambda s: s.start_time or s.session_id)

        total_interactions = 0
        total_tokens = TokenUsage()
        total_cost = Decimal('0.0')

        for session in sorted_sessions:
            session_cost = session.calculate_total_cost(pricing_data)
            session_tokens = session.total_tokens

            # Update totals
            total_interactions += session.interaction_count
            total_tokens.input += session_tokens.input
            total_tokens.output += session_tokens.output
            total_tokens.cache_write += session_tokens.cache_write
            total_tokens.cache_read += session_tokens.cache_read
            total_cost += session_cost

            # Get model breakdown for session
            model_breakdown = session.get_model_breakdown(pricing_data)

            # Add rows for each model
            for i, (model, stats) in enumerate(model_breakdown.items()):
                # Show session info only for first model
                if i == 0:
                    start_time = session.start_time.strftime('%Y-%m-%d %H:%M:%S') if session.start_time else 'N/A'
                    duration = self._format_duration(session.duration_ms) if session.duration_ms else 'N/A'
                    session_display = session.display_title
                    # Truncate if too long for display
                    if len(session_display) > 35:
                        session_display = session_display[:32] + "..."
                else:
                    start_time = ""
                    duration = ""
                    session_display = ""

                # Format model name
                model_text = Text(model)
                if len(model) > 25:
                    model_text = Text(f"{model[:22]}...")

                # Get cost color
                cost_color = self.get_cost_color(stats['cost'])

                table.add_row(
                    start_time,
                    duration,
                    session_display,
                    model_text,
                    self.format_number(stats['files']),
                    self.format_number(stats['tokens'].input),
                    self.format_number(stats['tokens'].output),
                    self.format_number(stats['tokens'].total),
                    Text(self.format_currency(stats['cost']), style=cost_color)
                )

        # Add separator and totals
        table.add_section()
        table.add_row(
            Text("TOTALS", style="bold white"),
            "",
            "",  # Empty session column
            Text(f"{len(sorted_sessions)} sessions", style="bold white"),
            Text(self.format_number(total_interactions), style="bold green"),
            Text(self.format_number(total_tokens.input), style="bold blue"),
            Text(self.format_number(total_tokens.output), style="bold blue"),
            Text(self.format_number(total_tokens.total), style="bold blue"),
            Text(self.format_currency(total_cost), style="bold red")
        )

        return table

    def create_session_table(self, session: SessionData, pricing_data: Dict[str, Any]) -> Table:
        """Create a table for a single session."""
        table = Table(
            title=f"Session: {session.display_title}",
            show_header=True,
            header_style="bold blue",
            title_style="bold magenta"
        )

        # Add columns
        table.add_column("File", style="cyan", max_width=30)
        table.add_column("Model", style="yellow")
        table.add_column("Input", justify="right", style="blue")
        table.add_column("Output", justify="right", style="blue")
        table.add_column("Cache W", justify="right", style="green")
        table.add_column("Cache R", justify="right", style="green")
        table.add_column("Total", justify="right", style="bold blue")
        table.add_column("Cost", justify="right", style="red")
        table.add_column("Duration", justify="right", style="cyan")

        total_cost = Decimal('0.0')
        total_tokens = TokenUsage()

        for file in session.files:
            cost = file.calculate_cost(pricing_data)
            total_cost += cost
            total_tokens.input += file.tokens.input
            total_tokens.output += file.tokens.output
            total_tokens.cache_write += file.tokens.cache_write
            total_tokens.cache_read += file.tokens.cache_read

            duration = ""
            if file.time_data and file.time_data.duration_ms:
                duration = self._format_duration(file.time_data.duration_ms)

            cost_color = self.get_cost_color(cost)

            table.add_row(
                Text(file.file_name[:27] + "..." if len(file.file_name) > 30 else file.file_name),
                file.model_id,
                self.format_number(file.tokens.input),
                self.format_number(file.tokens.output),
                self.format_number(file.tokens.cache_write),
                self.format_number(file.tokens.cache_read),
                self.format_number(file.tokens.total),
                Text(self.format_currency(cost), style=cost_color),
                duration
            )

        # Add totals
        table.add_section()
        table.add_row(
            Text("TOTALS", style="bold white"),
            "",
            Text(self.format_number(total_tokens.input), style="bold blue"),
            Text(self.format_number(total_tokens.output), style="bold blue"),
            Text(self.format_number(total_tokens.cache_write), style="bold green"),
            Text(self.format_number(total_tokens.cache_read), style="bold green"),
            Text(self.format_number(total_tokens.total), style="bold blue"),
            Text(self.format_currency(total_cost), style="bold red"),
            ""
        )

        return table

    def create_daily_table(self, daily_usage: List[DailyUsage], pricing_data: Dict[str, Any]) -> Table:
        """Create a table for daily usage breakdown."""
        table = Table(
            title="Daily Usage Breakdown",
            show_header=True,
            header_style="bold blue",
            title_style="bold magenta"
        )

        # Add columns
        table.add_column("Date", style="cyan", no_wrap=True)
        table.add_column("Sessions", justify="right", style="green")
        table.add_column("Interactions", justify="right", style="green")
        table.add_column("Input Tokens", justify="right", style="blue")
        table.add_column("Output Tokens", justify="right", style="blue")
        table.add_column("Total Tokens", justify="right", style="bold blue")
        table.add_column("Cost", justify="right", style="red")
        table.add_column("Models", style="yellow")

        total_sessions = 0
        total_interactions = 0
        total_tokens = TokenUsage()
        total_cost = Decimal('0.0')

        for day in daily_usage:
            day_cost = day.calculate_total_cost(pricing_data)
            day_tokens = day.total_tokens

            total_sessions += len(day.sessions)
            total_interactions += day.total_interactions
            total_tokens.input += day_tokens.input
            total_tokens.output += day_tokens.output
            total_tokens.cache_write += day_tokens.cache_write
            total_tokens.cache_read += day_tokens.cache_read
            total_cost += day_cost

            models_text = ", ".join(day.models_used[:3])
            if len(day.models_used) > 3:
                models_text += f" (+{len(day.models_used) - 3} more)"

            cost_color = self.get_cost_color(day_cost)

            table.add_row(
                day.date.strftime('%Y-%m-%d'),
                self.format_number(len(day.sessions)),
                self.format_number(day.total_interactions),
                self.format_number(day_tokens.input),
                self.format_number(day_tokens.output),
                self.format_number(day_tokens.total),
                Text(self.format_currency(day_cost), style=cost_color),
                Text(models_text, style="yellow")
            )

        # Add totals
        table.add_section()
        table.add_row(
            Text("TOTALS", style="bold white"),
            Text(self.format_number(total_sessions), style="bold green"),
            Text(self.format_number(total_interactions), style="bold green"),
            Text(self.format_number(total_tokens.input), style="bold blue"),
            Text(self.format_number(total_tokens.output), style="bold blue"),
            Text(self.format_number(total_tokens.total), style="bold blue"),
            Text(self.format_currency(total_cost), style="bold red"),
            ""
        )

        return table

    def create_model_breakdown_table(self, model_stats: List[ModelUsageStats]) -> Table:
        """Create a table for model usage breakdown."""
        table = Table(
            title="Model Usage Breakdown",
            show_header=True,
            header_style="bold blue",
            title_style="bold magenta"
        )

        # Add columns
        table.add_column("Model", style="yellow", max_width=30)
        table.add_column("Sessions", justify="right", style="green")
        table.add_column("Interactions", justify="right", style="green")
        table.add_column("Input Tokens", justify="right", style="blue")
        table.add_column("Output Tokens", justify="right", style="blue")
        table.add_column("Total Tokens", justify="right", style="bold blue")
        table.add_column("Cost", justify="right", style="red")
        table.add_column("Cost %", justify="right", style="red")

        total_cost = sum(model.total_cost for model in model_stats)

        for model in model_stats:
            cost_percentage = self.format_percentage(float(model.total_cost), float(total_cost))
            cost_color = self.get_cost_color(model.total_cost)

            table.add_row(
                Text(model.model_name[:27] + "..." if len(model.model_name) > 30 else model.model_name),
                self.format_number(model.total_sessions),
                self.format_number(model.total_interactions),
                self.format_number(model.total_tokens.input),
                self.format_number(model.total_tokens.output),
                self.format_number(model.total_tokens.total),
                Text(self.format_currency(model.total_cost), style=cost_color),
                Text(cost_percentage, style=cost_color)
            )

        return table

    def create_progress_bar(self, percentage: float, width: int = 20) -> str:
        """Create a text-based progress bar."""
        filled = int(width * percentage / 100)
        bar = '█' * filled + '░' * (width - filled)
        return f"[{bar}] {percentage:.1f}%"

    def _format_duration(self, milliseconds: int) -> str:
        """Format duration in milliseconds to hours and minutes format."""
        return TimeUtils.format_duration_hm(milliseconds)

    def create_summary_panel(self, sessions: List[SessionData], pricing_data: Dict[str, Any]) -> Panel:
        """Create a summary panel with key metrics."""
        if not sessions:
            return Panel("No sessions found", title="Summary", title_align="left")

        total_sessions = len(sessions)
        total_interactions = sum(session.interaction_count for session in sessions)
        total_tokens = TokenUsage()
        total_cost = Decimal('0.0')
        models_used = set()

        for session in sessions:
            session_tokens = session.total_tokens
            total_tokens.input += session_tokens.input
            total_tokens.output += session_tokens.output
            total_tokens.cache_write += session_tokens.cache_write
            total_tokens.cache_read += session_tokens.cache_read
            total_cost += session.calculate_total_cost(pricing_data)
            models_used.update(session.models_used)

        # Create summary text
        summary_lines = [
            f"[bold]Sessions:[/bold] {self.format_number(total_sessions)}",
            f"[bold]Interactions:[/bold] {self.format_number(total_interactions)}",
            f"[bold]Total Tokens:[/bold] {self.format_number(total_tokens.total)}",
            f"[bold]Total Cost:[/bold] {self.format_currency(total_cost)}",
            f"[bold]Models Used:[/bold] {len(models_used)}"
        ]

        return Panel(
            "\n".join(summary_lines),
            title="Summary",
            title_align="left",
            border_style="blue"
        )