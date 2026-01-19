"""
E2E tests for authentication module.
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from auth import register_user, login, hash_password, _users_db


class TestAuthenticationFlows:
    """Flow 5: Authentication flows."""

    def test_complete_registration_and_login_flow(self, reset_auth_db):
        """
        User Story: As a user, I want to register and then login
        with my credentials.
        """
        # Step 1: Register a new user
        result = register_user("john_doe", "securePassword123")
        assert result is True

        # Step 2: Login with correct credentials
        login_result = login("john_doe", "securePassword123")
        assert login_result is True

    def test_login_with_incorrect_password(self, reset_auth_db):
        """
        User Story: Login should fail with wrong password.
        """
        register_user("jane", "correctPassword")

        # Try login with wrong password
        result = login("jane", "wrongPassword")
        assert result is False

    def test_login_nonexistent_user(self, reset_auth_db):
        """
        User Story: Login should fail for user that doesn't exist.
        """
        result = login("nonexistent", "anyPassword")
        assert result is False

    def test_duplicate_registration(self, reset_auth_db):
        """
        User Story: Cannot register same username twice.
        """
        register_user("duplicate", "password1")

        result = register_user("duplicate", "password2")
        assert result is False

    def test_registration_empty_username(self, reset_auth_db):
        """Test registration fails with empty username."""
        result = register_user("", "password")
        assert result is False

    def test_registration_empty_password(self, reset_auth_db):
        """Test registration fails with empty password."""
        result = register_user("user", "")
        assert result is False

    def test_registration_both_empty(self, reset_auth_db):
        """Test registration fails with both empty."""
        result = register_user("", "")
        assert result is False

    def test_login_empty_username(self, reset_auth_db):
        """Test login fails with empty username."""
        register_user("user", "password")
        assert login("", "password") is False

    def test_login_empty_password(self, reset_auth_db):
        """Test login fails with empty password."""
        register_user("user", "password")
        assert login("user", "") is False

    def test_login_both_empty(self, reset_auth_db):
        """Test login fails with both empty."""
        assert login("", "") is False


class TestPasswordHashing:
    """Test password hashing functionality."""

    def test_hash_password_with_salt(self):
        """Test password hashing with provided salt."""
        hash1, salt1 = hash_password("password")
        hash2, _ = hash_password("password", salt1)

        # Same password + same salt = same hash
        assert hash1 == hash2

    def test_hash_password_generates_salt(self):
        """Test that hash_password generates unique salts."""
        hash1, salt1 = hash_password("password")
        hash2, salt2 = hash_password("password")

        # Different salts = different hashes
        assert salt1 != salt2
        assert hash1 != hash2

    def test_hash_password_different_passwords(self):
        """Test different passwords produce different hashes."""
        hash1, salt = hash_password("password1")
        hash2, _ = hash_password("password2", salt)

        assert hash1 != hash2

    def test_hash_returns_tuple(self):
        """Test hash_password returns (hash, salt) tuple."""
        result = hash_password("test")

        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], str)  # hash
        assert isinstance(result[1], str)  # salt

    def test_hash_is_hex_string(self):
        """Test hash output is a hex string."""
        hashed, salt = hash_password("test")

        # Should be valid hex
        int(hashed, 16)
        int(salt, 16)


class TestUserDatabase:
    """Test user database behavior."""

    def test_user_stored_after_registration(self, reset_auth_db):
        """Test user is stored in database after registration."""
        register_user("stored_user", "password")

        assert "stored_user" in _users_db
        assert "password_hash" in _users_db["stored_user"]
        assert "salt" in _users_db["stored_user"]

    def test_multiple_users_can_register(self, reset_auth_db):
        """Test multiple users can be registered."""
        register_user("user1", "pass1")
        register_user("user2", "pass2")
        register_user("user3", "pass3")

        assert len(_users_db) == 3
        assert "user1" in _users_db
        assert "user2" in _users_db
        assert "user3" in _users_db

    def test_user_can_login_after_other_registrations(self, reset_auth_db):
        """Test user can still login after other users register."""
        register_user("first", "firstpass")
        register_user("second", "secondpass")
        register_user("third", "thirdpass")

        # All should be able to login
        assert login("first", "firstpass") is True
        assert login("second", "secondpass") is True
        assert login("third", "thirdpass") is True

        # Wrong passwords should still fail
        assert login("first", "wrongpass") is False
