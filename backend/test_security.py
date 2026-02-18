import unittest
from unittest.mock import MagicMock, patch
import os
import sys

# Aseguramos que podemos importar server.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Mockeamos las variables de entorno ANTES de importar server
with patch.dict(os.environ, {
    "SUPABASE_URL": "https://fake.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "fake-key", # Match the env var name in server.py
    "WOMPI_INTEGRITY_SECRET": "test_secret_123",
    "WOMPI_EVENTS_KEY": "test_events_key"
}):
    # Importar después de setear variables de entorno para pasar el chequeo "Fail Fast"
    from server import create_wompi_signature, WompiSignatureRequest
    from fastapi import HTTPException

class TestPaymentSecurity(unittest.TestCase):

    @patch('server.httpx.AsyncClient')
    async def test_block_wompi_if_disabled(self, mock_client_cls):
        """Prueba que el backend rechaza (403) si allow_online es false"""
        print("\n🛡️  TEST: Intentando pagar en escuela SIN permisos...")
        
        # Setup del Mock para la llamada a Supabase
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [{'payment_settings': {'allow_online': False}}]
        
        # Configurar el comportamiento asíncrono
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client_cls.return_value = mock_client

        # Datos de la petición
        request_data = WompiSignatureRequest(
            reference="TX-123",
            amount_in_cents=500000,
            school_id="school-no-wompi-123"
        )

        # Verificamos que lance excepción HTTP 403
        try:
            await create_wompi_signature(request_data)
            self.fail("Debería haber lanzado HTTPException 403")
        except HTTPException as e:
            self.assertEqual(e.status_code, 403)
            print("✅ ÉXITO: El backend bloqueó la transacción no autorizada.")

    @patch('server.httpx.AsyncClient')
    async def test_allow_wompi_if_enabled(self, mock_client_cls):
        """Prueba que el backend firma (200) si allow_online es true"""
        print("\n💳 TEST: Intentando pagar en escuela CON permisos...")
        
        # Setup del Mock para allow_online = True
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [{'payment_settings': {'allow_online': True}}]
        
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client_cls.return_value = mock_client

        request_data = WompiSignatureRequest(
            reference="TX-999",
            amount_in_cents=10000,
            school_id="school-yes-wompi-abc"
        )

        # Ejecutamos
        response = await create_wompi_signature(request_data)
        
        # Verificamos
        self.assertIn("signature", response)
        print(f"✅ ÉXITO: Firma generada: {response['signature'][:10]}...")

# Adaptador para correr tests asíncronos con unittest estándar
def run_async_test(func):
    import asyncio
    def wrapper(*args, **kwargs):
        loop = asyncio.new_event_loop()
        return loop.run_until_complete(func(*args, **kwargs))
    return wrapper

# Parcheamos los métodos de test para que corran en loop
if __name__ == '__main__':
    # Modificación para soportar async en unittest viejos o simples
    suite = unittest.TestSuite()
    runner = unittest.TextTestRunner()
    
    # Instanciamos manualmente para envolver
    loader = unittest.TestLoader()
    test_methods = [m for m in dir(TestPaymentSecurity) if m.startswith('test_')]
    
    # Nota: unittest estándar no soporta async nativo fácilmente sin IsolatedAsyncioTestCase (Python 3.8+)
    # Si tienes Python 3.8+:
    try:
        from unittest import IsolatedAsyncioTestCase
        class AsyncTestPaymentSecurity(IsolatedAsyncioTestCase, TestPaymentSecurity):
            pass
        unittest.main()
    except ImportError:
        print("⚠️ Se requiere Python 3.8+ para correr estos tests asíncronos fácilmente.")
