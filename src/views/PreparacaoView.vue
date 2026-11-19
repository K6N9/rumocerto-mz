<script setup>
import { usePlano } from '../composables/usePlano.js'
const { plano } = usePlano()
const recursos = [
  { titulo: 'Antes da entrevista', texto: 'Leia o anúncio, pesquise a entidade e prepare dois exemplos em que resolveu um problema. Confirme a hora, o local ou a ligação e, se for por vídeo, teste o som e prepare uma alternativa caso a Internet falhe.' },
  { titulo: '«Fale um pouco sobre si»', texto: 'Em cerca de um minuto, apresente a sua formação, uma actividade relevante e o motivo pelo qual se candidata.' },
  { titulo: '«Conte-nos como resolveu um problema»', texto: 'Descreva a situação, a tarefa, o que fez e o resultado. Pode usar exemplos de aulas, trabalhos em grupo, voluntariado ou actividades comunitárias.' },
  { titulo: '«Tem alguma pergunta?»', texto: 'Pergunte por uma responsabilidade da função, pela formação inicial ou pelos próximos passos da selecção.' },
  { titulo: 'CV e carta de apresentação', texto: 'Use um e-mail profissional e um CV legível em PDF. Na carta, mencione a vaga, explique por que lhe interessa e dê um exemplo que satisfaça um requisito. Indique a sua disponibilidade e reveja a ortografia antes de enviar.' },
  { titulo: 'Competências e aprendizagem', texto: 'Compare os requisitos das vagas da sua área. Pratique comunicação escrita, colaboração e ferramentas digitais adequadas ao trabalho. Aproveite exercícios descarregáveis ou recursos de bibliotecas e centros de formação quando os dados móveis forem limitados.' },
  { titulo: 'Antes de enviar documentos', texto: 'Confirme o anúncio no sítio da entidade. Consulte a lista de documentos e guarde uma cópia da candidatura. Evite publicar identificação pessoal em grupos ou páginas abertas.' }
]
</script>

<template>
  <section class="container inner-page rc-page">
    <header class="page-heading"><h1>Preparação profissional</h1><p>Pratique entrevistas e prepare os documentos antes de se candidatar.</p></header>
    <div class="rc-card-grid">
      <article v-for="recurso in recursos" :key="recurso.titulo" class="surface rc-card">
        <h2>{{ recurso.titulo }}</h2><p>{{ recurso.texto }}</p>
      </article>
    </div>
    <section v-if="plano?.recursos?.length" class="surface rc-panel">
      <h2>Recursos do seu plano</h2><ul><li v-for="(texto, i) in plano.recursos" :key="i">{{ texto }}</li></ul>
      <RouterLink to="/progresso" class="text-link">Ver actividades do plano</RouterLink>
    </section>
    <div class="rc-actions"><RouterLink to="/conta/cv" class="btn btn-primary">Criar CV</RouterLink><RouterLink to="/plano" class="btn btn-outline">Criar plano</RouterLink></div>
  </section>
</template>
