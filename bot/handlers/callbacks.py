"""Callback query handlers for inline buttons."""
from aiogram import Router, F
from aiogram.types import CallbackQuery

from bot.keyboards.inline import (
    build_category_keyboard,
    build_account_keyboard,
    build_type_keyboard,
    build_transfer_source_keyboard,
    build_transfer_dest_keyboard,
    build_debt_type_keyboard,
    build_debt_source_keyboard,
    build_debt_counterparty_keyboard,
)
from bot.database.supabase import (
    get_categories,
    get_accounts,
    get_account_by_id,
    create_transaction,
    get_debt_accounts,
    create_debt_transaction,
)
from bot.utils.callback_data import (
    TypeSelectionCallback,
    CategorySelectionCallback,
    AccountSelectionCallback,
    ActionCallback,
    TransferSourceCallback,
    TransferDestinationCallback,
    DebtTypeCallback,
    DebtSourceCallback,
    DebtCounterpartyCallback,
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
        # For transfers, show source account selection
        accounts = await get_accounts(telegram_id)
        formatted = f"{callback_data.amount:,}".replace(",", " ")
        text = f"🔄 Перевод <b>{formatted} ₸</b>\n\nОткуда перевести?"
        keyboard = build_transfer_source_keyboard(
            accounts=accounts,
            amount=callback_data.amount,
            msg_id=callback_data.msg_id
        )
        await callback.message.edit_text(text, reply_markup=keyboard)
        await callback.answer()
        return
    elif callback_data.type_code == "debt":
        # Show debt type selection (lent/borrowed)
        formatted = f"{callback_data.amount:,}".replace(",", " ")
        text = f"🤝 Долги <b>{formatted} ₸</b>\n\nВыберите тип операции:"
        keyboard = build_debt_type_keyboard(
            amount=callback_data.amount,
            msg_id=callback_data.msg_id
        )
        await callback.message.edit_text(text, reply_markup=keyboard)
        await callback.answer()
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


# ==================== Transfer Handlers ====================

@router.callback_query(TransferSourceCallback.filter())
async def handle_transfer_source_selected(callback: CallbackQuery, callback_data: TransferSourceCallback):
    """Handle transfer source account selection - show destination accounts."""
    telegram_id = callback.from_user.id
    accounts = await get_accounts(telegram_id)
    
    # Get source account info for display
    source_account = await get_account_by_id(callback_data.source_id)
    source_name = source_account.get("name", "") if source_account else ""
    source_icon = source_account.get("icon", "💳") if source_account else "💳"
    
    formatted = f"{callback_data.amount:,}".replace(",", " ")
    text = f"""🔄 Перевод <b>{formatted} ₸</b>

Откуда: {source_icon} {source_name}

Куда перевести?"""
    
    keyboard = build_transfer_dest_keyboard(
        accounts=accounts,
        amount=callback_data.amount,
        source_id=callback_data.source_id,
        msg_id=callback_data.msg_id
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()


@router.callback_query(TransferDestinationCallback.filter())
async def handle_transfer_dest_selected(callback: CallbackQuery, callback_data: TransferDestinationCallback):
    """Handle transfer destination selection - create transfer transaction."""
    telegram_id = callback.from_user.id
    
    # Create transfer transaction
    result = await create_transaction(
        telegram_id=telegram_id,
        type_code="trf",
        amount=callback_data.amount,
        from_account_id=callback_data.source_id,
        to_account_id=callback_data.dest_id
    )
    
    if result:
        formatted = f"{callback_data.amount:,}".replace(",", " ")
        
        # Get updated account info
        source_account = await get_account_by_id(callback_data.source_id)
        dest_account = await get_account_by_id(callback_data.dest_id)
        
        source_name = source_account.get("name", "") if source_account else ""
        source_icon = source_account.get("icon", "💳") if source_account else "💳"
        source_balance = source_account.get("balance", 0) if source_account else 0
        source_balance_fmt = f"{source_balance:,}".replace(",", " ")
        
        dest_name = dest_account.get("name", "") if dest_account else ""
        dest_icon = dest_account.get("icon", "💳") if dest_account else "💳"
        dest_balance = dest_account.get("balance", 0) if dest_account else 0
        dest_balance_fmt = f"{dest_balance:,}".replace(",", " ")
        
        text = f"""✅ <b>Перевод выполнен!</b>

🔄 Сумма: <b>{formatted} ₸</b>
━━━━━━━━━━━━━━━━━━
{source_icon} {source_name}: <b>{source_balance_fmt} ₸</b>
{dest_icon} {dest_name}: <b>{dest_balance_fmt} ₸</b>

💡 <i>Отправь новую сумму для следующей транзакции</i>
"""
        await callback.message.edit_text(text)
        await callback.answer("✅ Перевод выполнен!")
    else:
        await callback.answer("❌ Ошибка перевода", show_alert=True)


@router.callback_query(ActionCallback.filter(F.action == "back_to_transfer_source"))
async def handle_back_to_transfer_source(callback: CallbackQuery, callback_data: ActionCallback):
    """Handle back to transfer source selection."""
    telegram_id = callback.from_user.id
    accounts = await get_accounts(telegram_id)
    
    formatted = f"{callback_data.amount:,}".replace(",", " ")
    text = f"🔄 Перевод <b>{formatted} ₸</b>\n\nОткуда перевести?"
    
    keyboard = build_transfer_source_keyboard(
        accounts=accounts,
        amount=callback_data.amount,
        msg_id=callback_data.msg_id
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()


# ==================== Debt Handlers ====================

@router.callback_query(DebtTypeCallback.filter())
async def handle_debt_type_selected(callback: CallbackQuery, callback_data: DebtTypeCallback):
    """Handle debt type selection (lent/borrowed) - show source accounts."""
    telegram_id = callback.from_user.id
    accounts = await get_accounts(telegram_id)  # Only asset accounts for source
    
    if callback_data.debt_type == "lent":
        title = "📤 Дал в долг"
        prompt = "Откуда деньги?"
    else:
        title = "📥 Взял в долг"
        prompt = "Куда зачислить?"
    
    formatted = f"{callback_data.amount:,}".replace(",", " ")
    text = f"{title} <b>{formatted} ₸</b>\n\n{prompt}"
    
    keyboard = build_debt_source_keyboard(
        accounts=accounts,
        amount=callback_data.amount,
        debt_type=callback_data.debt_type,
        msg_id=callback_data.msg_id
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()


@router.callback_query(DebtSourceCallback.filter())
async def handle_debt_source_selected(callback: CallbackQuery, callback_data: DebtSourceCallback):
    """Handle source account selection - show counterparty selection."""
    telegram_id = callback.from_user.id
    
    # Get existing debt accounts (counterparties)
    counterparties = await get_debt_accounts(telegram_id, callback_data.debt_type)
    
    # Get source account info
    source_account = await get_account_by_id(callback_data.source_id)
    source_name = source_account.get("name", "") if source_account else ""
    source_icon = source_account.get("icon", "💳") if source_account else "💳"
    
    if callback_data.debt_type == "lent":
        title = "📤 Дал в долг"
        prompt = "Кому дал?"
    else:
        title = "📥 Взял в долг"
        prompt = "У кого взял?"
    
    formatted = f"{callback_data.amount:,}".replace(",", " ")
    text = f"""{title} <b>{formatted} ₸</b>

Счёт: {source_icon} {source_name}

{prompt}"""
    
    keyboard = build_debt_counterparty_keyboard(
        counterparties=counterparties,
        amount=callback_data.amount,
        debt_type=callback_data.debt_type,
        source_id=callback_data.source_id,
        msg_id=callback_data.msg_id
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()


@router.callback_query(DebtCounterpartyCallback.filter())
async def handle_debt_counterparty_selected(callback: CallbackQuery, callback_data: DebtCounterpartyCallback):
    """Handle counterparty selection - create debt transaction."""
    telegram_id = callback.from_user.id
    
    # Create debt transaction
    result = await create_debt_transaction(
        telegram_id=telegram_id,
        debt_type=callback_data.debt_type,
        amount=callback_data.amount,
        source_account_id=callback_data.source_id,
        counterparty_account_id=callback_data.counterparty_id
    )
    
    if result:
        formatted = f"{callback_data.amount:,}".replace(",", " ")
        
        # Get updated account info
        source_account = await get_account_by_id(callback_data.source_id)
        counterparty_account = await get_account_by_id(callback_data.counterparty_id)
        
        source_name = source_account.get("name", "") if source_account else ""
        source_icon = source_account.get("icon", "💳") if source_account else "💳"
        source_balance = source_account.get("balance", 0) if source_account else 0
        source_balance_fmt = f"{source_balance:,}".replace(",", " ")
        
        cp_name = counterparty_account.get("name", "") if counterparty_account else ""
        cp_icon = counterparty_account.get("icon", "👤") if counterparty_account else "👤"
        cp_balance = counterparty_account.get("balance", 0) if counterparty_account else 0
        cp_balance_fmt = f"{cp_balance:,}".replace(",", " ")
        
        if callback_data.debt_type == "lent":
            action = "Дал в долг"
            emoji = "📤"
        else:
            action = "Взял в долг"
            emoji = "📥"
        
        text = f"""✅ <b>Записано!</b>

{emoji} {action}: <b>{formatted} ₸</b>
━━━━━━━━━━━━━━━━━━
{source_icon} {source_name}: <b>{source_balance_fmt} ₸</b>
{cp_icon} {cp_name}: <b>{cp_balance_fmt} ₸</b>

💡 <i>Отправь новую сумму для следующей транзакции</i>
"""
        await callback.message.edit_text(text)
        await callback.answer("✅ Записано!")
    else:
        await callback.answer("❌ Ошибка записи", show_alert=True)


@router.callback_query(ActionCallback.filter(F.action == "back_to_debt_type"))
async def handle_back_to_debt_type(callback: CallbackQuery, callback_data: ActionCallback):
    """Handle back to debt type selection."""
    formatted = f"{callback_data.amount:,}".replace(",", " ")
    text = f"🤝 Долги <b>{formatted} ₸</b>\n\nВыберите тип операции:"
    
    keyboard = build_debt_type_keyboard(
        amount=callback_data.amount,
        msg_id=callback_data.msg_id
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()


@router.callback_query(ActionCallback.filter(F.action == "back_to_debt_source"))
async def handle_back_to_debt_source(callback: CallbackQuery, callback_data: ActionCallback):
    """Handle back to debt source selection."""
    telegram_id = callback.from_user.id
    accounts = await get_accounts(telegram_id)
    
    debt_type = callback_data.type_code  # We encoded debt_type in type_code
    
    if debt_type == "lent":
        title = "📤 Дал в долг"
        prompt = "Откуда деньги?"
    else:
        title = "📥 Взял в долг"
        prompt = "Куда зачислить?"
    
    formatted = f"{callback_data.amount:,}".replace(",", " ")
    text = f"{title} <b>{formatted} ₸</b>\n\n{prompt}"
    
    keyboard = build_debt_source_keyboard(
        accounts=accounts,
        amount=callback_data.amount,
        debt_type=debt_type,
        msg_id=callback_data.msg_id
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()


@router.callback_query(ActionCallback.filter(F.action == "new_counterparty"))
async def handle_new_counterparty(callback: CallbackQuery, callback_data: ActionCallback):
    """Handle new counterparty creation - for now show placeholder."""
    # TODO: Implement FSM for entering new counterparty name
    await callback.answer("🚧 Пока можно только выбрать существующего. Добавьте через /accounts", show_alert=True)


