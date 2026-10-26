# Firebase Hosting - setup rápido

Este projeto está preparado para deploy no Firebase Hosting como alternativa/contingência ao Vercel.

## Pré-requisitos
- Conta do Google com acesso ao [Firebase Console](https://console.firebase.google.com)
- Firebase CLI instalado (opcional, pode fazer upload manual pelo console)

---

## 1. Criar projeto no Firebase

1. Acesse https://console.firebase.google.com
2. Clique em **"Adicionar projeto"**
3. Dê um nome (ex: `agenda-pro`) e siga até criar
4. Não é necessário habilitar o Google Analytics (pode desmarcar)

---

## 2. Adicionar app web ao projeto

1. No console do projeto, clique no ícone **</>** (app web)
2. Dê um apelido (ex: `agenda-pro-web`) e registre
3. Copie o objeto `firebaseConfig` que aparece (API Key, authDomain, etc.)

> Não adicionei esse `firebaseConfig` ao frontend porque o projeto já usa Supabase para auth/banco. Adicionar Firebase SDK no web seria redundante.

---

## 3. Fazer o build e deploy

### Opção A: Firebase CLI (recomendado)

```powershell
# Na pasta do projeto
cd "C:\Users\JuniorThug\.cline\data\workspaces\chat\agenda-pro"

# Login (abre o navegador)
npx firebase login

# Inicializa o projeto (escolha Hosting, use o projeto existente)
npx firebase init

# Build de produção
npm run build

# Deploy
npx firebase deploy --only hosting
```

### Opção B: Upload manual pelo console

1. Rode `npm run build` localmente
2. No Firebase Console, vá em **Hosting**
3. Clique em **"Começar"** ou **"Adicionar domínio"**
4. Faça upload da pasta `dist/` compactada (ou use o botão de upload de arquivos)

---

## 4. (Opcional) Vincular ao AdMob

Se quiser vincular o app do AdMob ao Firebase:

1. Acesse https://apps.admob.com
2. Selecione o app **Agenda Pro**
3. Vá em **Configurações** → **Vincular ao Firebase**
4. Escolha o projeto Firebase criado acima

Isso habilita Firebase Analytics e Crashlytics no Android (via Capacitor), se você decidir usar no futuro.

---

## Arquivos já preparados

- `firebase.json` — configuração de Hosting apontando para `dist/` com rewrites para SPA
- `vercel.json` — mantido (Vercel continua como principal)
- `dist/` — build atual já contém o snippet do AdSense no `<head>`

---

## Qual usar?

| Situação | Recomendação |
|----------|--------------|
| Site principal (agenda-pro-gilt.vercel.app) | **Vercel** (já configurado, não mude) |
| Contingência / segundo domínio | **Firebase Hosting** (use este guia) |
| Push notifications Android | **Firebase FCM** (já configurado via Supabase Functions) |
