from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import hmac
import hashlib
import random

router = APIRouter(prefix="/api/payments", tags=["payments"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'sportmaps')]

# Models
class PaymentIntent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    program_id: str
    amount: int  # In COP
    payment_method: str  # 'pse', 'card', 'nequi'
    description: str
    status: str = 'pending'  # pending, approved, rejected, failed
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[dict] = None

class PaymentIntentCreate(BaseModel):
    student_id: str
    program_id: str
    amount: int
    payment_method: str
    description: str
    parent_name: str
    parent_email: str
    parent_phone: Optional[str] = None

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    payment_intent_id: str
    student_id: str
    school_id: str
    program_id: str
    amount: int
    payment_method: str
    status: str  # approved, rejected, pending, refunded
    reference: str
    authorization_code: Optional[str] = None
    transaction_date: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[dict] = None

class Subscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    program_id: str
    school_id: str
    amount: int
    payment_method: str
    status: str = 'active'  # active, paused, canceled
    next_charge_date: datetime
    last_charge_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    card_last4: Optional[str] = None
    bank_name: Optional[str] = None

class WebhookPayload(BaseModel):
    x_ref_payco: str
    x_transaction_id: str
    x_amount: str
    x_currency_code: str
    x_signature: str
    x_cod_response: int  # 1=success, 2=rejected, 3=pending, 4=failed
    x_response: str
    x_approval_code: Optional[str] = None
    x_extra1: Optional[str] = None  # student_id
    x_extra2: Optional[str] = None  # program_id

# Demo data generator
def generate_demo_transactions(student_id: str) -> List[Transaction]:
    """Generate realistic demo transactions"""
    programs = [
        {'id': 'prog_1', 'name': 'Fútbol Juvenil', 'amount': 220000},
        {'id': 'prog_2', 'name': 'Natación Infantil', 'amount': 180000}
    ]
    
    transactions = []
    for i in range(6):
        prog = random.choice(programs)
        status = 'approved' if i < 5 else 'pending'
        
        transactions.append(Transaction(
            id=f"txn_{i+1}",
            payment_intent_id=f"pi_{i+1}",
            student_id=student_id,
            school_id="school_elite",
            program_id=prog['id'],
            amount=prog['amount'],
            payment_method=random.choice(['pse', 'card', 'nequi']),
            status=status,
            reference=f"REF{random.randint(100000, 999999)}",
            authorization_code=f"AUTH{random.randint(1000, 9999)}" if status == 'approved' else None,
            transaction_date=datetime.utcnow() - timedelta(days=30*i)
        ))
    
    return transactions

# Routes
@router.post("/create-intent")
async def create_payment_intent(intent: PaymentIntentCreate):
    """
    Create a payment intent (first step in payment flow)
    In production: This would create a session with ePayco/PayU
    """
    try:
        # DEMO MODE: Simulate payment intent creation
        payment_intent = PaymentIntent(
            student_id=intent.student_id,
            program_id=intent.program_id,
            amount=intent.amount,
            payment_method=intent.payment_method,
            description=intent.description,
            metadata={
                'parent_name': intent.parent_name,
                'parent_email': intent.parent_email,
                'parent_phone': intent.parent_phone
            }
        )
        
        # Save to database
        await db.payment_intents.insert_one(payment_intent.dict())
        
        # DEMO: Return mock checkout URL
        # In production, this would be ePayco's checkout URL
        checkout_url = f"/payment-processing?intent_id={payment_intent.id}&method={intent.payment_method}"
        
        return {
            "success": True,
            "intent_id": payment_intent.id,
            "checkout_url": checkout_url,
            "amount": intent.amount,
            "payment_method": intent.payment_method
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process-demo-payment/{intent_id}")
async def process_demo_payment(intent_id: str, simulate_failure: bool = False):
    """
    DEMO ONLY: Simulate payment processing
    In production: This would be handled by payment gateway webhook
    """
    try:
        # Get payment intent
        intent = await db.payment_intents.find_one({"id": intent_id})
        if not intent:
            raise HTTPException(status_code=404, detail="Payment intent not found")
        
        # Simulate processing delay
        import asyncio
        await asyncio.sleep(1)
        
        # Determine status (95% success rate in demo)
        status = 'rejected' if simulate_failure else ('approved' if random.random() > 0.05 else 'rejected')
        
        # Create transaction
        transaction = Transaction(
            payment_intent_id=intent_id,
            student_id=intent['student_id'],
            school_id="school_elite",  # Demo school
            program_id=intent['program_id'],
            amount=intent['amount'],
            payment_method=intent['payment_method'],
            status=status,
            reference=f"REF{random.randint(100000, 999999)}",
            authorization_code=f"AUTH{random.randint(1000, 9999)}" if status == 'approved' else None,
            metadata=intent.get('metadata')
        )
        
        # Save transaction
        await db.transactions.insert_one(transaction.dict())
        
        # Update intent status
        await db.payment_intents.update_one(
            {"id": intent_id},
            {"$set": {"status": status}}
        )
        
        # If approved and it's a subscription, create/update subscription
        if status == 'approved':
            subscription = Subscription(
                student_id=intent['student_id'],
                program_id=intent['program_id'],
                school_id="school_elite",
                amount=intent['amount'],
                payment_method=intent['payment_method'],
                next_charge_date=datetime.utcnow() + timedelta(days=30),
                last_charge_date=datetime.utcnow(),
                card_last4="1234" if intent['payment_method'] == 'card' else None,
                bank_name="Bancolombia" if intent['payment_method'] == 'pse' else None
            )
            await db.subscriptions.insert_one(subscription.dict())
        
        return {
            "success": status == 'approved',
            "transaction_id": transaction.id,
            "status": status,
            "reference": transaction.reference,
            "authorization_code": transaction.authorization_code,
            "message": "Pago aprobado exitosamente" if status == 'approved' else "Pago rechazado"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/transactions/{student_id}")
async def get_student_transactions(student_id: str, limit: int = 20):
    """
    Get transaction history for a student
    """
    try:
        # Check if demo mode
        is_demo = student_id.startswith('demo_') or '@demo.sportmaps.com' in student_id
        
        if is_demo:
            # Return demo data
            transactions = generate_demo_transactions(student_id)
            return {
                "success": True,
                "transactions": [t.dict() for t in transactions],
                "total": len(transactions)
            }
        
        # Get real transactions from database
        transactions = await db.transactions.find(
            {"student_id": student_id}
        ).sort("transaction_date", -1).limit(limit).to_list(limit)
        
        return {
            "success": True,
            "transactions": transactions,
            "total": len(transactions)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/subscriptions/{student_id}")
async def get_student_subscriptions(student_id: str):
    """
    Get active subscriptions for a student
    """
    try:
        # Check if demo mode
        is_demo = student_id.startswith('demo_') or '@demo.sportmaps.com' in student_id
        
        if is_demo:
            # Return demo subscription
            demo_sub = Subscription(
                id="sub_demo_1",
                student_id=student_id,
                program_id="prog_1",
                school_id="school_elite",
                amount=220000,
                payment_method="card",
                status="active",
                next_charge_date=datetime.utcnow() + timedelta(days=15),
                last_charge_date=datetime.utcnow() - timedelta(days=15),
                card_last4="1234"
            )
            return {
                "success": True,
                "subscriptions": [demo_sub.dict()]
            }
        
        # Get real subscriptions
        subscriptions = await db.subscriptions.find(
            {"student_id": student_id, "status": "active"}
        ).to_list(100)
        
        return {
            "success": True,
            "subscriptions": subscriptions
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/school-transactions/{school_id}")
async def get_school_transactions(school_id: str, days: int = 30):
    """
    Get all transactions for a school
    """
    try:
        # Check if demo mode
        is_demo = school_id == 'school_elite' or school_id.startswith('demo_')
        
        if is_demo:
            # Generate demo data for school
            transactions = []
            students = ['Santiago García', 'Emma García', 'Sofía Ramírez', 'Mateo Torres']
            
            for i in range(12):
                transactions.append({
                    'id': f'txn_{i+1}',
                    'student_name': random.choice(students),
                    'program_name': random.choice(['Fútbol Juvenil', 'Natación Infantil']),
                    'amount': random.choice([220000, 180000]),
                    'payment_method': random.choice(['PSE', 'Tarjeta', 'Nequi']),
                    'status': 'approved' if i < 11 else 'pending',
                    'transaction_date': (datetime.utcnow() - timedelta(days=i*2)).isoformat()
                })
            
            return {
                "success": True,
                "transactions": transactions,
                "total_amount": sum(t['amount'] for t in transactions if t['status'] == 'approved'),
                "success_rate": 0.985
            }
        
        # Get real transactions
        since_date = datetime.utcnow() - timedelta(days=days)
        transactions = await db.transactions.find(
            {"school_id": school_id, "transaction_date": {"$gte": since_date}}
        ).sort("transaction_date", -1).to_list(1000)
        
        approved = [t for t in transactions if t['status'] == 'approved']
        total_amount = sum(t['amount'] for t in approved)
        success_rate = len(approved) / len(transactions) if transactions else 0
        
        return {
            "success": True,
            "transactions": transactions,
            "total_amount": total_amount,
            "success_rate": success_rate
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook")
async def payment_webhook(
    request: Request,
    x_signature: Optional[str] = Header(None)
):
    """
    Webhook endpoint to receive payment notifications from payment gateway
    In production: Verify signature and process payment
    """
    try:
        data = await request.json()
        
        # TODO: In production, verify signature
        # webhook_secret = os.environ.get('PAYMENT_WEBHOOK_SECRET')
        # expected_sig = hmac.new(
        #     webhook_secret.encode(),
        #     str(data).encode(),
        #     hashlib.sha256
        # ).hexdigest()
        # if x_signature != expected_sig:
        #     raise HTTPException(401, "Invalid signature")
        
        # Process webhook data
        # This is where you'd update transaction status, send notifications, etc.
        
        return {"status": "ok", "message": "Webhook received"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cancel-subscription/{subscription_id}")
async def cancel_subscription(subscription_id: str):
    """
    Cancel a recurring subscription
    """
    try:
        result = await db.subscriptions.update_one(
            {"id": subscription_id},
            {"$set": {"status": "canceled"}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Subscription not found")
        
        return {
            "success": True,
            "message": "Suscripción cancelada exitosamente"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
