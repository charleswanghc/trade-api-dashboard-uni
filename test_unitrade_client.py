import os
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import unitrade_client


class UnitradeLoginTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(
            os.environ,
            {
                "UNITRADE_WS_URL": "https://example.invalid",
                "UNITRADE_ACCOUNT": "test-account",
                "UNITRADE_PASSWORD": "test-password",
                "UNITRADE_CERT_FILE": "/app/test.pfx",
                "UNITRADE_CERT_PASSWORD": "test-cert-password",
                "UNITRADE_ACTNO": "",
            },
        )
        self.env.start()
        unitrade_client._client = None
        unitrade_client._last_login_error = None
        unitrade_client._last_login_attempt_at = 0.0

    def tearDown(self):
        unitrade_client._client = None
        unitrade_client._last_login_error = None
        unitrade_client._last_login_attempt_at = 0.0
        self.env.stop()

    @patch.object(unitrade_client, "_setup_order_callbacks")
    @patch.object(unitrade_client, "Unitrade")
    def test_rejected_login_is_not_cached_as_connected(
        self, unitrade_cls, _callbacks
    ):
        api = MagicMock()
        api.login_status_flag = False
        api.login.return_value = SimpleNamespace(
            ok=False,
            error="帳號或密碼錯誤: test-password",
        )
        unitrade_cls.return_value = api

        with self.assertRaises(unitrade_client.UnitradeLoginError) as raised:
            unitrade_client.get_unitrade_client()

        self.assertIsNone(unitrade_client._client)
        self.assertNotIn("test-password", str(raised.exception))
        self.assertIn("[UNITRADE_PASSWORD]", str(raised.exception))
        api.logout.assert_called_once()

        with self.assertRaises(unitrade_client.UnitradeLoginError):
            unitrade_client.get_unitrade_client()
        self.assertEqual(unitrade_cls.call_count, 1)

    @patch.object(unitrade_client, "_setup_order_callbacks")
    @patch.object(unitrade_client, "Unitrade")
    def test_successful_login_is_cached(self, unitrade_cls, _callbacks):
        api = MagicMock()
        api.login_status_flag = True
        api.login.return_value = SimpleNamespace(ok=True, error="")
        api.get_accounts.return_value = []
        unitrade_cls.return_value = api

        first = unitrade_client.get_unitrade_client()
        second = unitrade_client.get_unitrade_client()

        self.assertIs(first, api)
        self.assertIs(second, api)
        self.assertEqual(api.login.call_count, 1)


if __name__ == "__main__":
    unittest.main()
