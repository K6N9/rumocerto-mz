<template>
  <div class="container inner-page">
    <div class="page-heading">
      <span class="eyebrow">SOBRE O PROJECTO</span>
      <h1>Sobre a plataforma</h1>
      <p>O RumoCerto MZ reúne planos de preparação profissional, oportunidades com fontes verificadas e indicadores estatísticos de Moçambique. Não é uma plataforma de recrutamento.</p>
    </div>
    <div class="about-grid">
      <div class="surface prose">
        <h2>Finalidade</h2>
        <p>A plataforma apresenta indicadores de desemprego juvenil e permite elaborar planos de desenvolvimento profissional com actividades organizadas em quatro semanas. O documento pode ser descarregado em PDF.</p>
        <h2>Funcionamento</h2>
        <p>O motor de regras adapta as actividades à área, ao objectivo, ao tempo disponível e às condições de acesso à Internet. O uso de Gemini é opcional no envio de planos por e-mail, quando o serviço estiver configurado.</p>
        <details class="info-disclosure"><summary>Fontes e interpretação dos dados <span aria-hidden="true">+</span></summary><div class="info-disclosure-content"><p>Os indicadores vêm da API de Indicadores do Banco Mundial para Moçambique (MOZ), com estimativas modeladas da Organização Internacional do Trabalho. Referem-se à força de trabalho dos 15 aos 24 anos e são valores nacionais e históricos. Não descrevem vagas nem permitem prever a situação de uma pessoa.</p></div></details>
        <details class="info-disclosure"><summary>Privacidade e utilização dos dados <span aria-hidden="true">+</span></summary><div class="info-disclosure-content"><p>O modo público guarda o rascunho e o progresso do plano no navegador. Na conta, os dados profissionais e os planos guardados são privados e ficam no Supabase. As definições da conta permitem exportar os registos e apresentar um pedido de eliminação. A plataforma guarda a sessão no navegador. Quando é solicitado o envio, o servidor Cloudflare pode guardar temporariamente o endereço e as preferências durante até sete dias. As mensagens são processadas pelo EmailJS, e o acesso ao PDF utiliza uma ligação privada.</p><p>O botão para limpar os dados remove apenas o conteúdo deste navegador, não pedidos já enviados ao servidor. O resumo semanal exige consentimento nas definições e pode ser cancelado na mesma página. Se a personalização com Gemini estiver activada, determinados campos poderão ser enviados à Google, conforme indicado no formulário.</p></div></details>
        <details class="info-disclosure"><summary>Limitações do serviço <span aria-hidden="true">+</span></summary><div class="info-disclosure-content"><p>O serviço depende de Internet, da disponibilidade das APIs e de quotas gratuitas. O envio de e-mails pode sofrer atrasos. Uma resposta de aceitação pelo serviço de correio não confirma a chegada à caixa de entrada. O plano não substitui orientação profissional especializada nem garante emprego.</p></div></details>
      </div>
      <aside class="about-aside">
        <span class="eyebrow">PROJECTO ACADÉMICO</span>
        <h3>Grupo 8 · LECC31</h3>
        <p>Benjamim Junior</p><p>Elmer Almirante</p><p>Mabikane Arnaldo</p>
        <hr />
        <h3>Fontes</h3>
        <a href="https://data.worldbank.org/indicator/SL.UEM.1524.ZS?locations=MZ" target="_blank" rel="noopener noreferrer">Banco Mundial / OIT ↗</a>
        <a href="https://datahelpdesk.worldbank.org/knowledgebase/articles/889392" target="_blank" rel="noopener noreferrer">Documentação da API ↗</a>
        <a href="https://www.afrobarometer.org/" target="_blank" rel="noopener noreferrer">Afrobarometer ↗</a>
        <hr />
        <p>Programação Web II · ISUTC · 2026</p>
      </aside>
    </div>
  </div>
</template>
