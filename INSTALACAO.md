# Guia de Instalação e Deploy - Sim + Cheshire (Embedded)

Este guia descreve como configurar o sistema de memória Cheshire, agora totalmente integrado (embedded) no Sim Studio.

---

## Arquitetura

O Cheshire agora roda como um módulo interno do Sim, conectando-se diretamente aos recursos:

1.  **PostgreSQL**: O mesmo banco da aplicação Sim (tabelas particionadas/separadas).
2.  **Qdrant**: Banco vetorial para embeddings.
3.  **Redis**: Cache rápido.

Não há mais necessidade de uma VPS separada rodando "Cascata". O Cheshire é local.

---

## Pré-requisitos

*   **Docker** e **Docker Compose** v2+ instalados.
*   Acesso SSH ao servidor.
*   **PostgreSQL, Redis e Qdrant** (seja via Docker Compose ou serviços gerenciados).

---

## 2. Configurar Variáveis de Ambiente

No arquivo `.env` do Sim:

```bash
# ... variáveis padrão do Sim ...

# === CHESHIRE MEMORY SYSTEM ===
# Usa a mesma conexão do Sim, ou uma string separada se preferir
CASCATA_POSTGRES_URL="${DATABASE_URL}" 

# Configuração do Qdrant (Pode ser local ou cloud)
CASCATA_QDRANT_URL="http://qdrant:6333" 
CASCATA_QDRANT_API_KEY="" 

# Redis
CASCATA_REDIS_URL="${REDIS_URL}" 
```

---

## 3. Deploy

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### Migrações

Certifique-se de aplicar as migrações SQL necessárias localizadas em `apps/sim/migrations/` para criar as tabelas `projects`, `memories`, etc.
