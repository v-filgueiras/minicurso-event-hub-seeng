from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_event_or_404
from app.models import Event, Registration
from app.schemas import RegistrationCreate, RegistrationOut
from app.utils import utcnow

router = APIRouter(tags=["Inscrições"])


@router.post(
    "/events/{event_id}/registrations",
    response_model=RegistrationOut,
    status_code=status.HTTP_201_CREATED,
)
def register(
    event_id: int,
    data: RegistrationCreate,
    db: Session = Depends(get_db),
):
    """Inscreve uma pessoa em um evento."""

    # Trava a linha do evento (SELECT ... FOR UPDATE) até o commit, para que
    # duas inscrições simultâneas não ocupem a mesma última vaga.
    # (SQLite ignora o FOR UPDATE; PostgreSQL/MySQL respeitam.)
    event = db.scalar(
        select(Event)
        .where(Event.id == event_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evento não encontrado.",
        )

    if event.ends_at < utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este evento já foi encerrado.",
        )

    # Conta depois de obter a trava, para enxergar inscrições recém-confirmadas.
    taken = db.scalar(
        select(func.count(Registration.id)).where(
            Registration.event_id == event.id
        )
    )

    if taken >= event.capacity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não há mais vagas disponíveis para este evento.",
        )

    registration = Registration(
        event_id=event.id,
        name=data.name.strip(),
        email=str(data.email).lower(),
    )

    db.add(registration)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este e-mail já está inscrito neste evento.",
        )

    db.refresh(registration)

    return registration


@router.get(
    "/events/{event_id}/registrations",
    response_model=list[RegistrationOut],
)
def list_registrations(
    event: Event = Depends(get_event_or_404),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Lista as inscrições de um evento."""

    query = (
        select(Registration)
        .where(Registration.event_id == event.id)
        .order_by(Registration.created_at, Registration.id)
        .offset(skip)
        .limit(limit)
    )

    return db.scalars(query).all()


@router.delete(
    "/registrations/{registration_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def cancel_registration(
    registration_id: int,
    db: Session = Depends(get_db),
):
    """Cancela uma inscrição."""

    registration = db.get(Registration, registration_id)

    if registration is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inscrição não encontrada.",
        )

    db.delete(registration)
    db.commit()