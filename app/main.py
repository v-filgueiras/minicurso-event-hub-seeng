from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.models import Event, Registration  # noqa: F401  (registra os modelos)
from app.routes import event_routes, registration_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cria as tabelas quando a aplicação é iniciada (use Alembic em produção).
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Event Hub - API de Eventos",
    description="API simples para cadastrar eventos e gerenciar inscrições.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://127.0.0.1:5500',
        'http://localhost:5500',
        'http://127.0.0.1:5501',
        'http://localhost:5501',
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(event_routes.router)
app.include_router(registration_routes.router)