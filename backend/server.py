"""
SportMaps Backend — Lightweight API (Supabase-first architecture)

This backend handles ONLY:
1. Wompi payment gateway webhooks (server-side signature verification)
2. Health check / status endpoint
3. Any future server-side-only operations

Student, class, and enrollment CRUD is handled directly by the frontend 
via Supabase client. See NAMING_DICTIONARY.md for table mappings.
"""

from fastapi import FastAPI, APIRouter, Request, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import sys
import logging
import hashlib
import uuid
import random
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create the main app
app = FastAPI(
    title="SportMaps API",
    description="Lightweight backend for payment webhooks and server-side operations",
    version="2.0.0",
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Health Check
# ============================================================================

@api_router.get("/")
async def root():
    return {
        "service": "sportmaps-api",
        "version": "2.0.0",
        "status": "healthy",
        "database": "supabase",
        "note": "CRUD operations use Supabase directly from the frontend",
    }

@api_router.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

# ============================================================================
# Wompi Payment Integration (server-side only — needs secrets)
# ============================================================================

WOMPI_INTEGRITY_SECRET = os.environ.get('WOMPI_INTEGRITY_SECRET')
WOMPI_EVENTS_KEY = os.environ.get('WOMPI_EVENTS_KEY')
WOMPI_PRIVATE_KEY = os.environ.get('WOMPI_PRIVATE_KEY')

# Critical Security Check: Fail fast if secrets are missing in production context
if not WOMPI_INTEGRITY_SECRET or not WOMPI_EVENTS_KEY:
    # Allow bypass ONLY if explicitly in a non-production test mode if needed, 
    # but for this audit we enforce strictness.
    logger.critical("WOMPI_INTEGRITY_SECRET or WOMPI_EVENTS_KEY is missing! Server cannot start securely.")
    # FAIL FAST: Stop deployment/container immediately to prevent insecure operation.
    sys.exit(1)

# Optional: Supabase service role key for server-side DB updates
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')


class WompiSignatureRequest(BaseModel):
    reference: str
    amount_in_cents: int
    currency: str = "COP"


@api_router.post("/payments/wompi/create-signature")
async def create_wompi_signature(req: WompiSignatureRequest):
    """
    Generate SHA-256 integrity signature for Wompi Widget Checkout.
    Concatenation order: reference + amountInCents + currency + INTEGRITY_SECRET
    """
    try:
        raw_signature = f"{req.reference}{req.amount_in_cents}{req.currency}{WOMPI_INTEGRITY_SECRET}"
        signature_hash = hashlib.sha256(raw_signature.encode()).hexdigest()
        logger.info(f"Wompi signature generated for ref={req.reference}, amount={req.amount_in_cents}")
        return {
            "signature": signature_hash,
            "reference": req.reference,
            "amount_in_cents": req.amount_in_cents,
            "currency": req.currency,
        }
    except Exception as e:
        logger.error(f"Error generating Wompi signature: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/payments/wompi/webhook")
async def wompi_webhook(request: Request):
    """
    Wompi webhook endpoint.
    Receives transaction events from Wompi and validates the checksum.
    On success, updates the payments table in Supabase via service role.
    """
    try:
        body = await request.json()
        event = body.get('event', '')
        data = body.get('data', {})
        signature_info = body.get('signature', {})

        logger.info(f"Wompi webhook received: event={event}")

        # 1. Validate checksum
        if signature_info and signature_info.get('checksum'):
            checksum = signature_info['checksum']
            properties = signature_info.get('properties', [])

            values = []
            for prop in properties:
                keys = prop.split('.')
                value = data
                for key in keys:
                    if isinstance(value, dict):
                        value = value.get(key, '')
                    else:
                        value = ''
                        break
                values.append(str(value))

            values.append(str(body.get('timestamp', '')))
            values.append(WOMPI_EVENTS_KEY)

            raw_checksum = ''.join(values)
            expected_checksum = hashlib.sha256(raw_checksum.encode()).hexdigest()

            if checksum != expected_checksum:
                logger.warning(f"Wompi webhook checksum mismatch!")
                raise HTTPException(status_code=401, detail="Invalid checksum")

            logger.info("Wompi webhook checksum validated successfully")

        # 2. Process the event
        if event == 'transaction.updated':
            transaction = data.get('transaction', {})
            tx_id = transaction.get('id', '')
            tx_status = transaction.get('status', '')
            tx_reference = transaction.get('reference', '')
            tx_amount = transaction.get('amount_in_cents', 0)
            tx_method = transaction.get('payment_method_type', 'UNKNOWN')

            logger.info(
                f"Wompi TX update: id={tx_id}, status={tx_status}, "
                f"ref={tx_reference}, amount={tx_amount}"
            )

            # Update Supabase payments table if service key is available
            if SUPABASE_URL and SUPABASE_SERVICE_KEY:
                try:
                    import httpx
                    async with httpx.AsyncClient() as client:
                        # Map Wompi status to our payment status
                        status_map = {
                            'APPROVED': 'paid',
                            'DECLINED': 'rejected',
                            'VOIDED': 'refunded',
                            'ERROR': 'failed',
                            'PENDING': 'pending',
                        }
                        payment_status = status_map.get(tx_status, 'pending')

                        response = await client.patch(
                            f"{SUPABASE_URL}/rest/v1/payments",
                            params={"receipt_number": f"eq.{tx_reference}"},
                            json={
                                "status": payment_status,
                                "payment_date": datetime.utcnow().isoformat(),
                                "updated_at": datetime.utcnow().isoformat(),
                            },
                            headers={
                                "apikey": SUPABASE_SERVICE_KEY,
                                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                                "Content-Type": "application/json",
                                "Prefer": "return=minimal",
                            },
                        )
                        logger.info(f"Supabase update response: {response.status_code}")
                except Exception as db_err:
                    logger.warning(f"Supabase update failed: {db_err}")

        return {"status": "ok", "event": event, "processed": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Wompi webhook error: {e}")
        return {"status": "error", "message": str(e)}


@api_router.get("/payments/wompi/transaction/{reference}")
async def get_wompi_transaction(reference: str):
    """
    Check a Wompi transaction status by reference.
    In production, this queries Supabase; for now returns basic info.
    """
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{SUPABASE_URL}/rest/v1/payments",
                    params={
                        "receipt_number": f"eq.{reference}",
                        "select": "id,status,amount,payment_date,receipt_number",
                    },
                    headers={
                        "apikey": SUPABASE_SERVICE_KEY,
                        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    if data:
                        return {"success": True, "transaction": data[0]}
        except Exception as e:
            logger.warning(f"Error checking transaction: {e}")

    return {"success": False, "message": "Transaction not found"}


@api_router.post("/payments/webhook")
async def payment_webhook(request: Request):
    """Legacy webhook endpoint. For Wompi, use /payments/wompi/webhook."""
    try:
        data = await request.json()
        logger.info(f"Legacy webhook received: {data}")
        return {"status": "ok", "message": "Webhook received"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Include routers
# ============================================================================
app.include_router(api_router)
