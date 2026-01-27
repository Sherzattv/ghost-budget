"""Inline keyboard builders."""
from typing import List, Dict, Any, Optional
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

from bot.utils.callback_data import (
    TypeSelectionCallback,
    CategorySelectionCallback,
    AccountSelectionCallback,
    ActionCallback,
)


def build_type_keyboard(amount: int, msg_id: int) -> InlineKeyboardMarkup:
    """Build keyboard for transaction type selection."""
    
    buttons = [
        # Row 1
        [
            InlineKeyboardButton(
                text="📉 Расход",
                callback_data=TypeSelectionCallback(
                    amount=amount, type_code="exp", msg_id=msg_id
                ).pack()
            ),
            InlineKeyboardButton(
                text="📈 Доход", 
                callback_data=TypeSelectionCallback(
                    amount=amount, type_code="inc", msg_id=msg_id
                ).pack()
            )
        ],
        # Row 2
        [
            InlineKeyboardButton(
                text="🔄 Перевод",
                callback_data=TypeSelectionCallback(
                    amount=amount, type_code="trf", msg_id=msg_id
                ).pack()
            ),
            InlineKeyboardButton(
                text="🤝 Долги",
                callback_data=TypeSelectionCallback(
                    amount=amount, type_code="debt", msg_id=msg_id
                ).pack()
            )
        ],
        # Row 3 - Cancel
        [
            InlineKeyboardButton(
                text="❌ Отмена",
                callback_data=ActionCallback(action="cancel", msg_id=msg_id).pack()
            )
        ]
    ]
    
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def build_category_keyboard(
    categories: List[Dict[str, Any]],
    amount: int,
    type_code: str,
    msg_id: int
) -> InlineKeyboardMarkup:
    """Build keyboard for category selection."""
    
    buttons = []
    row = []
    
    for i, cat in enumerate(categories):
        icon = cat.get("icon", "📁")
        name = cat.get("name", "Категория")
        cat_id = cat.get("id", "")
        
        button = InlineKeyboardButton(
            text=f"{icon} {name}",
            callback_data=CategorySelectionCallback(
                amount=amount,
                type_code=type_code,
                category_id=cat_id,
                msg_id=msg_id
            ).pack()
        )
        row.append(button)
        
        # 2 buttons per row
        if len(row) == 2:
            buttons.append(row)
            row = []
    
    # Add remaining button if odd number
    if row:
        buttons.append(row)
    
    # Custom category option
    buttons.append([
        InlineKeyboardButton(
            text="✍️ Другое",
            callback_data=ActionCallback(
                action="custom_cat",
                amount=amount,
                type_code=type_code,
                msg_id=msg_id
            ).pack()
        )
    ])
    
    # Back button
    buttons.append([
        InlineKeyboardButton(
            text="◀️ Назад",
            callback_data=ActionCallback(
                action="back_to_type",
                amount=amount,
                msg_id=msg_id
            ).pack()
        )
    ])
    
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def build_account_keyboard(
    accounts: List[Dict[str, Any]],
    amount: int,
    type_code: str,
    msg_id: int,
    category_id: Optional[str] = None,
    category_name: Optional[str] = None,
    is_source: bool = True
) -> InlineKeyboardMarkup:
    """Build keyboard for account selection."""
    
    buttons = []
    
    for acc in accounts:
        icon = acc.get("icon", "💳")
        name = acc.get("name", "Счёт")
        acc_id = acc.get("id", "")
        
        button = InlineKeyboardButton(
            text=f"{icon} {name}",
            callback_data=AccountSelectionCallback(
                amount=amount,
                type_code=type_code,
                category_id=category_id,
                account_id=acc_id,
                msg_id=msg_id
            ).pack()
        )
        buttons.append([button])
    
    # Back button
    if category_id:
        # Go back to category selection
        back_callback = ActionCallback(
            action="back_to_category",
            amount=amount,
            type_code=type_code,
            msg_id=msg_id
        )
    else:
        # Go back to type selection
        back_callback = ActionCallback(
            action="back_to_type",
            amount=amount,
            msg_id=msg_id
        )
    
    buttons.append([
        InlineKeyboardButton(
            text="◀️ Назад",
            callback_data=back_callback.pack()
        )
    ])
    
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def build_confirmation_keyboard(
    amount: int,
    type_code: str,
    category_id: str,
    account_id: str,
    msg_id: int
) -> InlineKeyboardMarkup:
    """Build confirmation keyboard."""
    
    buttons = [
        [
            InlineKeyboardButton(
                text="✅ Подтвердить",
                callback_data=AccountSelectionCallback(
                    amount=amount,
                    type_code=type_code,
                    category_id=category_id,
                    account_id=account_id,
                    msg_id=msg_id
                ).pack()
            )
        ],
        [
            InlineKeyboardButton(
                text="❌ Отмена",
                callback_data=ActionCallback(action="cancel", msg_id=msg_id).pack()
            )
        ]
    ]
    
    return InlineKeyboardMarkup(inline_keyboard=buttons)
