# TermuxLab — Deploy Guide

## Estrutura
```
termuxlab/
├── server.js        ← backend Express + SQLite
├── package.json
├── render.yaml      ← config para Render.com
└── public/
    └── index.html   ← frontend completo (SPA)
```

## Deploy no Render.com (gratuito)

### Passo 1 — Criar repositório GitHub
1. Vai a github.com → New repository → nome: `termuxlab`
2. Upload dos 4 ficheiros: `server.js`, `package.json`, `render.yaml`, `public/index.html`

### Passo 2 — Ligar ao Render
1. Vai a render.com → Sign up (grátis)
2. New → Web Service
3. Connect GitHub → selecciona o repo `termuxlab`
4. Render detecta o `render.yaml` automaticamente
5. Clica Deploy

### Passo 3 — Ligar o domínio
1. No Render → Settings → Custom Domains
2. Adiciona: `termuxlab.net.eu.org`
3. Render dá-te um CNAME record
4. No painel do teu domínio (eu.org) adiciona o CNAME

## O que a app tem
- ✅ Registo e login com JWT
- ✅ Base de dados SQLite (progresso guardado)
- ✅ 13 aulas completas (6 módulos de Linux + Redes + Pentest + CTF)
- ✅ Terminal interactivo em cada aula
- ✅ Sistema de badges (6 badges)
- ✅ Perfil com estatísticas
- ✅ Mobile-first, sem dependências externas
