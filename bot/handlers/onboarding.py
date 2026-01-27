"""Onboarding handler for new users."""
import json
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton

from bot.database.supabase import get_user_by_telegram_id

router = Router()

# Onboarding slides content
ONBOARDING_SLIDES = [
    {
        "title": "👋 Добро пожаловать в Ghost Budget!",
        "text": (
            "Я помогу тебе <b>видеть полную картину</b> твоих финансов.\n\n"
            "💡 <b>Ключевая идея:</b>\n"
            "Деньги не исчезают — они <i>перемещаются</i> между счетами.\n\n"
            "Давай я покажу, как это работает!"
        ),
        "emoji": "🎉"
    },
    {
        "title": "💳 Типы счетов",
        "text": (
            "У тебя есть разные <b>типы счетов</b>:\n\n"
            "💳 <b>Счета</b> — Kaspi, наличные, карты\n"
            "🏦 <b>Накопления</b> — депозиты, инвестиции\n"
            "📥 <b>Мне должны</b> — долги друзей тебе\n"
            "📤 <b>Я должен</b> — твои кредиты и долги\n\n"
            "Когда даёшь в долг — деньги <i>перемещаются</i> из Kaspi в «Долг Айбека»!"
        ),
        "emoji": "💰"
    },
    {
        "title": "⚡ Быстрый ввод",
        "text": (
            "Добавить транзакцию — <b>супер просто</b>:\n\n"
            "1️⃣ Отправь <b>сумму</b>: <code>2000</code>\n"
            "2️⃣ Выбери <b>тип</b>: Расход / Доход / Перевод\n"
            "3️⃣ Выбери <b>категорию</b>\n"
            "4️⃣ Выбери <b>счёт</b>\n\n"
            "✅ Готово! Транзакция сохранена."
        ),
        "emoji": "🚀"
    },
    {
        "title": "📊 Полезные команды",
        "text": (
            "Вот что я умею:\n\n"
            "/balance — 💰 Посмотреть балансы\n"
            "/stats — 📊 Аналитика расходов\n"
            "/help — ❓ Справка по командам\n\n"
            "А теперь — <b>попробуй сам!</b>\n"
            "Отправь любое число, например: <code>500</code>"
        ),
        "emoji": "✨"
    }
]


def build_onboarding_keyboard(slide_index: int) -> InlineKeyboardMarkup:
    """Build keyboard for onboarding slide."""
    buttons = []
    total_slides = len(ONBOARDING_SLIDES)
    
    nav_row = []
    
    # Back button (if not first slide)
    if slide_index > 0:
        nav_row.append(
            InlineKeyboardButton(
                text="◀️ Назад",
                callback_data=json.dumps({"onb": slide_index - 1})
            )
        )
    
    # Progress indicator
    progress = f"{slide_index + 1}/{total_slides}"
    nav_row.append(
        InlineKeyboardButton(
            text=progress,
            callback_data="noop"
        )
    )
    
    # Next/Finish button
    if slide_index < total_slides - 1:
        nav_row.append(
            InlineKeyboardButton(
                text="Далее ▶️",
                callback_data=json.dumps({"onb": slide_index + 1})
            )
        )
    else:
        nav_row.append(
            InlineKeyboardButton(
                text="🎉 Начать!",
                callback_data=json.dumps({"onb": "done"})
            )
        )
    
    buttons.append(nav_row)
    
    # Skip button on all slides except last
    if slide_index < total_slides - 1:
        buttons.append([
            InlineKeyboardButton(
                text="⏭ Пропустить обучение",
                callback_data=json.dumps({"onb": "skip"})
            )
        ])
    
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def get_slide_text(slide_index: int) -> str:
    """Get formatted text for onboarding slide."""
    slide = ONBOARDING_SLIDES[slide_index]
    return f"{slide['emoji']} <b>{slide['title']}</b>\n\n{slide['text']}"


async def start_onboarding(message: Message):
    """Start the onboarding flow for a new user."""
    text = get_slide_text(0)
    keyboard = build_onboarding_keyboard(0)
    await message.answer(text, reply_markup=keyboard)


@router.callback_query(F.data.contains('"onb"'))
async def handle_onboarding_navigation(callback: CallbackQuery):
    """Handle onboarding slide navigation."""
    if not callback.data or not callback.message:
        await callback.answer()
        return
    
    try:
        data = json.loads(callback.data)
        slide = data.get("onb")
    except (json.JSONDecodeError, KeyError):
        await callback.answer("❌ Ошибка")
        return
    
    if slide == "skip" or slide == "done":
        # Finish onboarding
        await callback.message.edit_text(
            "✅ <b>Отлично!</b>\n\n"
            "Ты готов начать!\n"
            "Просто отправь сумму, например: <code>1000</code>\n\n"
            "💡 <i>Подсказка: используй /help для полной справки</i>"
        )
        await callback.answer("🎉 Обучение завершено!")
        return
    
    if slide == "noop":
        await callback.answer()
        return
    
    # Show requested slide
    slide_index = int(slide)
    if 0 <= slide_index < len(ONBOARDING_SLIDES):
        text = get_slide_text(slide_index)
        keyboard = build_onboarding_keyboard(slide_index)
        await callback.message.edit_text(text, reply_markup=keyboard)
    
    await callback.answer()
