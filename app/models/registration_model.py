from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func, select
from sqlalchemy.orm import Mapped, column_property, mapped_column, relationship

from app.database import Base
from app.models.event_model import Event
from app.utils import utcnow


class Registration(Base):
    __tablename__ = "registrations"

    # Impede que o mesmo e-mail se inscreva duas vezes no mesmo evento
    __table_args__ = (
        UniqueConstraint("event_id", "email", name="uq_event_email"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"),
    )

    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )

    # Cada inscrição pertence a um único evento
    event: Mapped["Event"] = relationship(back_populates="registrations")


# Número de inscritos calculado pelo banco, junto com a query do evento.
Event.registrations_count = column_property(
    select(func.count(Registration.id))
    .where(Registration.event_id == Event.id)
    .correlate_except(Registration)
    .scalar_subquery(),
)