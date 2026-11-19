# Estado da entrega · RumoCerto MZ 4.0

Branch autorizada `mabikane/rumocerto-v4`, base `fb02285`. Verificação em 19 de Novembro de 2026, hora de Maputo.

A implementação integra área pública, área pessoal e administração. A área pública conserva os indicadores, o plano de regras, o progresso local, o PDF, Sobre e 404. A v4 acrescenta o catálogo verificado, a preparação profissional e o calendário de 30 actividades. Os módulos privados incluem perfil, planos guardados, favoritos, CV, candidaturas, RumoMatch, notificações e gestão de dados. A administração usa autorização e RLS no PostgreSQL, com auditoria e relatórios agregados.

## Verificação e pendências

- **Execução local.** 81 testes e subtestes, verificação de sintaxe, compilação de produção, seis percursos em Chrome e um percurso contra GoTrue, PostgREST, Mailpit e PostgreSQL locais aprovados. O Supabase isolado confirmou os tokens por fragmento, rejeitou estruturas inválidas, preservou os planos de 20 e 30 tarefas e reabriu o progresso noutra sessão. O Wrangler empacotou o Worker com os dois Durable Objects e a verificação em loopback aprovou saúde e CORS.
- **Produção observada.** GitHub Pages respondeu e navegou a 390 px na versão publicada. O Banco Mundial devolveu as três séries de Moçambique. O Worker publicado respondeu sem os campos de contrato necessários ao envio de planos. A resposta local está conforme o protocolo 3.5.
- **Configuração pendente.** Confirmar projecto Supabase alojado, Auth e SMTP, permissões do ambiente alojado e carregamento do catálogo remoto. Repetir no ambiente autorizado a validação de sincronização executada localmente. Configurar e verificar EmailJS, Gemini opcional e execução recorrente do Worker com consentimento e limites acordados. Os resultados por serviço estão na [matriz](VERIFICACAO_SERVICOS.md).
- **Fluxogramas.** Funcionamento Geral, Percurso do Jovem, RumoMatch e Alertas, Administração e Arquitectura Técnica têm cobertura mapeada pelo prompt. A conformidade de cada um dos cinco fica pendente dos originais Draw.io. Nenhum nó ou transição de diagrama foi presumido.
- **Limitações conhecidas.** A cópia pública local expira sem revisão editorial. O catálogo remoto começa por moderação humana e a pesquisa vazia permite consultar separadamente a cópia local. O detalhe das fichas antigas permanece em leitura quando há catálogo remoto. A comparação agendada analisa um conjunto limitado de anúncios por invocação. A cópia entre dispositivos exige guardar o plano na conta. A eliminação definitiva é um procedimento da equipa após o pedido.

O candidato destina-se à revisão na branch de desenvolvimento. Os ensaios de escrita foram executados em serviços locais isolados. A sequência de publicação oficial depende da revisão do Grupo 8 e da verificação das integrações alojadas.

## Testar e rever

```bash
npm ci
npm run dev
npm test
npm run check:syntax
npm run build
npm run test:browser
```

O [guia de configuração](CONFIGURACAO_AMBIENTE.md) contém o procedimento de teste com Supabase e Cloudflare. A [matriz de requisitos](REQUISITOS_E_FLUXOGRAMAS.md) liga os módulos aos casos de validação. O [guia administrativo](GUIA_ADMIN.md) cobre o operador inicial e moderação.

Para a revisão do Grupo 8, verifiquem primeiro o contrato do Worker, a separação entre duas contas e o administrador, a contagem de alertas repetidos e o catálogo nas dimensões móveis. Juntem os cinco Draw.io à documentação e confrontem os nós de decisão e os caminhos de erro. Confirmem também a entrega do BRD em PDF e os identificadores académicos da equipa exigidos pelo enunciado.

O workflow executa testes e build no push da branch de desenvolvimento e em pull requests para `main`. O Grupo 8 pode consultar os checks no GitHub e usar esta documentação para rever as pendências antes da integração.

## Inventário dos ficheiros face a `origin/main`

### Criados (51)

- `backend/alertas.js`
- `backend/email.js`
- `docs/ARQUITECTURA_V4.md`
- `docs/AUDITORIA_FINAL_V4.md`
- `docs/AUDITORIA_V36.md`
- `docs/CONFIGURACAO_AMBIENTE.md`
- `docs/ESTADO_FINAL_V4.md`
- `docs/GUIA_ADMIN.md`
- `docs/REQUISITOS_E_FLUXOGRAMAS.md`
- `docs/TESTES_V4.md`
- `docs/VERIFICACAO_SERVICOS.md`
- `scripts/validarAmbientePublico.js`
- `shared/chavePublicaSupabase.js`
- `shared/configuracao.js`
- `shared/contratoPlano.js`
- `shared/curriculo.js`
- `shared/oportunidades.js`
- `shared/rumomatch.js`
- `src/assets/dados/oportunidades.json`
- `src/assets/styles/v4.css`
- `src/components/CampoTexto.vue`
- `src/components/EstadoRecurso.vue`
- `src/components/OportunidadeCard.vue`
- `src/composables/useRecurso.js`
- `src/router/acesso.js`
- `src/services/dados.js`
- `src/services/supabase.js`
- `src/views/AdminView.vue`
- `src/views/AutenticacaoView.vue`
- `src/views/CandidaturasView.vue`
- `src/views/ContaView.vue`
- `src/views/CorrespondenciasView.vue`
- `src/views/CurriculoView.vue`
- `src/views/DefinicoesView.vue`
- `src/views/NotificacoesView.vue`
- `src/views/OportunidadeView.vue`
- `src/views/OportunidadesView.vue`
- `src/views/PerfilView.vue`
- `src/views/PreparacaoView.vue`
- `supabase/config.toml`
- `supabase/migrations/202611190001_rumocerto_v4.sql`
- `supabase/migrations/202611190002_percurso_alertas.sql`
- `supabase/migrations/202611190003_configuracao_admin.sql`
- `supabase/migrations/202611190004_contrato_plano.sql`
- `supabase/templates/confirmacao.html`
- `supabase/templates/recuperacao.html`
- `tests/ambiente-publico.test.js`
- `tests/base-v4.test.js`
- `tests/navegador.mjs`
- `tests/supabase-local.mjs`
- `tests/v4.test.js`

### Modificados (31)

- `.env.example`
- `.github/workflows/deploy.yml`
- `.gitignore`
- `README.md`
- `backend/.dev.vars.example`
- `backend/worker.js`
- `backend/wrangler.toml`
- `index.html`
- `package-lock.json`
- `package.json`
- `shared/pdf.js`
- `shared/persistencia.js`
- `shared/planner.js`
- `shared/versao.js`
- `src/App.vue`
- `src/assets/styles.css`
- `src/components/AppFooter.vue`
- `src/components/AppHeader.vue`
- `src/components/WeekCard.vue`
- `src/composables/useIndicador.js`
- `src/composables/usePlano.js`
- `src/main.js`
- `src/router/index.js`
- `src/views/InicioView.vue`
- `src/views/PlanoView.vue`
- `src/views/ProgressoView.vue`
- `src/views/SobreView.vue`
- `tests/api.test.js`
- `tests/estado.test.js`
- `tests/plano.test.js`
- `vite.config.js`
