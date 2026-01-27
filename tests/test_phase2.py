"""Tests for Phase 2 functionality."""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch


# ==================== Callback Data Tests ====================

def test_transfer_source_callback():
    """Test TransferSourceCallback creation and packing."""
    from bot.utils.callback_data import TransferSourceCallback
    
    callback = TransferSourceCallback(
        amount=50000,
        source_id="test-uuid",
        msg_id=123
    )
    
    packed = callback.pack()
    assert "trf_src" in packed
    assert callback.amount == 50000
    assert callback.source_id == "test-uuid"


def test_transfer_dest_callback():
    """Test TransferDestinationCallback creation and packing."""
    from bot.utils.callback_data import TransferDestinationCallback
    
    callback = TransferDestinationCallback(
        amount=50000,
        source_id="source-uuid",
        dest_id="dest-uuid",
        msg_id=123
    )
    
    packed = callback.pack()
    assert "trf_dst" in packed
    assert callback.source_id == "source-uuid"
    assert callback.dest_id == "dest-uuid"


def test_debt_type_callback():
    """Test DebtTypeCallback for lent/borrowed."""
    from bot.utils.callback_data import DebtTypeCallback
    
    lent = DebtTypeCallback(amount=20000, debt_type="lent", msg_id=1)
    borrowed = DebtTypeCallback(amount=30000, debt_type="borrowed", msg_id=2)
    
    assert lent.debt_type == "lent"
    assert borrowed.debt_type == "borrowed"
    assert "debt_type" in lent.pack()


def test_debt_source_callback():
    """Test DebtSourceCallback."""
    from bot.utils.callback_data import DebtSourceCallback
    
    callback = DebtSourceCallback(
        amount=10000,
        debt_type="lent",
        source_id="kaspi-uuid",
        msg_id=1
    )
    
    assert callback.debt_type == "lent"
    assert callback.source_id == "kaspi-uuid"


def test_debt_counterparty_callback():
    """Test DebtCounterpartyCallback."""
    from bot.utils.callback_data import DebtCounterpartyCallback
    
    callback = DebtCounterpartyCallback(
        amount=15000,
        debt_type="borrowed",
        source_id="kaspi-uuid",
        counterparty_id="friend-uuid",
        msg_id=1
    )
    
    assert callback.counterparty_id == "friend-uuid"


# ==================== Keyboard Tests ====================

def test_build_transfer_source_keyboard():
    """Test transfer source keyboard generation."""
    from bot.keyboards.inline import build_transfer_source_keyboard
    
    accounts = [
        {"id": "1", "name": "Kaspi", "icon": "💳", "balance": 100000},
        {"id": "2", "name": "Наличные", "icon": "💵", "balance": 50000},
    ]
    
    keyboard = build_transfer_source_keyboard(accounts, 10000, 123)
    
    # Should have 2 account buttons + back button
    assert len(keyboard.inline_keyboard) == 3
    assert "Kaspi" in keyboard.inline_keyboard[0][0].text
    assert "100 000" in keyboard.inline_keyboard[0][0].text


def test_build_transfer_dest_keyboard_excludes_source():
    """Test that destination keyboard excludes source account."""
    from bot.keyboards.inline import build_transfer_dest_keyboard
    
    accounts = [
        {"id": "1", "name": "Kaspi", "icon": "💳", "balance": 100000},
        {"id": "2", "name": "Наличные", "icon": "💵", "balance": 50000},
        {"id": "3", "name": "Halyk", "icon": "🏦", "balance": 200000},
    ]
    
    # Source is "1" (Kaspi), should be excluded from destination
    keyboard = build_transfer_dest_keyboard(accounts, 10000, "1", 123)
    
    # Should have 2 buttons (without Kaspi) + back button
    assert len(keyboard.inline_keyboard) == 3
    
    # Check Kaspi is not in the options
    texts = [row[0].text for row in keyboard.inline_keyboard]
    assert not any("Kaspi" in t for t in texts)


def test_build_debt_type_keyboard():
    """Test debt type keyboard has lent/borrowed options."""
    from bot.keyboards.inline import build_debt_type_keyboard
    
    keyboard = build_debt_type_keyboard(20000, 123)
    
    # Should have: Дал в долг, Взял в долг, Назад
    assert len(keyboard.inline_keyboard) == 3
    assert "Дал в долг" in keyboard.inline_keyboard[0][0].text
    assert "Взял в долг" in keyboard.inline_keyboard[1][0].text


def test_build_debt_counterparty_keyboard():
    """Test counterparty keyboard with new person option."""
    from bot.keyboards.inline import build_debt_counterparty_keyboard
    
    counterparties = [
        {"id": "cp1", "name": "Айбек", "icon": "👤", "balance": 5000},
    ]
    
    keyboard = build_debt_counterparty_keyboard(
        counterparties, 10000, "lent", "source-id", 123
    )
    
    # 1 counterparty + new person + back = 3 rows
    assert len(keyboard.inline_keyboard) == 3
    assert "Айбек" in keyboard.inline_keyboard[0][0].text
    assert "Новый человек" in keyboard.inline_keyboard[1][0].text


# ==================== Integration Test ====================

def test_all_imports():
    """Test that all new modules can be imported."""
    from bot.utils.callback_data import (
        TransferSourceCallback,
        TransferDestinationCallback,
        DebtTypeCallback,
        DebtSourceCallback,
        DebtCounterpartyCallback,
    )
    from bot.keyboards.inline import (
        build_transfer_source_keyboard,
        build_transfer_dest_keyboard,
        build_debt_type_keyboard,
        build_debt_source_keyboard,
        build_debt_counterparty_keyboard,
    )
    from bot.database.supabase import (
        get_debt_accounts,
        create_debt_account,
        create_debt_transaction,
    )
    
    # If we get here, all imports succeeded
    assert True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
