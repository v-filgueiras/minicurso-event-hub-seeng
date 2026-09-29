from datetime import datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator


class EventCreate(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    description: str | None = None
    location: str = Field(min_length=2, max_length=200)
    starts_at: AwareDatetime  # exige fuso horário (ex.: 2026-10-10T18:00:00-03:00)
    ends_at: AwareDatetime
    capacity: int = Field(gt=0)

    @model_validator(mode="after")
    def check_dates(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("A data de término deve ser depois da data de início.")

        return self


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=150)
    description: str | None = None
    location: str | None = Field(default=None, min_length=2, max_length=200)
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    capacity: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def check_fields(self):
        for field in ("title", "location", "starts_at", "ends_at", "capacity"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"O campo {field} não pode ser nulo.")

        return self


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    location: str
    starts_at: datetime
    ends_at: datetime
    capacity: int
    created_at: datetime
    registrations_count: int
    available_spots: int