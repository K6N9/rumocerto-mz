# RumoCerto MZ 4.0

**Projecto Final de Programação Web II · Grupo 8 · LECC31 · ISUTC · 2026**

Plataforma de orientação profissional para jovens moçambicanos. Reúne indicadores de desemprego juvenil do Banco Mundial, planos gratuitos de 30 dias e oportunidades com fonte verificada. A conta pessoal acrescenta perfil, progresso, RumoMatch, favoritos, CV em PDF, candidaturas e alertas.

- [Site público](https://k6n9.github.io/rumocerto-mz/)
- [Repositório do Grupo 8](https://github.com/K6N9/rumocerto-mz)
- [Estado e evidências da v4](docs/ESTADO_FINAL_V4.md)

As dificuldades de acesso a formação e a experiência profissional ajudam a explicar a necessidade de orientação e preparação para candidaturas. [Afrobarometer](https://www.afrobarometer.org/articles/os-jovens-mocambicanos-enfrentam-dificuldades-para-encontrar-emprego-afirmando-que-sao-prejudicados-pela-falta-de-formacao-e-de-experiencia-profissional/)

A v4 está em revisão na branch `mabikane/rumocerto-v4`. O GitHub Pages consultado em 19 de Novembro de 2026 serve uma versão anterior. A [auditoria final](docs/AUDITORIA_FINAL_V4.md) regista os testes e os requisitos para publicação.

## Executar localmente

Com Node.js 22 ou superior:

```bash
npm ci
npm run dev
npm test
npm run check:syntax
npm run build
```

Abra o endereço indicado pelo Vite. Sem configuração, é possível consultar os indicadores, pesquisar a cópia local de oportunidades verificadas, criar e descarregar o plano e guardar o progresso no navegador. O catálogo autenticado, a conta e a administração usam Supabase. Os alertas agendados e o e-mail opcional usam Cloudflare Workers. Consulte as variáveis em [Configuração](docs/CONFIGURACAO_AMBIENTE.md).

`npm run test:browser` utiliza o Chrome instalado para os testes de interface. Consulte [Testes e validação](docs/TESTES_V4.md).

## Funcionalidades

| Área | Funcionalidades |
| --- | --- |
| Pública | Início, indicadores com gráfico e CSV, central de oportunidades com pesquisa e detalhe, preparação profissional, plano de 30 dias, progresso, PDF, Sobre e 404. |
| Pessoal | Auth por e-mail, perfil e preferências, planos guardados na conta, favoritos, RumoMatch explicável, currículo, histórico de candidaturas, notificações, exportação de dados e pedido de eliminação. |
| Administração | Gestão de oportunidades e fontes, verificação, arquivamento, estatísticas agregadas, estado de serviços, falhas de envio, auditoria e configuração de alertas. O backend valida o papel administrativo. |

O RumoMatch aponta critérios compatíveis, incompatíveis e por confirmar. As candidaturas são registadas pelo titular e submetidas na fonte externa. Os e-mails de plano exigem consentimento no formulário. Os resumos semanais têm consentimento próprio e podem ser cancelados nas definições.

Os planos v3.6 continuam acessíveis com as conclusões originais. A conversão para 30 tarefas é opcional e guarda uma versão separada. O catálogo remoto exige revisão das fontes. Quando a pesquisa remota está vazia, a interface oferece uma consulta separada à cópia local enquanto houver anúncios vigentes.

## Tecnologias e fontes

Vue 3, Vue Router, Vite, JavaScript, CSS, Supabase Auth e PostgreSQL com RLS, Cloudflare Workers e Durable Objects SQLite, EmailJS e GitHub Actions. O Gemini é opcional e complementa o diagnóstico do plano quando disponível. O motor local de regras mantém a geração e o PDF disponíveis.

- API do Banco Mundial para Moçambique (`MOZ`), séries `SL.UEM.1524.ZS`, `SL.UEM.1524.FE.ZS` e `SL.UEM.1524.MA.ZS`. As estimativas da OIT representam a força de trabalho entre 15 e 24 anos. [Banco Mundial](https://data.worldbank.org/indicator/SL.UEM.1524.ZS?locations=MOZ)
- Os detalhes do catálogo ligam ao anúncio e à candidatura da entidade. A cópia local tem revisão datada e caduca automaticamente. [Verificação das fontes](docs/VERIFICACAO_SERVICOS.md)
- O PDF de plano usa fonte TrueType quando disponível e um modo local de compatibilidade. O CV usa uma fonte padrão do PDF e preserva os caracteres portugueses. [Fonte DejaVu utilizada no plano](https://github.com/prawnpdf/prawn/blob/master/data/fonts/DejaVuSans.ttf)

## Equipa e colaboração

| Nome | GitHub |
| --- | --- |
| Benjamim Junior | [@benjamimjunior](https://github.com/benjamimjunior) |
| Elmer Almirante | [@ElmerAlmirante](https://github.com/ElmerAlmirante) |
| Mabikane Arnaldo | [@K6N9](https://github.com/K6N9) |

Cada membro contribui na sua branch com a própria conta e submete um pull request para revisão de outro membro. O enunciado académico também pede os números de estudante e um BRD separado em PDF. Confirme os dados académicos com o Grupo 8 antes da entrega.

ChatGPT foi utilizado como apoio à implementação Vue, migrations, testes e documentação. A equipa revê o código, confirma as fontes e valida os serviços na sua configuração. O Gemini é usado apenas como funcionalidade opcional de personalização.

## Documentação

- [Auditoria da versão 3.6](docs/AUDITORIA_V36.md)
- [Auditoria final da v4](docs/AUDITORIA_FINAL_V4.md)
- [Arquitectura v4](docs/ARQUITECTURA_V4.md)
- [Matriz de requisitos e fluxogramas](docs/REQUISITOS_E_FLUXOGRAMAS.md)
- [Matriz de verificação dos serviços](docs/VERIFICACAO_SERVICOS.md)
- [Testes v4](docs/TESTES_V4.md)
- [Configuração de ambiente](docs/CONFIGURACAO_AMBIENTE.md)
- [Guia da administração](docs/GUIA_ADMIN.md)
- [Estado da entrega](docs/ESTADO_FINAL_V4.md)
