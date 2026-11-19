<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { accaoAuth, conta, contaConfigurada, urlConta } from '../services/supabase.js'
import { destinoSeguro } from '../router/acesso.js'

const rota = useRoute()
const router = useRouter()
const pagina = computed(() => rota.name)
const titulo = computed(() => ({ entrar: 'Entrar', registar: 'Criar conta', recuperar: 'Recuperar palavra-passe',
  'redefinir-palavra-passe': 'Definir palavra-passe', acesso: 'Acesso administrativo' })[pagina.value])
const email = ref('')
const palavraPasse = ref('')
const confirmar = ref('')
const ocupado = ref(false)
const mensagem = ref('')
const erro = ref('')
const destino = computed(() => destinoSeguro(rota.query.destino))
const redefinir = computed(() => pagina.value === 'redefinir-palavra-passe')
const criar = computed(() => pagina.value === 'registar' || redefinir.value)
watch(pagina, () => { erro.value = ''; mensagem.value = ''; palavraPasse.value = ''; confirmar.value = '' })

async function enviar() {
  if (ocupado.value) return
  erro.value = ''
  mensagem.value = ''
  if (criar.value && palavraPasse.value !== confirmar.value) {
    erro.value = 'As palavras-passe devem coincidir.'
    return
  }
  ocupado.value = true
  try {
    const credenciais = { email: email.value.trim(), password: palavraPasse.value }
    switch (pagina.value) {
      case 'entrar':
        await accaoAuth('signInWithPassword', credenciais)
        await router.replace(destino.value)
        break
      case 'registar':
        await accaoAuth('signUp', { ...credenciais, options: { emailRedirectTo: urlConta('email') } })
        mensagem.value = 'Consulte a caixa de entrada para confirmar o endereço e depois inicie sessão.'
        break
      case 'recuperar':
        await accaoAuth('resetPasswordForEmail', credenciais.email, { redirectTo: urlConta('recovery') })
        mensagem.value = 'Se o endereço estiver registado, receberá uma ligação de recuperação.'
        break
      default:
        await accaoAuth('updateUser', { password: credenciais.password })
        await router.replace({ name: 'definicoes', query: { actualizada: 'sim' } })
    }
  } catch (falha) {
    erro.value = falha.status === 429 ? 'Limite temporário atingido. Tente mais tarde.' :
      (pagina.value === 'entrar' ? 'Não foi possível entrar. Confirme o e-mail e os dados de acesso.' :
        'Não foi possível concluir o pedido. Reveja os dados e tente novamente.')
  } finally { ocupado.value = false }
}
</script>

<template>
  <section class="container inner-page rc-narrow">
    <div class="page-heading"><h1>{{ titulo }}</h1></div>
    <article class="surface rc-panel">
      <template v-if="pagina === 'acesso'">
        <p role="status">{{ rota.query.motivo === 'indisponivel' ? 'Não foi possível verificar as permissões. Tente novamente.' : 'Esta área exige autorização administrativa.' }}</p>
        <RouterLink to="/conta" class="btn btn-outline">Voltar à área pessoal</RouterLink>
      </template>
      <template v-else-if="!contaConfigurada">
        <p role="status">O serviço de contas aguarda configuração. Pode consultar os recursos e criar um plano neste navegador.</p>
        <RouterLink to="/plano" class="btn btn-primary">Criar plano</RouterLink>
      </template>
      <template v-else>
        <p v-if="conta.erro && pagina === 'entrar'" class="rc-error" role="alert">{{ conta.erro }}</p>
        <p v-if="conta.confirmada && pagina === 'entrar'" role="status">Endereço de e-mail confirmado.</p>
        <p v-if="erro" class="rc-error" role="alert">{{ erro }}</p>
        <p v-if="mensagem" class="rc-success" role="status">{{ mensagem }}</p>
        <RouterLink v-if="conta.utilizador && pagina === 'entrar'" :to="destino" class="btn btn-primary">Continuar para a conta</RouterLink>
        <form v-else class="rc-form" @submit.prevent="enviar">
          <label v-if="!redefinir">E-mail<input v-model="email" type="email" autocomplete="email" required maxlength="254" /></label>
          <label v-if="pagina !== 'recuperar'">Palavra-passe
            <input v-model="palavraPasse" type="password" :autocomplete="criar ? 'new-password' : 'current-password'" required :minlength="criar ? 8 : undefined" maxlength="128" />
          </label>
          <label v-if="criar">Confirmar palavra-passe<input v-model="confirmar" type="password" autocomplete="new-password" required minlength="8" maxlength="128" /></label>
          <button class="btn btn-primary" :disabled="ocupado">{{ ocupado ? 'A processar…' : (pagina === 'recuperar' ? 'Pedir ligação' : titulo) }}</button>
        </form>
        <nav v-if="!redefinir" class="rc-actions" aria-label="Opções de autenticação">
          <RouterLink v-if="pagina !== 'entrar'" :to="{name:'entrar',query:{destino:rota.query.destino}}">Entrar</RouterLink>
          <RouterLink v-if="pagina !== 'registar'" :to="{name:'registar',query:{destino:rota.query.destino}}">Criar conta</RouterLink>
          <RouterLink v-if="pagina !== 'recuperar'" to="/recuperar">Recuperar palavra-passe</RouterLink>
        </nav>
      </template>
    </article>
  </section>
</template>
