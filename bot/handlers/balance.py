"""Balance command handler."""
from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from aiogram.utils.formatting import (
    as_list,
    Bold,
    Text,
)

from bot.database.supabase import get_accounts_with_balance

router = Router()

# Markers
ITEM_MARKER = "○ "
DIVIDER = "─────────"


def format_amount(amount: float) -> str:
    """Format amount with spaces as thousand separator."""
    return f"{amount:,.0f}".replace(",", " ") + " ₸"


@router.message(Command("balance"))
async def cmd_balance(message: Message):
    """Handle /balance command - show all account balances."""
    if not message.from_user:
        return
    
    telegram_id = message.from_user.id
    accounts = await get_accounts_with_balance(telegram_id)
    
    if not accounts:
        await message.answer(
            "💳 У вас пока нет счетов.\n\n"
            "Используйте /accounts чтобы добавить счета."
        )
        return
    
    # Group accounts by type
    assets = [a for a in accounts if a.get("type") == "asset"]
    savings = [a for a in accounts if a.get("type") == "savings"]
    receivables = [a for a in accounts if a.get("type") == "receivable"]
    liabilities = [a for a in accounts if a.get("type") == "liability"]
    
    # Split assets into real money and credit cards
    real_money = [a for a in assets if not a.get("credit_limit")]
    credit_cards = [a for a in assets if a.get("credit_limit")]
    
    sections = []
    
    total_real_money = 0
    total_savings = 0
    total_owed_to_me = 0
    total_i_owe = 0
    total_credit_available = 0
    total_credit_limit = 0
    
    # === Real Money Section ===
    if real_money:
        items = []
        for acc in real_money:
            balance = float(acc.get("balance", 0) or 0)
            total_real_money += balance
            name = acc.get("name", "Счёт")
            items.append(Text(f"{ITEM_MARKER}{name}: {format_amount(balance)}"))
        
        items.append(Text(DIVIDER))
        items.append(Text(f"Итого: {format_amount(total_real_money)}"))
        
        sections.append(as_list(
            Bold("💵 Мои деньги:"),
            *items,
            sep="\n",
        ))
    
    # === Credit Cards Section ===
    if credit_cards:
        items = []
        for acc in credit_cards:
            available = float(acc.get("balance", 0) or 0)
            limit = float(acc.get("credit_limit", 0) or 0)
            total_credit_available += available
            total_credit_limit += limit
            name = acc.get("name", "Карта")
            items.append(Text(f"{ITEM_MARKER}{name}: {format_amount(available)} / {format_amount(limit)}"))
        
        used = total_credit_limit - total_credit_available
        items.append(Text(DIVIDER))
        items.append(Text(f"Использовано: {format_amount(used)}"))
        items.append(Text(f"Доступно: {format_amount(total_credit_available)}"))
        
        sections.append(as_list(
            Bold("💳 Кредитные карты:"),
            *items,
            sep="\n",
        ))
    
    # === Savings Section ===
    if savings:
        items = []
        for acc in savings:
            balance = float(acc.get("balance", 0) or 0)
            total_savings += balance
            name = acc.get("name", "Накопления")
            items.append(Text(f"{ITEM_MARKER}{name}: {format_amount(balance)}"))
        
        items.append(Text(DIVIDER))
        items.append(Text(f"Итого: {format_amount(total_savings)}"))
        
        sections.append(as_list(
            Bold("🏦 Накопления:"),
            *items,
            sep="\n",
        ))
    
    # === Receivables Section ===
    receivable_items = []
    for acc in receivables:
        balance = float(acc.get("balance", 0) or 0)
        if balance > 0:
            total_owed_to_me += balance
            name = acc.get("name", "Должник")
            receivable_items.append(Text(f"{ITEM_MARKER}{name}: {format_amount(balance)}"))
    
    if receivable_items:
        receivable_items.append(Text(DIVIDER))
        receivable_items.append(Text(f"Итого: {format_amount(total_owed_to_me)}"))
        
        sections.append(as_list(
            Bold("📥 Мне должны:"),
            *receivable_items,
            sep="\n",
        ))
    
    # === Liabilities Section ===
    if liabilities:
        items = []
        for acc in liabilities:
            balance = float(acc.get("balance", 0) or 0)
            debt = abs(balance)
            total_i_owe += debt
            name = acc.get("name", "Долг")
            items.append(Text(f"{ITEM_MARKER}{name}: {format_amount(debt)}"))
        
        items.append(Text(DIVIDER))
        items.append(Text(f"Итого: {format_amount(total_i_owe)}"))
        
        sections.append(as_list(
            Bold("📤 Я должен:"),
            *items,
            sep="\n",
        ))
    
    # === Summary Section ===
    summary_items = [
        Text(f"Свои деньги: {format_amount(total_real_money)}"),
    ]
    
    if total_savings > 0:
        summary_items.append(Text(f"Накоплено: {format_amount(total_savings)}"))
    
    if total_credit_available > 0:
        summary_items.append(Text(f"Кредит доступен: {format_amount(total_credit_available)}"))
    
    # Net worth = real money + savings + owed to me - i owe
    net_worth = total_real_money + total_savings + total_owed_to_me - total_i_owe
    sign = "+" if net_worth >= 0 else ""
    summary_items.append(Text(f"Чистый капитал: {sign}{format_amount(net_worth)}"))
    
    sections.append(as_list(
        Bold("━━━━━━━━━━"),
        *summary_items,
        sep="\n",
    ))
    
    # Build final content
    content = as_list(
        Bold("💰 Баланс"),
        *sections,
        sep="\n\n",
    )
    
    await message.answer(**content.as_kwargs())
