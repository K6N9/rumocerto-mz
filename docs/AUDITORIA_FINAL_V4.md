# Auditoria final de qualidade, segurança e integração

**Data:** 19 de Novembro de 2026, hora de Maputo. **Candidato:** `mabikane/rumocerto-v4`, base `fb02285`, no clone `rumocerto-mz-codex`. O inventário comparado com `origin/main` está no [relatório v4](ESTADO_FINAL_V4.md). Os testes usaram os conteúdos do candidato, uma stack Supabase isolada e um Worker de loopback.

**Estado após as correcções:** o candidato cobre a preservação do progresso, o bloqueio de credenciais antes do build, a validação de planos, o contrato Worker 3.5, o transporte do token de Auth por fragmento e a leitura dos links antigos do catálogo. Foram repetidas as consultas públicas ao Pages, Banco Mundial e Worker. As restantes integrações alojadas aguardam confirmação do operador.

## Achados e estado da correcção

| Prioridade | Achado na auditoria | Estado após as correcções |
| --- | --- | --- |
| Alta | **Contrato incompatível no Worker publicado.** `/api/saude` devolve HTTP 200 com `ok` e `gratuito`, mas sem `versao` nem `envioDisponivel`. No preflight de `GET /api/planos/{id}`, a resposta permite `Content-Type` e omite `Authorization`. A v4 mantém o envio desactivado e o navegador não pode fazer a consulta autenticada de estado nessa origem. | **Corrigido no código local.** Saúde tipada, preflight com `Authorization` e validação de pedidos verificados. O Worker publicado aguarda conferência da implantação activa e promoção autorizada. |
| Alta | **Perda de progresso ao voltar a gerar um plano v3.6 com o mesmo perfil.** Um plano existente reabre com 2/20 tarefas concluídas. A v3.6 mantém 2/20 ao voltar a gerar. A v4 substitui as tarefas e passa para 0/30 ao carregar em «Gerar plano», sem confirmação nesse caminho. `src/views/PlanoView.vue` e `shared/estado.js`. | **Corrigido localmente.** A regeneração mantém o plano antigo. A conversão exige confirmação, arquiva o original e transfere apenas as conclusões das tarefas copiadas. O original e o convertido podem ser reabertos. |
| Alta | **Protecção de secrets insuficiente no build.** A validação feita no navegador em `src/services/supabase.js` ocorre depois de o Vite incorporar o valor de `VITE_SUPABASE_PUBLISHABLE_KEY`. Um marcador fictício com prefixo de chave privada apareceu num ficheiro do bundle. A auditoria também confirmou que `backend/.dev.vars.staging` e `.dev.vars` na raiz não são ignorados. | **Corrigido localmente.** O Vite valida o ambiente resolvido antes de gerar artefactos. Testes com canário de CI e variante `.env` falharam antes de emitir o bundle e expuseram só o nome da variável. As variantes `.dev.vars` são ignoradas. |
| Média | **Validação do plano diverge entre API e UI.** Na Data API local, `guardar_plano` aceitou um título e quatro semanas com tarefas, sem os demais campos exigidos por `planoValido`. O titular fica com um registo que a interface não consegue reabrir. `supabase/migrations/202611190002_percurso_alertas.sql` e `shared/persistencia.js`. | **Corrigido localmente.** A migration aditiva `202611190004_contrato_plano.sql` aplica o contrato das novas escritas ao nível da tabela. PGlite e PostgREST recusaram planos inválidos. Planos de 20 e 30 tarefas válidos continuam aceites. |
| Média | **O token de confirmação e recuperação seguia na query para o alojamento.** A SPA removia a credencial depois da verificação. | **Corrigido no candidato.** Os templates novos usam o fragmento. A SPA limpa o URL antes de invocar o Auth e aplica `no-referrer`. Chrome e Mailpit confirmaram as duas operações. Os URLs antigos são aceites e limpos pela SPA. O primeiro GET de uma ligação antiga ainda leva a query. |
| Média | **A activação do Supabase tornava os detalhes com slug indisponíveis.** Um catálogo remoto vazio também interrompia a descoberta no catálogo local. | **Corrigido no candidato.** Mantém-se o detalhe em leitura para as fichas vigentes. A pesquisa remota vazia oferece acesso explícito à cópia local. Os favoritos, as candidaturas associadas e o RumoMatch continuam a usar o catálogo moderado. A revisão e publicação de fontes remotas é responsabilidade editorial. |

## Segurança e migrations

A pesquisa cobriu 96 ficheiros do candidato, 34 ficheiros do bundle público local e 143 blobs de sete commits alcançáveis nas referências locais. Procurou chaves privadas, tokens comuns de fornecedores, JWTs, passwords em cadeias de ligação e valores de variáveis sensíveis. A pesquisa não identificou credenciais reais nos ficheiros do candidato nem no bundle público local. Os modelos actuais têm campos sensíveis vazios. Os identificadores de serviço, de template e de aplicação são públicos. A revisão dos candidatos históricos considerou o contexto dos exemplos, sem imprimir valores. O resultado não abrange a configuração efectiva de Actions, os secrets no Cloudflare nem as máquinas de outros membros. `npm audit` devolveu zero alertas para o lockfile consultado.

As quatro migrations foram aplicadas numa base PostgreSQL isolada e no PGlite. A nova migration acrescenta um trigger de validação para novas escritas. Planos existentes mantêm os seus dados. São transaccionais, criam tabelas e políticas e incluem regras de eliminação em cascata para dados do titular quando uma conta for efectivamente removida. Os testes observaram isolamento entre titulares, protecção do CV mesmo face ao moderador da aplicação, negação de moderação anónima, auditoria de publicações e alertas sem duplicação. As rotinas privilegiadas relevantes fixam `search_path` e verificam a identidade ou o papel. Um teste compara a definição do contrato em JavaScript e SQL e verifica os veredictos nos dois ambientes. Num projecto alojado, o responsável deve verificar conflitos de esquema, privilégios efectivos, cópia de segurança e estado da lista de migrations antes da aplicação.

## Matriz de estado

| Funcionalidade | Estado | Evidência e alcance |
| --- | --- | --- |
| Site publicado e navegação por hash da versão existente | Funcional e testado | Chrome a 390 px abriu o menu, indicadores e detalhe por URL directa. |
| Três séries de Moçambique e transformação do Banco Mundial | Funcional e testado | Consultas HTTP deram 35 observações válidas por série após normalização. O último ano observado foi 2025 nas três. |
| Plano integralmente novo, progresso persistente, PDF local e reabertura v3.6 | Funcional e testado | Chrome, testes de persistência e validação de PDF. A reabertura conserva as conclusões anteriores. |
| Catálogo de reserva, pesquisa, detalhe e preparação | Funcional e testado | Chrome testou filtro e detalhe a 390 px. O catálogo de reserva caduca e depende de revisão editorial. |
| Auth, perfil e sincronização de plano | Funcional apenas localmente | GoTrue, Mailpit, PostgREST e duas sessões Chrome na stack de auditoria. |
| CV, favoritos, candidaturas, moderação, RLS e notificações internas | Funcional apenas localmente | Chrome e Data API testaram fluxos e papéis distintos. Duas execuções de alertas geraram uma única correspondência e zero envios. |
| Configuração alojada do Supabase, SMTP e catálogo moderado | Pendente de configuração | A configuração, acesso de operador e conteúdo editorial do projecto alojado não foram verificados. |
| Entrega por EmailJS, consulta de estado e PDFs assinados em produção | Pendente de configuração | O Worker local satisfaz a saúde e o CORS. Testes de envio usam fornecedores simulados. |
| Gemini e resumo semanal em produção | Pendente de configuração | Fallback local e lógica da fila testados. A entrega real e as quotas exigem teste autorizado. |
| Conversão da v3.6 que preserve tarefas concluídas | Funcional e testado | Chrome confirmou cancelamento, 2/20 no original, 2/30 na conversão e reabertura do original. PostgREST confirmou dois registos distintos na conta. |
| Bloqueio de chaves privadas antes do build público | Funcional e testado | Formatos privados fictícios foram recusados. Chave publicável e JWT `anon` foram admitidos. |
| Confirmação e recuperação por fragmento | Funcional apenas localmente | Auth e Mailpit verificaram as mensagens novas. A activação dos templates alojados aguarda configuração. |
| Eliminação automática de contas após pedido | Não implementado | O titular pode pedir a eliminação e o operador trata o pedido no procedimento administrativo. |

## Matriz Draw.io

A pesquisa no checkout, em `docs/arquitectura/`, nas pastas do projecto e nas referências Git locais não encontrou os ficheiros originais. A [matriz de requisitos escritos](REQUISITOS_E_FLUXOGRAMAS.md) mapeia os casos executáveis.

| Diagrama | Requisitos do projecto testados independentemente | Conformidade com o ficheiro |
| --- | --- | --- |
| Funcionamento Geral | Navegação pública, indicadores, catálogo, plano e PDF | Pendente do original |
| Percurso do Jovem | Auth, perfil, plano, progresso, CV, favoritos, candidaturas e definições | Pendente do original |
| RumoMatch e Alertas | Pontuação explicada, persistência, leitura e deduplicação de notificações | Pendente do original |
| Administração | Papel, validação de fontes, auditoria e estatísticas agregadas | Pendente do original |
| Arquitectura Técnica | Deploy de Pages condicionado à branch, RLS e contrato local do Worker | Pendente do original |

## Cloudflare Worker e preservação de estado

| Verificação | Publicado | Local |
| --- | --- | --- |
| `GET /api/saude` | HTTP 200 com `{"ok":true,"aplicacao":"RumoCerto MZ","gratuito":true}` | HTTP 200 com `{"ok":true,"aplicacao":"RumoCerto MZ","versao":"3.5","envioDisponivel":false}` |
| `OPTIONS /api/planos/{id fictício}` com origem Pages e pedido de `Authorization` | HTTP 204 com `Access-Control-Allow-Headers: Content-Type` | HTTP 204 com `Access-Control-Allow-Headers: Content-Type, Authorization` |

1. O responsável Cloudflare confirma o ID da versão activa, a conta, o script `rumocerto-mz-api`, o histórico de migrations e os IDs e tipo de armazenamento dos namespaces. O contrato público por si só não identifica o backend instalado. Se os bindings `PLANOS/PlanoJob` e `LIMITES/LimiteEnvios` e a migration `v3_3_sqlite` já corresponderem à configuração, manter os nomes, os IDs, o tipo e a sequência de migrations. Se houver outro armazenamento ou histórico, interromper a substituição e ensaiar um Worker paralelo no ambiente de teste. Inventariar e preservar o serviço legado enquanto existirem pedidos ou ligações válidas.
2. Preparar a recuperação do protocolo como alteração separada do cron v4. Manter `DOWNLOAD_SECRET` e `RATE_SALT` para preservar as assinaturas de PDF, tokens e chaves de limitação. Conferir os nomes das credenciais EmailJS, os valores públicos de `PUBLIC_WORKER_URL` e `ALLOWED_ORIGINS`, e os bindings no painel. `--keep-vars` protege variáveis configuradas no painel. Os secrets existentes são preservados pelo Wrangler, desde que se opere no Worker e ambiente correctos. Manter resumos desactivados até à aprovação específica. [Wrangler](https://developers.cloudflare.com/workers/wrangler/commands/workers/) · [Secrets Cloudflare](https://developers.cloudflare.com/workers/configuration/secrets/)
3. Testar o contrato completo em ambiente isolado com `ok === true`, `versao === '3.5'` e `envioDisponivel === true` apenas quando os recursos necessários estão configurados. Incluir respostas antigas, booleanos inválidos, origem rejeitada, estado com bearer, alarmes, PDF assinado e idempotência. O estado de saúde indica configuração e deve ser complementado por um teste de entrega autorizado. Uma versão de Worker não inclui um snapshot dos dados dos Durable Objects. Se houver mudança de ciclo de vida, preparar a estratégia de recuperação de dados separadamente. [Versões do Worker](https://developers.cloudflare.com/workers/versions-and-deployments/) · [Ciclo de vida dos Durable Objects](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)

## Comandos seguros e responsáveis

Comandos locais para repetir as verificações na branch candidata:

```bash
git branch --show-current
git status --short --branch
git diff --check
npm ci
npm test
npm run check:syntax
npm run test:browser
GITHUB_PAGES_BASE=/rumocerto-mz/ npm run build
npm audit
```

O responsável pelo Supabase pode reproduzir a configuração num checkout de testes com Docker, sem usar um projecto remoto ligado. Preencha `.env.local` com a URL e **chave publicável do ambiente de teste**. Aplique os templates por fragmento e verifique o comportamento do SMTP. Use `npm run test:auth-local` com as variáveis do [guia de testes](TESTES_V4.md).

```bash
test -e .env.local || (umask 077; cp .env.example .env.local)
npx supabase@3.2.0 start
npx supabase@3.2.0 migration list --local
npx supabase@3.2.0 status
npm run dev -- --host 127.0.0.1
```

O proprietário Cloudflare, autenticado na conta correcta, pode executar a verificação abaixo. Guarde os resultados de configuração em local privado. O dry-run apenas empacota. As consultas seguintes mostram a identidade, a versão activa e os nomes dos secrets.

```bash
qa_out=$(mktemp -d)
./node_modules/.bin/wrangler deploy --dry-run --keep-vars \
  --config backend/wrangler.toml --outdir "$qa_out"

./node_modules/.bin/wrangler whoami
./node_modules/.bin/wrangler deployments status --name rumocerto-mz-api --config backend/wrangler.toml
./node_modules/.bin/wrangler secret list --name rumocerto-mz-api --config backend/wrangler.toml

curl -fsS -H 'Origin: https://k6n9.github.io' \
  https://rumocerto-mz-api.k3n4.workers.dev/api/saude

curl -fsS -o /dev/null -D - -X OPTIONS \
  -H 'Origin: https://k6n9.github.io' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization' \
  https://rumocerto-mz-api.k3n4.workers.dev/api/planos/00000000-0000-0000-0000-000000000000
```

Depois de uma futura publicação aprovada, as verificações devem mostrar `versao: "3.5"`, um booleano em `envioDisponivel` e `Authorization` nos cabeçalhos permitidos. A equipa verifica a entrega real num ensaio autorizado antes de divulgar a funcionalidade.

O Grupo 8 deve nomear os responsáveis pelos dois ambientes, reunir os Draw.io, rever as correcções do candidato e autorizar em separado o teste de entrega com os fornecedores. A publicação fica condicionada à aprovação das correcções na branch, confirmação da configuração alojada e revisão dos cinco fluxogramas.

## Evidência de execução

- `npm test`: 81/81. `npm run check:syntax`: aprovado. Build de produção com a base do GitHub Pages e build com chave publicável de teste aprovados.
- Chrome local, 6/6. O percurso v3.6 verificou localStorage, cancelamento, conversão, reabertura e conclusões exactas. Os demais cobriram navegação móvel, PDFs, formulários, conta, administração, notificações, favoritos e as correcções de Auth e catálogo.
- Supabase CLI 3.2.0 local, 1/1. PostgREST recusou a estrutura inválida com `22023`. A base manteve o original de 20 tarefas e guardou o convertido de 30 noutro ID. O percurso confirmou Auth e recuperação em novos contextos, com tokens no fragmento e sem credenciais nos GET do alojamento. Mailpit reteve as mensagens.
- Workerd: saúde 3.5 e preflight 204 com `Authorization`. Estado sem bearer 401, origem não autorizada 403 e pedido de envio com a configuração desactivada 503. A validação de pedidos e a entrega usam testes com Durable Objects e fornecedor simulados.
- Wrangler 4.160.1: dry-run aprovado com `PLANOS/PlanoJob` e `LIMITES/LimiteEnvios`. A configuração do Worker, a tag `v3_3_sqlite` e as três migrations anteriores têm os mesmos conteúdos da auditoria.
- GitHub Pages, Banco Mundial e Worker foram consultados novamente por HTTP. As três séries do Banco Mundial contêm 35 observações utilizáveis cada. A versão servida pelo Pages é a anterior. O Worker publicado mantém o contrato legado e o preflight sem `Authorization`.

## Ficheiros desta correcção

| Área | Ficheiros |
| --- | --- |
| Planos | `shared/planner.js`, `shared/persistencia.js`, `src/composables/usePlano.js`, `src/views/PlanoView.vue`, `src/views/ProgressoView.vue` |
| Contrato | `shared/contratoPlano.js`, `supabase/migrations/202611190004_contrato_plano.sql` |
| Build | `.gitignore`, `package.json`, `vite.config.js`, `scripts/validarAmbientePublico.js`, `shared/chavePublicaSupabase.js`, `src/services/supabase.js` |
| Worker | `backend/worker.js`, `shared/versao.js`, `src/views/AdminView.vue` |
| Auth e catálogo | `index.html`, `src/main.js`, `src/services/supabase.js`, `src/services/dados.js`, `src/views/OportunidadeView.vue`, `src/views/OportunidadesView.vue`, `supabase/templates/confirmacao.html`, `supabase/templates/recuperacao.html` |
| CI | `.github/workflows/deploy.yml` |
| Testes | `tests/ambiente-publico.test.js`, `tests/api.test.js`, `tests/base-v4.test.js`, `tests/estado.test.js`, `tests/navegador.mjs`, `tests/supabase-local.mjs` |
| Documentação | `README.md`, `docs/AUDITORIA_FINAL_V4.md`, `docs/ARQUITECTURA_V4.md`, `docs/CONFIGURACAO_AMBIENTE.md`, `docs/ESTADO_FINAL_V4.md`, `docs/TESTES_V4.md`, `docs/VERIFICACAO_SERVICOS.md` |
