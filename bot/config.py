"""Bot configuration from environment variables."""
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Config:
    """Bot configuration."""
    
    # Telegram
    bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    
    # Supabase
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_key: str = os.getenv("SUPABASE_KEY", "")
    
    # Optional
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    
    def validate(self) -> None:
        """Validate required config values."""
        if not self.bot_token:
            raise ValueError("TELEGRAM_BOT_TOKEN is required")
        if not self.supabase_url:
            raise ValueError("SUPABASE_URL is required")
        if not self.supabase_key:
            raise ValueError("SUPABASE_KEY is required")


config = Config()
