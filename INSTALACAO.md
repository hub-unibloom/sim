# Guia de Instalação e Deploy - Sim + Cheshire

Este guia descreve de forma prática como colocar o sistema no ar (deploy) e como tirá-lo do ar, utilizando Docker Compose.

## Pré-requisitos

*   **Docker** e **Docker Compose** instalados no servidor (VPS).
*   Acesso ao terminal do servidor via SSH.
*   As variáveis de ambiente configuradas corretamente (ver abaixo).

---

## 1. Configuração Inicial

Antes de subir o sistema, você precisa configurar as variáveis de ambiente.

1.  Na raiz do projeto, crie ou edite o arquivo `.env.prod`:
    ```bash
    cp .env.example .env.prod
    nano .env.prod
    ```

2.  **Variáveis Críticas** (Certifique-se de que estas estão apontando para seus serviços externos):
    *   `DATABASE_URL`: URL da sua instância Postgres.
    *   `QDRANT_URL` & `QDRANT_API_KEY`: URL e chave do seu Qdrant.
    *   `REDIS_URL`: URL da sua instância Redis/Dragonfly.
    *   `OPENAI_API_KEY` (ou `AI_BASE_URL`): Chaves para a IA.
    *   `BETTER_AUTH_SECRET`: Chave secreta para autenticação.

---

## 2. Colocar no Ar (Deploy) 🚀

Para iniciar o sistema em modo de produção (com rebuild automático caso haja mudanças no código):

```bash
# Executar na raiz do projeto
docker-compose -f docker-compose.prod.yml up --build -d
```

*   `-f docker-compose.prod.yml`: Seleciona o arquivo de configuração de produção.
*   `--build`: Força a reconstrução das imagens (garante que o código novo seja usado).
*   `-d`: Roda em segundo plano (detached mode).

### Verificando se está rodando
Para ver os logs e garantir que tudo subiu corretamente:

```bash
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 3. Tirar do Ar (Parar) 🛑

Para parar o sistema e remover os containers (liberando recursos):

```bash
docker-compose -f docker-compose.prod.yml down
```

Se quiser parar, mas **manter** os dados persistentes (volumes), use apenas o comando acima.
Se quiser apagar **tudo** (incluindo volumes locais, se houver):

```bash
docker-compose -f docker-compose.prod.yml down -v
```

---

## Resumo dos Comandos

| Ação | Comando |
| :--- | :--- |
| **Subir** | `docker-compose -f docker-compose.prod.yml up --build -d` |
| **Ver Logs** | `docker-compose -f docker-compose.prod.yml logs -f` |
| **Parar** | `docker-compose -f docker-compose.prod.yml down` |
| **Reiniciar** | `docker-compose -f docker-compose.prod.yml restart` |
