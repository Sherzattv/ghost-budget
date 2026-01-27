"""Main entry point for the bot."""
import asyncio
import sys

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import ErrorEvent, BotCommand
from loguru import logger

from bot.config import config
from bot.handlers import start, transaction, callbacks, balance, onboarding
from bot.database.supabase import init_supabase
from bot.middlewares import DbSessionMiddleware


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
    
    # Register middleware
    dp.update.middleware(DbSessionMiddleware())
    logger.info("Middleware registered")
    
    # Register global error handler
    @dp.error()
    async def error_handler(event: ErrorEvent):
        """Global error handler for unhandled exceptions."""
        logger.critical(
            "Critical error caused by %s",
            event.exception,
            exc_info=True
        )
    
    # Register handlers
    dp.include_router(start.router)
    dp.include_router(onboarding.router)
    dp.include_router(transaction.router)
    dp.include_router(callbacks.router)
    dp.include_router(balance.router)
    
    # Set bot commands for menu
    commands = [
        BotCommand(command="start", description="🏠 Главное меню"),
        BotCommand(command="balance", description="💰 Мои балансы"),
        BotCommand(command="stats", description="📊 Статистика"),
        BotCommand(command="help", description="❓ Справка"),
    ]
    await bot.set_my_commands(commands)
    logger.info("Bot commands set")
    
    logger.info("Bot starting...")
    
    # Start polling
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()
        logger.info("Bot stopped")


if __name__ == "__main__":
    asyncio.run(main())
