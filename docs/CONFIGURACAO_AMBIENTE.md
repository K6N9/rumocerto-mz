# Configuração do ambiente

## Executar sem serviços privados

```bash
npm ci
npm run dev
```

Abra o URL apresentado pelo Vite. Para testar apenas neste computador, use `npm run dev -- --host 127.0.0.1`. A ausência de configuração preserva o plano público, o PDF e a pesquisa do catálogo local enquanto as entradas estiverem vigentes. Os indicadores requerem Internet ou resultados já guardados na sessão.

## Supabase Auth e PostgreSQL

1. Para desenvolvimento isolado, use Docker e a CLI Supabase v3. A partir da raiz da branch, execute `npx supabase@3.2.0 start`. O projecto local aplica as migrations e capta as mensagens de Auth no Mailpit, em `http://127.0.0.1:54324`. Para rever as URLs e a chave pública local, use `npx supabase@3.2.0 status`.
2. Copie `.env.example` para `.env.local`. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com a URL e a chave **publicável** do projecto de teste. A chave antiga `anon`, com o papel `anon`, também é suportada. Reinicie o Vite.
3. Para um projecto alojado de testes, aplique as migrations por ordem e teste com papéis distintos. Use o projecto, a URL e as permissões confirmadas do ambiente de testes. O operador da equipa deve rever o plano de migrations antes de qualquer execução em produção.
4. Em Auth, active o registo por e-mail e a confirmação. Configure uma URL da SPA terminada em `/`, por exemplo a raiz publicada `https://k6n9.github.io/rumocerto-mz/`, e permita os redireccionamentos exactos dessa URL com `?type=email` ou `?type=recovery`. Em desenvolvimento, inclua o localhost autorizado.
5. Para confirmação e recuperação noutro dispositivo, copie os conteúdos de `supabase/templates/` para os templates de confirmação e recuperação. O fragmento mantém o token fora da requisição inicial ao alojamento. A SPA limpa o URL antes de verificar o token. Teste as duas ligações com o rastreio de links desactivado no SMTP. Com o template padrão e PKCE, a troca de código usa o navegador que iniciou o pedido.
6. O SMTP alojado padrão do Supabase tem restrições de destinatários e limites baixos. Para aceitar registos do público, configure um SMTP autorizado, dentro da modalidade gratuita acordada. Confirme a entrega no ambiente de teste antes de abrir registos. [Configuração do SMTP no Supabase](https://supabase.com/docs/guides/auth/auth-smtp)
7. Configure a primeira conta administrativa de acordo com o [guia do administrador](GUIA_ADMIN.md). As migrations não incluem credenciais ou utilizadores iniciais.

A chave publicável e a URL do projecto podem ir no frontend. Guarde a chave `service_role` ou `sb_secret_…` exclusivamente no ambiente do Worker. Variáveis com prefixo `VITE_` são incluídas no JavaScript publicado.

## Worker e e-mail de planos

`VITE_WORKER_URL` é a raiz HTTPS do Worker, sem `/api`. Em testes locais o frontend pode apontar a `http://127.0.0.1:8787`; inclua a origem exacta do Vite em `ALLOWED_ORIGINS`. Com `npm run worker:dev`, consulte `/api/saude`. O contrato aceite é `{ ok: true, versao: "3.5", envioDisponivel: boolean }`.

| Variáveis no Worker | Finalidade |
| --- | --- |
| `PUBLIC_WORKER_URL`, `ALLOWED_ORIGINS` | URL pública para ligações assinadas e origens CORS autorizadas. |
| `RATE_SALT`, `DOWNLOAD_SECRET` | Segredos aleatórios independentes, de pelo menos 16 e 24 caracteres respectivamente. |
| `EMAILJS_SERVICE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY`, `EMAILJS_TEMPLATE_CONFIRM`, `EMAILJS_TEMPLATE_PLAN` | Serviço, credenciais e dois templates de plano. Configure a chave privada quando habilitada nas definições de segurança do EmailJS. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Personalização opcional. O valor de referência é `gemini-3.5-flash-lite`. |

O primeiro template recebe `to_email`, `nome`, `area`, `situacao`, `objetivo`, `disponibilidade`, `internet`, `usar_ia`, `passos`, `notas`, `subject` e `prazo`. O segundo recebe `to_email`, `nome`, `titulo_plano`, `resumo_plano`, `metodo`, `link_pdf`, `area`, `situacao`, `objetivo`, `disponibilidade`, `internet` e `prazo`. Defina o destinatário como `{{to_email}}`. O botão do segundo template usa `{{link_pdf}}`. Os PDFs são acessíveis por ligação assinada durante a retenção do pedido, até sete dias. [API REST do EmailJS](https://www.emailjs.com/docs/rest-api/send/)

Os Durable Objects `PLANOS` e `LIMITES` mantêm a migration `v3_3_sqlite`. A v4 conserva o protocolo 3.5. A resposta do Worker publicado já era incompatível com o frontend v3.6. Veja a evidência em [Verificação dos serviços](VERIFICACAO_SERVICOS.md).

## Alertas agendados e resumos

1. O cron tem periodicidade de 15 minutos. Para processamento interno habilite `ALERTAS_AGENDADOS=true`, configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` e confirme a opção correspondente no painel.
2. Para resumos, configure também `PUBLIC_APP_URL` com a raiz HTTPS da SPA, `EMAILJS_TEMPLATE_RESUMO`, os valores EmailJS acima e `EMAILJS_RESUMO_LIMITE_DIA`. Reserve capacidade para os e-mails de plano e escolha um limite diário compatível com a quota real da conta.
3. Use `{{to_email}}` como destinatário e `{{subject}}` como assunto. No corpo, use `{{total_alertas}}`, `{{link_alertas}}` e `{{link_preferencias}}`. O segundo link permite retirar o consentimento depois de entrar. Active `RESUMOS_EMAIL=true` e a opção correspondente no painel só após autorização e teste de recepção. O utilizador também tem de dar consentimento.
4. O resumo entra na fila a partir das 08h00 de segunda-feira em Maputo. Cada cron tenta até um envio, com limite diário transaccional. As tentativas das duas mensagens de plano partilham a quota do fornecedor quando usam a mesma conta. O EmailJS documenta um pedido por segundo. A fila semanal e a quota diária reduzem os pedidos de resumo e a equipa acompanha eventuais recusas.

Nos testes locais mantenha `RESUMOS_EMAIL=false` e use uma caixa de captura para Auth. Os ficheiros `.env.local` e `backend/.dev.vars` são ignorados pelo Git. O Worker não depende de listas de serviços pagos. Confirme os limites actuais de Cloudflare, Supabase, EmailJS e Gemini no painel de cada fornecedor. [Limites do Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits/) · [Modelos Gemini](https://ai.google.dev/gemini-api/docs/models)

## Publicação após aprovação

A equipa configura GitHub Pages com GitHub Actions. Defina `VITE_WORKER_URL`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` como variáveis do repositório. O workflow compila e testa a branch de desenvolvimento e os pull requests para `main`. O job de publicação só corre em `main`. A base Vite é o nome do repositório e o Vue Router usa hash. Valide o ambiente de teste primeiro e confirme os resultados antes de aprovar um PR de publicação.
