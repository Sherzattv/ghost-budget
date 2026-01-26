"""Main entry point for the bot."""
import asyncio
import sys

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from loguru import logger

from bot.config import config
from bot.handlers import start, transaction, callbacks, balance
from bot.database.supabase import init_supabase


# Configure logging
logger.remove()
logger.add(
    sys.stderr,
    level=config.log_level,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
)


async def main():
    """Initialize and start the bot."""
    # Validate config
    config.validate()
    
    # Initialize Supabase
    init_supabase()
    logger.info("Supabase client initialized")
    
    # Initialize bot
    bot = Bot(
        token=config.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML)
    )
    
    # Initialize dispatcher
    dp = Dispatcher()
    
    # Register handlers
    dp.include_router(start.router)
    dp.include_router(transaction.router)
    dp.include_router(callbacks.router)
    dp.include_router(balance.router)
    
    logger.info("Bot starting...")
    
    # Start polling
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
