from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegistrationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr


class RegistrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    name: str
    email: EmailStr
    created_at: datetime