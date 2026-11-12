# Guião de demonstração — Grupo 8 (Programação Web II)

**Objectivo:** provar funcionamento real, sem activar serviços pagos.

1. Abrir no GitHub Pages a página inicial e mostrar o logótipo, navegação mobile-first, contacto e identidade RumoCerto MZ.
2. Ir a **Indicadores**. Mostrar os três dados de Moçambique carregados por `fetch` do Banco Mundial, navegar ao detalhe, consultar evolução e exportar CSV. Desligar Internet momentaneamente e explicar estados de erro/cache.
3. Ir a **O meu plano**. Escolher «Tecnologia e engenharia», «Estudante», «3 a 5 horas por semana» e «Acesso limitado a dados móveis», com um objectivo realista. Mostrar prévia de quatro semanas e exportação PDF. Explicar que não exige nenhuma chave de IA nem pagamentos.
4. Com Worker e EmailJS preparados, introduzir **o próprio e-mail de teste**, autorizar os envios e submeter. Abrir o primeiro e-mail; verificar correspondência das escolhas.
5. Mostrar a fila de pedidos no KV (sem revelar dados pessoais em público) e o cron. Fechar navegador, aguardar 5 a 7 minutos, verificar segundo e-mail recebido. Testar o link protegido e o PDF por ligação privada (EmailJS Free não suporta anexo).
6. Mostrar no código o composable, as rotas, componentes props/emits, o Worker sem segredos no GitHub, testes `npm test` e GitHub Actions.
7. Mostrar os três branches individuais, commits e pull requests aprovados por outro membro.
8. Exibir BRD final com fontes oficiais, amostra real do estudo e links funcionais.

**Explicar limites:** O objectivo é apoio educativo, não garantia de emprego; a IA Gemini é opcional e pode usar quota gratuita. O plano é gerado sem IA se necessário. O cron executa aproximadamente a cada dois minutos; prazo é de cerca de 5–7 minutos, podendo atrasar. Os limites do EmailJS e Cloudflare têm de ser respeitados.
