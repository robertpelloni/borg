"""Configuration management for OpenCode Monitor."""

import json
import os
import toml
from typing import Dict, Optional

from pydantic import BaseModel, Field, field_validator
from decimal import Decimal

def opencode_storage_path(path: str | None = None) -> str:
    base = os.getenv("XDG_DATA_HOME") or "~/.local/share"
    parts = [base, "opencode", "storage"]
    if path:
        parts.append(path)
    return os.path.join(*parts)


class PathsConfig(BaseModel):
    """Configuration for file paths."""
    messages_dir: str = Field(default=opencode_storage_path("message"))
    opencode_storage_dir: str = Field(default=opencode_storage_path())
    export_dir: str = Field(default="./exports")

    @field_validator('messages_dir', 'opencode_storage_dir', 'export_dir')
    @classmethod
    def expand_path(cls, v):
        """Expand user paths and environment variables."""
        return os.path.expanduser(os.path.expandvars(v))


class UIConfig(BaseModel):
    """Configuration for UI appearance."""
    table_style: str = Field(default="rich", pattern="^(rich|simple|minimal)$")
    progress_bars: bool = Field(default=True)
    colors: bool = Field(default=True)
    live_refresh_interval: int = Field(default=5, ge=1, le=60)


class ExportConfig(BaseModel):
    """Configuration for data export."""
    default_format: str = Field(default="csv", pattern="^(csv|json)$")
    include_metadata: bool = Field(default=True)
    include_raw_data: bool = Field(default=False)


class ModelsConfig(BaseModel):
    """Configuration for model pricing."""
    config_file: str = Field(default="models.json")


class AnalyticsConfig(BaseModel):
    """Configuration for analytics."""
    default_timeframe: str = Field(default="daily", pattern="^(daily|weekly|monthly)$")
    recent_sessions_limit: int = Field(default=50, ge=1, le=1000)


class Config(BaseModel):
    """Main configuration class."""
    paths: PathsConfig = Field(default_factory=PathsConfig)
    ui: UIConfig = Field(default_factory=UIConfig)
    export: ExportConfig = Field(default_factory=ExportConfig)
    models: ModelsConfig = Field(default_factory=ModelsConfig)
    analytics: AnalyticsConfig = Field(default_factory=AnalyticsConfig)


class ModelPricing(BaseModel):
    """Model for pricing information."""
    input: Decimal = Field(description="Cost per 1M input tokens")
    output: Decimal = Field(description="Cost per 1M output tokens")
    cache_write: Decimal = Field(alias="cacheWrite", description="Cost per 1M cache write tokens")
    cache_read: Decimal = Field(alias="cacheRead", description="Cost per 1M cache read tokens")
    context_window: int = Field(alias="contextWindow", description="Maximum context window size")
    session_quota: Decimal = Field(alias="sessionQuota", description="Maximum session cost quota")


class ConfigManager:
    """Manages configuration loading and access."""

    def __init__(self, config_path: Optional[str] = None):
        """Initialize configuration manager.

        Args:
            config_path: Path to configuration file. If None, searches standard locations.
        """
        self.config_path = config_path or self._find_config_file()
        self._config: Optional[Config] = None
        self._pricing_data: Optional[Dict[str, ModelPricing]] = None

    def _find_config_file(self) -> str:
        """Find configuration file in standard locations."""
        search_paths = [
            os.path.join(os.path.dirname(__file__), "config.toml"),
            os.path.expanduser("~/.config/ocmonitor/config.toml"),
            "config.toml",
            "ocmonitor.toml",
        ]

        for path in search_paths:
            if os.path.exists(path):
                return path

        # Return default path even if it doesn't exist
        return search_paths[0]

    @property
    def config(self) -> Config:
        """Get configuration, loading if necessary."""
        if self._config is None:
            self._config = self._load_config()
        return self._config

    def _load_config(self) -> Config:
        """Load configuration from TOML file."""
        if not os.path.exists(self.config_path):
            # Return default configuration if file doesn't exist
            return Config()

        try:
            with open(self.config_path, 'r') as f:
                config_data = toml.load(f)
            return Config(**config_data)
        except (toml.TomlDecodeError, ValueError) as e:
            raise ValueError(f"Invalid configuration file {self.config_path}: {e}")

    def load_pricing_data(self) -> Dict[str, ModelPricing]:
        """Load model pricing data."""
        if self._pricing_data is None:
            self._pricing_data = self._load_pricing_data()
        return self._pricing_data

    def _load_pricing_data(self) -> Dict[str, ModelPricing]:
        """Load pricing data from JSON file."""
        models_file = self.config.models.config_file

        # Try relative to config file first
        if not os.path.isabs(models_file):
            config_dir = os.path.dirname(self.config_path)
            models_file = os.path.join(config_dir, models_file)

        if not os.path.exists(models_file):
            # Try in same directory as this module
            models_file = os.path.join(os.path.dirname(__file__), "models.json")

        if not os.path.exists(models_file):
            return {}

        try:
            with open(models_file, 'r') as f:
                raw_data = json.load(f)

            pricing_data = {}
            for model_name, model_data in raw_data.items():
                pricing_data[model_name] = ModelPricing(**model_data)

            return pricing_data
        except (json.JSONDecodeError, ValueError) as e:
            raise ValueError(f"Invalid pricing file {models_file}: {e}")

    def get_model_pricing(self, model_name: str) -> Optional[ModelPricing]:
        """Get pricing information for a specific model."""
        pricing_data = self.load_pricing_data()
        return pricing_data.get(model_name)

    def reload(self):
        """Reload configuration and pricing data."""
        self._config = None
        self._pricing_data = None


# Global configuration manager instance
config_manager = ConfigManager()