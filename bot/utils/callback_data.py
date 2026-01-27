"""Callback data structures using aiogram CallbackData factory."""
from typing import Optional
from aiogram.filters.callback_data import CallbackData


class TypeSelectionCallback(CallbackData, prefix="type"):
    """Callback for transaction type selection."""
    amount: int
    type_code: str  # exp, inc, trf
    msg_id: int


class CategorySelectionCallback(CallbackData, prefix="cat"):
    """Callback for category selection."""
    amount: int
    type_code: str
    category_id: str
    msg_id: int


class AccountSelectionCallback(CallbackData, prefix="acc"):
    """Callback for account selection."""
    amount: int
    type_code: str
    category_id: Optional[str] = None
    account_id: str = ""
    msg_id: int = 0


class TransferSourceCallback(CallbackData, prefix="trf_src"):
    """Callback for transfer source account selection."""
    amount: int
    source_id: str
    msg_id: int


class TransferDestinationCallback(CallbackData, prefix="trf_dst"):
    """Callback for transfer destination account selection."""
    amount: int
    source_id: str
    dest_id: str
    msg_id: int


class ActionCallback(CallbackData, prefix="act"):
    """Callback for actions like cancel, more categories, etc."""
    action: str
    msg_id: int = 0
    amount: int = 0
    type_code: Optional[str] = None
