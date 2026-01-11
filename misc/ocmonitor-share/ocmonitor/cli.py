"""Command line interface for OpenCode Monitor."""

import click
import json
from decimal import Decimal
from pathlib import Path
from typing import Optional
from rich.console import Console

from .config import config_manager
from .services.session_analyzer import SessionAnalyzer
from .services.report_generator import ReportGenerator
from .services.export_service import ExportService
from .services.live_monitor import LiveMonitor
from .utils.error_handling import ErrorHandler, handle_errors, create_user_friendly_error
from . import __version__


def json_serializer(obj):
    """Custom JSON serializer for special types."""
    if hasattr(obj, 'model_dump'):
        return obj.model_dump()
    elif isinstance(obj, Decimal):
        return float(obj)
    elif hasattr(obj, 'isoformat'):
        return obj.isoformat()
    else:
        return str(obj)


@click.group()
@click.version_option(version=__version__)
@click.option('--config', '-c', type=click.Path(exists=True),
              help='Path to configuration file')
@click.option('--verbose', '-v', is_flag=True, help='Enable verbose output')
@click.pass_context
def cli(ctx: click.Context, config: Optional[str], verbose: bool):
    """OpenCode Monitor - Analytics and monitoring for OpenCode sessions.

    Monitor token usage, costs, and performance metrics from your OpenCode
    AI coding sessions with beautiful tables and real-time dashboards.
    """
    # Initialize context object
    ctx.ensure_object(dict)
    ctx.obj['verbose'] = verbose
    ctx.obj['console'] = Console()
    ctx.obj['error_handler'] = ErrorHandler(verbose=verbose)

    # Load configuration
    try:
        if config:
            config_manager.config_path = config
            config_manager.reload()

        ctx.obj['config'] = config_manager.config
        ctx.obj['pricing_data'] = config_manager.load_pricing_data()

        # Initialize services
        analyzer = SessionAnalyzer(ctx.obj['pricing_data'])
        ctx.obj['analyzer'] = analyzer
        ctx.obj['report_generator'] = ReportGenerator(analyzer, ctx.obj['console'])
        ctx.obj['export_service'] = ExportService(ctx.obj['config'].paths.export_dir)
        ctx.obj['live_monitor'] = LiveMonitor(ctx.obj['pricing_data'], ctx.obj['console'])

    except Exception as e:
        error_msg = create_user_friendly_error(e)
        click.echo(f"Error initializing OpenCode Monitor: {error_msg}", err=True)
        if verbose:
            click.echo(f"Details: {str(e)}", err=True)
        ctx.exit(1)


@cli.command()
@click.argument('path', type=click.Path(exists=True), required=False)
@click.option('--format', '-f', 'output_format',
              type=click.Choice(['table', 'json', 'csv']),
              default='table', help='Output format')
@click.pass_context
def session(ctx: click.Context, path: Optional[str], output_format: str):
    """Analyze a single OpenCode session directory.

    PATH: Path to session directory (defaults to current directory)
    """
    if not path:
        path = str(Path.cwd())

    try:
        report_generator = ctx.obj['report_generator']
        result = report_generator.generate_single_session_report(path, output_format)

        if result is None:
            click.echo("No valid session data found in the specified directory.", err=True)
            ctx.exit(1)

        if output_format == 'json':
            click.echo(json.dumps(result, indent=2, default=json_serializer))
        elif output_format == 'csv':
            click.echo("CSV data would be exported to file. Use 'export' command for file output.")

    except Exception as e:
        error_msg = create_user_friendly_error(e)
        click.echo(f"Error analyzing session: {error_msg}", err=True)
        if ctx.obj['verbose']:
            click.echo(f"Details: {str(e)}", err=True)
        ctx.exit(1)


@cli.command()
@click.argument('path', type=click.Path(exists=True), required=False)
@click.option('--format', '-f', 'output_format',
              type=click.Choice(['table', 'json', 'csv']),
              default='table', help='Output format')
@click.option('--limit', '-l', type=int, default=None,
              help='Limit number of sessions to analyze')
@click.pass_context
def sessions(ctx: click.Context, path: Optional[str], output_format: str, limit: Optional[int]):
    """Analyze all OpenCode sessions in a directory.

    PATH: Path to directory containing session folders
          (defaults to configured messages directory)
    """
    config = ctx.obj['config']

    if not path:
        path = config.paths.messages_dir

    try:
        analyzer = ctx.obj['analyzer']
        report_generator = ctx.obj['report_generator']

        if limit:
            sessions = analyzer.analyze_all_sessions(path, limit)
            click.echo(f"Analyzing {len(sessions)} most recent sessions...")
        else:
            sessions = analyzer.analyze_all_sessions(path)
            click.echo(f"Analyzing {len(sessions)} sessions...")

        if not sessions:
            click.echo("No sessions found in the specified directory.", err=True)
            ctx.exit(1)

        result = report_generator.generate_sessions_summary_report(path, limit, output_format)

        if output_format == 'json':
            click.echo(json.dumps(result, indent=2, default=json_serializer))
        elif output_format == 'csv':
            click.echo("CSV data would be exported to file. Use 'export' command for file output.")

    except Exception as e:
        error_msg = create_user_friendly_error(e)
        click.echo(f"Error analyzing sessions: {error_msg}", err=True)
        if ctx.obj['verbose']:
            click.echo(f"Details: {str(e)}", err=True)
        ctx.exit(1)


@cli.command()
@click.argument('path', type=click.Path(exists=True), required=False)
@click.option('--interval', '-i', type=int, default=None,
              help='Update interval in seconds')
@click.option('--no-color', is_flag=True, help='Disable colored output')
@click.pass_context
def live(ctx: click.Context, path: Optional[str], interval: Optional[int], no_color: bool):
    """Start live dashboard for monitoring the most recent session.

    PATH: Path to directory containing session folders
          (defaults to configured messages directory)
    """
    config = ctx.obj['config']

    if not path:
        path = config.paths.messages_dir

    if interval is None:
        interval = config.ui.live_refresh_interval

    try:
        live_monitor = ctx.obj['live_monitor']

        # Validate monitoring setup
        validation = live_monitor.validate_monitoring_setup(path)
        if not validation['valid']:
            for issue in validation['issues']:
                click.echo(f"Error: {issue}", err=True)
            ctx.exit(1)

        if validation['warnings']:
            for warning in validation['warnings']:
                click.echo(f"Warning: {warning}")

        click.echo(f"[green]Starting live dashboard...[/green]")
        click.echo(f"Monitoring: {path}")
        click.echo(f"Update interval: {interval}s")

        live_monitor.start_monitoring(path, interval)

    except KeyboardInterrupt:
        click.echo("\nLive monitoring stopped.")
    except Exception as e:
        error_msg = create_user_friendly_error(e)
        click.echo(f"Error in live monitoring: {error_msg}", err=True)
        if ctx.obj['verbose']:
            click.echo(f"Details: {str(e)}", err=True)
        ctx.exit(1)


@cli.command()
@click.argument('path', type=click.Path(exists=True), required=False)
@click.option('--month', type=str, help='Month to analyze (YYYY-MM format)')
@click.option('--format', '-f', 'output_format',
              type=click.Choice(['table', 'json', 'csv']),
              default='table', help='Output format')
@click.option('--breakdown', is_flag=True, help='Show per-model breakdown')
@click.pass_context
def daily(ctx: click.Context, path: Optional[str], month: Optional[str], output_format: str, breakdown: bool):
    """Show daily breakdown of OpenCode usage.

    PATH: Path to directory containing session folders
          (defaults to configured messages directory)
    """
    config = ctx.obj['config']

    if not path:
        path = config.paths.messages_dir

    try:
        report_generator = ctx.obj['report_generator']
        result = report_generator.generate_daily_report(path, month, output_format, breakdown)

        if output_format == 'json':
            click.echo(json.dumps(result, indent=2, default=json_serializer))
        elif output_format == 'csv':
            click.echo("CSV data would be exported to file. Use 'export' command for file output.")

    except Exception as e:
        error_msg = create_user_friendly_error(e)
        click.echo(f"Error generating daily breakdown: {error_msg}", err=True)
        if ctx.obj['verbose']:
            click.echo(f"Details: {str(e)}", err=True)
        ctx.exit(1)


@cli.command()
@click.argument('path', type=click.Path(exists=True), required=False)
@click.option('--year', type=int, help='Year to analyze')
@click.option('--start-day', 
              type=click.Choice(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], 
                               case_sensitive=False),
              default='monday',
              help='Day to start the week (default: monday)')
@click.option('--format', '-f', 'output_format',
              type=click.Choice(['table', 'json', 'csv']),
              default='table', help='Output format')
@click.option('--breakdown', is_flag=True, help='Show per-model breakdown')
@click.pass_context
def weekly(ctx: click.Context, path: Optional[str], year: Optional[int], start_day: str, output_format: str, breakdown: bool):
    """Show weekly breakdown of OpenCode usage.

    PATH: Path to directory containing session folders
          (defaults to configured messages directory)
          
    Examples:
        ocmonitor weekly                    # Default (Monday start)
        ocmonitor weekly --start-day sunday # Sunday to Sunday weeks
        ocmonitor weekly --start-day friday # Friday to Friday weeks
    """
    config = ctx.obj['config']

    if not path:
        path = config.paths.messages_dir

    # Convert day name to weekday number
    from .utils.time_utils import WEEKDAY_MAP
    week_start_day = WEEKDAY_MAP[start_day.lower()]

    try:
        report_generator = ctx.obj['report_generator']
        result = report_generator.generate_weekly_report(path, year, output_format, breakdown, week_start_day)

        if output_format == 'json':
            click.echo(json.dumps(result, indent=2, default=json_serializer))
        elif output_format == 'csv':
            click.echo("CSV data would be exported to file. Use 'export' command for file output.")

    except Exception as e:
        error_msg = create_user_friendly_error(e)
        click.echo(f"Error generating weekly breakdown: {error_msg}", err=True)
        if ctx.obj['verbose']:
            click.echo(f"Details: {str(e)}", err=True)
        ctx.exit(1)


@cli.command()
@click.argument('path', type=click.Path(exists=True), required=False)
@click.option('--year', type=int, help='Year to analyze')
@click.option('--format', '-f', 'output_format',
              type=click.Choice(['table', 'json', 'csv']),
              default='table', help='Output format')
@click.option('--breakdown', is_flag=True, help='Show per-model breakdown')
@click.pass_context
def monthly(ctx: click.Context, path: Optional[str], year: Optional[int], output_format: str, breakdown: bool):
    """Show monthly breakdown of OpenCode usage.

    PATH: Path to directory containing session folders
          (defaults to configured messages directory)
    """
    config = ctx.obj['config']

    if not path:
        path = config.paths.messages_dir

    try:
        report_generator = ctx.obj['report_generator']
        result = report_generator.generate_monthly_report(path, year, output_format, breakdown)

        if output_format == 'json':
            click.echo(json.dumps(result, indent=2, default=json_serializer))
        elif output_format == 'csv':
            click.echo("CSV data would be exported to file. Use 'export' command for file output.")

    except Exception as e:
        error_msg = create_user_friendly_error(e)
        click.echo(f"Error generating monthly breakdown: {error_msg}", err=True)
        if ctx.obj['verbose']:
            click.echo(f"Details: {str(e)}", err=True)
        ctx.exit(1)


@cli.command()
@click.argument('path', type=click.Path(exists=True), required=False)
@click.option('--timeframe', type=click.Choice(['daily', 'weekly', 'monthly', 'all']),
              default='all', help='Timeframe for analysis')
@click.option('--start-date', type=str, help='Start date (YYYY-MM-DD)')
@click.option('--end-date', type=str, help='End date (YYYY-MM-DD)')
@click.option('--format', '-f', 'output_format',
              type=click.Choice(['table', 'json', 'csv']),
              default='table', help='Output format')
@click.pass_context
def models(ctx: click.Context, path: Optional[str], timeframe: str,
           start_date: Optional[str], end_date: Optional[str], output_format: str):
    """Show model usage breakdown and statistics.

    PATH: Path to directory containing session folders
          (defaults to configured messages directory)
    """
    config = ctx.obj['config']

    if not path:
        path = config.paths.messages_dir

    try:
        report_generator = ctx.obj['report_generator']
        result = report_generator.generate_models_report(
            path, timeframe, start_date, end_date, output_format
        )

        if output_format == 'json':
            click.echo(json.dumps(result, indent=2, default=json_serializer))
        elif output_format == 'csv':
            click.echo("CSV data would be exported to file. Use 'export' command for file output.")

    except Exception as e:
        error_msg = create_user_friendly_error(e)
        click.echo(f"Error generating model breakdown: {error_msg}", err=True)
        if ctx.obj['verbose']:
            click.echo(f"Details: {str(e)}", err=True)
        ctx.exit(1)


@cli.command()
@click.argument('path', type=click.Path(exists=True), required=False)
@click.option('--timeframe', type=click.Choice(['daily', 'weekly', 'monthly', 'all']),
              default='all', help='Timeframe for analysis')
@click.option('--start-date', type=str, help='Start date (YYYY-MM-DD)')
@click.option('--end-date', type=str, help='End date (YYYY-MM-DD)')
@click.option('--format', '-f', 'output_format',
              type=click.Choice(['table', 'json', 'csv']),
              default='table', help='Output format')
@click.pass_context
def projects(ctx: click.Context, path: Optional[str], timeframe: str,
           start_date: Optional[str], end_date: Optional[str], output_format: str):
    """Show project usage breakdown and statistics.

    PATH: Path to directory containing session folders
          (defaults to configured messages directory)
    """
    config = ctx.obj['config']

    if not path:
        path = config.paths.messages_dir

    try:
        report_generator = ctx.obj['report_generator']
        result = report_generator.generate_projects_report(
            path, timeframe, start_date, end_date, output_format
        )

        if output_format == 'json':
            click.echo(json.dumps(result, indent=2, default=json_serializer))
        elif output_format == 'csv':
            click.echo("CSV data would be exported to file. Use 'export' command for file output.")

    except Exception as e:
        error_msg = create_user_friendly_error(e)
        click.echo(f"Error generating project breakdown: {error_msg}", err=True)
        if ctx.obj['verbose']:
            click.echo(f"Details: {str(e)}", err=True)
        ctx.exit(1)


@cli.command()
@click.argument('report_type', type=click.Choice([
    'session', 'sessions', 'daily', 'weekly', 'monthly', 'models', 'projects'
]))
@click.argument('path', type=click.Path(exists=True), required=False)
@click.option('--format', '-f', 'export_format',
              type=click.Choice(['csv', 'json']),
              help='Export format (defaults to configured format)')
@click.option('--output', '-o', type=click.Path(),
              help='Output file path')
@click.option('--include-raw', is_flag=True,
              help='Include raw data in export')
@click.pass_context
def export(ctx: click.Context, report_type: str, path: Optional[str],
           export_format: Optional[str], output: Optional[str], include_raw: bool):
    """Export analysis results to file.

    REPORT_TYPE: Type of report to export
    PATH: Path to analyze (defaults to configured messages directory)
    """
    config = ctx.obj['config']

    if not path:
        path = config.paths.messages_dir

    if not export_format:
        export_format = config.export.default_format

    try:
        report_generator = ctx.obj['report_generator']
        export_service = ctx.obj['export_service']

        # Generate report data
        report_data = None
        if report_type == 'session':
            report_data = report_generator.generate_single_session_report(path, 'json')
        elif report_type == 'sessions':
            report_data = report_generator.generate_sessions_summary_report(path, None, 'table')  # Use 'table' to get raw data
        elif report_type == 'daily':
            report_data = report_generator.generate_daily_report(path, None, 'table')  # Use 'table' to get raw data
        elif report_type == 'weekly':
            report_data = report_generator.generate_weekly_report(path, None, 'table', False, 0)  # Use 'table' to get raw data, Monday start
        elif report_type == 'monthly':
            report_data = report_generator.generate_monthly_report(path, None, 'table')  # Use 'table' to get raw data
        elif report_type == 'models':
            report_data = report_generator.generate_models_report(path, 'all', None, None, 'table')  # Use 'table' to get raw data
        elif report_type == 'projects':
            report_data = report_generator.generate_projects_report(path, 'all', None, None, 'table')  # Use 'table' to get raw data

        if not report_data:
            click.echo("No data to export.", err=True)
            ctx.exit(1)

        # Export the data
        output_path = export_service.export_report_data(
            report_data, report_type, export_format, output, config.export.include_metadata
        )

        # Get export summary
        summary = export_service.get_export_summary(output_path)
        click.echo(f"✅ Export completed successfully!")
        click.echo(f"File: {output_path}")
        click.echo(f"Size: {summary.get('size_human', 'Unknown')}")
        if 'rows' in summary:
            click.echo(f"Rows: {summary['rows']}")

    except Exception as e:
        error_msg = create_user_friendly_error(e)
        click.echo(f"Error exporting data: {error_msg}", err=True)
        if ctx.obj['verbose']:
            click.echo(f"Details: {str(e)}", err=True)
        ctx.exit(1)


@cli.group()
def config():
    """Configuration management commands."""
    pass


@config.command('show')
@click.pass_context
def config_show(ctx: click.Context):
    """Show current configuration."""
    try:
        config = ctx.obj['config']
        pricing_data = ctx.obj['pricing_data']

        click.echo("📋 Current Configuration:")
        click.echo()
        click.echo("📁 Paths:")
        click.echo(f"  Messages directory: {config.paths.messages_dir}")
        click.echo(f"  Export directory: {config.paths.export_dir}")
        click.echo()
        click.echo("🎨 UI Settings:")
        click.echo(f"  Table style: {config.ui.table_style}")
        click.echo(f"  Progress bars: {config.ui.progress_bars}")
        click.echo(f"  Colors: {config.ui.colors}")
        click.echo(f"  Live refresh interval: {config.ui.live_refresh_interval}s")
        click.echo()
        click.echo("📤 Export Settings:")
        click.echo(f"  Default format: {config.export.default_format}")
        click.echo(f"  Include metadata: {config.export.include_metadata}")
        click.echo()
        click.echo("🤖 Models:")
        click.echo(f"  Configured models: {len(pricing_data)}")
        for model_name in sorted(pricing_data.keys()):
            click.echo(f"    - {model_name}")

    except Exception as e:
        error_msg = create_user_friendly_error(e)
        click.echo(f"Error showing configuration: {error_msg}", err=True)


@config.command('set')
@click.argument('key')
@click.argument('value')
@click.pass_context
def config_set(ctx: click.Context, key: str, value: str):
    """Set configuration value.

    KEY: Configuration key (e.g., 'paths.messages_dir')
    VALUE: New value to set
    """
    click.echo(f"Configuration setting is not yet implemented.")
    click.echo(f"Would set {key} = {value}")
    click.echo("Please edit the config.toml file directly for now.")


def main():
    """Entry point for the CLI application."""
    cli()