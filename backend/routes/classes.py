from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime, time
import uuid

router = APIRouter(prefix="/api/classes", tags=["classes"])

# MongoDB connection (will be injected)
db = None

def init_db(database):
    global db
    db = database

# Models
class Schedule(BaseModel):
    day: str = Field(..., pattern="^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$")
    start_time: str = Field(..., description="HH:MM format")
    end_time: str = Field(..., description="HH:MM format")
    
    @validator('start_time', 'end_time')
    def validate_time_format(cls, v):
        try:
            time.fromisoformat(v)
        except ValueError:
            raise ValueError('Time must be in HH:MM format')
        return v

class ClassBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    sport: str = Field(..., min_length=1, max_length=100)
    level: str = Field(..., pattern="^(beginner|intermediate|advanced)$")
    school_id: str
    coach_id: Optional[str] = None
    coach_name: Optional[str] = None
    capacity: int = Field(default=20, ge=1, le=100)
    schedule: List[Schedule] = Field(default_factory=list)
    location: Optional[str] = None
    price: Optional[float] = Field(None, ge=0)
    status: str = Field(default="active", pattern="^(active|inactive|full|cancelled)$")
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class ClassCreate(ClassBase):
    pass

class ClassUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    sport: Optional[str] = None
    level: Optional[str] = None
    coach_id: Optional[str] = None
    coach_name: Optional[str] = None
    capacity: Optional[int] = Field(None, ge=1, le=100)
    schedule: Optional[List[Schedule]] = None
    location: Optional[str] = None
    price: Optional[float] = Field(None, ge=0)
    status: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class Class(ClassBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    enrolled_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class EnrollmentRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    class_id: str
    student_id: str
    student_name: str
    enrollment_date: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="active", pattern="^(active|dropped|completed)$")

# Endpoints
@router.post("/", response_model=Class)
async def create_class(class_data: ClassCreate):
    """Create a new class/program"""
    try:
        class_dict = class_data.dict()
        class_obj = Class(**class_dict)
        
        await db.classes.insert_one(class_obj.dict())
        return class_obj
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[Class])
async def get_classes(
    school_id: Optional[str] = Query(None),
    sport: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    coach_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get list of classes with filters"""
    try:
        query = {}
        
        if school_id:
            query['school_id'] = school_id
        if sport:
            query['sport'] = sport
        if level:
            query['level'] = level
        if status:
            query['status'] = status
        if coach_id:
            query['coach_id'] = coach_id
        if search:
            query['$or'] = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'sport': {'$regex': search, '$options': 'i'}},
                {'coach_name': {'$regex': search, '$options': 'i'}}
            ]
        
        classes = await db.classes.find(query).skip(skip).limit(limit).to_list(limit)
        
        # Get enrollment count for each class
        for class_item in classes:
            count = await db.enrollments.count_documents({
                'class_id': class_item['id'],
                'status': 'active'
            })
            class_item['enrolled_count'] = count
        
        return [Class(**c) for c in classes]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{class_id}", response_model=Class)
async def get_class(class_id: str):
    """Get a specific class by ID"""
    try:
        class_item = await db.classes.find_one({"id": class_id})
        if not class_item:
            raise HTTPException(status_code=404, detail="Class not found")
        
        # Get enrollment count
        count = await db.enrollments.count_documents({
            'class_id': class_id,
            'status': 'active'
        })
        class_item['enrolled_count'] = count
        
        return Class(**class_item)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{class_id}", response_model=Class)
async def update_class(class_id: str, class_update: ClassUpdate):
    """Update a class"""
    try:
        existing = await db.classes.find_one({"id": class_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Class not found")
        
        update_data = class_update.dict(exclude_unset=True)
        update_data['updated_at'] = datetime.utcnow()
        
        await db.classes.update_one(
            {"id": class_id},
            {"$set": update_data}
        )
        
        updated = await db.classes.find_one({"id": class_id})
        
        # Get enrollment count
        count = await db.enrollments.count_documents({
            'class_id': class_id,
            'status': 'active'
        })
        updated['enrolled_count'] = count
        
        return Class(**updated)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{class_id}")
async def delete_class(class_id: str):
    """Delete a class"""
    try:
        result = await db.classes.delete_one({"id": class_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Class not found")
        return {"message": "Class deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Enrollment endpoints
@router.post("/{class_id}/enroll")
async def enroll_student(
    class_id: str,
    student_id: str = Query(...),
    student_name: str = Query(...)
):
    """Enroll a student in a class"""
    try:
        # Check if class exists
        class_item = await db.classes.find_one({"id": class_id})
        if not class_item:
            raise HTTPException(status_code=404, detail="Class not found")
        
        # Check if already enrolled
        existing = await db.enrollments.find_one({
            'class_id': class_id,
            'student_id': student_id,
            'status': 'active'
        })
        if existing:
            raise HTTPException(status_code=400, detail="Student already enrolled in this class")
        
        # Check capacity
        enrolled_count = await db.enrollments.count_documents({
            'class_id': class_id,
            'status': 'active'
        })
        if enrolled_count >= class_item.get('capacity', 20):
            raise HTTPException(status_code=400, detail="Class is full")
        
        # Create enrollment
        enrollment = EnrollmentRecord(
            class_id=class_id,
            student_id=student_id,
            student_name=student_name
        )
        
        await db.enrollments.insert_one(enrollment.dict())
        return enrollment
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{class_id}/enroll/{student_id}")
async def unenroll_student(class_id: str, student_id: str):
    """Remove a student from a class"""
    try:
        result = await db.enrollments.update_one(
            {
                'class_id': class_id,
                'student_id': student_id,
                'status': 'active'
            },
            {'$set': {'status': 'dropped'}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Enrollment not found")
        
        return {"message": "Student unenrolled successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{class_id}/students")
async def get_class_students(class_id: str):
    """Get all students enrolled in a class"""
    try:
        enrollments = await db.enrollments.find({
            'class_id': class_id,
            'status': 'active'
        }).to_list(500)
        
        # Get full student details
        student_ids = [e['student_id'] for e in enrollments]
        students = await db.students.find({
            'id': {'$in': student_ids}
        }).to_list(500)
        
        # Combine enrollment and student data
        result = []
        for enrollment in enrollments:
            student = next((s for s in students if s['id'] == enrollment['student_id']), None)
            if student:
                result.append({
                    'enrollment_id': enrollment['id'],
                    'enrollment_date': enrollment['enrollment_date'],
                    'student': student
                })
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats/{school_id}")
async def get_class_stats(school_id: str):
    """Get class statistics for a school"""
    try:
        total = await db.classes.count_documents({"school_id": school_id})
        active = await db.classes.count_documents({"school_id": school_id, "status": "active"})
        full = await db.classes.count_documents({"school_id": school_id, "status": "full"})
        
        # Count by sport
        pipeline = [
            {"$match": {"school_id": school_id}},
            {"$group": {"_id": "$sport", "count": {"$sum": 1}}}
        ]
        sports = await db.classes.aggregate(pipeline).to_list(100)
        
        # Total enrolled students across all classes
        total_enrolled = await db.enrollments.count_documents({
            "status": "active"
        })
        
        return {
            "total": total,
            "active": active,
            "full": full,
            "by_sport": {s['_id']: s['count'] for s in sports if s['_id']},
            "total_enrolled": total_enrolled
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
