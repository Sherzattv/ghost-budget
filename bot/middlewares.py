"""Middlewares for the bot."""
from typing import Callable, Dict, Any, Awaitable

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject
from supabase import Client

from bot.database.supabase import get_client


class DbSessionMiddleware(BaseMiddleware):
    """Middleware to inject Supabase client into handlers."""
    
    async def __call__(
        self,
        handler: Callable[[TelegramObject, Dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: Dict[str, Any]
    ) -> Any:
        """Inject db_session into handler data."""
        data["db_session"] = get_client()
        return await handler(event, data)
