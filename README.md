# Bota Dentro João & Nathalia — 12/12/2026

Aplicação completa de Lista de Presentes com sincronização em tempo real via **Supabase**, envio automático de e-mail via **EmailJS** e Painel Admin (`najorecebe`).

## Como colocar online em 3 minutos (Vercel)

1. Crie um repositório novo no **GitHub** e envie todos os arquivos desta pasta.
2. Acesse **vercel.com**, clique em **Add New Project** e importe o repositório.
3. Antes de clicar em **Deploy**, abra a aba **Environment Variables** na Vercel e adicione:
   - `VITE_SUPABASE_URL` -> Sua Project URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` -> Sua chave `anon public` do Supabase
   - `VITE_EMAILJS_SERVICE_ID` -> Seu Service ID do EmailJS
   - `VITE_EMAILJS_TEMPLATE_ID` -> Seu Template ID do EmailJS
   - `VITE_EMAILJS_PUBLIC_KEY` -> Sua Public Key do EmailJS
   - `VITE_ADMIN_PASSWORD` -> `najorecebe`
4. Clique em **Deploy**. Assim que o link abrir, entre na **Área dos Anfitriões** (`najorecebe`) para configurar sua **Chave Pix** e colar os links de compra!
