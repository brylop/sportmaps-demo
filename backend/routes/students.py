from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime
import uuid
import csv
import io
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/api/students", tags=["students"])

# MongoDB connection (will be injected)
db = None

def init_db(database):
    global db
    db = database

# Models
class StudentBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    date_of_birth: Optional[str] = None
    gender: Optional[str] = Field(None, pattern="^(male|female|other)$")
    grade: Optional[str] = None
    school_id: str = Field(..., description="ID of the school/academy")
    parent_name: Optional[str] = None
    parent_email: Optional[str] = None
    parent_phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    medical_notes: Optional[str] = None
    status: str = Field(default="active", pattern="^(active|inactive|suspended)$")
    enrollment_date: Optional[str] = None
    
    @validator('email', 'parent_email')
    def validate_email(cls, v):
        if v and '@' not in v:
            raise ValueError('Invalid email format')
        return v

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    grade: Optional[str] = None
    parent_name: Optional[str] = None
    parent_email: Optional[str] = None
    parent_phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    medical_notes: Optional[str] = None
    status: Optional[str] = None

class Student(StudentBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class BulkUploadResponse(BaseModel):
    success: int
    failed: int
    errors: List[dict]
    students: List[Student]

# Endpoints
@router.post("/", response_model=Student)
async def create_student(student: StudentCreate):
    """Create a new student"""
    try:
        student_dict = student.dict()
        student_obj = Student(**student_dict)
        
        await db.students.insert_one(student_obj.dict())
        return student_obj
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[Student])
async def get_students(
    school_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get list of students with filters"""
    try:
        query = {}
        
        if school_id:
            query['school_id'] = school_id
        if status:
            query['status'] = status
        if grade:
            query['grade'] = grade
        if search:
            query['$or'] = [
                {'full_name': {'$regex': search, '$options': 'i'}},
                {'email': {'$regex': search, '$options': 'i'}},
                {'parent_name': {'$regex': search, '$options': 'i'}}
            ]
        
        students = await db.students.find(query).skip(skip).limit(limit).to_list(limit)
        return [Student(**student) for student in students]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{student_id}", response_model=Student)
async def get_student(student_id: str):
    """Get a specific student by ID"""
    try:
        student = await db.students.find_one({"id": student_id})
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        return Student(**student)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{student_id}", response_model=Student)
async def update_student(student_id: str, student_update: StudentUpdate):
    """Update a student"""
    try:
        # Get existing student
        existing = await db.students.find_one({"id": student_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Student not found")
        
        # Update fields
        update_data = student_update.dict(exclude_unset=True)
        update_data['updated_at'] = datetime.utcnow()
        
        await db.students.update_one(
            {"id": student_id},
            {"$set": update_data}
        )
        
        # Return updated student
        updated = await db.students.find_one({"id": student_id})
        return Student(**updated)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{student_id}")
async def delete_student(student_id: str):
    """Delete a student"""
    try:
        result = await db.students.delete_one({"id": student_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Student not found")
        return {"message": "Student deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bulk", response_model=BulkUploadResponse)
async def bulk_upload_students(
    file: UploadFile = File(...),
    school_id: str = Query(..., description="School ID for all students")
):
    """
    Bulk upload students from CSV file
    Expected CSV format: full_name,email,phone,date_of_birth,gender,grade,parent_name,parent_email,parent_phone
    """
    try:
        # Validate file type
        if not file.filename.endswith(('.csv', '.CSV')):
            raise HTTPException(status_code=400, detail="Only CSV files are supported")
        
        # Read file content
        contents = await file.read()
        decoded = contents.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(decoded))
        
        success = 0
        failed = 0
        errors = []
        students = []
        
        for index, row in enumerate(csv_reader, start=2):  # Start at 2 (row 1 is header)
            try:
                # Create student from CSV row
                student_data = {
                    'full_name': row.get('full_name', '').strip(),
                    'email': row.get('email', '').strip() or None,
                    'phone': row.get('phone', '').strip() or None,
                    'date_of_birth': row.get('date_of_birth', '').strip() or None,
                    'gender': row.get('gender', '').strip().lower() or None,
                    'grade': row.get('grade', '').strip() or None,
                    'school_id': school_id,
                    'parent_name': row.get('parent_name', '').strip() or None,
                    'parent_email': row.get('parent_email', '').strip() or None,
                    'parent_phone': row.get('parent_phone', '').strip() or None,
                    'emergency_contact': row.get('emergency_contact', '').strip() or None,
                    'status': 'active',
                    'enrollment_date': datetime.utcnow().isoformat()
                }
                
                # Validate required fields
                if not student_data['full_name']:
                    errors.append({
                        'row': index,
                        'error': 'Missing required field: full_name'
                    })
                    failed += 1
                    continue
                
                # Create student object
                student_create = StudentCreate(**student_data)
                student_obj = Student(**student_create.dict())
                
                # Insert to database
                await db.students.insert_one(student_obj.dict())
                students.append(student_obj)
                success += 1
                
            except Exception as e:
                errors.append({
                    'row': index,
                    'error': str(e)
                })
                failed += 1
        
        return BulkUploadResponse(
            success=success,
            failed=failed,
            errors=errors,
            students=students
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@router.get("/stats/{school_id}")
async def get_student_stats(school_id: str):
    """Get student statistics for a school"""
    try:
        total = await db.students.count_documents({"school_id": school_id})
        active = await db.students.count_documents({"school_id": school_id, "status": "active"})
        inactive = await db.students.count_documents({"school_id": school_id, "status": "inactive"})
        
        # Count by grade
        pipeline = [
            {"$match": {"school_id": school_id}},
            {"$group": {"_id": "$grade", "count": {"$sum": 1}}}
        ]
        grades = await db.students.aggregate(pipeline).to_list(100)
        
        return {
            "total": total,
            "active": active,
            "inactive": inactive,
            "by_grade": {g['_id']: g['count'] for g in grades if g['_id']}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
