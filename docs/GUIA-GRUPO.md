# Guia de trabalho — Grupo 8

## Estado do projecto

Tema escolhido: **RumoCerto MZ — orientação profissional**. A aplicação foca jovens moçambicanos e utiliza dados do Banco Mundial para contextualizar o emprego juvenil. Não confundir o público-alvo do inquérito (sugestão: 18–30 anos, estudantes e recém-formados) com o indicador estatístico (15–24 anos, força de trabalho).

## Verificação dos requisitos

- R1 Vue 3/Vite/SFC/Composition API: código preparado.
- R2 API/dados MOZ/fetch, loading/erro/vazio/cache: código preparado; falta teste em navegador com Internet.
- R3 — confirmação por EmailJS **já foi demonstrada na versão 1.1**; na versão 2.0, **PENDENTE testar** dois templates, Worker Cron, PDF e recepção do segundo e-mail após cerca de cinco minutos.
- R4 Funcionalidade/GitHub Pages: **PENDENTE compilar v2 no Mac e publicar**.
- R5 Repositório público e README: README preparado, **PENDENTE de publicar**.
- R6 Cada membro com branch/commit/PR/revisão: **PENDENTE de contribuição individual real**.
- BRD 4–8 páginas (sem capa/referências): **PENDENTE de documentação final e inquérito**.

## Recolha de opinião — amostra exploratória

Proposta: 30–60 jovens adultos de 18–30 anos de Maputo e Matola, recrutados por conveniência. Não usar este método para afirmar resultados representativos de todo Moçambique. Não recolher nome, e-mail ou telefone na amostra sem necessidade.

Perguntas sugeridas:
1. Idade (faixa 18–21; 22–25; 26–30).
2. Situação (estudante; recém-formado; empregado; à procura de trabalho).
3. Principal dificuldade na preparação profissional (CV; vagas; competências; entrevistas; contactos; outra).
4. Como procura informação sobre carreira actualmente?
5. Uma aplicação com indicadores e plano de acções seria útil? (escala 1–5).
6. Que funcionalidade prioritária recomenda?

## Checklist de aceitação do docente

- [ ] Testar `npm install`, `npm test`, `npm run build`.
- [ ] Conferir indicadores actualizados e fontes directamente no browser.
- [ ] Testar erro de rede e estado vazio.
- [ ] Conferir todas as rotas, rota por parâmetro e 404.
- [ ] Guardar, recarregar e limpar o formulário; testar prévia das quatro semanas, descarregar PDF e conferir a identidade visual.
- [ ] Configurar os dois templates EmailJS, Cloudflare Worker + KV + Cron e confirmar primeiro e segundo e-mail (testar após fechar o navegador).
- [ ] Verificar que não há credenciais privadas no repositório.
- [ ] Cada membro realizar commits e PR reais, com revisão por outro membro.
- [ ] Fazer deployment GitHub Pages, testar F5 em rota interna e versão mobile.
- [ ] Completar BRD com dados e fontes, 1–2 personas, indicadores mensuráveis.
- [ ] Preencher números de estudantes, nomes de utilizador e URLs no README/BRD.
- [ ] Conferir o prazo: 21/11/2026, às 23:59.
