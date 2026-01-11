"""File utility functions for OpenCode Monitor."""

import json
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Any, Generator
from datetime import datetime

from ..models.session import SessionData, InteractionFile, TokenUsage, TimeData


class FileProcessor:
    """Handles file processing and session discovery."""

    @staticmethod
    def find_session_directories(base_path: str) -> List[Path]:
        """Find all session directories in the base path.

        Args:
            base_path: Path to search for session directories

        Returns:
            List of session directory paths sorted by modification time (newest first)
        """
        base_dir = Path(base_path)
        if not base_dir.exists():
            return []

        # Find all directories that start with 'ses_'
        session_dirs = [
            d for d in base_dir.iterdir()
            if d.is_dir() and d.name.startswith('ses_')
        ]

        # Sort by modification time (most recent first)
        session_dirs.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        return session_dirs

    @staticmethod
    def find_json_files(directory: Path) -> List[Path]:
        """Find all JSON files in a directory.

        Args:
            directory: Directory to search

        Returns:
            List of JSON file paths sorted by modification time (newest first)
        """
        if not directory.exists() or not directory.is_dir():
            return []

        json_files = list(directory.glob("*.json"))
        json_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        return json_files

    @staticmethod
    def load_json_file(file_path: Path) -> Optional[Dict[str, Any]]:
        """Load and parse a JSON file.

        Args:
            file_path: Path to JSON file

        Returns:
            Parsed JSON data or None if failed
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError, PermissionError, UnicodeDecodeError):
            return None

    @staticmethod
    def _extract_model_name(model_id: str) -> str:
        """Extract model name from fully qualified model ID.
        
        Args:
            model_id: Full model ID (e.g., 'qwen/qwen3-coder' or 'claude-sonnet-4-20250514')
            
        Returns:
            Extracted model name (normalized for pricing lookup)
        """
        if '/' in model_id:
            return model_id.lower()
        return FileProcessor._normalize_model_name(model_id)

    @staticmethod
    def _normalize_model_name(model_id: str) -> str:
        """Normalize model name for flexible pricing lookup.
        
        Handles various model ID formats:
        - Strips date suffixes (e.g., -20250514, -20251101)
        - Normalizes version separators (-X-Y to -X.Y)
        - Converts to lowercase
        
        Args:
            model_id: Raw model ID from OpenCode
            
        Returns:
            Normalized model name for pricing lookup
        """
        model_id = model_id.lower()
        
        # Strip date suffixes like -20250514, -20251101, -20241001, etc.
        model_id = re.sub(r'-\d{8}$', '', model_id)
        
        # Normalize version separators: -X-Y to -X.Y
        # E.g., claude-opus-4-5 -> claude-opus-4.5
        # Be careful not to create double dots or mess up existing dots
        model_id = re.sub(r'-(\d+)-(\d+)(?![.\d])', r'-\1.\2', model_id)
        
        # Handle special cases for known model families
        
        # Claude family: claude-opus-4-5 -> claude-opus-4.5, claude-sonnet-4-5 -> claude-sonnet-4.5
        model_id = re.sub(r'claude-(opus|sonnet|haiku)-(\d+)-(\d+)', r'claude-\1-\2.\3', model_id)
        
        # Gemini family: gemini-3-pro -> gemini-3-pro (keep as is)
        # GPT family: gpt-5-1 -> gpt-5.1, gpt-5-2 -> gpt-5.2
        model_id = re.sub(r'gpt-(\d+)-(\d+)', r'gpt-\1.\2', model_id)
        
        # Kimi family: kimi-k-2 -> kimi-k2 (remove middle dash)
        model_id = re.sub(r'kimi-k-(\d+)', r'kimi-k\1', model_id)
        
        return model_id

    @staticmethod
    def extract_project_name(path_str: str) -> str:
        """Extract project name from a file path.
        
        Args:
            path_str: Full path string (e.g., '/Users/shelli/Documents/apps/ocmonitor')
            
        Returns:
            Project name (last directory in path) or 'Unknown' if empty
        """
        if not path_str:
            return "Unknown"
        
        path = Path(path_str)
        return path.name if path.name else "Unknown"

    @staticmethod
    def get_opencode_storage_path() -> Optional[Path]:
        """Get the OpenCode storage path.
        
        Returns:
            Path to OpenCode storage directory or None if not found
        """
        # Try to get from configuration first
        try:
            from ..config import config_manager
            storage_path = Path(config_manager.config.paths.opencode_storage_dir)
            if storage_path.exists():
                return storage_path
        except ImportError:
            pass
        
        # Standard OpenCode storage location as fallback
        home = Path.home()
        storage_path = home / ".local" / "share" / "opencode" / "storage"
        
        if storage_path.exists():
            return storage_path
        
        return None

    @staticmethod
    def find_session_title(session_id: str) -> Optional[str]:
        """Find and load session title from OpenCode storage.
        
        Args:
            session_id: Session ID to search for
            
        Returns:
            Session title or None if not found
        """
        storage_path = FileProcessor.get_opencode_storage_path()
        if not storage_path:
            return None
        
        session_storage = storage_path / "session"
        if not session_storage.exists():
            return None
        
        # Search through all project directories (including global)
        for project_dir in session_storage.iterdir():
            if not project_dir.is_dir():
                continue

            session_file = project_dir / f"{session_id}.json"
            if session_file.exists():
                session_data = FileProcessor.load_json_file(session_file)
                if session_data and "title" in session_data:
                    return session_data["title"]

        return None

    @staticmethod
    def parse_interaction_file(file_path: Path, session_id: str) -> Optional[InteractionFile]:
        """Parse a single interaction JSON file.

        Args:
            file_path: Path to the interaction file
            session_id: ID of the session this file belongs to

        Returns:
            InteractionFile object or None if parsing failed
        """
        data = FileProcessor.load_json_file(file_path)
        if not data:
            return None

        try:
            # Extract basic information
            model_id = data.get('modelID', 'unknown')
            
            # Handle fully qualified model names
            model_id = FileProcessor._extract_model_name(model_id)

            # Extract token usage
            tokens_data = data.get('tokens', {})
            cache_data = tokens_data.get('cache', {})

            tokens = TokenUsage(
                input=tokens_data.get('input', 0),
                output=tokens_data.get('output', 0),
                cache_write=cache_data.get('write', 0),
                cache_read=cache_data.get('read', 0)
            )

            # Extract time data
            time_data = None
            if 'time' in data:
                time_info = data['time']
                time_data = TimeData(
                    created=time_info.get('created'),
                    completed=time_info.get('completed')
                )

            # Extract project path data
            project_path = None
            if 'path' in data:
                path_info = data['path']
                # Use 'cwd' as the project path, fallback to 'root' if needed
                project_path = path_info.get('cwd') or path_info.get('root')

            return InteractionFile(
                file_path=file_path,
                session_id=session_id,
                model_id=model_id,
                tokens=tokens,
                time_data=time_data,
                project_path=project_path,
                raw_data=data
            )

        except (KeyError, ValueError, TypeError):
            return None

    @staticmethod
    def load_session_data(session_path: Path) -> Optional[SessionData]:
        """Load complete session data from a session directory.

        Args:
            session_path: Path to session directory

        Returns:
            SessionData object or None if loading failed
        """
        if not session_path.exists() or not session_path.is_dir():
            return None

        session_id = session_path.name
        json_files = FileProcessor.find_json_files(session_path)

        if not json_files:
            return None

        interaction_files = []
        for json_file in json_files:
            interaction = FileProcessor.parse_interaction_file(json_file, session_id)
            if interaction:
                # Filter out interactions with zero token usage
                if interaction.tokens.total > 0:
                    interaction_files.append(interaction)

        if not interaction_files:
            return None

        # Load session title from OpenCode storage
        session_title = FileProcessor.find_session_title(session_id)

        return SessionData(
            session_id=session_id,
            session_path=session_path,
            files=interaction_files,
            session_title=session_title
        )

    @staticmethod
    def get_most_recent_session(base_path: str) -> Optional[SessionData]:
        """Get the most recently modified session.

        Args:
            base_path: Path to search for sessions

        Returns:
            Most recent SessionData or None if no sessions found
        """
        session_dirs = FileProcessor.find_session_directories(base_path)
        if not session_dirs:
            return None

        return FileProcessor.load_session_data(session_dirs[0])

    @staticmethod
    def get_most_recent_file(session_path: Path) -> Optional[InteractionFile]:
        """Get the most recently modified file in a session.

        Args:
            session_path: Path to session directory

        Returns:
            Most recent InteractionFile or None if no files found
        """
        json_files = FileProcessor.find_json_files(session_path)
        if not json_files:
            return None

        session_id = session_path.name
        return FileProcessor.parse_interaction_file(json_files[0], session_id)

    @staticmethod
    def load_all_sessions(base_path: str, limit: Optional[int] = None) -> List[SessionData]:
        """Load all sessions from the base path.

        Args:
            base_path: Path to search for sessions
            limit: Maximum number of sessions to load (None for all)

        Returns:
            List of SessionData objects
        """
        session_dirs = FileProcessor.find_session_directories(base_path)

        if limit:
            session_dirs = session_dirs[:limit]

        sessions = []
        for session_dir in session_dirs:
            session_data = FileProcessor.load_session_data(session_dir)
            if session_data:
                sessions.append(session_data)

        return sessions

    @staticmethod
    def session_generator(base_path: str) -> Generator[SessionData, None, None]:
        """Generator that yields sessions one by one (memory efficient).

        Args:
            base_path: Path to search for sessions

        Yields:
            SessionData objects
        """
        session_dirs = FileProcessor.find_session_directories(base_path)

        for session_dir in session_dirs:
            session_data = FileProcessor.load_session_data(session_dir)
            if session_data:
                yield session_data

    @staticmethod
    def validate_session_structure(session_path: Path) -> bool:
        """Validate that a directory contains valid session structure.

        Args:
            session_path: Path to potential session directory

        Returns:
            True if valid session structure, False otherwise
        """
        if not session_path.exists() or not session_path.is_dir():
            return False

        if not session_path.name.startswith('ses_'):
            return False

        json_files = FileProcessor.find_json_files(session_path)
        if not json_files:
            return False

        # Check if at least one file has valid structure
        for json_file in json_files[:3]:  # Check first 3 files
            data = FileProcessor.load_json_file(json_file)
            if data and ('tokens' in data or 'modelID' in data):
                return True

        return False

    @staticmethod
    def get_session_stats(session_path: Path) -> Dict[str, Any]:
        """Get basic statistics about a session without loading all data.

        Args:
            session_path: Path to session directory

        Returns:
            Dictionary with basic session statistics
        """
        if not FileProcessor.validate_session_structure(session_path):
            return {}

        json_files = FileProcessor.find_json_files(session_path)

        stats = {
            'session_id': session_path.name,
            'file_count': len(json_files),
            'first_file': None,
            'last_file': None,
            'total_size_bytes': 0
        }

        if json_files:
            stats['first_file'] = json_files[-1].name  # Oldest file
            stats['last_file'] = json_files[0].name    # Newest file

            # Calculate total size
            for json_file in json_files:
                try:
                    stats['total_size_bytes'] += json_file.stat().st_size
                except OSError:
                    pass

        return stats