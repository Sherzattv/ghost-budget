"""Inline keyboard builders."""
import json
from typing import List, Dict, Any, Optional
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton


def build_type_keyboard(amount: int, msg_id: int) -> InlineKeyboardMarkup:
    """Build keyboard for transaction type selection."""
    
    buttons = [
        # Row 1
        [
            InlineKeyboardButton(
                text="📉 Расход",
                callback_data=json.dumps({"a": amount, "t": "exp", "m": msg_id})
            ),
            InlineKeyboardButton(
                text="📈 Доход", 
                callback_data=json.dumps({"a": amount, "t": "inc", "m": msg_id})
            )
        ],
        # Row 2
        [
            InlineKeyboardButton(
                text="🔄 Перевод",
                callback_data=json.dumps({"a": amount, "t": "trf", "m": msg_id})
            ),
            InlineKeyboardButton(
                text="🤝 Долги",
                callback_data=json.dumps({"a": amount, "t": "debt", "m": msg_id})
            )
        ],
        # Row 3 - Cancel
        [
            InlineKeyboardButton(
                text="❌ Отмена",
                callback_data=json.dumps({"action": "cancel", "m": msg_id})
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
            callback_data=json.dumps({
                "a": amount,
                "t": type_code,
                "c": cat_id,
                "cn": name[:10],  # truncate for 64 byte limit
                "m": msg_id
            })
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
            callback_data=json.dumps({
                "a": amount,
                "t": type_code,
                "action": "custom_cat",
                "m": msg_id
            })
        )
    ])
    
    # Back button
    buttons.append([
        InlineKeyboardButton(
            text="◀️ Назад",
            callback_data=json.dumps({"a": amount, "m": msg_id})
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
        
        callback_data = {
            "a": amount,
            "t": type_code,
            "s": acc_id,
            "an": name[:10],
            "m": msg_id,
            "f": True  # finalize flag
        }
        
        if category_id:
            callback_data["c"] = category_id
        if category_name:
            callback_data["cn"] = category_name[:10]
        
        button = InlineKeyboardButton(
            text=f"{icon} {name}",
            callback_data=json.dumps(callback_data)
        )
        buttons.append([button])
    
    # Back button
    back_data = {"a": amount, "t": type_code, "m": msg_id}
    if not category_id:
        # Go back to type selection
        back_data = {"a": amount, "m": msg_id}
    
    buttons.append([
        InlineKeyboardButton(
            text="◀️ Назад",
            callback_data=json.dumps(back_data)
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
                callback_data=json.dumps({
                    "a": amount,
                    "t": type_code,
                    "c": category_id,
                    "s": account_id,
                    "m": msg_id,
                    "f": True
                })
            )
        ],
        [
            InlineKeyboardButton(
                text="❌ Отмена",
                callback_data=json.dumps({"action": "cancel", "m": msg_id})
            )
        ]
    ]
    
    return InlineKeyboardMarkup(inline_keyboard=buttons)
