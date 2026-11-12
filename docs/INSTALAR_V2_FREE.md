# Guia definitivo de instalação — RumoCerto MZ v2.1 (sem pagamentos)

## 0. Antes de começar

É preciso ter Node.js LTS, VS Code, contas gratuitas GitHub, Cloudflare e EmailJS. A conta EmailJS do projecto já possui um serviço Gmail criado. Não vamos precisar de comprar domínio, contratar alojamento, pagar por IA ou entregar a Private Key a colegas por mensagem. **Limites gratuitos podem mudar e devem ser verificados na própria conta.**

Caminho do projecto no Mac:

```bash
cd "/Users/mabikane.arnaldo/Documents/KANE/KANE_WORKSPACE/2S_2026/PROG_WEB2/PRJ_FINAL/rumocerto-mz-final"
```

**Antes de substituir a versão antiga**, guarda cópia da pasta e do `.env.local` existente. Descompacta a v2 numa pasta temporária, confere os ficheiros, e só depois substitui os ficheiros que pretendes actualizar. Nunca apagues as chaves locais sem guardar uma cópia.

## 1. Executar a prévia gratuita e o PDF

```bash
npm install
npm run dev
```

Abre `http://localhost:5173/#/plano`. Selecciona área, situação e escreve um objectivo. Clica **Prévia gratuita** e **Descarregar PDF**. Este modo cria o PDF sem IA paga e sem backend: serve também como plano B para o dia da apresentação.

```bash
npm test
npm run build
npm run preview
```

O `npm test` executa 19 verificações, incluindo os parâmetros reais do segundo e-mail e um servidor simulado para os dois envios. A compilação e o fluxo externo devem ser verificados no teu Mac.

## 2. EmailJS: dois templates, uma conta gratuita

O Gmail do projecto está associado ao EmailJS com Service ID `service_v12e9ah`. Os templates confirmados são `template_veq29mm` (confirmação) e `template_ktb1bxm` (plano). A Public Key é consultada em EmailJS **Account → API Keys**; a Private Key fica secreta. Nunca a publiques.

### Template 1 — confirmação imediata

Edita o template existente e configura:

- **To Email:** `{{to_email}}`
- **From Name:** `RumoCerto MZ`
- **Subject:** `Recebemos as tuas escolhas — RumoCerto MZ`
- **Body:**

```text
Olá {{nome}},

Recebemos as tuas escolhas para o plano de carreira:
Área: {{area}}
Situação: {{situacao}}
Objectivo: {{objetivo}}

O teu plano completo de 30 dias está a ser preparado.
Receberás outro e-mail com uma ligação para PDF aproximadamente 5 a 7 minutos depois.

RumoCerto MZ — Grupo 8, ISUTC
```

### Template 2 — envio do plano e PDF

Cria um **novo template** e copia o `Template ID` (começa por `template_`). Configura:

- **To Email:** `{{to_email}}`
- **From Name:** `RumoCerto MZ`
- **Subject:** `O teu plano completo de 30 dias — RumoCerto MZ`
- **Body:**

```text
Olá {{nome}},

O teu plano personalizado está pronto!
Título: {{titulo_plano}}
Resumo: {{resumo_plano}}

Descarrega o teu PDF neste endereço privado (válido por 7 dias):
{{link_pdf}}

Método de preparação: {{metodo}}
Nota: este plano é educativo e não garante emprego ou estágio.

Equipa RumoCerto MZ — Grupo 8, ISUTC
```

**EmailJS Free não inclui anexos.** No editor do conteúdo, escreve «Descarregar o PDF», selecciona esse texto, clica no ícone de ligação e introduz `{{link_pdf}}` como URL. Não configures um anexo `pdf_anexo`.

O logótipo `public/branding/logo-email.png` deve ser publicado num endereço HTTPS e inserido no template pelo URL público (não por um caminho `localhost` ou ficheiro do Mac).

## 3. Configurar Cloudflare Workers Free + KV Free

1. Cria conta gratuita em https://dash.cloudflare.com/ e selecciona **Workers & Pages**.
2. No terminal (com o projecto aberto):

```bash
npx wrangler login
npx wrangler kv namespace create JOBS
```

3. Copia o ID hexadecimal devolvido pelo comando e substitui `SUBSTITUIR_PELO_ID_DA_NAMESPACE_KV` no ficheiro `backend/wrangler.toml`. **O nome do binding deve continuar `JOBS`.**
4. Copia o ficheiro `backend/.dev.vars.example` para `backend/.dev.vars`. Preenche os valores verdadeiros apenas nesse ficheiro privado:

```env
EMAILJS_SERVICE_ID="service_v12e9ah"
EMAILJS_PUBLIC_KEY="PUBLIC_KEY_DA_CONTA"
EMAILJS_TEMPLATE_CONFIRM="template_veq29mm"
EMAILJS_TEMPLATE_PLAN="template_ktb1bxm"
EMAILJS_PRIVATE_KEY="PRIVATE_KEY_NAO_PARTILHAR"
GEMINI_API_KEY=""
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:4173"
PUBLIC_WORKER_URL="http://localhost:8787"
RATE_SALT="FRASE_ALEATORIA_LONGA"
```

O `.dev.vars` está excluído do Git. Não uses tokens privados em ficheiros com prefixo `VITE_`.

5. Em um segundo terminal, executa:

```bash
cd "/Users/mabikane.arnaldo/Documents/KANE/KANE_WORKSPACE/2S_2026/PROG_WEB2/PRJ_FINAL/rumocerto-mz-final"
npm run worker:dev
```

O Worker local deve abrir em `http://localhost:8787`. Testa saúde com:

```bash
curl http://localhost:8787/api/saude
```

6. No frontend, copia `.env.example` para `.env.local` se ainda não existir, e adiciona:

```env
VITE_WORKER_URL=http://localhost:8787
```

Reinicia `npm run dev`, completa os campos com o teu próprio e-mail e clica **Pedir o plano e os 2 e-mails**. Confirma a primeira mensagem no Gmail.

7. Para simular o cron durante o teste local, executa depois de registares um pedido:

```bash
curl "http://localhost:8787/cdn-cgi/local/scheduled?format=json"
```

O agendamento só envia o segundo e-mail **depois de vencidos os cinco minutos**. Podes repetir a simulação depois desse prazo. Se esta rota local mudar na versão do Wrangler, consulta o painel `http://localhost:8787/cdn-cgi/local/explorer` ou a documentação actual do Wrangler; o cron real em produção é automático.

## 4. IA gratuita facultativa (Gemini)

Acede a https://aistudio.google.com/app/apikey e verifica se a tua conta/região tem acesso ao **Gemini API Free Tier** para `gemini-2.5-flash`. Se tiver, cria uma chave gratuita e coloca em `GEMINI_API_KEY` **somente no Worker** (ficheiro `.dev.vars` local ou segredo Cloudflare em produção). **Não actives faturação paga.** Se não houver modalidade gratuita ou quota, mantém a variável vazia: o sistema gerará um plano educativo completo com o motor de regras, indicado ao utilizador sem fingir que usou IA.

A modalidade gratuita Gemini pode usar entradas para melhorar os produtos do fornecedor. Evita recolher informações clínicas, íntimas, financeiras ou dados de terceiros.

## 5. Publicar o Worker sem pagar

Na pasta `backend`, com a namespace KV já configurada:

```bash
npx wrangler deploy
```

O terminal mostrará o URL público do Worker, semelhante a `https://rumocerto-mz-api.CONTA.workers.dev` (o URL exacto depende da conta).

Configura todos os valores no Worker com `npx wrangler secret put NOME_DA_VARIAVEL`, um por um (o terminal pedir-te-á o valor):

```bash
npx wrangler secret put EMAILJS_SERVICE_ID
npx wrangler secret put EMAILJS_PUBLIC_KEY
npx wrangler secret put EMAILJS_TEMPLATE_CONFIRM
npx wrangler secret put EMAILJS_TEMPLATE_PLAN
npx wrangler secret put EMAILJS_PRIVATE_KEY
npx wrangler secret put RATE_SALT
npx wrangler secret put ALLOWED_ORIGINS
npx wrangler secret put PUBLIC_WORKER_URL
```

Opcionalmente:

```bash
npx wrangler secret put GEMINI_API_KEY
```

Em `ALLOWED_ORIGINS`, informa o **origin** exacto do GitHub Pages, sem o nome do repositório, por exemplo `https://UTILIZADOR.github.io`. Podes acrescentar `http://localhost:5173` separado por vírgula enquanto testas. Em `PUBLIC_WORKER_URL`, coloca o URL real do Worker, sem barra final.

Confirma que o Cron Trigger `*/2 * * * *` aparece nas definições do Worker. Em produção, o Cron executa aproximadamente a cada dois minutos; o e-mail é enviado em geral **5 a 7 minutos** após o registo, não ao segundo exacto. Após activar os segredos, testa os dois envios com o teu e-mail e verifica se o PDF/ligação abre num browser anónimo.

## 6. Preparar o GitHub Pages

O site deve continuar num repositório **público** (exigência do docente). Adiciona todos os integrantes como colaboradores. Cada um deve fazer commits reais num branch pessoal, abrir um Pull Request revisto por outro colega e fazer merge por PR.

Em **Settings → Pages**, selecciona **GitHub Actions**. Em **Settings → Secrets and variables → Actions → Variables**, adiciona:

```text
VITE_WORKER_URL = https://URL-REAL-DO-WORKER.workers.dev
```

A execução de `npm run build` incorpora o URL público do Worker no frontend. A regra de `base` do Vite e o `createWebHashHistory` do router já estão preparados.

Confirma as páginas, `F5` numa rota interna, a API do Banco Mundial, o formulário e a entrega de dois e-mails. Preenche os links no README e no BRD.

## 7. Verificações para a apresentação ao docente

- [ ] `npm test` e `npm run build` passaram no Mac
- [ ] Logótipos aparecem no site, no Gmail e no modelo de e-mail
- [ ] API Banco Mundial carrega, trata erros e exporta CSV
- [ ] Plano gerado com informações específicas e 4 semanas
- [ ] Prévia gratuita e PDF descarregado localmente
- [ ] Primeiro e-mail recebido com escolhas correctas
- [ ] Segundo e-mail recebido *depois* de cinco minutos, com link e PDF
- [ ] Envio funciona mesmo depois de fechar o navegador
- [ ] A chave Gemini, Private Key EmailJS e `.dev.vars` não constam do GitHub
- [ ] Publicação no GitHub Pages funcional e 3 PRs reais do grupo
- [ ] BRD actualizado com dados reais do inquérito e links públicos

**Nota:** dois e-mails por pessoa gastam dois pedidos no EmailJS. Verifica o contador gratuito. Não há forma de prometer entrega exacta ou disponibilidade ilimitada em serviços gratuitos.

## Correcção v2.1 na instalação já existente

**Não substituas o `backend/wrangler.toml` inteiro:** já contém o ID verdadeiro da tua namespace `JOBS`. Modifica só o Cron de `* * * * *` para `*/2 * * * *`.

O ZIP de actualização sobrepõe os ficheiros de código e documentação **sem substituir `.env.local`, `backend/.dev.vars` ou `backend/wrangler.toml`**. Depois executa `npm test` e `npm run build`. As alterações no código não mudam os Template IDs nem as credenciais.

No envio #2 o código envia `{{titulo_plano}}`, `{{resumo_plano}}`, `{{metodo}}`, `{{link_pdf}}` como texto e URL. Se o e-mail mostrar dados de teste como «1002» ou um link vazio, procura parâmetros guardados no modo *Test It* do EmailJS, remove dados de exemplo e envia um pedido novo. Os testes unitários verificam que o backend não emite «1002» nesses campos.

**Antes de efectuar o deploy**, regenera as chaves EmailJS anteriormente expostas e coloca os valores novos no Worker. Faz deploy do Worker, copia o URL HTTPS real, define `PUBLIC_WORKER_URL` com esse URL e confirma o envio directo fora do Mac. O cron em produção não necessita do `curl` local.
