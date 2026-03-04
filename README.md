<<<<<<< HEAD
# SalonManager (Frontend + API Local)

## Rodar local sem Docker

1. API

```bash
npm run dev:api
```

2. Frontend

```bash
npm run dev
```

## Rodar com Docker Compose

Subir frontend e backend juntos:

```bash
docker compose up
```

Acessos:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`
- Health check: `http://localhost:4000/health`

Observação:

- Não existe mais auto-cadastro público.
- Quando o banco está vazio, a API cria um admin inicial (veja variáveis `BOOTSTRAP_ADMIN_*` em `backend/.env.example`).
- Caso o admin perca acesso, use `npm run admin:reset-password -- --email ...` na raiz do projeto.
- Apenas admin pode gerenciar usuários e cadastrar serviços.
- Serviços são compartilhados por todos; agendamentos são separados por usuário logado.
- Redefinição de senha é feita apenas por administrador (módulo de usuários / endpoint admin).
=======
# salonmanager-react-node
>>>>>>> origin/main
