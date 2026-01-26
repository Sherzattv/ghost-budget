"""Balance command handler."""
from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from bot.database.supabase import get_accounts_with_balance

router = Router()


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
    
    text = "💰 <b>Ваши балансы</b>\n\n"
    
    total_available = 0
    total_savings = 0
    total_owed_to_me = 0
    total_i_owe = 0
    
    if assets:
        text += "💳 <b>Счета:</b>\n"
        for acc in assets:
            balance = acc.get("balance", 0)
            total_available += balance
            icon = acc.get("icon", "💳")
            name = acc.get("name", "Счёт")
            formatted = f"{balance:,.0f}".replace(",", " ")
            text += f"  {icon} {name}: <b>{formatted} ₸</b>\n"
        text += "\n"
    
    if savings:
        text += "🏦 <b>Накопления:</b>\n"
        for acc in savings:
            balance = acc.get("balance", 0)
            total_savings += balance
            icon = acc.get("icon", "🏧")
            name = acc.get("name", "Накопления")
            formatted = f"{balance:,.0f}".replace(",", " ")
            text += f"  {icon} {name}: <b>{formatted} ₸</b>\n"
        text += "\n"
    
    if receivables:
        text += "📥 <b>Мне должны:</b>\n"
        for acc in receivables:
            balance = acc.get("balance", 0)
            total_owed_to_me += balance
            icon = acc.get("icon", "👤")
            name = acc.get("name", "Должник")
            formatted = f"{balance:,.0f}".replace(",", " ")
            text += f"  {icon} {name}: <b>{formatted} ₸</b>\n"
        text += "\n"
    
    if liabilities:
        text += "📤 <b>Я должен:</b>\n"
        for acc in liabilities:
            balance = acc.get("balance", 0)
            total_i_owe += abs(balance)
            icon = acc.get("icon", "🏛")
            name = acc.get("name", "Кредит")
            formatted = f"{abs(balance):,.0f}".replace(",", " ")
            text += f"  {icon} {name}: <b>-{formatted} ₸</b>\n"
        text += "\n"
    
    # Summary
    text += "━━━━━━━━━━━━━━━━━━\n"
    
    available_formatted = f"{total_available:,.0f}".replace(",", " ")
    text += f"💵 Доступно: <b>{available_formatted} ₸</b>\n"
    
    if total_savings > 0:
        savings_formatted = f"{total_savings:,.0f}".replace(",", " ")
        text += f"🏦 Накоплено: <b>{savings_formatted} ₸</b>\n"
    
    if total_owed_to_me > 0:
        owed_formatted = f"{total_owed_to_me:,.0f}".replace(",", " ")
        text += f"📥 Мне должны: <b>{owed_formatted} ₸</b>\n"
    
    if total_i_owe > 0:
        i_owe_formatted = f"{total_i_owe:,.0f}".replace(",", " ")
        text += f"📤 Я должен: <b>-{i_owe_formatted} ₸</b>\n"
    
    net_worth = total_available + total_savings + total_owed_to_me - total_i_owe
    net_formatted = f"{net_worth:,.0f}".replace(",", " ")
    sign = "+" if net_worth >= 0 else ""
    text += f"\n💎 Чистый капитал: <b>{sign}{net_formatted} ₸</b>"
    
    await message.answer(text)
