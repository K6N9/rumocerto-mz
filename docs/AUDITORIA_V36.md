# Auditoria inicial da v3.6

Verificação de 19 de Novembro de 2026. A cópia aberta continha a versão 3.6.0, com todos os ficheiros iguais aos da branch local `mabikane/rumocerto-v4` em `fb02285`. A pasta aberta veio sem metadados Git. A auditoria associou-a aos metadados de um clone isolado da branch e desconsiderou diferenças de permissões do ZIP. A árvore de conteúdos inicial estava limpa.

| Área | Estado inicial e evidência | Trabalho da v4 |
| --- | --- | --- |
| Frontend e rotas | Vue 3, sete vistas, navegação por hash e 404. Vite com base para Pages. Planos e progresso acessíveis publicamente. | Acrescentar catálogo, preparação e áreas autenticadas. Corrigir salto de acessibilidade em rotas por hash e navegação móvel com mais destinos. |
| Indicadores | Três séries MOZ, cache de uma hora em memória e sessionStorage, recuperação do último valor, gráfico, tabela e CSV. | Preservar e verificar as três respostas reais. Adicionar prazo de rede e evitar mostrar dados de outra série após falha. |
| Planos | Composable, perfis especializados, geração local, quatro semanas, tarefas, progresso e validação de dados locais. Apenas um plano guardado por navegador. | Preservar v3, continuar planos guardados e sincronizar explicitamente com a conta. |
| PDF | Gerador próprio para o browser e Worker, com fonte Unicode opcional e fonte Helvetica de reserva. | Reutilizar paginação e saída PDF no CV. Verificar abertura e caracteres portugueses. |
| Worker | CORS por origem, protocolo 3.5, dois Durable Objects SQLite, limites, alarmes, tokens de estado e PDF assinado. Testes com fornecedores simulados. | Preservar contratos e validar saúde publicada. Separar a fila de resumos do fluxo de e-mail de plano. |
| E-mail e Gemini | EmailJS no backend com dois templates e consentimento por pedido. Gemini opcional com fallback local. | Verificar configuração observável sem envio. Implementar consentimento independente para resumos. |
| Persistência e segurança | Estado de plano validado em localStorage e token temporário em sessionStorage. Sem contas, permissões remotas ou área administrativa. | Isolar contas com Auth/RLS e separar rascunho público dos planos de conta. |
| Módulos ausentes | Catálogo verificado, perfis, favoritos, correspondência, CV, candidaturas, preparação, alertas e administração. | Implementar com migrations, rotas e testes. |
| CI | Actions verifica e compila PRs para main. A publicação disparava também por execução manual noutras branches. | Restringir job de publicação a main e passar configuração pública do Supabase. |

`npm test` na base executou 60 testes, com 59 aprovados e um ignorado por falta da fonte TrueType de teste. `npm run check:syntax` passou. A primeira compilação falhou por ausência de dependências. Após `npm ci --offline`, `npm run build` passou com Vite 6.4.6.

Os cinco ficheiros Draw.io não foram encontrados no checkout, no clone vizinho, na pasta do projecto nem nos ZIPs consultados. A implementação usa o prompt mestre como fonte disponível. A reconciliação com os diagramas fica pendente.
