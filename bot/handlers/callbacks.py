"""Callback query handlers for inline buttons."""
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
    get_account_by_id,
    create_transaction
)
from bot.utils.callback_data import (
    TypeSelectionCallback,
    CategorySelectionCallback,
    AccountSelectionCallback,
    ActionCallback,
)

router = Router()


@router.callback_query(ActionCallback.filter(F.action == "cancel"))
async def handle_cancel(callback: CallbackQuery, callback_data: ActionCallback):
    """Handle cancel button - delete bot message."""
    await callback.message.delete()
    await callback.answer("❌ Отменено")


@router.callback_query(ActionCallback.filter(F.action == "back_to_type"))
async def handle_back_to_type(callback: CallbackQuery, callback_data: ActionCallback):
    """Handle back to type selection."""
    formatted = f"{callback_data.amount:,}".replace(",", " ")
    text = f"💰 Сумма: <b>{formatted} ₸</b>\n\nВыберите тип операции:"
    
    keyboard = build_type_keyboard(callback_data.amount, callback_data.msg_id)
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()


@router.callback_query(ActionCallback.filter(F.action == "back_to_category"))
async def handle_back_to_category(callback: CallbackQuery, callback_data: ActionCallback):
    """Handle back to category selection."""
    if not callback_data.type_code:
        await callback.answer("❌ Ошибка")
        return
    
    telegram_id = callback.from_user.id
    
    if callback_data.type_code == "exp":
        categories = await get_categories(telegram_id, "expense")
        title = "📉 Расход"
    else:
        categories = await get_categories(telegram_id, "income")
        title = "📈 Доход"
    
    formatted = f"{callback_data.amount:,}".replace(",", " ")
    text = f"{title} <b>{formatted} ₸</b>\n\nВыберите категорию:"
    
    keyboard = build_category_keyboard(
        categories=categories,
        amount=callback_data.amount,
        type_code=callback_data.type_code,
        msg_id=callback_data.msg_id
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()


@router.callback_query(ActionCallback.filter(F.action == "custom_cat"))
async def handle_custom_category(callback: CallbackQuery, callback_data: ActionCallback):
    """Handle custom category - not yet implemented."""
    await callback.answer("🚧 В разработке", show_alert=True)


@router.callback_query(TypeSelectionCallback.filter())
async def handle_type_selected(callback: CallbackQuery, callback_data: TypeSelectionCallback):
    """Handle type selection - show categories or accounts."""
    telegram_id = callback.from_user.id
    
    if callback_data.type_code == "exp":
        categories = await get_categories(telegram_id, "expense")
        title = "📉 Расход"
    elif callback_data.type_code == "inc":
        categories = await get_categories(telegram_id, "income")
        title = "📈 Доход"
    elif callback_data.type_code == "trf":
        # For transfers, skip categories, go to accounts
        accounts = await get_accounts(telegram_id)
        formatted = f"{callback_data.amount:,}".replace(",", " ")
        text = f"🔄 Перевод <b>{formatted} ₸</b>\n\nОткуда перевести?"
        keyboard = build_account_keyboard(
            accounts=accounts,
            amount=callback_data.amount,
            type_code=callback_data.type_code,
            msg_id=callback_data.msg_id,
            is_source=True
        )
        await callback.message.edit_text(text, reply_markup=keyboard)
        await callback.answer()
        return
    elif callback_data.type_code == "debt":
        # TODO: Debt flow
        await callback.answer("🚧 В разработке", show_alert=True)
        return
    else:
        await callback.answer("❌")
        return
    
    formatted = f"{callback_data.amount:,}".replace(",", " ")
    text = f"{title} <b>{formatted} ₸</b>\n\nВыберите категорию:"
    
    keyboard = build_category_keyboard(
        categories=categories,
        amount=callback_data.amount,
        type_code=callback_data.type_code,
        msg_id=callback_data.msg_id
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()


@router.callback_query(CategorySelectionCallback.filter())
async def handle_category_selected(callback: CallbackQuery, callback_data: CategorySelectionCallback):
    """Handle category selection - show source accounts."""
    telegram_id = callback.from_user.id
    accounts = await get_accounts(telegram_id)
    
    # Get category from ID - for now we'll need to fetch it
    # In a real app, you might want to include category_name in the callback
    categories = await get_categories(
        telegram_id,
        "expense" if callback_data.type_code == "exp" else "income"
    )
    
    cat_name = "Выбрано"
    for cat in categories:
        if cat.get("id") == callback_data.category_id:
            cat_name = cat.get("name", "Выбрано")
            break
    
    if callback_data.type_code == "exp":
        title = "📉 Расход"
        account_prompt = "Откуда списать?"
    else:
        title = "📈 Доход"
        account_prompt = "Куда зачислить?"
    
    formatted = f"{callback_data.amount:,}".replace(",", " ")
    text = f"{title} <b>{formatted} ₸</b>\nКатегория: {cat_name}\n\n{account_prompt}"
    
    keyboard = build_account_keyboard(
        accounts=accounts,
        amount=callback_data.amount,
        type_code=callback_data.type_code,
        category_id=callback_data.category_id,
        category_name=cat_name,
        msg_id=callback_data.msg_id
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()


@router.callback_query(AccountSelectionCallback.filter())
async def handle_account_selected(callback: CallbackQuery, callback_data: AccountSelectionCallback):
    """Handle account selection - finalize transaction."""
    telegram_id = callback.from_user.id
    
    # Create transaction in database
    result = await create_transaction(
        telegram_id=telegram_id,
        type_code=callback_data.type_code,
        amount=callback_data.amount,
        category_id=callback_data.category_id,
        account_id=callback_data.account_id
    )
    
    if result:
        formatted = f"{callback_data.amount:,}".replace(",", " ")
        
        if callback_data.type_code == "exp":
            emoji = "📉"
            type_name = "Расход"
        elif callback_data.type_code == "inc":
            emoji = "📈"
            type_name = "Доход"
        else:
            emoji = "🔄"
            type_name = "Перевод"
        
        # Get account with updated balance
        account = await get_account_by_id(callback_data.account_id)
        acc_name = account.get("name", "") if account else ""
        acc_icon = account.get("icon", "💳") if account else "💳"
        new_balance = account.get("balance", 0) if account else 0
        balance_formatted = f"{new_balance:,}".replace(",", " ")
        
        # Get category name
        cat_name = ""
        if callback_data.category_id:
            categories = await get_categories(
                telegram_id,
                "expense" if callback_data.type_code == "exp" else "income"
            )
            for cat in categories:
                if cat.get("id") == callback_data.category_id:
                    cat_name = cat.get("name", "")
                    break
        
        text = f"""
✅ <b>Сохранено!</b>

{emoji} {type_name}: <b>{formatted} ₸</b>
📁 Категория: {cat_name}
━━━━━━━━━━━━━━━━━━
{acc_icon} {acc_name}: <b>{balance_formatted} ₸</b>

💡 <i>Отправь новую сумму для следующей транзакции</i>
"""
        await callback.message.edit_text(text)
        await callback.answer("✅ Сохранено!")
    else:
        await callback.answer("❌ Ошибка сохранения", show_alert=True)
