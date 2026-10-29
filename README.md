# 🛰️ Fleet Tracker — Sistema de Rastreamento de Frotas para Múltiplos Veículos em Tempo Real

> Plataforma escalável e resiliente para ingestão e processamento de telemetria veicular em tempo real, construída com **NestJS**, **RabbitMQ (Consistent Hash)**, **PostgreSQL (Prisma)**, **Redis** e **MQTT (Mosquitto)** utilizando a arquitetura de **Comboio Sequencial (Sequential Convoy)**.

---

## 🔭 Visão Geral do Projeto

O **Fleet Tracker** é um sistema voltado para empresas de logística, telemetria e rastreamento de veículos. Ele recebe centenas de milhares de pacotes de dados emitidos por rastreadores GPS veiculares, suportando múltiplos protocolos de hardware (tais como **GT06**, **JT/T 808** e **JSON Genérico**), via **HTTP REST** ou **MQTT**.

### Principais Objetivos

- **Ingestão Rápida (Zero I/O no Ingestor):** A camada de API apenas decodifica os bytes/JSON de entrada, valida a existência do IMEI e despacha imediatamente para a fila, desacoplando o recebimento da persistência.
- **Garantia de Ordem Linear por Veículo:** Garantir que o odômetro e os estados de ignição sejam calculados em ordem estritamente cronológica, sem travar o processamento dos demais veículos.
- **Idempotência e Resiliência:** Prevenir duplicidades decorrentes de retransmissões de rede móvel (4G/GPRS) e isolar falhas via Quorum Queues e Dead Letter Exchange (DLX).
- **Cache Quente Geoespacial:** Alimentar em tempo real índices geoespaciais e estados no Redis para consultas instantâneas de mapa ao vivo.

---

## 🏛 Arquitetura e Design Patterns

O projeto segue os princípios de **Domain-Driven Design (DDD)** e **Clean Architecture (Hexagonal / Ports and Adapters)**:

```bash
[Dispositivos GPS / MQTT]
        │
        ▼ (HTTP POST / Tópico MQTT)
┌───────────────────────────────────────────────┐
│              Camada de API (NestJS)           │
│  - IngestionController / MqttConsumer         │
│  - ProtocolDecoderRegistry (Strategy Pattern) │
│  - IngestTelemetryUseCase                     │
└───────────────────────┬───────────────────────┘
                        │
                        ▼ (Routing Key = IMEI)
┌───────────────────────────────────────────────┐
│               Broker RabbitMQ                 │
│  [tracking.raw] (Topic Exchange)              │
│         │                                     │
│         ▼ (E2E Binding: '#')                  │
│  [tracking.hash] (Consistent Hash Exchange)   │
└───────────┬───────────────────────────────────┘
            │
            ├──► [Fila q.track.0]  ──► [Worker 0  (Prefetch: 1)]
            ├──► [Fila q.track.1]  ──► [Worker 1  (Prefetch: 1)]
            ├──► [ ... ]           ──► [ ... ]
            └──► [Fila q.track.15] ──► [Worker 15 (Prefetch: 1)]
                        │
                        ▼ (ProcessTelemetryUseCase)
┌───────────────────────────────────────────────┐
│            Armazenamento & Cache              │
│  ├── PostgreSQL (Posições, Estados, Eventos)  │
│  └── Redis 7    (Cache Quente + GEOADD)       │
└───────────────────────────────────────────────┘
                        │
                        └──► (Erro Irrecuperável) ──► [tracking.dlx (Quarentena)]
```

### Padrões Aplicados

- **Strategy Pattern (Decoders):** A interface `ProtocolDecoder` desacopla as particularidades de cada fabricante (`Gt06Decoder`, `Jt808Decoder`, `GenericJsonDecoder`). Adicionar um novo fabricante exige apenas criar uma nova classe e registrá-la no `ProtocolDecoderRegistry`.
- **Ports & Adapters:** O domínio e casos de uso não dependem diretamente de bibliotecas (Prisma, ioredis, amqplib). Eles interagem com portas abstratas (`MessageBroker`, `Cache`, `VehicleRepository`, `TelemetryRepository`).
- **Idempotent Receiver:** Cada evento possui um `eventId` único persistido na tabela `processed_events`, garantindo que processamentos duplicados sejam descartados silenciosamente sem efeitos colaterais.

---

## 🚚 Mensageria e Arquitetura Comboio Sequencial

### O Desafio da Concorrência em IoT Veicular

Em sistemas tradicionais de mensageria onde vários workers consomem uma mesma fila concorrente (Round-Robin com prefetch alto):

1. O Veículo A envia `Posição 1` (Ignição Ligada, Lat -23.55, Lng -46.63).
2. 5 segundos depois, envia `Posição 2` (Em Movimento, Lat -23.56, Lng -46.64).
3. O Worker 1 recebe a `Posição 1` e sofre uma lentidão momentânea no banco de dados.
4. O Worker 2 recebe a `Posição 2` e a processa primeiro.
5. **Resultado catastrófico:**
   - O cálculo do odômetro (distância de Haversine entre o estado anterior e a nova posição) fica corrompido ou negativo.
   - O evento `IGNITION_ON` pode ser disparado após o veículo já estar marcado como em trânsito.
   - O estado do veículo no banco passa a refletir dados do passado.

### A Solução: Consistent Hash + Particionamento com Prefetch 1

O padrão **Sequential Convoy (Comboio Sequencial)** soluciona isso sem perder a capacidade de escala horizontal:

1. **Roteamento com Exchange-to-Exchange (E2E) Binding:**
   - A API publica na exchange de tópicos `tracking.raw` usando o **`IMEI` como Routing Key**.
   - A exchange `tracking.raw` está vinculada diretamente à exchange `tracking.hash` via `channel.bindExchange('tracking.hash', 'tracking.raw', '#')`.
   - Isso preserva integralmente a routing key (`IMEI`) enquanto encaminha a mensagem para o hash ring.

2. **Exchange com Consistent Hash (`x-consistent-hash`):**
   - O plugin `rabbitmq_consistent_hash_exchange` aplica um algoritmo de hash uniforme sobre o IMEI.
   - **Garantia matemática:** Todas as mensagens do mesmo IMEI sempre cairão na **mesma fila particionada** (`q.track.0` até `q.track.15`).

3. **Workers Monotarefa dedicados por Partição:**
   - Cada worker é inicializado escutando **apenas uma partição** (`PARTITION=0`, `PARTITION=1`, etc.).
   - O canal do RabbitMQ é configurado com **`prefetch = 1`**.
   - O worker só recebe a próxima mensagem após enviar o `ack` da mensagem atual.
   - Logo, as telemetrias de um mesmo veículo formam um "comboio" ordenado em fila indiana.

4. **Escala Horizontal Sem Conflitos:**
   - Veículos diferentes caem em partições diferentes e são processados concorrentemente por workers diferentes.
   - O sistema escala aumentando o número de partições (`PARTITIONS=32`, `64`, etc.) e instâncias de workers.

5. **Tratamento de Exceções sem Bloquear o Comboio:**
   - Em caso de falha de validação irrecuperável, o worker executa `nack(raw, false, false)` sem re-enfileirar (`requeue = false`).
   - A mensagem falha é encaminhada para a Dead Letter Exchange (`tracking.dlx`), impedindo que uma mensagem corrompida trave indefinidamente o comboio daquele veículo.

### ❓ Por Que Usar Exchange-to-Exchange (E2E) Binding?

Em vez de publicar diretamente na exchange de hash, a arquitetura utiliza o fluxo `tracking.raw (topic) ──[E2E]──> tracking.hash (consistent-hash)`. Os motivos técnicos para essa decisão são:

1. **Desacoplamento Arquitetural da Camada de Ingestão:** A camada de API atua apenas como gateway de entrada. Ela sabe apenas que está postando telemetria bruta (`tracking.raw`) identificada por uma chave (`IMEI`). Ela não precisa saber detalhes internos de infraestrutura ou estratégias de particionamento (quantas partições existem ou como os workers estão distribuídos).
2. **Capacidade de Fanout / Tap / Auditoria (Sem Impacto no Core):** Por ser uma exchange do tipo `topic`, podemos conectar novos consumidores diretamente em `tracking.raw` sem alterar uma única linha de código da API ou dos workers. Exemplos:
   - Uma fila de auditoria/compliance ou data lake (`q.telemetry.datalake` com routing key `#`).
   - Um sistema de alertas emergenciais ou de antifurto que escuta apenas marcas específicas.
3. **Ponte de Protocolos do RabbitMQ:** O tipo de exchange `x-consistent-hash` não suporta casamento de padrões complexos de tópicos; ele exige roteamento estrito por hash para filas com peso. O Exchange-to-Exchange Binding une o melhor dos dois mundos: a flexibilidade de tópicos na borda e o particionamento consistente no núcleo.

---

## 🛠 Tecnologias Utilizadas

| Tecnologia            | Versão          | Função no Projeto                                                     |
| :-------------------- | :-------------- | :-------------------------------------------------------------------- |
| **Node.js**           | 20 LTS          | Ambiente de execução JavaScript/TypeScript                            |
| **NestJS**            | ^12.1.3         | Framework de arquitetura modular, injeção de dependências e lifecycle |
| **TypeScript**        | ^5.3.3          | Tipagem estática e segurança em tempo de compilação                   |
| **Prisma ORM**        | ^5.10.0         | Mapeamento relacional e migrações do banco de dados                   |
| **PostgreSQL**        | 16 (Alpine)     | Banco de dados relacional principal (persistência durável e ACID)     |
| **RabbitMQ**          | 3.13-management | Message broker com Quorum Queues e Consistent Hash Exchange           |
| **Eclipse Mosquitto** | 2               | Broker MQTT ultraleve para telemetria IoT                             |
| **Redis**             | 7 (Alpine)      | Cache em memória e índices geoespaciais (`GEOADD`)                    |
| **Docker & Compose**  | v2+             | Orquestração de containers da infraestrutura e dos workers            |
| **amqplib**           | ^0.10.3         | Cliente Node.js para protocolo AMQP 0-9-1                             |
| **ioredis**           | ^5.3.2          | Cliente Redis de alta performance para comandos padrão e geoespaciais |
| **mqtt**              | ^5.3.5          | Cliente MQTT para assinatura de tópicos de telemetria                 |

---

## 📂 Estrutura de Pastas

```text
fleet-tracker/
├── .env-example                   # Modelo de variáveis de ambiente
├── Dockerfile                     # Imagem Docker da aplicação Node.js
├── docker-compose.yml             # Orquestração (Postgres, Redis, RabbitMQ, Mosquitto, API, 16 Workers)
├── package.json                   # Dependências e scripts do projeto
├── tsconfig.json                  # Configurações do compilador TypeScript
│
├── mosquitto/
│   └── mosquitto.conf             # Configuração do broker Mosquitto (porta 1883, allow_anonymous)
│
├── rabbitmq/
│   └── enabled_plugins            # Plugins habilitados: consistent_hash, management, mqtt, prometheus
│
├── prisma/
│   ├── schema.prisma              # Definição dos modelos de dados (Vehicle, Position, Event, etc.)
│   └── migrations/                # Histórico de migrações SQL do banco
│
└── src/
    ├── app-api.module.ts          # Módulo raiz da API HTTP/MQTT Ingestion
    ├── app-worker.module.ts       # Módulo raiz do Worker de processamento
    ├── main-api.ts                # Ponto de entrada da API
    ├── main-worker.ts             # Ponto de entrada do Worker
    │
    ├── domain/                    # Núcleo de Domínio (DDD)
    │   ├── entities/              # Entidades puras (ex: Telemetry)
    │   ├── repositories/          # Interfaces de repositórios (VehicleRepository, TelemetryRepository)
    │   └── value-objects/         # Objetos de valor imutáveis (Position, TrackerBrand)
    │
    ├── application/               # Camada de Aplicação (Casos de Uso)
    │   ├── ports/                 # Portas abstratas (MessageBroker, Cache, ProtocolDecoder)
    │   └── use-cases/             # Casos de uso (IngestTelemetryUseCase, ProcessTelemetryUseCase)
    │
    └── infrastructure/            # Camada de Infraestrutura e Adaptadores
        ├── cache/                 # Implementação de Cache com Redis
        ├── database/              # Implementação de Repositórios com Prisma
        ├── http/                  # Controladores REST e Listener de Ingestão MQTT
        ├── messaging/             # RabbitMQ, Topologia das filas e ConvoyConsumerService
        └── protocols/             # Decodificadores de protocolo (Generic JSON, GT06, JT808)
```

---

## ⚙️ Pré-requisitos e Variáveis de Ambiente

### Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/) instalados.
- [Node.js](https://nodejs.org/) 20+ e npm (caso deseje rodar a aplicação localmente fora do container).
- [Insomnia](https://insomnia.rest/), Postman ou `curl` para testes HTTP.
- Cliente MQTT: ferramenta de terminal como `mosquitto_pub` ([Mosquitto Clients](https://mosquitto.org/download/)), MQTTX ou via Docker.

### Variáveis de Ambiente (`.env`)

Crie o arquivo `.env` a partir do modelo `.env-example`:

```bash
cp .env-example .env
```

```bash

NODE_ENV=development   #Ambiente de execução
APP_PORT=3000          #Porta onde a API HTTP escuta
PARTITIONS=16          #Quantidade total de partições/filas do RabbitMQ
PARTITION=0            #Partição do worker atual (usado apenas em workers) | (0 a 15)
RABBITMQ_URL=amqp://tracking:tracking@localhost:5672   #url de conexão com o RabbitMQ
REDIS_URL=redis://localhost:6379                       #url de conexão com o Redis
DATABASE_URL=postgresql://tracking:tracking@localhost:5432/tracking?schema=public   #url de conexão com o PostgreSQL
MQTT_URL=mqtt://localhost:1883                         #url de conexão com o Mosquitto
```

> **Nota:** Quando os serviços rodam dentro do Docker Compose, os hostnames referenciam os nomes dos containers (`rabbitmq`, `postgres`, `redis`, `mosquitto`).

---

## 🚀 Como Instalar e Iniciar

### Opção 1: Execução Total com Docker Compose (Recomendado)

Esta opção sobe todo o ecossistema: PostgreSQL, Redis, RabbitMQ, Mosquitto, a API e os 16 workers particionados.

1. **Suba todos os serviços:**

   ```bash
   docker compose up --build -d
   ```

2. **Acompanhe os logs da API:**

   ```bash
   docker compose logs -f api
   ```

3. **Acompanhe os logs de um worker específico (ex: worker-0):**

   ```bash
   docker compose logs -f worker-0
   ```

4. **Para desligar a stack:**
   ```bash
   docker compose down
   ```

---

### Opção 2: Execução Híbrida / Desenvolvimento Local

Ideal para depuração passo a passo no VS Code ou terminal local:

1. **Suba apenas os serviços de infraestrutura via Docker:**

   ```bash
   docker compose up -d postgres redis rabbitmq mosquitto
   ```

2. **Instale as dependências Node.js localmente:**

   ```bash
   npm install
   ```

3. **Gere os tipos do Prisma e aplique as migrações:**

   ```bash
   # Certifique-se de que a DATABASE_URL no seu .env aponta para localhost:5433 (porta mapeada do postgres)
   npm run prisma:generate
   npm run prisma:migrate:dev
   ```

4. **Inicie a API HTTP/MQTT em um terminal:**

   ```bash
   npm run start:api
   ```

5. **Inicie um Worker em outro terminal (definindo qual partição ele escuta):**
   - **No Linux/macOS:**
     ```bash
     PARTITION=0 npm run start:worker
     ```
   - **No Windows (PowerShell):**
     ```powershell
     $env:PARTITION="0"; npm run start:worker
     ```
   - **No Windows (CMD):**
     ```cmd
     set PARTITION=0 && npm run start:worker
     ```

---

## 🚘 Preparação Inicial: Cadastrando Veículos de Demonstração

> ⚠️ **IMPORTANTE:** Tanto o endpoint HTTP quanto o listener MQTT validam a existência do IMEI no banco de dados (`VehicleRepository.findIdByImei`). Se um pacote chegar com um IMEI não cadastrado, a requisição retornará `400 Bad Request` ou o MQTT descartará o pacote!

### Método 1: Script Automático de Seed (Recomendado) 🚀

O projeto conta com um script de seed idempotente (`prisma/seed.ts`) que popula automaticamente **4 veículos de demonstração** no PostgreSQL:

- **Se estiver rodando no Docker Compose:**

  ```bash
  docker compose exec api npm run seed
  ```

- **Se estiver rodando localmente:**
  ```bash
  npm run seed
  ```

_(Você pode executar `npm run seed` quantas vezes quiser; ele utiliza `upsert` e não gera duplicidades)._

---

### Método 2: Via Prisma Studio (Visual)

Caso prefira gerenciar visualmente:

```bash
npx prisma studio
```

Acesse `http://localhost:5555`, clique no modelo **Vehicle** para visualizar ou adicionar veículos.

---

### Método 3: Via Linha de Comando (SQL Direto)

Se preferir injetar manualmente via SQL:

```bash
docker exec -i $(docker compose ps -q postgres) psql -U tracking -d tracking -c "
INSERT INTO \"Vehicle\" (\"id\", \"imei\", \"plate\", \"brand\", \"model\", \"active\", \"updatedAt\")
VALUES ('d290f1ee-6c54-4b01-90e6-d701748f0851', '123456789012345', 'ABC1D23', 'Scania', 'R450', true, NOW())
ON CONFLICT (\"imei\") DO NOTHING;
"
```

---

## 🧪 Como Testar a Ingestão

Com o veículo cadastrado (IMEI `123456789012345`), você pode disparar telemetrias por HTTP ou MQTT.

### 1. Testes via HTTP / REST (Insomnia, Postman, cURL)

A API expõe o endpoint `POST /ingest/:protocol`. Suporta os protocolos: `generic-json`, `gt06` e `jt808`.

#### Teste A: Protocolo `generic-json`

- **Método:** `POST`
- **URL:** `http://localhost:3000/ingest/generic-json`
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "eventId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "imei": "123456789012345",
    "lat": -23.55052,
    "lng": -46.633308,
    "speed": 65.5,
    "heading": 180,
    "altitude": 760,
    "ignition": true,
    "capturedAt": "2026-10-26T14:30:00.000Z"
  }
  ```

**Comando cURL equivalente:**

```bash
curl -X POST http://localhost:3000/ingest/generic-json \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "imei": "123456789012345",
    "lat": -23.55052,
    "lng": -46.633308,
    "speed": 65.5,
    "heading": 180,
    "altitude": 760,
    "ignition": true,
    "capturedAt": "2026-10-26T14:30:00.000Z"
  }'
```

**Resposta esperada (HTTP 201 Created):**

```json
{
  "accepted": true,
  "eventId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
}
```

---

#### Teste B: Protocolo `gt06`

- **Método:** `POST`
- **URL:** `http://localhost:3000/ingest/gt06`
- **Body:**
  ```json
  {
    "imei": "123456789012345",
    "lat": -23.552,
    "lng": -46.635,
    "speed": 130.0,
    "course": 90,
    "altitude": 750,
    "acc": true,
    "gpsTime": "2026-10-26T14:32:00.000Z"
  }
  ```
  _(Observação: como a velocidade é 130 km/h, o worker disparará um evento `OVERSPEED`)_.

---

#### Teste C: Protocolo `jt808`

- **Método:** `POST`
- **URL:** `http://localhost:3000/ingest/jt808`
- **Body:**
  ```json
  {
    "terminalId": "123456789012345",
    "lat": -23550520,
    "lng": -46633308,
    "speed": 800,
    "direction": 270,
    "altitude": 750,
    "acc": false,
    "time": "2026-10-26T14:35:00.000Z"
  }
  ```

---

### 2. Testes via MQTT pelo Prompt de Comando

O serviço `MqttIngestionService` assina o tópico wildcard:

```text
trackers/<protocolo>/<imei>
```

#### Opção A: Usando o Cliente Oficial `mosquitto_pub`

Se você possui os utilitários do Mosquitto instalados no terminal (Windows, Linux ou Mac):

```bash
mosquitto_pub -h localhost -p 1883 \
  -t "trackers/generic-json/123456789012345" \
  -m '{"lat": -23.5510, "lng": -46.6340, "speed": 85.0, "heading": 120, "altitude": 765, "ignition": true, "capturedAt": "2026-10-26T14:40:00.000Z"}' \
  -q 1
```

#### Opção B: Usando Docker (Não precisa instalar nada na sua máquina!)

Você pode rodar o `mosquitto_pub` diretamente pelo container do Mosquitto que já está em execução no Docker:

**No Windows (PowerShell):**

```powershell
docker exec -i $(docker compose ps -q mosquitto) mosquitto_pub -t "trackers/generic-json/123456789012345" -m '{\"lat\": -23.5510, \"lng\": -46.6340, \"speed\": 92.0, \"heading\": 140, \"altitude\": 770, \"ignition\": true, \"capturedAt\": \"2026-10-26T14:45:00.000Z\"}' -q 1
```

**No Linux ou macOS (Bash):**

```bash
docker exec -i $(docker compose ps -q mosquitto) mosquitto_pub \
  -t "trackers/generic-json/123456789012345" \
  -m '{"lat": -23.5510, "lng": -46.6340, "speed": 92.0, "heading": 140, "altitude": 770, "ignition": true, "capturedAt": "2026-10-26T14:45:00.000Z"}' \
  -q 1
```

---

## 🔍 Validação dos Dados Processados

Após disparar os testes, você pode validar o fluxo de dados em todas as camadas da arquitetura:

### Consulta no Redis (Cache Quente e Geoespacial)

Acesse o cliente CLI do Redis:

```bash
docker exec -it $(docker compose ps -q redis) redis-cli
```

1. **Verificar o estado mais recente do veículo:**

   ```redis
   GET vehicle:d290f1ee-6c54-4b01-90e6-d701748f0851:state
   ```

   _Retorna o JSON com `lastLat`, `lastLng`, `lastSpeed`, `odometer` e `lastTimestamp`._

2. **Verificar a coordenada geográfica ao vivo:**

   ```redis
   GEOPOS vehicles:live d290f1ee-6c54-4b01-90e6-d701748f0851
   ```

3. **Buscar veículos em um raio de 50km de São Paulo:**
   ```redis
   GEORADIUS vehicles:live -46.6333 -23.5505 50 km WITHDIST WITHCOORD
   ```

### Consulta no PostgreSQL (Banco Relacional)

Acesse o PostgreSQL:

```bash
docker exec -it $(docker compose ps -q postgres) psql -U tracking -d tracking
```

1. **Ver o histórico de posições recebidas:**

   ```sql
   SELECT "eventId", "latitude", "longitude", "speed", "odometer", "ignition", "capturedAt"
   FROM positions
   ORDER BY "capturedAt" DESC
   LIMIT 5;
   ```

2. **Ver os eventos de telemetria disparados (ex: IGNITION_ON, OVERSPEED):**

   ```sql
   SELECT "type", "payload", "occurredAt"
   FROM events
   ORDER BY "occurredAt" DESC;
   ```

3. **Ver a barreira de idempotência:**
   ```sql
   SELECT * FROM processed_events LIMIT 5;
   ```

### Painel do RabbitMQ

Acesse a interface administrativa do RabbitMQ no navegador:

- **URL:** [http://localhost:15672](http://localhost:15672)
- **Usuário:** `tracking`
- **Senha:** `tracking`

Nela, você pode visualizar:

- As 16 filas `q.track.0` até `q.track.15`.
- A taxa de entrada e saída de mensagens (`Message rates`).
- O binding de consistência hash (`tracking.hash`).
- A fila de quarentena `tracking.dlx`.

---

## 💡 Sugestões e Melhores Práticas Adicionais

Aqui estão recomendações técnicas para expansão e manutenção do projeto:

1. **Monitoramento e Métricas com Prometheus / Grafana:**
   - O container do RabbitMQ já possui o plugin `rabbitmq_prometheus` ativo na porta 15692.
   - É recomendável expor um endpoint `/metrics` na API NestJS (usando `@willsoto/nestjs-prometheus`) para acompanhar a latência de ponta a ponta desde o recebimento do MQTT/HTTP até o commit no PostgreSQL.

2. **Gerenciamento da Dead Letter Queue (DLQ):**
   - Implementar um worker de quarentena com interface de auditoria para reprocessar ou emitir alarmes caso mensagens com erro persistente entrem na fila de quarentena (`tracking.dlx`).

3. **Streaming em Tempo Real para o Front-end (WebSockets / SSE):**
   - Conectar o Redis Pub/Sub ao evento de salvamento do `ProcessTelemetryUseCase` para enviar atualizações via WebSockets diretamente para uma interface de mapas (Leaflet / Mapbox / Google Maps).
