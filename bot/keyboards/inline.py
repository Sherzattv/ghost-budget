"""Inline keyboard builders."""
from typing import List, Dict, Any, Optional
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

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


def build_transfer_source_keyboard(
    accounts: List[Dict[str, Any]],
    amount: int,
    msg_id: int
) -> InlineKeyboardMarkup:
    """Build keyboard for transfer source account selection."""
    
    buttons = []
    
    for acc in accounts:
        icon = acc.get("icon", "💳")
        name = acc.get("name", "Счёт")
        acc_id = acc.get("id", "")
        balance = acc.get("balance", 0) or 0
        balance_formatted = f"{balance:,}".replace(",", " ")
        
        button = InlineKeyboardButton(
            text=f"{icon} {name} ({balance_formatted} ₸)",
            callback_data=TransferSourceCallback(
                amount=amount,
                source_id=acc_id,
                msg_id=msg_id
            ).pack()
        )
        buttons.append([button])
    
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


def build_transfer_dest_keyboard(
    accounts: List[Dict[str, Any]],
    amount: int,
    source_id: str,
    msg_id: int
) -> InlineKeyboardMarkup:
    """Build keyboard for transfer destination account selection (excludes source)."""
    
    buttons = []
    
    for acc in accounts:
        acc_id = acc.get("id", "")
        # Skip source account
        if acc_id == source_id:
            continue
            
        icon = acc.get("icon", "💳")
        name = acc.get("name", "Счёт")
        balance = acc.get("balance", 0) or 0
        balance_formatted = f"{balance:,}".replace(",", " ")
        
        button = InlineKeyboardButton(
            text=f"{icon} {name} ({balance_formatted} ₸)",
            callback_data=TransferDestinationCallback(
                amount=amount,
                source_id=source_id,
                dest_id=acc_id,
                msg_id=msg_id
            ).pack()
        )
        buttons.append([button])
    
    # Back button - go back to source selection
    buttons.append([
        InlineKeyboardButton(
            text="◀️ Назад",
            callback_data=ActionCallback(
                action="back_to_transfer_source",
                amount=amount,
                msg_id=msg_id
            ).pack()
        )
    ])
    
    return InlineKeyboardMarkup(inline_keyboard=buttons)


# ==================== Debt Keyboards ====================

def build_debt_type_keyboard(amount: int, msg_id: int) -> InlineKeyboardMarkup:
    """Build keyboard for debt type selection (lent/borrowed)."""
    
    buttons = [
        [
            InlineKeyboardButton(
                text="📤 Дал в долг",
                callback_data=DebtTypeCallback(
                    amount=amount,
                    debt_type="lent",
                    msg_id=msg_id
                ).pack()
            )
        ],
        [
            InlineKeyboardButton(
                text="📥 Взял в долг",
                callback_data=DebtTypeCallback(
                    amount=amount,
                    debt_type="borrowed",
                    msg_id=msg_id
                ).pack()
            )
        ],
        [
            InlineKeyboardButton(
                text="◀️ Назад",
                callback_data=ActionCallback(
                    action="back_to_type",
                    amount=amount,
                    msg_id=msg_id
                ).pack()
            )
        ]
    ]
    
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def build_debt_source_keyboard(
    accounts: List[Dict[str, Any]],
    amount: int,
    debt_type: str,
    msg_id: int
) -> InlineKeyboardMarkup:
    """Build keyboard for source account selection in debt flow."""
    
    buttons = []
    
    for acc in accounts:
        icon = acc.get("icon", "💳")
        name = acc.get("name", "Счёт")
        acc_id = acc.get("id", "")
        balance = acc.get("balance", 0) or 0
        balance_formatted = f"{balance:,}".replace(",", " ")
        
        button = InlineKeyboardButton(
            text=f"{icon} {name} ({balance_formatted} ₸)",
            callback_data=DebtSourceCallback(
                amount=amount,
                debt_type=debt_type,
                source_id=acc_id,
                msg_id=msg_id
            ).pack()
        )
        buttons.append([button])
    
    # Back button
    buttons.append([
        InlineKeyboardButton(
            text="◀️ Назад",
            callback_data=ActionCallback(
                action="back_to_debt_type",
                amount=amount,
                msg_id=msg_id
            ).pack()
        )
    ])
    
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def build_debt_counterparty_keyboard(
    counterparties: List[Dict[str, Any]],
    amount: int,
    debt_type: str,
    source_id: str,
    msg_id: int
) -> InlineKeyboardMarkup:
    """Build keyboard for counterparty (debtor/creditor) selection."""
    
    buttons = []
    
    for acc in counterparties:
        icon = acc.get("icon", "👤")
        name = acc.get("name", "Человек")
        acc_id = acc.get("id", "")
        balance = acc.get("balance", 0) or 0
        balance_formatted = f"{balance:,}".replace(",", " ")
        
        button = InlineKeyboardButton(
            text=f"{icon} {name} ({balance_formatted} ₸)",
            callback_data=DebtCounterpartyCallback(
                amount=amount,
                debt_type=debt_type,
                source_id=source_id,
                counterparty_id=acc_id,
                msg_id=msg_id
            ).pack()
        )
        buttons.append([button])
    
    # Add new counterparty button
    buttons.append([
        InlineKeyboardButton(
            text="➕ Новый человек",
            callback_data=ActionCallback(
                action="new_counterparty",
                amount=amount,
                type_code=f"debt_{debt_type}_{source_id}",  # encode for later
                msg_id=msg_id
            ).pack()
        )
    ])
    
    # Back button
    buttons.append([
        InlineKeyboardButton(
            text="◀️ Назад",
            callback_data=ActionCallback(
                action="back_to_debt_source",
                amount=amount,
                type_code=debt_type,
                msg_id=msg_id
            ).pack()
        )
    ])
    
    return InlineKeyboardMarkup(inline_keyboard=buttons)


