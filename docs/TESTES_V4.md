# Testes da v4

## Comandos reproduzíveis

```bash
npm ci
npm test
npm run check:syntax
npm run build
npm run test:browser
```

O teste de navegador usa o Chrome instalado. Pode apontar para outro executável Chromium com `RUMOCERTO_CHROME`. Os testes de navegador abrem portas de loopback temporárias e interceptam os pedidos de teste. A variável opcional `RUMOCERTO_PDFS` recebe um directório existente para reter os PDFs de teste.

## Evidência local observada

- `npm ci`, `npm test` com 81 testes e subtestes, `npm run check:syntax` e o build de produção com `GITHUB_PAGES_BASE=/rumocerto-mz/` passaram. O build recusou credenciais fictícias privadas antes de emitir artefactos. A auditoria npm devolveu zero alertas para o lockfile consultado.
- `npm run test:browser` aprovou seis percursos em Chrome. Cobriu navegação móvel a 390 px e por teclado, filtros e detalhes, dados v3.6 e conversão, PDFs, limpeza de ligações Auth, catálogo vazio com acesso à cópia local, ecrãs pessoais e administração. Os percursos com API simulada executaram login, perfil, RumoMatch, favoritos, notificações, preferências, CV, candidaturas, restrição de acesso e validação de fonte e auditoria com papel de operador.
- `npm run test:auth-local` aprovou um percurso contra uma stack Supabase CLI 3.2.0 com PostgreSQL, PostgREST, GoTrue e Mailpit isolados. Os fragmentos de confirmação e recuperação funcionaram em novos contextos e os GET ao alojamento chegaram sem o token. PostgREST recusou o plano inválido com `22023`, preservou dois registos de 20 e 30 tarefas e reabriu o outro plano com 1 de 30 tarefas concluída numa nova sessão.
- O PGlite executa PostgreSQL real em WASM, com as funções de identificação do Supabase substituídas por fixtures de teste. Valida migrations, políticas, transacções, permissões de operador, anonimato, visibilidade cruzada, histórico e fila de notificações.
- Na auditoria anterior, o processamento de alertas do Worker foi invocado duas vezes contra a Data API da stack isolada. O estado ficou concluído e a fila ficou vazia.
- Wrangler empacotou o Worker com os dois Durable Objects em dry-run. O Worker local devolveu saúde 3.5 com envio desligado, preflight com `Authorization` e os códigos 401, 403 e 503 para pedidos fora das condições do contrato. Os testes do fluxo de e-mail utilizaram um fornecedor simulado.
- Chrome validou os dois downloads e os cabeçalhos dos ficheiros. Na auditoria anterior, PDFKit confirmou o plano com três páginas, o CV com uma e os caracteres portugueses.
- A página e os assets da versão publicada voltaram a responder por HTTP. A navegação do menu móvel e um detalhe acessado por hash foram verificados no Chrome na auditoria anterior.

PGlite foi acrescentado para testar RLS com um motor PostgreSQL reproduzível, sem configurar um serviço remoto no CI. Playwright Core exercita componentes Vue, navegação, teclado e downloads reais, usando um navegador separado e sem instalar um browser para cada execução. A biblioteca de testes de base continua a ser `node:test`.

## Executar o teste Auth real em localhost

Inicie a stack Supabase local e indique apenas a URL, a chave publicável e a URL do Mailpit devolvidas por `supabase status`. O teste recusa URLs remotas e cria uma conta fictícia.

```bash
RUMOCERTO_SUPABASE_URL=http://127.0.0.1:54321 \
RUMOCERTO_MAILPIT_URL=http://127.0.0.1:54324 \
RUMOCERTO_SUPABASE_CHAVE_PUBLICA='<CHAVE_PUBLICAVEL_LOCAL>' \
npm run test:auth-local
```

## Validação com um projecto de testes

1. Inicie o Supabase local com captura Mailpit ou use um projecto de testes autorizado. Confirme registo, confirmação, login, logout e recuperação em dois navegadores. Use e-mails de teste e mantenha o EmailJS de produção desactivado.
2. Registe dois titulares e um operador. Guarde perfil, plano, progresso, CV, favorito e candidatura na primeira conta. Abra o plano na segunda sessão do mesmo titular. Confirme separadamente que o segundo titular e o operador não conseguem ler os registos privados.
3. Adicione e verifique uma fonte no painel. Crie um rascunho e confirme que está ausente em sessão anónima. Publique, teste filtros e detalhes e arquive. Consulte a auditoria.
4. Actualize alertas duas vezes, confirme a chave única e marque notificações como lidas. Teste uma oportunidade com prazo próximo e um plano com tarefa pendente.
5. Quando autorizado, valide templates, limites e recepção dos e-mails com um destinatário de testes. Teste revogação do consentimento e monitorize os códigos de erro. Use uma chave Gemini de teste se a equipa activar a funcionalidade.
