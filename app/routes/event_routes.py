from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_event_or_404
from app.models import Event
from app.schemas import EventCreate, EventOut, EventUpdate
from app.utils import utcnow

router = APIRouter(prefix="/events", tags=["Eventos"])


@router.post(
    "",
    response_model=EventOut,
    status_code=status.HTTP_201_CREATED,
)
def create_event(
    data: EventCreate,
    db: Session = Depends(get_db),
):
    """Cadastra um evento."""

    event = Event(**data.model_dump())

    db.add(event)
    db.commit()
    db.refresh(event)

    return event


@router.get("", response_model=list[EventOut])
def list_events(
    upcoming_only: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Lista os eventos cadastrados."""

    query = select(Event).order_by(Event.starts_at, Event.id)

    if upcoming_only:
        query = query.where(Event.starts_at >= utcnow())

    query = query.offset(skip).limit(limit)

    return db.scalars(query).all()


@router.get("/{event_id}", response_model=EventOut)
def get_event(event: Event = Depends(get_event_or_404)):
    """Mostra os detalhes de um evento."""

    return event


@router.patch("/{event_id}", response_model=EventOut)
def update_event(
    data: EventUpdate,
    event: Event = Depends(get_event_or_404),
    db: Session = Depends(get_db),
):
    """Atualiza apenas os campos enviados."""

    changes = data.model_dump(exclude_unset=True)

    starts_at = changes.get("starts_at", event.starts_at)
    ends_at = changes.get("ends_at", event.ends_at)

    if ends_at <= starts_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A data de término deve ser depois da data de início.",
        )

    new_capacity = changes.get("capacity")

    if new_capacity is not None and new_capacity < event.registrations_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A capacidade não pode ser menor que o número de inscritos.",
        )

    for field, value in changes.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)

    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event: Event = Depends(get_event_or_404),
    db: Session = Depends(get_db),
):
    """Exclui um evento."""

    db.delete(event)
    db.commit()