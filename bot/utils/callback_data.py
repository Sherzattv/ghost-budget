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


class DebtTypeCallback(CallbackData, prefix="debt_type"):
    """Callback for debt type selection (lent/borrowed)."""
    amount: int
    debt_type: str  # lent = дал в долг, borrowed = взял в долг
    msg_id: int


class DebtSourceCallback(CallbackData, prefix="debt_src"):
    """Callback for source account selection in debt flow."""
    amount: int
    debt_type: str
    source_id: str
    msg_id: int


class DebtCounterpartyCallback(CallbackData, prefix="debt_cp"):
    """Callback for counterparty (debtor/creditor) selection."""
    amount: int
    debt_type: str
    source_id: str
    counterparty_id: str  # account ID of the receivable/liability
    msg_id: int

