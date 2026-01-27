"""Transaction input handler - when user sends a number."""
import re
from aiogram import Router, F
from aiogram.types import Message

from bot.keyboards.inline import build_type_keyboard

router = Router()


def parse_amount(text: str) -> int | None:
    """
    Parse amount from various formats.
    
    Supported formats:
    - "2000" -> 2000
    - "2 000" -> 2000
    - "2,000" -> 2000
    - "2.5k" or "2.5к" -> 2500
    - "2k" or "2к" -> 2000
    - "2000.50" -> 2001 (rounded)
    """
    text = text.strip().lower()
    
    # Handle k/к suffix (thousands)
    if text.endswith('k') or text.endswith('к'):
        text = text[:-1].strip()
        try:
            # Handle decimal thousands like "2.5k"
            num = float(text.replace(' ', '').replace(',', '.'))
            return int(num * 1000)
        except ValueError:
            return None
    
    # Remove spaces and commas
    text = text.replace(' ', '').replace(',', '')
    
    # Handle decimal numbers
    if '.' in text:
        try:
            return int(round(float(text)))
        except ValueError:
            return None
    
    # Handle pure integers
    try:
        return int(text)
    except ValueError:
        return None


# Match various number formats
NUMBER_PATTERN = re.compile(
    r'^[\d\s,\.]+[kк]?$',
    re.IGNORECASE
)


@router.message(F.text.regexp(NUMBER_PATTERN))
async def handle_number_input(message: Message):
    """Handle when user sends a number (amount)."""
    if not message.text or not message.from_user:
        return
    
    # Parse the amount with support for various formats
    amount = parse_amount(message.text)
    
    # Validation
    if amount is None:
        await message.answer(
            "❌ <b>Не могу распознать сумму</b>\n\n"
            "Примеры форматов:\n"
            "• <code>2000</code>\n"
            "• <code>2 500</code>\n"
            "• <code>2.5k</code> (= 2500)\n"
            "• <code>10к</code> (= 10000)"
        )
        return
    
    if amount <= 0:
        await message.answer(
            "❌ Сумма должна быть больше нуля.\n"
            "Попробуй ещё раз!"
        )
        return
    
    if amount > 999_999_999:
        await message.answer(
            "😅 Слишком большая сумма!\n"
            "Максимум: 999 999 999 ₸"
        )
        return
    
    user_message_id = message.message_id
    
    # Format amount with spaces for readability
    formatted_amount = f"{amount:,}".replace(",", " ")
    
    text = f"💰 Сумма: <b>{formatted_amount} ₸</b>\n\nВыберите тип операции:"
    
    keyboard = build_type_keyboard(amount, user_message_id)
    
    await message.answer(text, reply_markup=keyboard)
