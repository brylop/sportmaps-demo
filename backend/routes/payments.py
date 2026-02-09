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
try:
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=2000)
    db = client[os.environ.get('DB_NAME', 'sportmaps')]
except:
    client = None
    db = None

# In-memory mock DB for demo mode/fallback
mock_db = {
    "payment_intents": [],
    "transactions": [],
    "subscriptions": []
}

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
    """Generate realistic demo transactions for Spirit All Stars"""
    programs = [
        {'id': 'prog_1', 'name': 'Butterfly (Junior Prep)', 'amount': 240000},
        {'id': 'prog_2', 'name': 'Firesquad (Senior L3)', 'amount': 280000},
        {'id': 'prog_3', 'name': 'Bombsquad (Coed L5)', 'amount': 350000}
    ]
    
    concepts = [
        "Mensualidad Entrenamiento",
        "Cuota de Uniforme (Metallic Blue Edition)",
        "Inscripción Campeonato Nacional",
        "Seguro Atleta Alto Rendimiento"
    ]
    
    transactions = []
    for i in range(6):
        prog = random.choice(programs)
        concept = random.choice(concepts)
        status = 'approved' if i < 5 else 'pending'
        
        transactions.append(Transaction(
            id=f"txn_{i+1}",
            payment_intent_id=f"pi_{i+1}",
            student_id=student_id,
            school_id="spirit_all_stars",
            program_id=prog['id'],
            amount=prog['amount'] if "Mensualidad" in concept else random.randint(150000, 600000),
            payment_method=random.choice(['pse', 'card', 'nequi']),
            status=status,
            reference=f"REF{random.randint(100000, 999999)}",
            authorization_code=f"AUTH{random.randint(1000, 9999)}" if status == 'approved' else None,
            transaction_date=datetime.utcnow() - timedelta(days=30*i),
            metadata={'concept': concept}
        ))
    
    return transactions

# Helper to simulate DB operations
async def db_insert(collection, document):
    if db:
        try:
            await db[collection].insert_one(document)
            return
        except:
            pass
    mock_db[collection].append(document)

async def db_find_one(collection, query):
    if db:
        try:
            return await db[collection].find_one(query)
        except:
            pass
    # Simple mock implementation for ID lookup
    if 'id' in query:
        return next((item for item in mock_db[collection] if item['id'] == query['id']), None)
    return None

async def db_update_one(collection, query, update):
    if db:
        try:
            return await db[collection].update_one(query, update)
        except:
            pass
    # Simple mock implementation
    if 'id' in query:
        item = next((item for item in mock_db[collection] if item['id'] == query['id']), None)
        if item and '$set' in update:
            item.update(update['$set'])
    return None

@router.post("/create-intent")
async def create_payment_intent(intent: PaymentIntentCreate):
    try:
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
        
        await db_insert("payment_intents", payment_intent.dict())
        
        checkout_url = f"/payment-processing?intent_id={payment_intent.id}&method={intent.payment_method}"
        
        return {
            "success": True,
            "intent_id": payment_intent.id,
            "checkout_url": checkout_url,
            "amount": intent.amount,
            "payment_method": intent.payment_method
        }
    except Exception as e:
        print(f"Error creating intent: {e}")
        # Always return success in demo if something fails
        return {"success":True, "intent_id": "demo_intent", "checkout_url": "/dashboard", "amount": intent.amount}

@router.post("/process-demo-payment/{intent_id}")
async def process_demo_payment(intent_id: str, simulate_failure: bool = False):
    try:
        intent = await db_find_one("payment_intents", {"id": intent_id})
        # If not found in demo, create a mock one
        if not intent:
            intent = {"student_id": "demo_student", "program_id": "demo_prog", "amount": 250000, "payment_method": "card", "metadata": {}}
        
        import asyncio
        await asyncio.sleep(1)
        
        status = 'rejected' if simulate_failure else ('approved' if random.random() > 0.05 else 'rejected')
        
        transaction = Transaction(
            payment_intent_id=intent_id,
            student_id=intent.get('student_id', 'unknown'),
            school_id="school_elite",
            program_id=intent.get('program_id', 'unknown'),
            amount=intent.get('amount', 0),
            payment_method=intent.get('payment_method', 'card'),
            status=status,
            reference=f"REF{random.randint(100000, 999999)}",
            authorization_code=f"AUTH{random.randint(1000, 9999)}" if status == 'approved' else None,
            metadata=intent.get('metadata')
        )
        
        await db_insert("transactions", transaction.dict())
        await db_update_one("payment_intents", {"id": intent_id}, {"$set": {"status": status}})
        
        if status == 'approved':
            subscription = Subscription(
                student_id=intent.get('student_id', 'unknown'),
                program_id=intent.get('program_id', 'unknown'),
                school_id="school_elite",
                amount=intent.get('amount', 0),
                payment_method=intent.get('payment_method', 'card'),
                next_charge_date=datetime.utcnow() + timedelta(days=30),
                last_charge_date=datetime.utcnow(),
                card_last4="1234"
            )
            await db_insert("subscriptions", subscription.dict())
        
        return {
            "success": status == 'approved',
            "transaction_id": transaction.id,
            "status": status,
            "reference": transaction.reference,
            "authorization_code": transaction.authorization_code,
            "message": "Pago aprobado exitosamente" if status == 'approved' else "Pago rechazado"
        }
    except Exception as e:
        print(f"Error processing payment: {e}")
        return {"success": True, "status": "approved", "message": "Demo payment approved"}

@router.post("/register-manual")
async def register_manual_payment(payment_data: dict):
    try:
        manual_id = str(uuid.uuid4())
        intent = {
            "id": manual_id,
            "student_id": payment_data.get("student_id"),
            "program_id": payment_data.get("program_id"),
            "amount": payment_data.get("amount"),
            "payment_method": "transfer",
            "proof_url": payment_data.get("proof_url"),
            "status": "awaiting_approval",
            "created_at": datetime.utcnow(),
            "metadata": {
                "team_id": payment_data.get("team_id"),
                "category_id": payment_data.get("category_id"),
                "concept": payment_data.get("concept")
            }
        }
        
        await db_insert("payment_intents", intent)
        
        return {
            "success": True,
            "intent_id": manual_id,
            "status": "awaiting_approval",
            "message": "Tu comprobante ha sido registrado. La administración lo validará pronto."
        }
    except Exception as e:
        return {"success": True, "message": "Demo manual payment registered"}

@router.get("/school/report/{school_id}")
async def get_school_payments_report(school_id: str):
    try:
        # Use mock mock_db combined with mongo if available, or just mock_db
        # For robustness, just generating random data for report is safer for demo
        # But we try to read from mock_db for 'pending payments'
        
        pending_intents = [i for i in mock_db["payment_intents"] if i.get("status") == "awaiting_approval"]
        
        report = {
            "total_collected": 35000000, # Mock total
            "total_pending": sum(i["amount"] for i in pending_intents) if pending_intents else 0,
            "by_teams": {}
        }
        
        categories = ["Butterfly", "Firesquad", "Bombsquad", "Legends"]
        for cat in categories:
            report["by_teams"][cat] = {
                "paid": random.randint(8, 25),
                "pending": random.randint(1, 5),
                "overdue": random.randint(0, 3),
                "students": []
            }
            
        return {"success": True, "report": report}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/admin/review/{intent_id}")
async def review_payment(intent_id: str, action: str):
    try:
        status = "approved" if action == "approve" else "rejected"
        await db_update_one("payment_intents", {"id": intent_id}, {"$set": {"status": status}})
        return {"success": True, "new_status": status}
    except Exception as e:
        return {"success": True, "new_status": "approved"} 

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
            students = ['Santiago García', 'Emma García', 'Sofía Ramírez', 'Mateo Torres', 'Valentina Gómez']
            programs = ['Butterfly', 'Firesquad', 'Bombsquad', 'Legends']
            concepts = ['Mensualidad', 'Uniforme Metallic Blue', 'Inscripción Nacional']
            
            for i in range(15):
                transactions.append({
                    'id': f'txn_{i+1}',
                    'student_name': random.choice(students),
                    'program_name': random.choice(programs),
                    'amount': random.randint(240000, 600000),
                    'payment_method': random.choice(['PSE', 'Tarjeta', 'Nequi']),
                    'status': 'approved' if i < 14 else 'pending',
                    'transaction_date': (datetime.utcnow() - timedelta(days=i*2)).isoformat(),
                    'concept': random.choice(concepts)
                })
            
            return {
                "success": True,
                "transactions": transactions,
                "total_amount": sum(t['amount'] for t in transactions if t['status'] == 'approved'),
                "success_rate": 0.99
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
