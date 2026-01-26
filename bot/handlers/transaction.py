"""Transaction input handler - when user sends a number."""
from aiogram import Router, F
from aiogram.types import Message

from bot.keyboards.inline import build_type_keyboard

router = Router()


@router.message(F.text.regexp(r"^\d+$"))
async def handle_number_input(message: Message):
    """Handle when user sends a number (amount)."""
    if not message.text or not message.from_user:
        return
    
    amount = int(message.text)
    user_message_id = message.message_id
    
    # Format amount with spaces for readability
    formatted_amount = f"{amount:,}".replace(",", " ")
    
    text = f"💰 Сумма: <b>{formatted_amount} ₸</b>\n\nВыберите тип операции:"
    
    keyboard = build_type_keyboard(amount, user_message_id)
    
    await message.answer(text, reply_markup=keyboard)
