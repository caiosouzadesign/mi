# Contas do Imóvel

Portal para os inquilinos acessarem as contas de **luz (Enel)** e **água (Sabesp)** dos imóveis que continuam no nome do proprietário — sem que o proprietário precise baixar e mandar cada conta manualmente.

Funciona como a **central do imóvel**: contas, contrato, documentos e fotos em um só lugar.

Cada inquilino recebe **um link próprio** (ex.: `https://seu-site.vercel.app/t/aB3x...`) onde ele pode:

- ver a conta do mês com valor, vencimento e consumo;
- **copiar o código de barras** (e o PIX copia e cola, quando a conta tiver);
- **baixar o PDF** ou **compartilhar** por WhatsApp, e-mail ou pelo menu de compartilhar do celular (manda o próprio PDF);
- ver o **histórico** e a situação de cada mês (a pagar, vencida, pagamento informado, paga);
- receber **alertas**: conta vencida, vencendo em até 3 dias, **consumo acima da média** (com dica de vazamento no caso da água);
- ver **avisos** das distribuidoras (os que vêm escritos na conta e os que chegam por e-mail, como interrupção programada) e avisos que você mesmo publicar;
- informar **"já paguei"**, com comprovante opcional — você confirma no painel;
- na aba **Contrato e fotos**: ver e baixar o contrato, quantos dias faltam para o fim (com aviso quando estiver acabando), **assinar documentos digitalmente** pelo celular e ver as **fotos do imóvel** (as da entrega, que servem de referência na vistoria de saída).

O proprietário tem um painel (`/admin`). Em cada imóvel há as abas **Contas**, **Contrato** (datas, aluguel, documentos, assinatura digital e o botão de avisar o inquilino) e **Fotos**. O painel mostra todos os imóveis, contratos a vencer, contas sem imóvel identificado, pagamentos informados e um botão para enviar o link ao inquilino pelo WhatsApp.

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

### 4. Conecte o Gmail (Google Apps Script)
No painel do site publicado, clique no ícone de envelope no topo (**Conectar Gmail**). A página tem o passo a passo e o botão **Copiar script**, que já vem preenchido com o endereço do seu site e o `INGEST_SECRET`. Em resumo:
1. Abra https://script.google.com com o Gmail que recebe as contas › **Novo projeto**.
2. Apague o texto do editor, cole o script e salve.
3. Escolha a função **`instalar`** › **Executar** › **Revisar permissões** › **Avançado** › **Acessar (não seguro)** › **Permitir**. O aviso “O Google não verificou este app” é normal: o app é seu.
4. Volte à página **Conectar Gmail**: o quadro fica verde com **Conectado**.

Ele processa os e-mails dos últimos 60 dias e passa a rodar de hora em hora. E-mails lidos recebem o marcador `contas-processadas`; falsificados, `contas-suspeitas`.

**Avisos resumidos (opcional):** os avisos que chegam por e-mail (falta de água, desligamento, reajuste...) aparecem no **sino de notificações** do painel como uma notificação curta, com data e horário em destaque. Sem configurar nada, o resumo é simples. Para resumos feitos por IA, cadastre `ANTHROPIC_API_KEY` (crie em https://console.anthropic.com) na Vercel: o texto dos avisos (não as contas) é enviado à API do Claude só para gerar o resumo; custa centavos por aviso.

### 5. Cadastre os imóveis
Em `/admin` › **Cadastrar imóvel**: nome, inquilino, WhatsApp, **nº da instalação Enel** e **RGI Sabesp**. Depois use **Enviar link no WhatsApp**.

Trocou o inquilino? Na página do imóvel, **Gerar novo link** — o link antigo para de funcionar.

### 6. Contrato, lembretes e assinatura digital (opcional)

**Lembretes de fim de contrato.** Na aba Contrato do imóvel, informe início, fim e aluguel. O inquilino passa a ver o prazo, e recebe avisos automáticos **90, 60 e 30 dias antes e no dia do fim** (no portal, e por e-mail se configurado). Para ligar a rotina diária, cadastre `CRON_SECRET` (qualquer texto aleatório) na Vercel — o agendamento já está em `vercel.json`. A qualquer momento você também pode clicar em **Avisar no portal** ou mandar a mensagem pronta pelo WhatsApp.

**E-mail (opcional).** Crie uma conta em https://resend.com, verifique um domínio e cadastre `RESEND_API_KEY` e `EMAIL_FROM`.

**Assinatura digital — ZapSign.** Funciona como o DocuSign, mas é brasileira, mais barata e tem validade jurídica (MP 2.200-2/2001). O fluxo: você envia o PDF na aba Contrato › o inquilino recebe o link (no portal e por e-mail) › assina pelo celular › o PDF assinado volta sozinho para o sistema.
1. Crie a conta em https://zapsign.com.br (para testar sem custo: https://sandbox.zapsign.com.br e `ZAPSIGN_SANDBOX=true`).
2. Em Configurações › Integrações › API, copie o token para `ZAPSIGN_API_TOKEN`.
3. Em Configurações › Webhooks, cadastre `https://SEU-SITE/api/webhooks/assinatura?secret=SEU_SEGREDO` e coloque o mesmo segredo em `SIGNATURE_WEBHOOK_SECRET`. (Se o webhook falhar, a rotina diária também atualiza as assinaturas pendentes.)
4. Para assinar junto como locador, preencha `OWNER_NAME` e `OWNER_EMAIL`.

Documentos assinados em papel ou em outro serviço podem ser marcados como **assinados manualmente**, com upload do PDF assinado.

> A integração foi escrita com base no pacote oficial da ZapSign (endpoints `/api/v1/docs/`). Faça o primeiro envio no **sandbox** para confirmar o fluxo de ponta a ponta antes de usar com contratos reais.

## Próxima aba: câmeras

A navegação já está preparada (`src/lib/nav.ts`). A ideia é o proprietário liberar, por imóvel, o acesso às câmeras (por exemplo, a da garagem ou do portão) e o inquilino ver a imagem ao vivo na aba **Câmeras**. O caminho depende das câmeras: modelos com nuvem (Intelbras, Tuya/Smart Life, TP-Link Tapo) costumam permitir compartilhar ou incorporar a imagem; câmeras com RTSP precisam de um conversor para o navegador (ex.: go2rtc em um computador ou roteador da casa). Quando for fazer, me diga a marca/modelo.

## Segurança

### O que o sistema faz para te proteger

**Contra boleto falso** (o golpe mais provável neste tipo de sistema):
- O leitor do Gmail só importa e-mails **autenticados** (DMARC/DKIM verificados pelo próprio Google) dos domínios oficiais da Enel e da Sabesp. O que não passar ganha o marcador `contas-suspeitas` no Gmail e não entra.
- Mesmo assim, toda conta que chega por e-mail passa por uma checagem e fica **escondida do inquilino** até você liberar se: for a primeira daquela distribuidora no imóvel; o código da empresa no boleto for diferente das contas anteriores (outro favorecido); o código de barras não for de conta de luz/água; ou o valor for mais de 3× a média. Elas aparecem em **Contas para conferir** no painel.
- Avisos que chegam por e-mail nunca vão direto para o inquilino: você publica.

**Acesso:**
- Cada inquilino tem um link com um código aleatório impossível de adivinhar e só vê o próprio imóvel. **Trate o link como uma senha.**
- **Gerar novo link** (troca de inquilino) invalida o portal antigo **e todos os links de PDF já enviados** (contas e contrato).
- Painel com senha: **bloqueio de 15 min após 5 erros** por IP e limite global contra ataques de vários IPs; sessão em cookie protegido (HttpOnly, SameSite); **trocar a senha desconecta todas as sessões** na hora. Em produção, o sistema recusa senha com menos de 12 caracteres.
- Integrações (Gmail, rotina diária, ZapSign) exigem segredos comparados em tempo constante. O status de assinatura é sempre confirmado direto na API da ZapSign, então um aviso forjado não muda nada.

**Arquivos:**
- O tipo de todo arquivo enviado (comprovante, foto, documento, conta) é identificado pelos bytes, não pelo nome: um HTML/SVG com código disfarçado de "foto" é recusado. Fotos e comprovantes abrem numa caixa de areia (nada executa).

**Navegador:** política de conteúdo (CSP), proteção contra o site ser embutido em outro (clickjacking), HTTPS obrigatório (HSTS), e a URL com o código do inquilino nunca é enviada a outros sites (Referrer-Policy). As páginas não são indexadas por buscadores.

### O que fica com você (checklist)
- [ ] **Ative a verificação em duas etapas** no GitHub, Vercel, Turso, Google (Gmail/Apps Script), ZapSign e Resend. Quem entrar nessas contas tem acesso a tudo.
- [ ] Use segredos longos e diferentes: `ADMIN_PASSWORD` (12+ caracteres), `SESSION_SECRET` e `INGEST_SECRET` (32+ caracteres aleatórios, ex.: `openssl rand -base64 32`). Nunca os coloque no código ou no GitHub.
- [ ] Na troca de inquilino, clique em **Gerar novo link**.
- [ ] Antes de liberar uma conta em **Contas para conferir**, confira o código de barras no app da Enel/Sabesp.
- [ ] Se uma conta verdadeira cair em `contas-suspeitas` no Gmail, confira o remetente e adicione o domínio em `DOMINIOS_CONFIAVEIS` no Apps Script.
- [ ] Ative backups no Turso.

### Riscos conhecidos e aceitos
- As contas estão no seu nome: o PDF mostra seu nome/CPF/endereço para o inquilino (isso já acontecia ao mandar as contas pelo WhatsApp).
- O segredo do webhook da ZapSign vai na URL (pode aparecer em logs); por isso o status é sempre reconfirmado na API.
- A CSP permite scripts inline do próprio Next.js (necessários para o site funcionar); conteúdo de terceiros não é carregado.

## Limitações e próximos passos
- **O leitor de PDF foi calibrado com contas de exemplo.** O código de barras e o valor são confiáveis; vencimento, mês de referência e consumo dependem do texto da conta real e podem precisar de ajuste. Mande um PDF real de cada distribuidora (pode tapar dados pessoais) para afinar — depois do ajuste, o botão **Ler o PDF de novo** atualiza as contas já importadas.
- O **PIX** só é capturado quando o código vem como texto no PDF (se vier só como imagem de QR code, fica de fora por enquanto).
- A confirmação de pagamento é manual (o inquilino informa, você confirma). Não há integração bancária.
- Com o e-mail (Resend) configurado, o inquilino recebe um e-mail quando a conta chega (depois de liberada, se estava em revisão) e um lembrete 3 dias antes do vencimento. No painel, cada conta em aberto tem um botão de WhatsApp com a mensagem pronta.
- Ideia futura: instalar o portal como app no celular (PWA).

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local   # DATABASE_URL=file:local.db já funciona sem Turso
npm run seed                 # 2 imóveis de demonstração: contas, contrato, documentos e fotos
npm run dev                  # http://localhost:3000/admin
npm test                     # testes do leitor de contas
```

Estrutura:

- `src/lib/parser/` — leitura das contas (código de barras FEBRABAN, valor, vencimento, consumo, PIX, avisos)
- `src/lib/ingest.ts` — importa o PDF, evita duplicadas e liga ao imóvel
- `src/app/t/[token]` — portal do inquilino
- `src/app/admin` — painel do proprietário
- `src/app/t/[token]/imovel` — contrato, documentos e fotos (inquilino)
- `src/app/admin/imoveis/[id]/{contrato,fotos}` — contrato, assinatura e fotos (painel)
- `src/lib/contract.ts`, `src/lib/contract-notify.ts` — prazo do contrato e lembretes
- `src/lib/signature/` — integração com a ZapSign
- `src/app/api/cron/diario` — rotina diária (lembretes + assinaturas pendentes)
- `src/app/api/webhooks/assinatura` — retorno da ZapSign
- `src/app/api/ingest` — recebe contas e avisos do Apps Script
- `src/lib/gmail-script.ts` — leitor do Gmail (Apps Script entregue em Conectar Gmail)
- `src/lib/summarize.ts` — resumo dos avisos (Claude, com resumo simples de reserva)
