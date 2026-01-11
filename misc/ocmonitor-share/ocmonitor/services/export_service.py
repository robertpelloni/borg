"""Export service for OpenCode Monitor."""

import csv
import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional, Union
from datetime import datetime

from ..utils.formatting import DataFormatter


class ExportService:
    """Service for exporting data to various formats."""

    def __init__(self, export_dir: str = "./exports"):
        """Initialize export service.

        Args:
            export_dir: Directory to save exported files
        """
        self.export_dir = Path(export_dir)
        self.export_dir.mkdir(parents=True, exist_ok=True)

    def export_to_csv(self, data: List[Dict[str, Any]], filename: str,
                     include_metadata: bool = True) -> str:
        """Export data to CSV format.

        Args:
            data: List of dictionaries to export
            filename: Output filename (without extension)
            include_metadata: Whether to include metadata header

        Returns:
            Path to exported file

        Raises:
            ValueError: If data is empty or invalid
            IOError: If file cannot be written
        """
        if not data:
            raise ValueError("No data to export")

        # Ensure filename has .csv extension
        if not filename.endswith('.csv'):
            filename += '.csv'

        output_path = self.export_dir / filename

        try:
            with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
                # Write metadata header if requested
                if include_metadata:
                    csvfile.write(f"# OpenCode Monitor Export\n")
                    csvfile.write(f"# Generated: {datetime.now().isoformat()}\n")
                    csvfile.write(f"# Records: {len(data)}\n")
                    csvfile.write("#\n")

                # Get all unique keys from the data
                fieldnames = set()
                for row in data:
                    fieldnames.update(row.keys())
                fieldnames = sorted(list(fieldnames))

                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()

                # Write data rows, sanitizing values
                for row in data:
                    sanitized_row = {}
                    for key in fieldnames:
                        value = row.get(key)
                        if value is None:
                            sanitized_row[key] = ""
                        elif isinstance(value, (list, dict)):
                            # Convert complex types to string representation
                            sanitized_row[key] = str(value)
                        else:
                            sanitized_row[key] = DataFormatter.sanitize_for_csv(value)
                    writer.writerow(sanitized_row)

        except IOError as e:
            raise IOError(f"Failed to write CSV file: {e}")

        return str(output_path)

    def export_to_json(self, data: Union[List[Dict[str, Any]], Dict[str, Any]], filename: str,
                      include_metadata: bool = True, indent: int = 2) -> str:
        """Export data to JSON format.

        Args:
            data: Data to export (list of dicts or single dict)
            filename: Output filename (without extension)
            include_metadata: Whether to include metadata
            indent: JSON indentation level

        Returns:
            Path to exported file

        Raises:
            ValueError: If data is invalid
            IOError: If file cannot be written
        """
        if data is None:
            raise ValueError("No data to export")

        # Ensure filename has .json extension
        if not filename.endswith('.json'):
            filename += '.json'

        output_path = self.export_dir / filename

        # Prepare export data
        export_data = data
        if include_metadata:
            metadata = {
                'export_info': {
                    'generated_by': 'OpenCode Monitor',
                    'generated_at': datetime.now().isoformat(),
                    'version': '1.0.0'
                }
            }

            if isinstance(data, list):
                export_data = {
                    'metadata': metadata,
                    'data': data,
                    'record_count': len(data)
                }
            elif isinstance(data, dict):
                export_data = {
                    'metadata': metadata,
                    'data': data
                }

        try:
            with open(output_path, 'w', encoding='utf-8') as jsonfile:
                json.dump(export_data, jsonfile, indent=indent, default=self._json_serializer,
                         ensure_ascii=False)

        except IOError as e:
            raise IOError(f"Failed to write JSON file: {e}")

        return str(output_path)

    def export_report_data(self, report_data: Dict[str, Any], report_type: str,
                          format_type: str, output_filename: Optional[str] = None,
                          include_metadata: bool = True) -> str:
        """Export report data in specified format.

        Args:
            report_data: Report data from ReportGenerator
            report_type: Type of report (session, sessions, daily, etc.)
            format_type: Export format ("csv" or "json")
            output_filename: Custom filename (auto-generated if None)
            include_metadata: Whether to include metadata

        Returns:
            Path to exported file

        Raises:
            ValueError: If format or data is invalid
            IOError: If export fails
        """
        if format_type not in ["csv", "json"]:
            raise ValueError(f"Unsupported export format: {format_type}")

        # Generate filename if not provided
        if not output_filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_filename = f"ocmonitor_{report_type}_{timestamp}"

        # Extract exportable data based on report type
        export_data = self._extract_export_data(report_data, report_type)

        if format_type == "csv":
            return self.export_to_csv(export_data, output_filename, include_metadata)
        else:
            return self.export_to_json(export_data, output_filename, include_metadata)

    def _extract_export_data(self, report_data: Dict[str, Any], report_type: str) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
        """Extract exportable data from report data.

        Args:
            report_data: Raw report data
            report_type: Type of report

        Returns:
            Data suitable for export
        """
        if report_type == "single_session":
            # For single session, export interaction details
            session = report_data.get('session')
            if session:
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
                        'created_time': file.time_data.created if file.time_data else None,
                        'completed_time': file.time_data.completed if file.time_data else None,
                        'duration_ms': file.time_data.duration_ms if file.time_data else None
                    }
                    for file in session.files
                ]
            return []

        elif report_type == "sessions":
            # For sessions summary, export session-level data
            sessions = report_data.get('sessions', [])
            from ..services.session_analyzer import SessionAnalyzer
            # Note: This is a simplified version - in practice, we'd need the analyzer instance
            return [
                {
                    'session_id': session.session_id,
                    'session_title': session.session_title,
                    'project_name': session.project_name,
                    'start_time': session.start_time.isoformat() if session.start_time else None,
                    'end_time': session.end_time.isoformat() if session.end_time else None,
                    'duration_ms': session.duration_ms,
                    'interaction_count': session.interaction_count,
                    'models_used': ', '.join(session.models_used),
                    'total_input_tokens': session.total_tokens.input,
                    'total_output_tokens': session.total_tokens.output,
                    'total_cache_write_tokens': session.total_tokens.cache_write,
                    'total_cache_read_tokens': session.total_tokens.cache_read,
                    'total_tokens': session.total_tokens.total
                }
                for session in sessions
            ]

        elif report_type == "daily":
            # For daily breakdown, export daily data
            daily_usage = report_data.get('daily_usage', [])
            from ..services.session_analyzer import SessionAnalyzer
            # Note: This would need the analyzer instance for cost calculation
            return [
                {
                    'date': day.date.isoformat(),
                    'sessions_count': len(day.sessions),
                    'total_interactions': day.total_interactions,
                    'input_tokens': day.total_tokens.input,
                    'output_tokens': day.total_tokens.output,
                    'cache_write_tokens': day.total_tokens.cache_write,
                    'cache_read_tokens': day.total_tokens.cache_read,
                    'total_tokens': day.total_tokens.total,
                    'models_used': ', '.join(day.models_used)
                }
                for day in daily_usage
            ]

        elif report_type == "weekly":
            # For weekly breakdown, export weekly data
            weekly_usage = report_data.get('weekly_usage', [])
            return [
                {
                    'year': week.year,
                    'week_number': week.week,
                    'start_date': week.start_date.isoformat(),
                    'end_date': week.end_date.isoformat(),
                    'sessions_count': week.total_sessions,
                    'total_interactions': week.total_interactions,
                    'input_tokens': week.total_tokens.input,
                    'output_tokens': week.total_tokens.output,
                    'cache_write_tokens': week.total_tokens.cache_write,
                    'cache_read_tokens': week.total_tokens.cache_read,
                    'total_tokens': week.total_tokens.total
                }
                for week in weekly_usage
            ]

        elif report_type == "monthly":
            # For monthly breakdown, export monthly data
            monthly_usage = report_data.get('monthly_usage', [])
            return [
                {
                    'year': month.year,
                    'month': month.month,
                    'sessions_count': month.total_sessions,
                    'total_interactions': month.total_interactions,
                    'input_tokens': month.total_tokens.input,
                    'output_tokens': month.total_tokens.output,
                    'cache_write_tokens': month.total_tokens.cache_write,
                    'cache_read_tokens': month.total_tokens.cache_read,
                    'total_tokens': month.total_tokens.total
                }
                for month in monthly_usage
            ]

        elif report_type == "models":
            # For models breakdown, export model data
            model_breakdown = report_data.get('model_breakdown')
            if model_breakdown:
                return [
                    {
                        'model_name': model.model_name,
                        'total_sessions': model.total_sessions,
                        'total_interactions': model.total_interactions,
                        'input_tokens': model.total_tokens.input,
                        'output_tokens': model.total_tokens.output,
                        'cache_write_tokens': model.total_tokens.cache_write,
                        'cache_read_tokens': model.total_tokens.cache_read,
                        'total_tokens': model.total_tokens.total,
                        'total_cost': float(model.total_cost),
                        'first_used': model.first_used.isoformat() if model.first_used else None,
                        'last_used': model.last_used.isoformat() if model.last_used else None
                    }
                    for model in model_breakdown.model_stats
                ]
            return []

        elif report_type == "projects":
            # For projects breakdown, export project data
            project_breakdown = report_data.get('project_breakdown')
            if project_breakdown:
                return [
                    {
                        'project_name': project.project_name,
                        'total_sessions': project.total_sessions,
                        'total_interactions': project.total_interactions,
                        'input_tokens': project.total_tokens.input,
                        'output_tokens': project.total_tokens.output,
                        'cache_write_tokens': project.total_tokens.cache_write,
                        'cache_read_tokens': project.total_tokens.cache_read,
                        'total_tokens': project.total_tokens.total,
                        'total_cost': float(project.total_cost),
                        'models_used': ', '.join(project.models_used),
                        'first_activity': project.first_activity.isoformat() if project.first_activity else None,
                        'last_activity': project.last_activity.isoformat() if project.last_activity else None
                    }
                    for project in project_breakdown.project_stats
                ]
            return []

        else:
            # For unknown report types, try to return the data as-is
            return report_data

    def _json_serializer(self, obj):
        """Custom JSON serializer for special types.

        Args:
            obj: Object to serialize

        Returns:
            Serializable representation
        """
        if hasattr(obj, 'isoformat'):
            # Handle datetime objects
            return obj.isoformat()
        elif hasattr(obj, '__dict__'):
            # Handle objects with __dict__
            return obj.__dict__
        elif hasattr(obj, 'model_dump'):
            # Handle Pydantic models
            return obj.model_dump()
        else:
            # Fallback to string representation
            return str(obj)

    def get_export_summary(self, file_path: str) -> Dict[str, Any]:
        """Get summary information about an exported file.

        Args:
            file_path: Path to exported file

        Returns:
            Summary information
        """
        path = Path(file_path)
        if not path.exists():
            return {'error': 'File not found'}

        try:
            stat = path.stat()
            summary = {
                'filename': path.name,
                'size_bytes': stat.st_size,
                'size_human': self._format_file_size(stat.st_size),
                'created': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'format': path.suffix.lower()
            }

            # Add format-specific information
            if path.suffix.lower() == '.csv':
                summary.update(self._get_csv_info(path))
            elif path.suffix.lower() == '.json':
                summary.update(self._get_json_info(path))

            return summary

        except (OSError, IOError) as e:
            return {'error': f'Failed to read file info: {e}'}

    def _get_csv_info(self, file_path: Path) -> Dict[str, Any]:
        """Get CSV-specific information.

        Args:
            file_path: Path to CSV file

        Returns:
            CSV information
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as csvfile:
                # Count lines (excluding metadata comments)
                lines = csvfile.readlines()
                data_lines = [line for line in lines if not line.startswith('#')]

                if data_lines:
                    # First non-comment line should be header
                    header_line = data_lines[0] if data_lines else ""
                    columns = len(header_line.split(',')) if header_line else 0
                    rows = len(data_lines) - 1  # Subtract header row

                    return {
                        'rows': rows,
                        'columns': columns,
                        'has_header': True
                    }
                else:
                    return {'rows': 0, 'columns': 0, 'has_header': False}

        except Exception:
            return {'rows': 'unknown', 'columns': 'unknown', 'has_header': 'unknown'}

    def _get_json_info(self, file_path: Path) -> Dict[str, Any]:
        """Get JSON-specific information.

        Args:
            file_path: Path to JSON file

        Returns:
            JSON information
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as jsonfile:
                data = json.load(jsonfile)

                info = {'valid_json': True}

                if isinstance(data, dict):
                    info['type'] = 'object'
                    info['keys'] = len(data.keys())

                    # Check for metadata
                    if 'metadata' in data:
                        info['has_metadata'] = True
                        if 'data' in data:
                            data_section = data['data']
                            if isinstance(data_section, list):
                                info['records'] = len(data_section)
                        elif 'record_count' in data:
                            info['records'] = data['record_count']

                elif isinstance(data, list):
                    info['type'] = 'array'
                    info['records'] = len(data)

                return info

        except Exception:
            return {'valid_json': False}

    def _format_file_size(self, bytes_count: int) -> str:
        """Format file size in human-readable format.

        Args:
            bytes_count: Size in bytes

        Returns:
            Human-readable size string
        """
        if bytes_count == 0:
            return "0 B"

        units = ["B", "KB", "MB", "GB"]
        size = float(bytes_count)
        unit_index = 0

        while size >= 1024 and unit_index < len(units) - 1:
            size /= 1024
            unit_index += 1

        if unit_index == 0:
            return f"{int(size)} {units[unit_index]}"
        else:
            return f"{size:.1f} {units[unit_index]}"

    def list_exports(self) -> List[Dict[str, Any]]:
        """List all exported files in the export directory.

        Returns:
            List of export file information
        """
        if not self.export_dir.exists():
            return []

        exports = []
        for file_path in self.export_dir.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in ['.csv', '.json']:
                summary = self.get_export_summary(str(file_path))
                exports.append(summary)

        # Sort by modification time (newest first)
        exports.sort(key=lambda x: x.get('modified', ''), reverse=True)
        return exports