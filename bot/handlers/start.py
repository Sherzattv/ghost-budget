"""Start and help command handlers."""
import json
from aiogram import Router, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton

from bot.database.supabase import (
    get_user_by_telegram_id,
    create_new_profile_with_telegram,
    reset_user_data,
    delete_profile,
)

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message):
    """Handle /start command."""
    user = message.from_user
    if not user:
        return
    
    telegram_id = user.id
    display_name = user.full_name
    
    # Check if user already exists
    existing_user = await get_user_by_telegram_id(telegram_id)
    
    if existing_user:
        # User exists - show welcome with reset option
        await show_welcome_with_options(message, user.first_name)
    else:
        # No profile - create new one
        new_user = await create_new_profile_with_telegram(telegram_id, display_name)
        if new_user:
            await message.answer(
                f"✅ Добро пожаловать, <b>{display_name}</b>!\n\n"
                "Я создал тебе профиль со стандартными счетами и категориями.\n"
                "Настрой их под себя в /accounts и /categories."
            )
        await show_welcome(message, user.first_name)


async def show_welcome(message: Message, first_name: str):
    """Show simple welcome message."""
    welcome_text = f"""
👋 <b>{first_name}</b>, я Ghost Budget!

<b>Быстрый старт:</b>
Просто отправь <b>сумму</b> (например <code>5000</code>) и выбери тип операции.

<b>Команды:</b>
/balance — Балансы счетов
/help — Полная справка

💰 Начни прямо сейчас — отправь число!
"""
    await message.answer(welcome_text)


async def show_welcome_with_options(message: Message, first_name: str):
    """Show welcome with reset/fresh start options."""
    buttons = [
        [
            InlineKeyboardButton(
                text="🔄 Очистить все данные",
                callback_data=json.dumps({"action": "reset_data"})
            )
        ],
        [
            InlineKeyboardButton(
                text="🗑 Удалить профиль и создать новый",
                callback_data=json.dumps({"action": "delete_profile"})
            )
        ],
        [
            InlineKeyboardButton(
                text="✅ Всё ок, продолжаю",
                callback_data=json.dumps({"action": "continue"})
            )
        ]
    ]
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=buttons)
    
    welcome_text = f"""
👋 С возвращением, <b>{first_name}</b>!

Твой профиль уже настроен. Просто отправь сумму чтобы добавить транзакцию.

<b>Или выбери действие:</b>
"""
    await message.answer(welcome_text, reply_markup=keyboard)


@router.callback_query(F.data.contains("reset_data"))
async def handle_reset_data(callback: CallbackQuery):
    """Handle reset data - clear transactions but keep accounts/categories."""
    if not callback.from_user:
        return
    
    telegram_id = callback.from_user.id
    success = await reset_user_data(telegram_id)
    
    if success:
        await callback.message.edit_text(
            "🔄 <b>Данные очищены!</b>\n\n"
            "Все транзакции удалены.\n"
            "Счета и категории сохранены.\n\n"
            "Отправь сумму чтобы начать заново! 💰"
        )
    else:
        await callback.message.edit_text("❌ Ошибка очистки данных. Попробуй /start снова.")
    
    await callback.answer()


@router.callback_query(F.data.contains("delete_profile"))
async def handle_delete_profile(callback: CallbackQuery):
    """Handle delete profile - remove everything and create fresh."""
    if not callback.from_user:
        return
    
    telegram_id = callback.from_user.id
    display_name = callback.from_user.full_name
    
    # Delete old profile
    await delete_profile(telegram_id)
    
    # Create new one
    new_user = await create_new_profile_with_telegram(telegram_id, display_name)
    
    if new_user:
        await callback.message.edit_text(
            "🗑 <b>Профиль пересоздан!</b>\n\n"
            "Все старые данные удалены.\n"
            "Создан новый профиль со стандартными счетами и категориями.\n\n"
            "Отправь сумму чтобы начать! 💰"
        )
    else:
        await callback.message.edit_text("❌ Ошибка создания профиля. Попробуй /start снова.")
    
    await callback.answer()


@router.callback_query(F.data.contains("continue"))
async def handle_continue(callback: CallbackQuery):
    """Handle continue - just close the menu."""
    await callback.message.edit_text(
        "✅ Отлично! Просто отправь сумму чтобы добавить транзакцию. 💰"
    )
    await callback.answer()


@router.message(Command("help"))
async def cmd_help(message: Message):
    """Handle /help command."""
    help_text = """
📖 <b>Справка по Ghost Budget</b>

<b>Быстрый ввод:</b>
Просто отправь число — это сумма твоей операции.
Например: <code>2500</code>

<b>Типы операций:</b>
📉 <b>Расход</b> — деньги потрачены
📈 <b>Доход</b> — деньги получены
🔄 <b>Перевод</b> — между своими счетами
🤝 <b>Долги</b> — дал/взял в долг

<b>Команды:</b>
/start — Начать работу / Сбросить
/balance — Балансы всех счетов
/stats — Аналитика расходов
/accounts — Управление счетами
/categories — Управление категориями
/help — Эта справка

<b>Примеры:</b>
<code>500</code> → Расход → Еда → Kaspi
<code>100000</code> → Доход → Зарплата

💡 Все данные хранятся надёжно в облаке.
"""
    await message.answer(help_text)
