# 🚀 Como fazer o deploy no Vercel

## Arquivos nesta pasta:
- `api/index.js` — lógica do servidor (rotas)
- `api/html_data.js` — HTML do cardápio em base64
- `vercel.json` — configuração do Vercel
- `package.json` — configuração do projeto

## Passos para o deploy:

### 1. Crie uma conta no Vercel
- Acesse: https://vercel.com
- Clique "Sign Up" → entre com GitHub (crie conta no GitHub se não tiver)

### 2. Crie repositório no GitHub
- Acesse: https://github.com/new
- Nome do repositório: `yanni-sushi`
- Clique "Create repository"
- Suba os arquivos desta pasta para o repositório

### 3. Deploy no Vercel
- No Vercel, clique "New Project"
- Conecte seu GitHub e escolha o repositório `yanni-sushi`
- Em "Environment Variables" adicione:
  - Nome: `GROQ_API_KEY`
  - Valor: sua chave Groq (para a Suki funcionar)
- Clique "Deploy"

### 4. URL do sistema
- O Vercel vai gerar uma URL tipo: `yanni-sushi.vercel.app`
- Essa URL substitui o `yanni-novo.sousaxaviertv.workers.dev`

## ⚠️ Importante
- O sistema atual no Cloudflare continua funcionando até você trocar
- Só desligue o Cloudflare depois de testar tudo no Vercel
