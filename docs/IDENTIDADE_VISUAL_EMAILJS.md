# RumoCerto MZ — identidade visual 1.1

## Ficheiros prontos

- `public/branding/simbolo.png`: símbolo compacto usado na barra de navegação e no rodapé.
- `public/branding/logo-email.png`: logótipo horizontal para inserir no conteúdo do e-mail.
- `public/branding/logo-perfil-gmail.png`: avatar quadrado para o perfil da conta Google/Gmail do projecto.
- `public/favicon-48.png` e `public/apple-touch-icon.png`: ícones do navegador e iOS.

## Actualizar o site local sem perder a configuração EmailJS

Os recursos visuais já vêm integrados no pacote v2. **Não substituas nem partilhes o `.env.local` do Vue ou o `.dev.vars` secreto do Worker.**

1. Copie os ficheiros actualizados para a mesma pasta do projecto.
2. Inicie com `npm run dev`.
3. Faça recarregamento forçado (`Command + Shift + R`) se vir o símbolo antigo em cache.
4. A compilação `npm run build` continuará a copiar tudo o que está em `public/` para `dist/`.

## Alterar a fotografia da conta Gmail

1. No Google, entre na conta do projecto.
2. Aceda a https://myaccount.google.com/personal-info
3. Em **Fotografia do perfil**, escolha **Carregar do dispositivo**.
4. Seleccione `logo-perfil-gmail.png` (ou a cópia solta fornecida), recorte e grave.
5. A alteração pode demorar a aparecer noutros serviços Google e nos e-mails recebidos.

## Corrigir o logo quebrado no template EmailJS

O perfil do Gmail e a imagem dentro do corpo do e-mail são independentes. Mudar o avatar **não** corrige automaticamente uma imagem quebrada no corpo.

**Alternativa A — depois de publicar o site no GitHub Pages (simples):**

1. Publique a versão 1.1 da aplicação.
2. Determine a URL pública de `logo-email.png`, por exemplo:
   `https://UTILIZADOR.github.io/NOME_DO_REPOSITORIO/branding/logo-email.png`
3. Abra essa URL numa janela anónima; deve mostrar a imagem sem autenticação.
4. No EmailJS → Email Templates → o template RumoCerto → Edit Content, seleccione a imagem antiga, remova-a e insira a nova imagem pelo URL absoluto HTTPS.
5. Defina uma largura de aproximadamente 300–420 px, guarde com Apply Changes e Save.
6. Envie novo e-mail e confirme a visualização. Alguns leitores de e-mail bloqueiam imagens externas até autorização do destinatário.

**Alternativa B — utilizar as funcionalidades de anexos/incorporação do EmailJS:**

No template Auto-Reply, o EmailJS documenta um logótipo como anexo estático chamado `logo.png` na aba **Attachments**. Esta funcionalidade pode depender do plano. Verifique a disponibilidade e as referências de imagem na configuração do template; se não estiver disponível, utilize a alternativa A.

Referências oficiais: https://www.emailjs.com/docs/user-guide/pre-built-email-templates/

## Cores recomendadas

- Azul-escuro: `#10243F`
- Verde-turquesa: `#0F8E7F`
- Verde-claro: `#62CBB3`
- Fundo claro: `#F7F9FA`

## Atenção

Não faça commit de `.env.local`, palavra-passe do Gmail ou chave privada do EmailJS. Na versão 2.0, nenhuma chave privada é usada no Vue. A chave privada do EmailJS e a chave Gemini opcional devem ficar apenas nos segredos Cloudflare Worker. O frontend utiliza `VITE_WORKER_URL`.
