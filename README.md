# RumoCerto MZ — Versão 2.1 gratuita — links PDF e agendamento corrigidos

**Grupo 8 · Programação Web II · ISUTC · 2026**

Aplicação Vue 3 para jovens moçambicanos: indicadores reais de desemprego juvenil, criação de planos educativos personalizados de 30 dias em PDF e, **após configurar os serviços gratuitos**, dois e-mails: confirmação imediata e entrega agendada cerca de cinco minutos depois.

> **Estado da versão:** o código-fonte e os testes automatizados estão preparados. A API externa Gemini/EmailJS e a fila agendada Cloudflare **não foram activadas numa conta real nem testadas de ponta a ponta em produção**. Não dizer ao docente que o segundo e-mail foi enviado até haver captura de prova real.

## O que oferece

- Vue 3, Vite, Vue Router (rota de detalhe por parâmetro + página 404), componentes com props, composables, CSS responsivo em português;
- `fetch` à API pública do Banco Mundial para Moçambique, com carregamento, erro, vazio, gráfico e exportação CSV;
- formulário detalhado: situação actual, área, objectivo, disponibilidade, condições de internet, competências e dificuldades;
- plano de 30 dias com 4 semanas, tarefas e entregáveis verificáveis; prévia e PDF grátis mesmo sem backend;
- IA Gemini opcional em **modalidade gratuita**, sempre com motor de regras educativo como alternativa quando a quota ou a chave não estiver disponível;
- backend Cloudflare Workers Free + Workers KV Free, com Cron de dois em dois minutos, para processar pedidos depois de fechar o navegador;
- primeiro e-mail por EmailJS na submissão; segundo por EmailJS com **link privado para PDF**, sem anexos pagos;
- visual institucional (símbolo, favicon, logótipo do cabeçalho, avatar do Gmail e logótipo para o template do EmailJS);
- validação frontend/backend, privacidade com consentimento, controlo de frequência simples, token de acesso ao PDF, TTL de 7 dias para os pedidos;
- testes unitários e teste simulado do fluxo de dois e-mails, e workflow GitHub Actions para GitHub Pages.

## Custo: sem pagamento para o projecto académico, com limites

| Serviço | Modalidade usada | Atenção |
|---|---|---|
| Vue / Vite e PDF | Bibliotecas e código sem custo | Executa no computador/navegador |
| API Banco Mundial | API pública | Depende de Internet |
| GitHub Pages | Gratuito para repositório público | Necessita conta GitHub |
| Cloudflare Worker | Free: 100.000 pedidos/dia | Limite de CPU por chamada (ver documentação) |
| Workers KV | Free: 1.000 escritas/dia, 100.000 leituras/dia, 1.000 listagens/dia | Quotas; sem escalabilidade garantida |
| EmailJS | Conta grátis com 200 pedidos/mês nesta conta | **Dois envios por plano ≈ 100 planos/mês**; anexos não incluídos |
| Gemini API | Free tier **opcional** | Quotas e elegibilidade por região/conta; conteúdo pode ser usado para melhorar produtos |

**Nunca active facturação nem faça upgrade.** Se o serviço de IA gratuito estiver indisponível, a aplicação usa o motor de regras; se o agendamento/e-mail externo não estiver configurado, a prévia e o PDF continuam a funcionar localmente. A modalidade sem custos não significa que todos os serviços de terceiros estejam disponíveis sem restrições em todas as contas.

Fontes oficiais: [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/), [Cloudflare KV](https://developers.cloudflare.com/kv/platform/limits/), [Gemini API](https://ai.google.dev/gemini-api/docs/pricing), [EmailJS anexos](https://www.emailjs.com/docs/user-guide/file-attachments/).

## Iniciar no Mac

```bash
cd "/Users/mabikane.arnaldo/Documents/KANE/KANE_WORKSPACE/2S_2026/PROG_WEB2/PRJ_FINAL/rumocerto-mz-final"
npm install
npm run dev
```

Abrir o URL que o Vite indicar, tipicamente `http://localhost:5173/#/plano`.

Sem backend configurado: seleccionar área, situação e objectivo, clicar **Prévia gratuita** e **Descarregar PDF**. A API do Banco Mundial também funciona sem o Worker.

### Testes automatizados

```bash
npm test     # 16 testes: 10 de formatação + 9 de backend (simulado)
npm run build
npm run preview
```

## Activar os dois e-mails

1. Aproveitar o Gmail oficial já ligado ao EmailJS. O serviço conhecido do Grupo 8 é `service_v12e9ah`.
2. Utilizar o template existente `template_veq29mm` para o **primeiro e-mail de confirmação**, adaptando o conteúdo para confirmar escolhas (não anexar PDF aqui).
3. Utilizar o segundo template **`template_ktb1bxm`**, com `To Email: {{to_email}}`, `{{titulo_plano}}`, `{{resumo_plano}}`, `{{metodo}}` e `{{link_pdf}}`. Criar uma ligação no editor de conteúdo com texto «Descarregar o PDF» e URL `{{link_pdf}}`. **Não configurar Attachments**: EmailJS Free não permite anexos.
4. Criar conta Cloudflare Free, uma namespace Workers KV e um Worker com agendamento cron a cada dois minutos (`*/2 * * * *`) para respeitar as 1.000 listagens/dia do KV gratuito. Configurar os segredos **no Worker** (`EMAILJS_PRIVATE_KEY`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_SERVICE_ID`, IDs dos templates, `RATE_SALT` e `GEMINI_API_KEY` opcional). **Nunca** colocar a Private Key do EmailJS ou Gemini em `VITE_`.
5. Fazer deploy do Worker, configurar o endereço público no frontend via `VITE_WORKER_URL`, testar o primeiro e segundo e-mails e depois publicar o frontend em GitHub Pages.

### Instruções completas passo a passo

**[docs/INSTALAR_V2_FREE.md](docs/INSTALAR_V2_FREE.md)** — inclui comandos completos de Cloudflare, templates de e-mail, testes do cron e GitHub Pages.

## Arquitectura

```text
Navegador → GitHub Pages (Vue.js)
         ├─ API Banco Mundial (indicadores)
         ├─ Prévia e PDF local gratuito
         └─ POST /api/planos → Cloudflare Worker (segredos protegidos)
                                 ├─ Gemini API gratuita (opcional)
                                 │   ou motor educativo gratuito de regras
                                 ├─ EmailJS: e-mail #1 imediato
                                 ├─ Workers KV: pedido por 7 dias
                                 └─ Cron (a cada 2 minutos) → EmailJS: e-mail #2
                                                      + link privado para gerar PDF
```

## Segurança e integridade académica

- Não solicitar documentos de identificação, passwords, contactos de terceiros, nem informação médica íntima.
- Os campos do formulário ficam no `localStorage` do navegador excepto o e-mail, que só é enviado com consentimento; no modo com dois e-mails, os dados ficam no KV até 7 dias. A opção Gemini pode transferir textos introduzidos para um fornecedor externo. Ler termos de privacidade antes de activar.
- A IA e os planos não são prova de oportunidades de emprego, nem garantem resultados. Estatísticas do Banco Mundial são indicadores nacionais e históricos.
- O fluxo de fila com KV e Cron é apropriado para demonstração académica de baixa utilização; sob falhas de rede complexas podem ocorrer atrasos ou duplicações. Para operação real em escala, é necessário um sistema de filas com idempotência transaccional e protecção anti-spam robusta.
- O repositório público deve conter informação sobre uso de IA e contribuições do Grupo 8.
- As contas GitHub e os commits de Benjamim Junior, Elmer Almirante e Mabikane Arnaldo têm de ser realizados pelos próprios, com PR revisto por outro membro; este ZIP não substitui o histórico exigido na avaliação.
- O BRD na pasta `docs/` é um documento **a completar** (links reais, números de estudante e amostra). Não inventar provas nem resultados de questionários.

## Estrutura

```text
backend/
  src/{worker,planner,pdf,logo}.js   # API, motor de IA opcional, PDF de marca
  tests/                            # simulação dos dois envios
  wrangler.toml                      # cron + KV
  .dev.vars.example                 # nomes dos segredos, sem valores reais
src/
  views/PlanoView.vue               # novo formulário + prévia + PDF + estado
  components/, router/, composables/, data/, assets/
public/branding/                   # identidade visual já integrada
.github/workflows/deploy.yml       # GitHub Pages
.env.example                       # apenas variáveis públicas do frontend
docs/INSTALAR_V2_FREE.md           # passos para Mac e deploy
```

## Links finais — preencher antes de entregar

- Repositório: `PREENCHER_URL_GITHUB`
- Site: `PREENCHER_URL_GITHUB_PAGES`
- API Worker: `PREENCHER_URL_WORKER`

## Transparência do apoio de IA

ChatGPT foi utilizado como ferramenta de apoio para estudo dos requisitos, implementação inicial, validações, documentação e arquitectura. Gemini API é um gerador **opcional** do plano profissional, activado apenas pela equipa se existir chave gratuita; o conteúdo deve ser revisto e compreendido pelos estudantes. Nenhum texto produzido por IA deve ser apresentado como entrevista, vaga confirmada ou dado estatístico de fonte oficial.

## Correcções v2.1

- **EmailJS Free:** segundo e-mail envia a ligação privada `link_pdf`, e não tenta anexos pagos; o PDF é gerado ao aceder ao Worker.
- **KV Free:** `*/2 * * * *` evita 1.440 listagens/dia do cron de minuto a minuto (quota de 1.000/dia). Prazo estimado após o pedido: 5–7 minutos, não exacto.
- **Testes:** validam os parâmetros reais `titulo_plano`, `resumo_plano`, `metodo`, `link_pdf`, rejeitam anexo e confirmam geração de plano orientado para Vue.js.
- **Produção:** actualizar `PUBLIC_WORKER_URL` para o URL HTTPS público antes de enviar pedidos; os links `localhost` são exclusivos do Mac.
- **Segurança:** regenerar a chave privada EmailJS anteriormente exposta; nunca enviar `.dev.vars` ao GitHub. Free Tier da IA poderá ter restrições de dados; evitar dados pessoais identificáveis nos pedidos Gemini.

O registo `201 Created` e o estado `enviado` representam aceitação pelo serviço de correio, **não prova de entrega na caixa de entrada**. O Gmail do destinatário deve ser verificado.
