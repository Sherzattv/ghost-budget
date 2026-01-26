"""Callback query handlers for inline buttons."""
import json
from aiogram import Router, F
from aiogram.types import CallbackQuery

from bot.keyboards.inline import (
    build_category_keyboard,
    build_account_keyboard,
    build_type_keyboard
)
from bot.database.supabase import (
    get_categories,
    get_accounts,
    create_transaction
)
from bot.utils.callback_data import parse_callback, CallbackData

router = Router()


@router.callback_query(F.data.startswith("{"))
async def handle_json_callback(callback: CallbackQuery):
    """Handle all JSON-encoded callback data."""
    if not callback.data or not callback.message or not callback.from_user:
        await callback.answer("❌ Ошибка")
        return
    
    data = parse_callback(callback.data)
    if not data:
        await callback.answer("❌ Ошибка парсинга")
        return
    
    telegram_id = callback.from_user.id
    
    # Route based on current state
    if data.action == "cancel":
        await handle_cancel(callback, data)
    elif data.finalize:
        await handle_finalize(callback, data, telegram_id)
    elif data.type and not data.category:
        # Type selected, need category
        await handle_type_selected(callback, data, telegram_id)
    elif data.type and data.category and not data.source:
        # Category selected, need source account
        await handle_category_selected(callback, data, telegram_id)
    else:
        await callback.answer("🤔")


async def handle_cancel(callback: CallbackQuery, data: CallbackData):
    """Handle cancel button - delete bot message."""
    await callback.message.delete()
    await callback.answer("❌ Отменено")


async def handle_type_selected(callback: CallbackQuery, data: CallbackData, telegram_id: int):
    """Handle type selection - show categories."""
    
    if data.type == "exp":
        categories = await get_categories(telegram_id, "expense")
        title = "📉 Расход"
        cat_type = "expense"
    elif data.type == "inc":
        categories = await get_categories(telegram_id, "income")
        title = "📈 Доход"
        cat_type = "income"
    elif data.type == "trf":
        # For transfers, skip categories, go to accounts
        accounts = await get_accounts(telegram_id)
        formatted = f"{data.amount:,}".replace(",", " ")
        text = f"🔄 Перевод <b>{formatted} ₸</b>\n\nОткуда перевести?"
        keyboard = build_account_keyboard(
            accounts=accounts,
            amount=data.amount,
            type_code=data.type,
            msg_id=data.msg_id,
            is_source=True
        )
        await callback.message.edit_text(text, reply_markup=keyboard)
        await callback.answer()
        return
    elif data.type == "debt":
        # TODO: Debt flow
        await callback.answer("🚧 В разработке", show_alert=True)
        return
    else:
        await callback.answer("❌")
        return
    
    formatted = f"{data.amount:,}".replace(",", " ")
    text = f"{title} <b>{formatted} ₸</b>\n\nВыберите категорию:"
    
    keyboard = build_category_keyboard(
        categories=categories,
        amount=data.amount,
        type_code=data.type,
        msg_id=data.msg_id
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()


async def handle_category_selected(callback: CallbackQuery, data: CallbackData, telegram_id: int):
    """Handle category selection - show source accounts."""
    accounts = await get_accounts(telegram_id)
    
    # Get category name for display
    cat_name = data.category_name or "Выбрано"
    
    if data.type == "exp":
        title = "📉 Расход"
    else:
        title = "📈 Доход"
    
    formatted = f"{data.amount:,}".replace(",", " ")
    text = f"{title} <b>{formatted} ₸</b>\nКатегория: {cat_name}\n\n"
    
    if data.type == "exp":
        text += "Откуда списать?"
    else:
        text += "Куда зачислить?"
    
    keyboard = build_account_keyboard(
        accounts=accounts,
        amount=data.amount,
        type_code=data.type,
        category_id=data.category,
        category_name=cat_name,
        msg_id=data.msg_id
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()


async def handle_finalize(callback: CallbackQuery, data: CallbackData, telegram_id: int):
    """Handle final step - save transaction."""
    
    # Create transaction in database
    result = await create_transaction(
        telegram_id=telegram_id,
        type_code=data.type,
        amount=data.amount,
        category_id=data.category,
        account_id=data.source
    )
    
    if result:
        formatted = f"{data.amount:,}".replace(",", " ")
        
        if data.type == "exp":
            emoji = "📉"
            type_name = "Расход"
        elif data.type == "inc":
            emoji = "📈"
            type_name = "Доход"
        else:
            emoji = "🔄"
            type_name = "Перевод"
        
        cat_name = data.category_name or ""
        acc_name = data.account_name or ""
        
        text = f"""
✅ <b>Сохранено!</b>

{emoji} {type_name}: <b>{formatted} ₸</b>
📁 Категория: {cat_name}
💳 Счёт: {acc_name}
"""
        await callback.message.edit_text(text)
        await callback.answer("✅ Сохранено!")
    else:
        await callback.answer("❌ Ошибка сохранения", show_alert=True)


@router.callback_query(F.data == "cancel")
async def handle_simple_cancel(callback: CallbackQuery):
    """Handle simple cancel string callback."""
    await callback.message.delete()
    await callback.answer("❌ Отменено")


@router.callback_query(F.data == "back")
async def handle_back(callback: CallbackQuery):
    """Handle back button - for now just cancel."""
    # TODO: Implement proper back navigation
    await callback.answer("◀️")
