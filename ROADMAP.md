# Stage Timer — Roadmap de Evolução

POC (`timer.html`) → Produto com display separado do controle.

**Premissa de arquitetura:**
- Servidor Node.js = fonte de verdade do estado
- `display.html` = TV de palco (só renderiza, sem controles)
- `control.html` = celular/tablet do operador (todos os controles)
- Comunicação via WebSocket em rede local

---

## Padrões obrigatórios em todas as fases

Cada entrega deve respeitar:

| Princípio | Aplicação prática |
|---|---|
| **SRP** | Um arquivo = uma razão pra mudar. Domínio, infra, rota e bootstrap são módulos separados. |
| **OCP** | Novos comandos do timer entram no map `COMMAND_HANDLERS`, sem editar código existente. |
| **DIP** | `TimerService` recebe `persistence` injetado — não importa `fileStatePersistence` diretamente. |
| **Clean Architecture** | Domínio não importa nada externo. Use cases não importam Express. Rotas não têm lógica de negócio. |
| **Clean Code** | Funções com ≤ 20 linhas, nomes que descrevem intenção, sem comentários óbvios. |
| **Imutabilidade** | Transições de estado retornam novo objeto (spread), nunca mutam o original. |
| **Sonar / segurança** | Sem `eval`, sem concatenação SQL, sem dados do cliente no log, sem `console.log` em produção. |

**Estrutura de camadas (não quebrar):**
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
- [x] Objeto de estado global no servidor: `{ status, mode, totalSeconds, remainingSeconds }`
- [x] Endpoints REST: `GET /state`, `POST /command` (START, PAUSE, RESUME, RESET, SET_TIME)
- [x] `setInterval` de 1s no servidor decrementa `remainingSeconds`
- [x] Estado persiste em `data/state.json` (recupera após restart, sempre `status: stopped`)
- [x] Arquitetura em camadas: `domain/timerState.js` · `infra/fileStatePersistence.js` · `infra/intervalTick.js` · `usecases/timerService.js` · `routes/timerRouter.js` · `app.js` · `index.js`

**Qualidade desta fase:**
- `timerState.js` — funções puras, imutáveis, sem I/O (testáveis isoladamente)
- `TimerService` — recebe `persistence` por injeção (DIP)
- `COMMAND_HANDLERS` map — adicionar novo comando sem editar `execute()` (OCP)
- Erros de domínio (tempo inválido, ação desconhecida) propagam via `throw` e são capturados só na rota

**Validação:** `curl -X POST localhost:3000/command -d '{"action":"START"}'` → timer roda no servidor. `GET /state` mostra tempo decrementando.

---

## Fase 2 — Display sincronizado

**Objetivo:** `display.html` mostra o timer em tempo real via WebSocket.

**Entregáveis:**
- [ ] `infra/wsBroadcaster.js` — gerencia conexões WS e expõe `broadcast(state)`
- [ ] `TimerService` recebe `broadcaster` como segunda dependência injetada
- [ ] Servidor faz broadcast do estado a cada tick (1s) e após cada comando
- [ ] `display.html` conecta via WebSocket, exibe `remainingSeconds` formatado (MM:SS)
- [ ] Reconexão automática no display (backoff: 2s → 5s → 10s, cap 30s)
- [ ] Visual base: fundo preto, dígitos grandes (fonte DSEG7), sem controles visíveis

**Qualidade desta fase:**
- `wsBroadcaster.js` em `infra/` — WebSocket é detalhe de infraestrutura, não vaza para use case
- `TimerService` não importa `ws` diretamente — recebe interface `{ broadcast }` (DIP)
- `display.html` lida com mensagens JSON; falha de parse é silenciosa (não trava a tela)

**Validação:** iniciar timer via `curl`, ver `display.html` atualizar em tempo real na TV.

---

## Fase 3 — Painel de controle mínimo

**Objetivo:** operador controla o timer pelo celular, sem `curl`.

**Entregáveis:**
- [ ] `control.html` com botões: **Iniciar / Pausar / Resetar**
- [ ] Botão **Definir tempo** — abre modal com presets (5/10/15/20/30min) + input manual
- [ ] Painel reflete estado atual via WebSocket (botão muda Iniciar ↔ Pausar)
- [ ] Indicador de conexão (verde = conectado, vermelho = offline)

**Qualidade desta fase:**
- `control.html` nunca mantém estado local do timer — lê sempre do servidor via WS
- Funções JS separadas por responsabilidade: `renderState()`, `sendCommand()`, `connect()`
- Nenhum `onclick` inline no HTML — event listeners no script

**Validação:** abrir `control.html` no celular e controlar `display.html` na TV. Desligar WiFi → indicador vermelho → reconectar → verde.

---

## Fase 4 — Alertas visuais no display

**Objetivo:** display muda de cor conforme tempo restante (comportamento do POC, agora server-driven).

**Entregáveis:**
- [ ] `timerState.js` — função pura `alertLevel(state)`: `normal` / `warning` (≤30%) / `danger` (≤20%) / `zero`
- [ ] `alertLevel` incluído no estado broadcastado
- [ ] Display aplica classes CSS: branco → laranja pulsante → vermelho pulsante → vermelho escalando
- [ ] Alerta `zero` persiste até reset
- [ ] Modo progressivo sempre `normal`

**Qualidade desta fase:**
- `alertLevel` fica em `domain/timerState.js` — é regra de negócio, não visual
- CSS usa classes semânticas (`.warning`, `.danger`, `.zero`), não estilos inline via JS
- Transições CSS, não JS `setInterval` para animação

**Validação:** definir 1 minuto → acompanhar progressão de cores em tempo real.

---

## Fase 5 — Mensagens emergenciais

**Objetivo:** operador envia mensagem para tela inteira no display.

**Entregáveis:**
- [ ] `timerState.js` — `setMessage(state, text)` e `clearMessage(state)` como transições puras
- [ ] `control.html`: botão **Mensagem** → modal com quick messages + textarea
- [ ] Quick messages: ACABOU · +5 MIN · MAIS GRAVE · MAIS AGUDO · VOLUME ↑ · VOLUME ↓ · OK ✓
- [ ] Display: `emergencyMessage` não-nulo substitui timer por texto centralizado (fit de fonte automático)
- [ ] Comando `SET_MESSAGE` e `CLEAR_MESSAGE` no `COMMAND_HANDLERS`

**Qualidade desta fase:**
- Texto da mensagem é sanitizado no servidor antes de broadcast (strip HTML)
- `fitMensagem()` extraído como função pura que recebe dimensões, não lê `window` direto

**Validação:** enviar "ACABOU" → tela cheia no display. Voltar → timer reaparece.

---

## Fase 6 — Controle de brilho e áudio remoto

**Objetivo:** operador ajusta brilho da TV e alertas sonoros sem tocar no display.

**Entregáveis:**
- [ ] `brightness` (0–100) e `audioEnabled` (bool) no estado
- [ ] Comandos `SET_BRIGHTNESS` e `TOGGLE_AUDIO` no `COMMAND_HANDLERS`
- [ ] `control.html`: slider de brilho + toggle áudio
- [ ] `display.html`: aplica `filter: brightness(x)` e toca beeps via Web Audio API

**Qualidade desta fase:**
- Lógica de beep em `display.html` encapsulada em módulo `audioAlerts` (objeto com `play(level)`)
- Brilho validado no domínio: `setBrightness(state, value)` — `value` clampado entre 0–100

**Validação:** ajustar brilho pelo celular → TV escurece em tempo real.

---

## Fase 7 — Robustez e experiência de produção

**Objetivo:** sistema sobrevive a falhas de rede e reinicializações.

**Entregáveis:**
- [ ] Display: banner "Reconectando..." discreto ao perder WS, sem travar o timer visível
- [ ] `control.html`: indicador mostra quantos displays estão conectados
- [ ] Fullscreen automático no display ao carregar (fallback: botão)
- [ ] QR code na raiz (`localhost:3000`) com URL do `/control`
- [ ] PIN de 4 dígitos no `/control` (variável de ambiente `CONTROL_PIN`)

**Qualidade desta fase:**
- PIN verificado no servidor, não no cliente
- QR code gerado server-side com lib `qrcode` — cliente recebe PNG, não gera no browser
- `CONTROL_PIN` lido via `process.env`, nunca hardcoded

**Validação:** matar e reiniciar servidor → display reconecta em < 15s, estado preservado.

---

## Fase 8 — Deploy no Raspberry Pi

**Objetivo:** sistema roda standalone, sem depender de outros equipamentos.

**Entregáveis:**
- [ ] `scripts/setup.sh` — instala Node.js + dependências no Pi
- [ ] `scripts/emaus-timer.service` — systemd inicia servidor no boot
- [ ] `scripts/autostart` — Chromium kiosk abre `/display` no login
- [ ] `docs/operacao.md` — como ligar, conectar no hotspot, acessar `/control`

**Qualidade desta fase:**
- `setup.sh` é idempotente (pode rodar duas vezes sem quebrar)
- Serviço systemd usa `Restart=on-failure` com `RestartSec=5`
- Documentação inclui QR code estático da URL do controle

**Validação (final):** ligar o Pi → TV abre display. Celular no hotspot → QR code → controla timer. 100% offline.

---

## Stack de referência

```
emaus-timer/
├── server/
│   ├── index.js                    # bootstrap
│   ├── app.js                      # Express + rotas
│   ├── domain/
│   │   └── timerState.js           # regras puras
│   ├── usecases/
│   │   └── timerService.js         # orquestração
│   ├── infra/
│   │   ├── fileStatePersistence.js # I/O disco
│   │   ├── intervalTick.js         # setInterval
│   │   └── wsBroadcaster.js        # WebSocket (Fase 2)
│   └── routes/
│       └── timerRouter.js          # handlers HTTP
├── public/
│   ├── display.html                # TV de palco
│   └── control.html                # painel do operador
├── data/
│   └── state.json                  # gerado em runtime
├── scripts/                        # Fase 8
├── docs/                           # Fase 8
├── package.json
└── ROADMAP.md
```

**Dependências:**
- `express` — servidor HTTP
- `ws` — WebSocket
- `qrcode` — QR code da URL de controle (Fase 7)

---

## Critérios de "pronto" por fase

Cada fase só está concluída quando:
1. Funciona em **dois dispositivos reais** na mesma rede (não só localhost)
2. Nenhum arquivo tem mais de uma responsabilidade (SRP)
3. Nenhuma camada interna importa camada externa (Clean Architecture)
4. Código commitado com mensagem descritiva no padrão `feat(fase-N): ...`
