"""Live dashboard UI components for OpenCode Monitor."""

import os
import time
from typing import Dict, Any, Optional
from decimal import Decimal
from datetime import datetime
from rich.console import Console
from rich.panel import Panel
from rich.columns import Columns
from rich.text import Text
from rich.table import Table
from rich.progress import Progress, BarColumn, TextColumn
from rich.live import Live
from rich.layout import Layout

from ..models.session import SessionData, TokenUsage
from ..utils.time_utils import TimeUtils


class DashboardUI:
    """UI components for the live dashboard."""

    def __init__(self, console: Optional[Console] = None):
        """Initialize dashboard UI.

        Args:
            console: Rich console instance. If None, creates a new one.
        """
        self.console = console or Console()

    def create_header(self, session: SessionData) -> Panel:
        """Create header panel with session info."""
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        header_text = f"""[bold blue]OpenCode Live Dashboard[/bold blue]  [dim]Project:[/dim] [bold cyan]{session.project_name}[/bold cyan]  [dim]Session:[/dim] [bold white]{session.display_title}[/bold white]  [dim]Updated:[/dim] [bold white]{current_time}[/bold white]  [dim]Interactions:[/dim] [bold white]{session.interaction_count}[/bold white]"""

        return Panel(
            header_text,
            title="Dashboard",
            title_align="left",
            border_style="dim blue"
        )

    def create_token_panel(self, session: SessionData, recent_file: Optional[Any] = None) -> Panel:
        """Create token consumption panel."""
        session_tokens = session.total_tokens

        # Create compact horizontal layout
        if recent_file:
            token_text = f"""[bold blue]Recent Interaction[/bold blue]
[dim]Input:[/dim] [bold white]{recent_file.tokens.input:,}[/bold white]    [dim]Cache W:[/dim] [bold white]{recent_file.tokens.cache_write:,}[/bold white]
[dim]Output:[/dim] [bold white]{recent_file.tokens.output:,}[/bold white]   [dim]Cache R:[/dim] [bold white]{recent_file.tokens.cache_read:,}[/bold white]

[bold blue]Session Totals[/bold blue]
[dim]Input:[/dim] [bold white]{session_tokens.input:,}[/bold white]    [dim]Cache W:[/dim] [bold white]{session_tokens.cache_write:,}[/bold white]
[dim]Output:[/dim] [bold white]{session_tokens.output:,}[/bold white]   [dim]Cache R:[/dim] [bold white]{session_tokens.cache_read:,}[/bold white]
[dim]Total:[/dim] [bold cyan]{session_tokens.total:,}[/bold cyan]"""
        else:
            token_text = f"""[bold blue]Session Totals[/bold blue]
[dim]Input:[/dim] [bold white]{session_tokens.input:,}[/bold white]    [dim]Cache W:[/dim] [bold white]{session_tokens.cache_write:,}[/bold white]
[dim]Output:[/dim] [bold white]{session_tokens.output:,}[/bold white]   [dim]Cache R:[/dim] [bold white]{session_tokens.cache_read:,}[/bold white]
[dim]Total:[/dim] [bold cyan]{session_tokens.total:,}[/bold cyan]"""

        return Panel(
            token_text,
            title="Tokens",
            title_align="left",
            border_style="dim white"
        )

    def create_cost_panel(self, session: SessionData, pricing_data: Dict[str, Any],
                         quota: Optional[Decimal] = None) -> Panel:
        """Create cost tracking panel."""
        total_cost = session.calculate_total_cost(pricing_data)

        if quota:
            percentage = min(100, float(total_cost / quota) * 100)
            progress_bar = self.create_compact_progress_bar(percentage)
            cost_color = self.get_cost_color(percentage)

            cost_text = f"""[bold blue]Cost Tracking[/bold blue]
[dim]Session:[/dim] [bold white]${total_cost:.2f}[/bold white]
[dim]Quota:[/dim] [bold white]${quota:.2f}[/bold white]
[{cost_color}]{progress_bar}[/{cost_color}]"""
        else:
            cost_text = f"""[bold blue]Cost Tracking[/bold blue]
[dim]Session:[/dim] [bold white]${total_cost:.2f}[/bold white]
[dim]No quota configured[/dim]"""

        return Panel(
            cost_text,
            title="Cost",
            title_align="left",
            border_style="dim white"
        )

    def create_model_panel(self, session: SessionData, pricing_data: Dict[str, Any]) -> Panel:
        """Create model usage panel."""
        model_breakdown = session.get_model_breakdown(pricing_data)

        if not model_breakdown:
            return Panel("[dim]No model data available[/dim]", title="Models", border_style="dim white")

        model_lines = []
        for model, stats in model_breakdown.items():
            model_name = model[:25] + "..." if len(model) > 28 else model
            model_lines.append(
                f"[dim]{model_name}[/dim]  "
                f"[bold white]{stats['tokens'].total:,}[/bold white] [dim cyan]tokens[/dim cyan]  "
                f"[bold white]${stats['cost']:.2f}[/bold white]"
            )

        model_text = "\n".join(model_lines)

        return Panel(
            model_text,
            title="Models",
            title_align="left",
            border_style="dim white"
        )

    def create_context_panel(self, recent_file: Optional[Any],
                           context_window: int = 200000) -> Panel:
        """Create context window status panel."""
        if not recent_file:
            return Panel(
                "[dim]No recent interaction[/dim]",
                title="Context",
                border_style="dim white"
            )

        # Calculate context size (input + cache read + cache write from most recent)
        context_size = (recent_file.tokens.input +
                       recent_file.tokens.cache_read +
                       recent_file.tokens.cache_write)

        percentage = min(100, (context_size / context_window) * 100)
        progress_bar = self.create_compact_progress_bar(percentage, 12)
        context_color = self.get_context_color(percentage)

        context_text = f"""[dim]Size:[/dim] [bold white]{context_size:,}[/bold white]
[dim]Window:[/dim] [bold white]{context_window:,}[/bold white]
[{context_color}]{progress_bar}[/{context_color}]"""

        return Panel(
            context_text,
            title="Context",
            title_align="left",
            border_style="dim white"
        )

    def create_burn_rate_panel(self, burn_rate: float) -> Panel:
        """Create token burn rate panel."""
        if burn_rate == 0:
            burn_text = "[dim]No recent activity[/dim]"
        else:
            # Add level indicator
            if burn_rate > 10000:
                level = "[red][HIGH][/red]"
            elif burn_rate > 5000:
                level = "[yellow][MED][/yellow]"
            else:
                level = "[green][LOW][/green]"
            
            burn_text = f"""[bold white]{burn_rate:,.0f}[/bold white] [dim cyan]tok/min[/dim cyan]
{level}"""

        return Panel(
            burn_text,
            title="Rate",
            title_align="left",
            border_style="dim white"
        )

    def create_session_time_panel(self, session: SessionData) -> Panel:
        """Create session time progress panel with 5-hour maximum."""
        if not session.start_time:
            return Panel(
                "[dim]No session timing data[/dim]",
                title="Session Time",
                border_style="dim white"
            )

        # Calculate duration from start_time to now (updates continuously even when idle)
        current_time = datetime.now()
        session_duration = current_time - session.start_time
        duration_ms = int(session_duration.total_seconds() * 1000)

        # Calculate percentage based on 5-hour maximum
        max_hours = 5.0
        duration_hours = session_duration.total_seconds() / 3600
        percentage = min(100.0, (duration_hours / max_hours) * 100.0)

        # Format duration display using hours and minutes format
        duration_display = TimeUtils.format_duration_hm(duration_ms)
        
        # Create progress bar with time-based colors
        progress_bar = self.create_compact_progress_bar(percentage, 12)
        time_color = self.get_time_color(percentage)
        
        time_text = f"""[dim]Duration:[/dim] [bold white]{duration_display}[/bold white]
[dim]Max:[/dim] [bold white]{max_hours:.0f}h[/bold white]
[{time_color}]{progress_bar}[/{time_color}]"""

        return Panel(
            time_text,
            title="Session Time",
            title_align="left",
            border_style="dim white"
        )

    def create_recent_file_panel(self, recent_file: Optional[Any]) -> Panel:
        """Create recent file info panel."""
        if not recent_file:
            return Panel(
                "[dim]No recent files[/dim]",
                title="Recent",
                border_style="dim white"
            )

        # Truncate file name if too long
        file_name = recent_file.file_name
        if len(file_name) > 20:
            file_name = "..." + file_name[-17:]

        file_text = f"""[dim]File:[/dim] [bold white]{file_name}[/bold white]
[dim]Model:[/dim] [bold white]{recent_file.model_id[:15]}[/bold white]"""

        if recent_file.time_data and recent_file.time_data.duration_ms:
            duration = self.format_duration(recent_file.time_data.duration_ms)
            file_text += f"\n[dim]Duration:[/dim] [bold white]{duration}[/bold white]"

        return Panel(
            file_text,
            title="Recent",
            title_align="left",
            border_style="dim white"
        )

    def create_dashboard_layout(self, session: SessionData, recent_file: Optional[Any],
                              pricing_data: Dict[str, Any], burn_rate: float,
                              quota: Optional[Decimal] = None,
                              context_window: int = 200000) -> Layout:
        """Create the complete dashboard layout."""
        layout = Layout()

        # Create panels
        header = self.create_header(session)
        token_panel = self.create_token_panel(session, recent_file)
        cost_panel = self.create_cost_panel(session, pricing_data, quota)
        model_panel = self.create_model_panel(session, pricing_data)
        context_panel = self.create_context_panel(recent_file, context_window)
        burn_rate_panel = self.create_burn_rate_panel(burn_rate)
        session_time_panel = self.create_session_time_panel(session)
        recent_file_panel = self.create_recent_file_panel(recent_file)

        # Setup new 4-section layout structure
        layout.split_column(
            Layout(header, size=3),                    # Compact header
            Layout(name="primary", minimum_size=8),    # Main metrics
            Layout(name="secondary", size=6),          # Compact metrics
            Layout(name="models", minimum_size=4)      # Model breakdown
        )

        # Primary section: Token usage (60%) and Cost tracking (40%)
        layout["primary"].split_row(
            Layout(token_panel, ratio=3),              # 60% for token data
            Layout(cost_panel, ratio=2)                # 40% for cost data
        )

        # Secondary section: Four compact panels
        layout["secondary"].split_row(
            Layout(context_panel, ratio=1),
            Layout(burn_rate_panel, ratio=1),
            Layout(session_time_panel, ratio=1),
            Layout(recent_file_panel, ratio=1)
        )

        # Models section: Full width for model breakdown
        layout["models"].update(model_panel)

        return layout

    def create_progress_bar(self, percentage: float, width: int = 30) -> str:
        """Create a text-based progress bar."""
        filled = int(width * percentage / 100)
        bar = '█' * filled + '░' * (width - filled)
        return f"[{bar}] {percentage:.1f}%"

    def create_compact_progress_bar(self, percentage: float, width: int = 20) -> str:
        """Create a compact progress bar for space-efficient display."""
        filled = int(width * percentage / 100)
        bar = '▌' * filled + '░' * (width - filled)
        return f"{bar} {percentage:.0f}%"

    def get_cost_color(self, percentage: float) -> str:
        """Get color for cost based on percentage."""
        if percentage >= 90:
            return "red"
        elif percentage >= 75:
            return "yellow"
        elif percentage >= 50:
            return "orange"
        else:
            return "green"

    def get_context_color(self, percentage: float) -> str:
        """Get color for context window based on percentage."""
        if percentage >= 95:
            return "red"
        elif percentage >= 85:
            return "yellow"
        elif percentage >= 70:
            return "orange"
        else:
            return "green"

    def get_time_color(self, percentage: float) -> str:
        """Get color for session time based on percentage of 5-hour max."""
        if percentage >= 90:
            return "red"
        elif percentage >= 75:
            return "yellow"
        elif percentage >= 50:
            return "orange"
        else:
            return "green"

    def format_duration(self, milliseconds: int) -> str:
        """Format duration in milliseconds to hours and minutes format."""
        return TimeUtils.format_duration_hm(milliseconds)

    def clear_screen(self):
        """Clear the terminal screen."""
        os.system('cls' if os.name == 'nt' else 'clear')

    def create_simple_table(self, data: Dict[str, Any]) -> Table:
        """Create a simple data table for fallback rendering."""
        table = Table(show_header=False, box=None)
        table.add_column("Key", style="cyan")
        table.add_column("Value", style="white")

        for key, value in data.items():
            table.add_row(key, str(value))

        return table