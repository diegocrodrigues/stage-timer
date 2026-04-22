# Stage Timer — Roadmap de Evolução

POC (`timer.html`) → Produto com display separado do controle.

**Premissa de arquitetura:**
- Servidor Node.js = fonte de verdade do estado
- `display.html` = TV de palco (só renderiza, sem controles)
- `control.html` = celular/tablet do operador (todos os controles)
- Comunicação via WebSocket em rede local

---

## Padrões obrigatórios em todas as fases

### Design e código

| Princípio | Aplicação prática |
|---|---|
| **SRP** | Um arquivo = uma razão pra mudar. Domínio, infra, rota e bootstrap são módulos separados. |
| **OCP** | Novos comandos do timer entram no map `COMMAND_HANDLERS`, sem editar código existente. |
| **DIP** | `TimerService` recebe dependências injetadas — não importa implementações concretas diretamente. |
| **Clean Architecture** | Domínio não importa nada externo. Use cases não importam Express. Rotas não têm lógica de negócio. |
| **Clean Code** | Funções com ≤ 20 linhas, nomes que descrevem intenção, sem comentários óbvios. |
| **Imutabilidade** | Transições de estado retornam novo objeto (spread), nunca mutam o original. |
| **Sonar / segurança** | Sem `eval`, sem concatenação SQL, sem dados do cliente no log, sem `console.log` em produção. |

### Testes (obrigatórios a partir da Fase 3)

| Tipo | O que cobre | Ferramenta |
|---|---|---|
| **Unitário** | `domain/` — funções puras isoladas | Jest |
| **Unitário** | `usecases/` — lógica com dependências mockadas | Jest + mocks manuais |
| **Integração** | Endpoints REST end-to-end (servidor real em memória) | Jest + Supertest |
| **Integração** | WebSocket — connect, broadcast, reconexão | Jest + cliente `ws` |

Cobertura mínima: **80% de linhas** no servidor (`server/`).  
Rodar com: `npm test` (todos) · `npm run test:watch` (dev) · `npm run test:coverage`.

### Observabilidade (obrigatória a partir da Fase 3)

| Nível | Quando usar |
|---|---|
| `ERROR` | Exceções não tratadas, falha de persistência, erro de inicialização |
| `WARN` | Ação inválida recebida, cliente WS fechou inesperadamente |
| `INFO` | Startup, comando executado, cliente WS conectou/desconectou |
| `DEBUG` | Tick do timer, estado após cada transição (apenas em dev) |

- Logger: **`pino`** — JSON estruturado, sem `console.log` no código de produção.
- Endpoint: `GET /health` → `{ status, uptime, wsConnections, timer: { status, remainingSeconds } }`.
- Logs nunca contêm IP do cliente, conteúdo de mensagens do operador, nem dados sensíveis.

### Estrutura de camadas (não quebrar)

```
domain/      ← regras de negócio puras, sem I/O
usecases/    ← orquestração: domínio + infra
infra/       ← I/O concreto (fs, setInterval, WebSocket broadcast)
routes/      ← tradução HTTP/WS → use case
app.js       ← composição Express
index.js     ← bootstrap (porta, OS, wiring)
```

---

## Fase 0 — Estrutura do projeto ✅

**Objetivo:** repositório com esqueleto funcional, servidor HTTP servindo arquivos estáticos.

**Entregáveis:**
- [x] `package.json` com dependências (`express`, `ws`)
- [x] `server/index.js` — Express servindo `public/`
- [x] `public/display.html` — página em branco com título
- [x] `public/control.html` — página em branco com título
- [x] Servidor responde em `http://localhost:3000`
- [x] `/display` e `/control` acessíveis de outro dispositivo na mesma rede

**Validação:** abrir `localhost:3000/control` no PC e `192.168.X.X:3000/display` no celular — ambos carregam.

---

## Fase 1 — Timer no servidor ✅

**Objetivo:** estado do timer vive no servidor, não no browser.

**Entregáveis:**
- [x] Objeto de estado: `{ status, mode, totalSeconds, remainingSeconds }`
- [x] Endpoints REST: `GET /state`, `POST /command` (START, PAUSE, RESUME, RESET, SET_TIME)
- [x] `setInterval` de 1s no servidor decrementa `remainingSeconds`
- [x] Estado persiste em `data/state.json` (recupera após restart, sempre `status: stopped`)
- [x] Arquitetura em camadas: `domain/timerState.js` · `infra/fileStatePersistence.js` · `infra/intervalTick.js` · `usecases/timerService.js` · `routes/timerRouter.js` · `app.js` · `index.js`

**Qualidade desta fase:**
- `timerState.js` — funções puras, imutáveis, sem I/O
- `TimerService` — recebe `persistence` por injeção (DIP)
- `COMMAND_HANDLERS` map — adicionar novo comando sem editar `execute()` (OCP)
- Erros de domínio propagam via `throw`, capturados só na rota

**Validação:** `curl -X POST localhost:3000/command -d '{"action":"START"}'` → timer roda. `GET /state` mostra tempo decrementando.

---

## Fase 2 — Display sincronizado ✅

**Objetivo:** `display.html` mostra o timer em tempo real via WebSocket.

**Entregáveis:**
- [x] `infra/wsBroadcaster.js` — gerencia conexões WS, expõe `broadcast(state)`
- [x] `TimerService` recebe `onStateChange` callback injetado (DIP)
- [x] Broadcast a cada tick e após cada comando
- [x] `display.html` — DSEG7, MM:SS, sem controles, reconnect com backoff (2s→4s→…→30s)
- [x] Banner "reconectando..." quando WS cai

**Qualidade desta fase:**
- `wsBroadcaster.js` em `infra/` — WS não vaza para use case
- `display.html` trata falha de parse silenciosamente

**Validação:** iniciar timer via `curl`, ver `display.html` atualizar em tempo real.

---

## Fase 3 — Testes e Observabilidade

**Objetivo:** garantir qualidade das camadas já construídas e estabelecer base de testes para as próximas.

### 3a — Infraestrutura de testes

**Entregáveis:**
- [ ] `jest` + `supertest` instalados como `devDependencies`
- [ ] `jest.config.js` — cobertura em `server/`, excluindo `index.js` (bootstrap)
- [ ] `npm test`, `npm run test:watch`, `npm run test:coverage` configurados no `package.json`
- [ ] Diretório `tests/` espelhando `server/`: `tests/domain/`, `tests/usecases/`, `tests/integration/`

### 3b — Testes unitários do domínio

Arquivo: `tests/domain/timerState.test.js`

- [ ] `create()` retorna estado padrão correto
- [ ] `tick()` decrementa countdown; incrementa countup; não vai abaixo de 0; muda status para `stopped` ao zerar
- [ ] `start()` retorna estado `running`; lança erro se countdown sem tempo; é idempotente se já running
- [ ] `pause()` retorna `paused` só se estava `running`; é idempotente
- [ ] `resume()` retorna `running` só se estava `paused`
- [ ] `reset()` volta `remainingSeconds` para `totalSeconds` com status `stopped`
- [ ] `setTime()` lança para segundos negativos ou não-numérico; modo `countdown` se > 0; `countup` se = 0

### 3c — Testes unitários do use case

Arquivo: `tests/usecases/timerService.test.js`

- [ ] `execute('START')` chama `persistence.save` e `onStateChange`
- [ ] `execute('PAUSE')` para o tick (mock de `IntervalTick` verifica `stop()`)
- [ ] `execute('SET_TIME')` com segundos inválidos propaga o erro da camada de domínio
- [ ] `execute('BORK')` lança `unknown action`
- [ ] Na inicialização, carrega estado do `persistence.load`

### 3d — Testes de integração REST

Arquivo: `tests/integration/api.test.js`

- [ ] `GET /state` → 200 com shape `{ status, mode, totalSeconds, remainingSeconds }`
- [ ] `POST /command` SET_TIME + START → estado `running`
- [ ] `POST /command` com ação inválida → 400 `{ error }`
- [ ] `POST /command` START sem tempo definido → 400
- [ ] Ciclo completo: SET_TIME → START → PAUSE → RESUME → RESET → estado correto em cada passo

### 3e — Testes de integração WebSocket

Arquivo: `tests/integration/websocket.test.js`

- [ ] Cliente WS recebe estado atual imediatamente ao conectar
- [ ] Após `POST /command START`, cliente WS recebe broadcast com `status: running`
- [ ] Dois clientes WS conectados recebem o mesmo broadcast simultaneamente

### 3f — Observabilidade

**Entregáveis:**
- [ ] `pino` instalado; `infra/logger.js` exporta instância configurada (JSON em prod, pretty em dev via `LOG_LEVEL`)
- [ ] `index.js` loga startup (INFO): porta, IPs de rede
- [ ] `timerRouter.js` loga cada comando recebido (INFO): `{ action, params }`
- [ ] `wsBroadcaster.js` loga connect/disconnect (INFO): count de clientes ativos
- [ ] `fileStatePersistence.js` loga falha de leitura/escrita (WARN), não lança
- [ ] `GET /health` → `{ status: 'ok', uptime, wsConnections, timer: { status, remainingSeconds } }`
- [ ] Nenhum `console.log` fora de `index.js`

**Validação:**
- `npm test` passa com ≥ 80% cobertura
- `npm run test:coverage` gera relatório em `coverage/`
- `curl localhost:3000/health` retorna JSON válido
- Log em formato JSON ao rodar `NODE_ENV=production node server/index.js`

---

## Fase 4 — Painel de controle mínimo ✅

**Objetivo:** operador controla o timer pelo celular, sem `curl`.

**Entregáveis:**
- [x] `control.html` com botões: **Iniciar / Pausar / Resetar**
- [x] Botão **Definir tempo** — modal com presets (5/10/15/20/30min) + input manual
- [x] Painel reflete estado atual via WebSocket (botão muda Iniciar ↔ Pausar ↔ Retomar)
- [x] Indicador de conexão (verde pulsante = online, vermelho = offline)
- [x] Hold-to-reset (1s) com barra de progresso visual

**Qualidade desta fase:**
- `control.html` nunca mantém estado local — lê sempre do servidor via WS
- Funções separadas: `renderState()`, `sendCommand()`, `connect()`
- Comandos via REST POST; estado recebido via WebSocket (separação clara)
- Nenhum `onclick` inline — todos os listeners no script

**Testes desta fase:**
- Ciclo completo já coberto em `tests/integration/api.test.js` (SET_TIME → START → PAUSE → RESUME → RESET)

**Validação:** abrir `control.html` no celular e controlar `display.html` na TV. Desligar WiFi → indicador vermelho → reconectar → verde.

---

## Fase 5 — Alertas visuais no display ✅

**Objetivo:** display muda de cor conforme tempo restante.

**Entregáveis:**
- [x] `timerState.js` — função pura `alertLevel(state)`: `normal` / `warning` (≤30%) / `danger` (≤20%) / `zero`
- [x] `timerService.publicState()` enriquece o estado com `alertLevel` antes de broadcast e `getState()`
- [x] Persistência armazena estado mínimo (sem `alertLevel`); clientes recebem estado derivado
- [x] Display aplica classes CSS: branco → laranja pulsante → vermelho pulsante → vermelho escalando
- [x] Alerta `zero` persiste até RESET; modo progressivo sempre `normal`

**Qualidade desta fase:**
- `alertLevel` em `domain/` — regra de negócio, não detalhe visual
- CSS usa classes semânticas (`.warning`, `.danger`, `.zero`), não estilos inline via JS
- `alertLevel` sempre fresco: computado em `getState()` e `notifyAndSave()`, nunca cacheado

**Testes desta fase:**
- 8 casos unitários: todos os thresholds, countup, estado inicial, imutabilidade
- Integração: `GET /state` inclui `alertLevel`; valor `normal` no estado inicial

**Validação:** definir 1 minuto → progressão de cores em tempo real.

---

## Fase 6 — Mensagens emergenciais ✅

**Objetivo:** operador envia mensagem para tela inteira no display.

**Entregáveis:**
- [x] `timerState.js` — `setMessage(state, text)` e `clearMessage(state)` como transições puras
- [x] `timerRouter.js` — sanitização de HTML na fronteira HTTP (antes de chegar ao domínio)
- [x] `control.html`: botão **Mensagem** → modal com quick messages + textarea + Ctrl+Enter
- [x] Quick messages: ACABOU · +5 MIN · MAIS GRAVE · MAIS AGUDO · VOLUME ↑ · VOLUME ↓ · OK ✓
- [x] Banner de mensagem ativa no painel com preview e botão Limpar
- [x] Display: `emergencyMessage` não-nulo ocupa tela cheia com font-fit automático
- [x] Botão "Voltar ao timer" no display envia `CLEAR_MESSAGE`
- [x] Comandos `SET_MESSAGE` e `CLEAR_MESSAGE` no `COMMAND_HANDLERS`

**Qualidade desta fase:**
- Strip de HTML na rota (boundary) — domínio só valida lógica (não-vazio)
- Font-fit por busca binária — sem `setInterval`, sem `requestAnimationFrame` em loop

**Testes desta fase:**
- 6 unitários: `setMessage` (trim, vazio, whitespace, imutabilidade) + `clearMessage` (null, idempotente)
- 4 integração: SET_MESSAGE persiste; CLEAR_MESSAGE limpa; HTML stripped; vazio → 400

**Validação:** enviar "ACABOU" → tela cheia no display. Voltar → timer reaparece.

---

## Fase 7 — Controle de brilho e áudio remoto

**Objetivo:** operador ajusta brilho da TV e alertas sonoros sem tocar no display.

**Entregáveis:**
- [ ] `brightness` (0–100) e `audioEnabled` (bool) no estado
- [ ] Comandos `SET_BRIGHTNESS` e `TOGGLE_AUDIO` no `COMMAND_HANDLERS`
- [ ] `control.html`: slider de brilho + toggle áudio
- [ ] `display.html`: aplica `filter: brightness(x)` e toca beeps via Web Audio API

**Qualidade desta fase:**
- Lógica de beep encapsulada em objeto `audioAlerts` com `play(level)`
- `setBrightness` valida range no domínio (clamp 0–100)

**Testes desta fase:**
- Unitário: `setBrightness()` clampado corretamente nos limites e fora deles

**Validação:** ajustar brilho pelo celular → TV escurece em tempo real.

---

## Fase 8 — Robustez e experiência de produção

**Objetivo:** sistema sobrevive a falhas de rede e reinicializações.

**Entregáveis:**
- [ ] `control.html`: indicador mostra quantos displays estão conectados
- [ ] Fullscreen automático no display ao carregar (fallback: botão)
- [ ] QR code na raiz (`localhost:3000`) com URL do `/control`
- [ ] PIN de 4 dígitos no `/control` (variável de ambiente `CONTROL_PIN`)

**Qualidade desta fase:**
- PIN verificado no servidor, não no cliente
- QR code gerado server-side com `qrcode` — cliente recebe PNG
- `CONTROL_PIN` lido via `process.env`, nunca hardcoded

**Testes desta fase:**
- Integração: `/control` sem PIN correto → 401; com PIN → 200
- Integração: `/health` reflete `wsConnections` correto após connect/disconnect

**Validação:** matar e reiniciar servidor → display reconecta em < 15s, estado preservado.

---

## Fase 9 — Deploy no Raspberry Pi + Docker

**Objetivo:** sistema roda standalone, sem depender de outros equipamentos.

**Por que Docker:**
`Dockerfile` + `docker-compose.yml` substituem configuração manual de Node.js no Pi.
`docker compose up -d` resolve runtime, restart e isolamento sem instalar Node globalmente.

**Por que sem mensageria:**
Projeto tem 1 processo. WebSocket já é o canal de mensagens em tempo real.
Kafka/RabbitMQ resolveriam comunicação assíncrona entre múltiplos serviços — não é o caso aqui.

**Entregáveis:**
- [ ] `Dockerfile` — `node:lts-alpine`, usuário não-root, expõe porta 3000
- [ ] `docker-compose.yml` — `restart: unless-stopped`, volume nomeado para `/data`
- [ ] `.dockerignore` — exclui `node_modules`, `data/`, `.git`, `coverage/`
- [ ] `.env.example` — documenta `PORT`, `LOG_LEVEL`, `CONTROL_PIN`
- [ ] `scripts/autostart` — Chromium kiosk abre `/display` no login do Pi
- [ ] `docs/operacao.md` — ligar, conectar no hotspot, acessar `/control`

**Qualidade desta fase:**
- Container não roda como root (`USER node`)
- `CONTROL_PIN` e `LOG_LEVEL` via `.env`, nunca hardcoded
- `docker compose up` sobe e passa `npm test` dentro do container

**Validação (final):** `docker compose up -d` no Pi → TV abre display. Celular no hotspot → QR code → controla timer. 100% offline.

---

## Fase 10 — Documentação técnica

**Objetivo:** registrar todas as decisões de arquitetura e entregar documentação final de produto — README orientado ao operador/desenvolvedor e ADRs para rastreabilidade técnica.

### 10a — Architecture Decision Records (ADR)

Cada ADR segue o formato: **Contexto → Decisão → Alternativas avaliadas → Consequências**.

Arquivo: `docs/adr/`

- [ ] `ADR-001-runtime.md` — Node.js sobre Python/Go/Deno
- [ ] `ADR-002-realtime.md` — WebSocket sobre SSE, polling e MQTT
- [ ] `ADR-003-hosting.md` — Rede local (Raspberry Pi) sobre cloud/VPS
- [ ] `ADR-004-no-messaging.md` — Sem Kafka/RabbitMQ — WebSocket é suficiente
- [ ] `ADR-005-architecture.md` — Clean Architecture sobre MVC flat
- [ ] `ADR-006-frontend.md` — Vanilla JS sobre React/Vue para display e controle
- [ ] `ADR-007-docker.md` — Docker sobre systemd + Node.js global no Pi
- [ ] `ADR-008-persistence.md` — JSON file sobre SQLite/Redis para estado do timer
- [ ] `ADR-009-testing.md` — Jest + Supertest sobre Vitest/Mocha; fake timers para use case

### 10b — README.md

README orientado a dois públicos: **quem opera** (músico/técnico de som) e **quem desenvolve** (contribuidor).

Seções:

- [ ] **Problema** — o que o POC resolvia mal (controle e display na mesma tela)
- [ ] **Solução** — diagrama de arquitetura (Mermaid): Pi → WiFi → TV display + celular operador
- [ ] **Stack** — tabela: camada, tecnologia, justificativa em uma linha
- [ ] **Pré-requisitos** — Node.js 18+ / Docker + Docker Compose
- [ ] **Instalação rápida** — `git clone` → `npm install` → `npm start` → QR code
- [ ] **Deploy no Raspberry Pi** — `docker compose up -d`, configuração de kiosk
- [ ] **Variáveis de ambiente** — tabela: `PORT`, `LOG_LEVEL`, `CONTROL_PIN`
- [ ] **Troubleshooting** — tabela: sintoma → causa provável → solução
  - Display mostra "--:--" → WS não conectou → verificar mesma rede
  - Controle não responde → PIN errado → verificar CONTROL_PIN
  - Timer deriva após reinício → state.json corrompido → deletar e reiniciar
  - Sem áudio → audioEnabled = false → toggle no painel
- [ ] **Licença**

**Qualidade desta fase:**
- Diagrama Mermaid renderiza no GitHub sem plugin externo
- Todos os comandos do README foram testados do zero numa máquina limpa
- ADRs têm data e autor, não apenas decisão

**Validação:** alguém que nunca viu o projeto consegue rodar com apenas o README.

---

## Stack de referência

```
stage-timer/
├── server/
│   ├── index.js                    # bootstrap
│   ├── app.js                      # Express + rotas
│   ├── domain/
│   │   └── timerState.js           # regras puras
│   ├── usecases/
│   │   └── timerService.js         # orquestração
│   ├── infra/
│   │   ├── logger.js               # pino (Fase 3)
│   │   ├── fileStatePersistence.js # I/O disco
│   │   ├── intervalTick.js         # setInterval
│   │   └── wsBroadcaster.js        # WebSocket
│   └── routes/
│       └── timerRouter.js          # handlers HTTP
├── tests/
│   ├── domain/
│   │   └── timerState.test.js      # Fase 3
│   ├── usecases/
│   │   └── timerService.test.js    # Fase 3
│   └── integration/
│       ├── api.test.js             # Fase 3
│       └── websocket.test.js       # Fase 3
├── public/
│   ├── display.html
│   └── control.html
├── data/                           # runtime, gitignored
├── coverage/                       # runtime, gitignored
├── scripts/                        # Fase 9
├── docs/                           # Fase 9
├── .env.example
├── jest.config.js
├── package.json
└── ROADMAP.md
```

**Dependências de produção:**
- `express` — servidor HTTP
- `ws` — WebSocket
- `pino` — structured logging (Fase 3)
- `qrcode` — QR code da URL de controle (Fase 8)

**Dependências de desenvolvimento:**
- `jest` — test runner + coverage
- `supertest` — integração HTTP sem bind de porta
- `pino-pretty` — log legível em desenvolvimento

---

## Critérios de "pronto" por fase

Cada fase só está concluída quando:
1. Funciona em **dois dispositivos reais** na mesma rede
2. `npm test` passa com ≥ 80% cobertura (a partir da Fase 3)
3. Nenhum arquivo tem mais de uma responsabilidade (SRP)
4. Nenhuma camada interna importa camada externa (Clean Architecture)
5. Nenhum `console.log` no código — apenas o logger estruturado (a partir da Fase 3)
6. Código commitado com `feat(fase-N): ...`
