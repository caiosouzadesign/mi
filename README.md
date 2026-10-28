# Contas do Imóvel

Portal para os inquilinos acessarem as contas de **luz (Enel)** e **água (Sabesp)** dos imóveis que continuam no nome do proprietário — sem que o proprietário precise baixar e mandar cada conta manualmente.

Cada inquilino recebe **um link próprio** (ex.: `https://seu-site.vercel.app/t/aB3x...`) onde ele pode:

- ver a conta do mês com valor, vencimento e consumo;
- **copiar o código de barras** (e o PIX copia e cola, quando a conta tiver);
- **baixar o PDF** ou **compartilhar** por WhatsApp, e-mail ou pelo menu de compartilhar do celular (manda o próprio PDF);
- ver o **histórico** e a situação de cada mês (a pagar, vencida, pagamento informado, paga);
- receber **alertas**: conta vencida, vencendo em até 3 dias, **consumo acima da média** (com dica de vazamento no caso da água);
- ver **avisos** das distribuidoras (os que vêm escritos na conta e os que chegam por e-mail, como interrupção programada) e avisos que você mesmo publicar;
- informar **"já paguei"**, com comprovante opcional — você confirma no painel.

O proprietário tem um painel (`/admin`) com todos os imóveis, contas sem imóvel identificado, pagamentos informados e um botão para enviar o link ao inquilino pelo WhatsApp.

## Como as contas chegam

A Enel e a Sabesp não têm API pública, e automatizar o login nos sites delas é frágil (captcha, mudanças de layout, termos de uso). O caminho estável é o **e-mail**:

```
Enel / Sabesp ──(conta digital por e-mail, PDF)──▶ seu Gmail
                                                      │  Google Apps Script (a cada hora)
                                                      ▼
                                    POST /api/ingest (este site)
                                                      │  lê o PDF: código de barras, valor,
                                                      │  vencimento, consumo, avisos, nº instalação/RGI
                                                      ▼
                                    conta ligada ao imóvel certo ──▶ link do inquilino
```

- O imóvel é identificado pelo **nº da instalação (Enel)** ou **RGI/fornecimento (Sabesp)** que aparece no PDF.
- O valor vem do próprio código de barras (padrão FEBRABAN, validado pelos dígitos verificadores), então não depende do layout da conta.
- Se algo não for lido certo, você corrige na tela da conta no painel. Também dá para **enviar PDFs manualmente** pelo painel (útil no começo e para importar contas antigas).

## Colocando no ar (≈ 30 min, pelo computador)

Tudo abaixo cabe nos planos gratuitos.

### 1. Ative a conta digital por e-mail
- **Enel SP**: app ou site Enel › Conta por e-mail (fatura digital), para cada instalação.
- **Sabesp**: Agência Virtual › Conta Digital, para cada RGI.

Use o seu Gmail (ou crie um só para as contas). Anote o **nº da instalação** e o **RGI** de cada imóvel.

### 2. Banco de dados (Turso)
1. Crie uma conta em https://turso.tech e um banco (ex.: `contas`).
2. Copie a **URL** (`libsql://...`) e gere um **token**.

### 3. Site (Vercel)
1. Em https://vercel.com, importe este repositório do GitHub.
2. Em *Environment Variables*, cadastre:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | URL do Turso (`libsql://...`) |
| `DATABASE_AUTH_TOKEN` | token do Turso |
| `ADMIN_PASSWORD` | sua senha do painel |
| `SESSION_SECRET` | texto aleatório longo |
| `INGEST_SECRET` | outro texto aleatório longo (vai também no Apps Script) |
| `PDF_PASSWORDS` | opcional: senhas dos PDFs, se vierem protegidos (separadas por vírgula) |

Para gerar textos aleatórios: https://www.random.org/strings/ ou `openssl rand -base64 32`.

3. Faça o deploy. As tabelas são criadas sozinhas no primeiro acesso.

### 4. Leitor do Gmail (Google Apps Script)
1. Abra https://script.google.com › **Novo projeto**.
2. Cole o conteúdo de [`scripts/gmail-apps-script.gs`](scripts/gmail-apps-script.gs).
3. Preencha `SITE_URL` (endereço da Vercel) e `INGEST_SECRET` (mesmo valor do passo 3).
4. Escolha a função **`instalar`** › **Executar** › autorize o acesso ao Gmail.

Ele processa os e-mails dos últimos 60 dias e passa a rodar de hora em hora. E-mails já lidos recebem o marcador `contas-processadas`.

### 5. Cadastre os imóveis
Em `/admin` › **Cadastrar imóvel**: nome, inquilino, WhatsApp, **nº da instalação Enel** e **RGI Sabesp**. Depois use **Enviar link no WhatsApp**.

Trocou o inquilino? Na página do imóvel, **Gerar novo link** — o link antigo para de funcionar.

## Segurança
- Cada inquilino só vê as contas do próprio imóvel; o link usa um token aleatório impossível de adivinhar.
- O link de compartilhar uma conta (`/f/...`) dá acesso **só àquele PDF**, não ao portal.
- O painel é protegido por senha; a API de ingestão, por um segredo compartilhado com o Apps Script.
- As páginas pedem aos buscadores para não serem indexadas.

## Limitações e próximos passos
- **O leitor de PDF foi calibrado com contas de exemplo.** O código de barras e o valor são confiáveis; vencimento, mês de referência e consumo dependem do texto da conta real e podem precisar de ajuste. Mande um PDF real de cada distribuidora (pode tapar dados pessoais) para afinar — depois do ajuste, o botão **Ler o PDF de novo** atualiza as contas já importadas.
- O **PIX** só é capturado quando o código vem como texto no PDF (se vier só como imagem de QR code, fica de fora por enquanto).
- A confirmação de pagamento é manual (o inquilino informa, você confirma). Não há integração bancária.
- Ideias: aviso automático ao inquilino quando a conta chega (e-mail via Resend ou WhatsApp Business), lembrete antes do vencimento, instalar como app (PWA).

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local   # DATABASE_URL=file:local.db já funciona sem Turso
npm run seed                 # 2 imóveis de demonstração com 6 meses de contas
npm run dev                  # http://localhost:3000/admin
npm test                     # testes do leitor de contas
```

Estrutura:

- `src/lib/parser/` — leitura das contas (código de barras FEBRABAN, valor, vencimento, consumo, PIX, avisos)
- `src/lib/ingest.ts` — importa o PDF, evita duplicadas e liga ao imóvel
- `src/app/t/[token]` — portal do inquilino
- `src/app/admin` — painel do proprietário
- `src/app/api/ingest` — recebe contas e avisos do Apps Script
- `scripts/gmail-apps-script.gs` — leitor do Gmail
