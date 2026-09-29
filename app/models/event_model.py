from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils import utcnow


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)

    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str] = mapped_column(String(200))

    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    capacity: Mapped[int] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )

    # O banco cuida do ON DELETE CASCADE (passive_deletes evita carregar
    # todas as inscrições na memória só para apagá-las).
    registrations: Mapped[list["Registration"]] = relationship(
        back_populates="event",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # `registrations_count` é definido em models/registration.py como uma
    # subquery COUNT (evita carregar todas as inscrições e o problema N+1).

    @property
    def available_spots(self) -> int:
        return max(self.capacity - self.registrations_count, 0)