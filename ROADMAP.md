# Emaús Timer — Roadmap de Evolução

POC (`timer.html`) → Produto com display separado do controle.

**Premissa de arquitetura:**
- Servidor Node.js = fonte de verdade do estado
- `display.html` = TV de palco (só renderiza, sem controles)
- `control.html` = celular/tablet do operador (todos os controles)
- Comunicação via WebSocket em rede local

---

## Fase 0 — Estrutura do projeto

**Objetivo:** repositório com esqueleto funcional, servidor HTTP servindo arquivos estáticos.

**Entregáveis:**
- [ ] `package.json` com dependências (`express`, `ws`)
- [ ] `server/index.js` — Express servindo `public/`
- [ ] `public/display.html` — página em branco com título
- [ ] `public/control.html` — página em branco com título
- [ ] Servidor responde em `http://localhost:3000`
- [ ] `/display` e `/control` acessíveis de outro dispositivo na mesma rede

**Validação:** abrir `localhost:3000/control` no PC e `192.168.X.X:3000/display` no celular — ambos carregam.

---

## Fase 1 — Timer no servidor

**Objetivo:** estado do timer vive no servidor, não no browser.

**Entregáveis:**
- [ ] Objeto de estado global no servidor: `{ status, mode, totalSeconds, remainingSeconds }`
- [ ] Endpoints REST simples: `GET /state`, `POST /command` (START, PAUSE, RESET, SET_TIME)
- [ ] `setInterval` de 1s no servidor decrementa `remainingSeconds`
- [ ] Estado persiste em `data/state.json` (recupera após restart)
- [ ] Teste via `curl` ou Postman: iniciar, pausar, resetar

**Validação:** `curl -X POST localhost:3000/command -d '{"action":"START"}'` → timer roda no servidor. `GET /state` mostra tempo decrementando.

---

## Fase 2 — Display sincronizado

**Objetivo:** `display.html` mostra o timer em tempo real via WebSocket.

**Entregáveis:**
- [ ] Servidor WebSocket na mesma porta (upgrade HTTP→WS)
- [ ] Servidor faz broadcast do estado a cada tick (1s)
- [ ] `display.html` conecta via WebSocket, exibe `remainingSeconds` formatado
- [ ] Reconexão automática no display (backoff de 2s → 5s → 10s)
- [ ] Visual base: fundo preto, dígitos grandes (fonte DSEG7), sem controles visíveis

**Validação:** iniciar timer via `curl`, ver display.html atualizar em tempo real na TV.

---

## Fase 3 — Painel de controle mínimo

**Objetivo:** operador controla o timer pelo celular, sem `curl`.

**Entregáveis:**
- [ ] `control.html` com botões: **Iniciar / Pausar / Resetar**
- [ ] Botão **Definir tempo** — abre modal com presets (5/10/15/20/30min) + input manual
- [ ] Painel reflete estado atual (botão muda de "Iniciar" → "Pausar" quando rodando)
- [ ] Indicador de conexão no painel (verde = conectado, vermelho = offline)

**Validação:** abrir control.html no celular e controlar o display.html na TV. Desligar WiFi do celular → indicador fica vermelho → reconectar → volta verde.

---

## Fase 4 — Alertas visuais no display

**Objetivo:** display muda de cor conforme tempo restante (comportamento do POC, agora server-driven).

**Entregáveis:**
- [ ] Servidor calcula nível de alerta: `normal` / `warning` (≤30%) / `danger` (≤20%) / `zero` (0s)
- [ ] Estado inclui `alertLevel` no broadcast
- [ ] Display aplica classes CSS: branco → laranja pulsante → vermelho pulsante → vermelho escalando
- [ ] Alerta visual de `zero` persiste até reset
- [ ] Modo progressivo (sem tempo definido) fica sempre em `normal`

**Validação:** definir 1 minuto, rodar — ver progressão de cores em tempo real no display.

---

## Fase 5 — Mensagens emergenciais

**Objetivo:** operador envia mensagem para tela inteira no display.

**Entregáveis:**
- [ ] `control.html`: botão **Mensagem** → modal com quick messages + textarea
- [ ] Quick messages: ACABOU · +5 MIN · MAIS GRAVE · MAIS AGUDO · VOLUME ↑ · VOLUME ↓ · OK ✓
- [ ] Servidor propaga `emergencyMessage` para o estado
- [ ] Display: quando `emergencyMessage` não-nulo, substitui timer por texto centralizado em vermelho (fit de fonte automático)
- [ ] Botão **Voltar ao timer** no display e no painel de controle

**Validação:** enviar "ACABOU" pelo celular → display mostra em tela cheia. Pressionar voltar → timer reaparece.

---

## Fase 6 — Controle de brilho e áudio remoto

**Objetivo:** operador ajusta brilho da TV e alertas sonoros sem tocar no display.

**Entregáveis:**
- [ ] Servidor propaga `brightness` (0–100) e `audioEnabled` no estado
- [ ] `control.html`: slider de brilho + toggle áudio
- [ ] `display.html`: aplica `filter: brightness(x)` e toca beeps via Web Audio API (lógica do POC)
- [ ] Presets de brilho: 25% / 50% / 75% / 100%

**Validação:** ajustar brilho pelo celular → TV escurece em tempo real.

---

## Fase 7 — Robustez e experiência de produção

**Objetivo:** sistema sobrevive a falhas de rede e reinicializações.

**Entregáveis:**
- [ ] Servidor restaura estado do `data/state.json` ao iniciar (timer parado, tempo preservado)
- [ ] Display: banner discreto "Reconectando..." quando WS cai, sem travar tela
- [ ] `control.html`: indicador mostra quantos displays estão conectados
- [ ] Fullscreen automático no display ao carregar (com fallback de botão)
- [ ] QR code na raiz do servidor (`localhost:3000`) com a URL do `/control`

**Validação:** matar e reiniciar o servidor — display reconecta em < 15s, estado preservado.

---

## Fase 8 — Deploy no Raspberry Pi

**Objetivo:** sistema roda standalone, sem depender de outros equipamentos.

**Entregáveis:**
- [ ] Script `setup.sh` para instalar Node.js + dependências no Pi
- [ ] Serviço `systemd` (`emaus-timer.service`) inicia servidor no boot
- [ ] Chromium em modo kiosk: `chromium-browser --kiosk http://localhost:3000/display`
- [ ] Script `autostart` para abrir o kiosk ao login no Pi
- [ ] Documentação: como conectar na rede do Pi via hotspot e acessar `/control`

**Validação (final):** ligar o Pi, TV abre o display automaticamente. Conectar celular no hotspot do Pi, abrir URL do QR code → controlar timer. Sistema funciona 100% sem internet.

---

## Stack de referência

```
emaus-timer/
├── server/
│   └── index.js          # Express + WebSocket + lógica do timer
├── public/
│   ├── display.html      # TV de palco
│   └── control.html      # Painel do operador
├── data/
│   └── state.json        # Persistência do estado (gerado em runtime)
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
2. Reconexão após queda de WiFi funciona sem recarregar a página manualmente
3. Código commitado com mensagem descritiva
