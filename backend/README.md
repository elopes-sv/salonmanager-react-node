# Backend API (Local)

API local para agendamentos com persistência em SQLite.
O banco inicia vazio (sem dados seed automáticos).

## Requisitos

- Node.js 18+

## Instalação

```bash
cd backend
npm install
```

## Executar em desenvolvimento

```bash
npm run dev
```

Servidor padrão: `http://localhost:4000`

Banco local padrão: `backend/data/app.db`

Endpoints básicos de verificação:

- `GET /`
- `GET /health`

## Criar administrador com segurança

Com o banco vazio (ou usando `--force`), crie o admin via CLI:

```bash
npm run admin:create
```

Opcional (gerar senha temporária automaticamente):

```bash
npm run admin:create -- --auto-password
```

Criar outro administrador quando já existe um ativo:

```bash
npm run admin:create -- --force
```

Criar outro admin já informando nome/e-mail:

```bash
npm run admin:create -- --force --name "Administrador 2" --email admin2@salon.com
```

Fluxo:

- solicita nome, e-mail e senha por prompt local (senha não é exibida em log);
- aplica hash de senha no backend;
- define `role=admin`;
- marca troca obrigatória de senha no primeiro login.

## Redefinir senha de administrador via CLI

Sem depender da interface web, você pode redefinir a senha de um admin por e-mail:

```bash
npm run admin:reset-password -- --email admin@salon.com
```

Para gerar senha temporária automaticamente:

```bash
npm run admin:reset-password -- --email admin@salon.com --auto-password
```

Também é possível informar senha manual por argumento:

```bash
npm run admin:reset-password -- --email admin@salon.com --password "NovaSenhaForte"
```

Comportamento:

- valida se o e-mail existe e pertence a um usuário `admin`;
- revoga sessões ativas do usuário;
- força troca de senha no próximo login (`mustChangePassword=true`).

## Variáveis importantes

- `AUTH_TOKEN_SECRET`: obrigatório em produção (use valor longo e aleatório).
- `HOST`: em local, mantenha `127.0.0.1` para não expor a API na rede. Em Docker, use `0.0.0.0`.
- `AUTH_COOKIE_SECURE`: usar `true` em HTTPS.
- `CORS_ORIGIN`: origem(s) permitidas separadas por vírgula.
- `AUTH_MAX_TRACKED_LOGIN_KEYS`: limite de chaves em memória para proteção de login (default: `5000`).

## Endpoints

- `GET /`
- `GET /health`
- `POST /auth/login`
- `GET /auth/me`
- `PUT /auth/me`
- `POST /auth/logout`
- `POST /auth/change-password`
- `GET /users` (admin)
- `POST /users` (admin)
- `PUT /users/:id` (admin)
- `DELETE /users/:id` (admin)
- `PATCH /users/:id/status` (admin)
- `POST /users/:id/reset-password` (admin)
- `GET /appointments`
- `POST /appointments`
- `PUT /appointments/:id`
- `DELETE /appointments/:id`
- `GET /services`
- `POST /services` (admin)
- `PUT /services/:id` (admin)
- `DELETE /services/:id` (admin)

## Autenticação

- `POST /auth/login` retorna `{ user }` e grava cookie `HttpOnly`.
  - aceita `rememberMe` opcional no body:
    - `true` (padrão): cookie persistente (`Max-Age`).
    - `false`: cookie de sessão (expira ao encerrar o navegador).
- `GET /auth/me` lê sessão do cookie (`credentials: include` no frontend).
- `PUT /auth/me` atualiza nome/e-mail do usuário autenticado.
- `POST /auth/logout` invalida a sessão ativa no servidor e limpa o cookie.
- Todas as rotas de `appointments`, `services` e `users` exigem sessão ativa.
- Rotas de `users` exigem papel `admin`.
- Criação/edição/exclusão de `services` exige papel `admin`.
- Os serviços são compartilhados globalmente entre os usuários.
- Cada usuário autenticado acessa apenas seus próprios agendamentos (`owner_id`).
- Proteção anti força-bruta no login:
  - `code: "TOO_MANY_ATTEMPTS"` após muitas tentativas inválidas.
  - inclui `retryAfterSeconds` no body e header HTTP `Retry-After`.
- Cadastro público foi removido: novos usuários são criados apenas por administradores.
- Usuário com `mustChangePassword=true` precisa trocar senha antes de acessar módulos do sistema.

## Regras de negócio

- Não permite agendamentos com horários sobrepostos.
  - Retorno HTTP `409` com `code: "TIME_CONFLICT"`.
- Não permite agendamento com `serviceId` inexistente.
  - Retorno HTTP `400` com `code: "SERVICE_NOT_FOUND"`.
- Não permite criar agendamento com serviço inativo.
  - Retorno HTTP `409` com `code: "SERVICE_INACTIVE"`.
- Não permite serviços com nome duplicado.
  - Retorno HTTP `409` com `code: "SERVICE_NAME_CONFLICT"`.
- Não permite inativar serviço com agendamentos futuros.
  - Retorno HTTP `409` com `code: "SERVICE_HAS_FUTURE_APPOINTMENTS"`.
- Não permite excluir serviço já usado em agendamentos.
  - Retorno HTTP `409` com `code: "SERVICE_IN_USE"`.
- Não permite criar usuário com e-mail já existente.
  - Retorno HTTP `409` com `code: "EMAIL_CONFLICT"`.
- Bloqueia acesso sem token válido nas rotas protegidas.
  - Retorno HTTP `401` com `code: "UNAUTHORIZED"`.
- Bloqueia acesso de não-admin no módulo de usuários.
  - Retorno HTTP `403` com `code: "FORBIDDEN"`.
- Não permite conta inativa autenticar.
  - Retorno HTTP `403` com `code: "ACCOUNT_INACTIVE"`.
- Não permite remover/inativar o último administrador ativo.
  - Retorno HTTP `409` com `code: "LAST_ADMIN_REQUIRED"`.
- Ao excluir usuário, seus agendamentos também são removidos.
- Não permite excluir o próprio usuário logado.
  - Retorno HTTP `409` com `code: "SELF_DELETION_NOT_ALLOWED"`.
- Redefinição de senha por admin revoga sessões ativas do usuário alvo.
- Redefinição de senha por admin força troca de senha no próximo login.
- Troca de senha (`/auth/change-password`) revoga sessões anteriores e renova a sessão atual.
- Isolamento de dados por usuário autenticado.
  - Um usuário não enxerga/edita dados de outro.

## Contrato de `appointment`

```json
{
  "id": "string",
  "client": "string",
  "serviceId": "string",
  "value": 150,
  "notes": "string",
  "startAt": "2026-03-01T12:00:00.000Z",
  "endAt": "2026-03-01T12:45:00.000Z"
}
```

## Contrato de `service`

```json
{
  "id": "string",
  "name": "string",
  "durationMinutes": 45,
  "price": 120,
  "description": "string",
  "isActive": true
}
```

## Contrato de `user`

```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "role": "admin | staff",
  "isActive": true,
  "mustChangePassword": false
}
```
