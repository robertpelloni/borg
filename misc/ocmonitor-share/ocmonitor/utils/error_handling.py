"""Error handling utilities for OpenCode Monitor."""

import traceback
from typing import Optional, Dict, Any, Callable, TypeVar, Union
from functools import wraps
from pathlib import Path
import logging

# Set up logging
logger = logging.getLogger(__name__)

# Type variable for decorated functions
F = TypeVar('F', bound=Callable[..., Any])


class OCMonitorError(Exception):
    """Base exception for OpenCode Monitor."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ConfigurationError(OCMonitorError):
    """Raised when there's a configuration problem."""
    pass


class DataProcessingError(OCMonitorError):
    """Raised when there's an error processing session data."""
    pass


class FileSystemError(OCMonitorError):
    """Raised when there's a file system related error."""
    pass


class ValidationError(OCMonitorError):
    """Raised when data validation fails."""
    pass


class ExportError(OCMonitorError):
    """Raised when export operations fail."""
    pass


class ErrorHandler:
    """Centralized error handling for OpenCode Monitor."""

    def __init__(self, verbose: bool = False):
        """Initialize error handler.

        Args:
            verbose: Whether to show detailed error information
        """
        self.verbose = verbose

    def handle_error(self, error: Exception, context: str = "") -> Dict[str, Any]:
        """Handle an error and return structured error information.

        Args:
            error: The exception that occurred
            context: Additional context about where the error occurred

        Returns:
            Dictionary with error information
        """
        error_info = {
            'error_type': type(error).__name__,
            'message': str(error),
            'context': context,
            'success': False
        }

        # Add details if it's our custom exception
        if isinstance(error, OCMonitorError):
            error_info['details'] = error.details

        # Add traceback in verbose mode
        if self.verbose:
            error_info['traceback'] = traceback.format_exc()

        # Log the error
        logger.error(f"Error in {context}: {error_info['error_type']}: {error_info['message']}")
        if self.verbose:
            logger.debug(f"Traceback: {error_info.get('traceback', 'N/A')}")

        return error_info

    def safe_execute(self, func: Callable, *args, context: str = "", **kwargs) -> Dict[str, Any]:
        """Safely execute a function and handle any errors.

        Args:
            func: Function to execute
            *args: Positional arguments for the function
            context: Context description for error handling
            **kwargs: Keyword arguments for the function

        Returns:
            Dictionary with result or error information
        """
        try:
            result = func(*args, **kwargs)
            return {
                'success': True,
                'result': result
            }
        except Exception as e:
            return self.handle_error(e, context)


def handle_errors(error_handler: Optional[ErrorHandler] = None, context: str = ""):
    """Decorator for handling errors in functions.

    Args:
        error_handler: ErrorHandler instance to use
        context: Context description for the operation

    Returns:
        Decorated function
    """
    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args, **kwargs):
            handler = error_handler or ErrorHandler()
            func_context = context or f"{func.__module__}.{func.__name__}"
            return handler.safe_execute(func, *args, context=func_context, **kwargs)
        return wrapper
    return decorator


def validate_path(path: Union[str, Path], must_exist: bool = True, must_be_dir: bool = False) -> Path:
    """Validate a file system path.

    Args:
        path: Path to validate
        must_exist: Whether the path must exist
        must_be_dir: Whether the path must be a directory

    Returns:
        Validated Path object

    Raises:
        ValidationError: If validation fails
    """
    try:
        path_obj = Path(path)

        if must_exist and not path_obj.exists():
            raise ValidationError(f"Path does not exist: {path}")

        if must_exist and must_be_dir and not path_obj.is_dir():
            raise ValidationError(f"Path is not a directory: {path}")

        return path_obj

    except (TypeError, ValueError) as e:
        raise ValidationError(f"Invalid path: {path}") from e


def validate_config_value(value: Any, expected_type: type, name: str) -> Any:
    """Validate a configuration value.

    Args:
        value: Value to validate
        expected_type: Expected type
        name: Name of the configuration value

    Returns:
        Validated value

    Raises:
        ConfigurationError: If validation fails
    """
    if not isinstance(value, expected_type):
        raise ConfigurationError(
            f"Configuration value '{name}' must be of type {expected_type.__name__}, got {type(value).__name__}",
            details={'value': value, 'expected_type': expected_type.__name__}
        )
    return value


def safe_json_load(file_path: Path) -> Dict[str, Any]:
    """Safely load JSON data from a file.

    Args:
        file_path: Path to JSON file

    Returns:
        Parsed JSON data

    Raises:
        FileSystemError: If file cannot be read or parsed
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            import json
            return json.load(f)
    except FileNotFoundError:
        raise FileSystemError(f"JSON file not found: {file_path}")
    except json.JSONDecodeError as e:
        raise DataProcessingError(
            f"Invalid JSON in file: {file_path}",
            details={'json_error': str(e), 'line': e.lineno, 'column': e.colno}
        )
    except PermissionError:
        raise FileSystemError(f"Permission denied reading file: {file_path}")
    except UnicodeDecodeError:
        raise DataProcessingError(f"File encoding error: {file_path}")


def safe_file_write(file_path: Path, content: str, encoding: str = 'utf-8') -> None:
    """Safely write content to a file.

    Args:
        file_path: Path to write to
        content: Content to write
        encoding: File encoding

    Raises:
        FileSystemError: If file cannot be written
    """
    try:
        # Ensure parent directory exists
        file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(file_path, 'w', encoding=encoding) as f:
            f.write(content)
    except PermissionError:
        raise FileSystemError(f"Permission denied writing to file: {file_path}")
    except OSError as e:
        raise FileSystemError(f"Error writing to file: {file_path}: {e}")


def validate_session_data(session_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate session data structure.

    Args:
        session_data: Session data to validate

    Returns:
        Validated session data

    Raises:
        ValidationError: If validation fails
    """
    required_fields = ['tokens']

    for field in required_fields:
        if field not in session_data:
            raise ValidationError(
                f"Missing required field in session data: {field}",
                details={'data': session_data}
            )

    # Validate tokens structure
    tokens = session_data['tokens']
    if not isinstance(tokens, dict):
        raise ValidationError("Tokens field must be a dictionary")

    # Validate token values
    token_fields = ['input', 'output']
    for field in token_fields:
        if field in tokens:
            if not isinstance(tokens[field], int) or tokens[field] < 0:
                raise ValidationError(
                    f"Token field '{field}' must be a non-negative integer",
                    details={'value': tokens[field]}
                )

    return session_data


def create_user_friendly_error(error: Exception) -> str:
    """Create a user-friendly error message.

    Args:
        error: Exception to format

    Returns:
        User-friendly error message
    """
    if isinstance(error, ConfigurationError):
        return f"Configuration error: {error.message}"
    elif isinstance(error, FileSystemError):
        return f"File system error: {error.message}"
    elif isinstance(error, DataProcessingError):
        return f"Data processing error: {error.message}"
    elif isinstance(error, ValidationError):
        return f"Validation error: {error.message}"
    elif isinstance(error, ExportError):
        return f"Export error: {error.message}"
    elif isinstance(error, FileNotFoundError):
        return f"File not found: {error.filename or 'Unknown file'}"
    elif isinstance(error, PermissionError):
        return f"Permission denied: {error.filename or 'Unknown file'}"
    elif isinstance(error, KeyboardInterrupt):
        return "Operation cancelled by user"
    else:
        return f"Unexpected error: {str(error)}"


class OperationResult:
    """Represents the result of an operation that might fail."""

    def __init__(self, success: bool, data: Any = None, error: Optional[Exception] = None):
        """Initialize operation result.

        Args:
            success: Whether the operation succeeded
            data: Result data if successful
            error: Exception if failed
        """
        self.success = success
        self.data = data
        self.error = error

    @classmethod
    def success_result(cls, data: Any = None) -> 'OperationResult':
        """Create a successful result.

        Args:
            data: Result data

        Returns:
            OperationResult with success=True
        """
        return cls(success=True, data=data)

    @classmethod
    def error_result(cls, error: Exception) -> 'OperationResult':
        """Create a failed result.

        Args:
            error: Exception that occurred

        Returns:
            OperationResult with success=False
        """
        return cls(success=False, error=error)

    def get_data_or_raise(self) -> Any:
        """Get the data or raise the error.

        Returns:
            Result data

        Raises:
            Exception: If the operation failed
        """
        if self.success:
            return self.data
        else:
            raise self.error or RuntimeError("Operation failed with no error details")

    def get_error_message(self) -> str:
        """Get a user-friendly error message.

        Returns:
            Error message or empty string if successful
        """
        if self.success:
            return ""
        else:
            return create_user_friendly_error(self.error) if self.error else "Unknown error"


def retry_operation(func: Callable, max_retries: int = 3, delay: float = 1.0) -> OperationResult:
    """Retry an operation with exponential backoff.

    Args:
        func: Function to retry
        max_retries: Maximum number of retries
        delay: Initial delay between retries

    Returns:
        OperationResult with the final result
    """
    import time

    for attempt in range(max_retries + 1):
        try:
            result = func()
            return OperationResult.success_result(result)
        except Exception as e:
            if attempt == max_retries:
                return OperationResult.error_result(e)

            time.sleep(delay * (2 ** attempt))  # Exponential backoff

    return OperationResult.error_result(RuntimeError("Retry operation failed"))


def graceful_shutdown(cleanup_func: Optional[Callable] = None):
    """Decorator for graceful shutdown handling.

    Args:
        cleanup_func: Optional cleanup function to call

    Returns:
        Decorated function
    """
    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except KeyboardInterrupt:
                if cleanup_func:
                    try:
                        cleanup_func()
                    except Exception as cleanup_error:
                        logger.error(f"Error during cleanup: {cleanup_error}")
                raise
            except Exception as e:
                if cleanup_func:
                    try:
                        cleanup_func()
                    except Exception as cleanup_error:
                        logger.error(f"Error during cleanup: {cleanup_error}")
                raise
        return wrapper
    return decorator