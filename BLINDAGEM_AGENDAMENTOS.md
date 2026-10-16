# 🔒 Blindagem (Agendamentos + Perfil) — Guia de aplicação

Fecha dois buracos abertos pela chave pública do site/APK:

1. **Agendamentos**: qualquer pessoa lia, alterava e excluía agendamentos de
   todos os profissionais sem login.
2. **Perfil (`profissionais`)**: qualquer visitante fazia `select senha from
   profissionais` e via a **senha em texto puro de todos**. ← o mais grave.

> ⚠️ Isso mexe no app em produção. Siga a ordem. Cada passo é reversível.
> ⚠️ O push foi migrado de "senha pura" para "token de sessão". Publique a
>    **Edge Function `manage-push-device`** junto com o app (senão o push
>    quebra em dispositivo novo).

---

## Arquivos criados/alterados

- `_blindagem_agendamentos.sql` → RPCs dos agendamentos + RLS + sessão/token
- `_blindagem_perfil.sql` → esconde a senha + RPCs `admin_ver_senha` e `push_verify_token`
- `_blindagem_servicos_promocoes.sql` → RPCs de serviços/promoções + RLS (leitura pública, escrita via RPC)
- `supabase/functions/manage-push-device/index.ts` → push autentica por token (com fallback à senha)
- `src/lib/agendamentosApi.js` → camada do app (RPCs) (NOVO)
- `src/lib/catalogoApi.js` → camada do app p/ serviços e promoções (RPCs) (NOVO)
- `src/App.jsx` → telas migradas; login por token; push por token; admin "ver senha" via RPC; catálogo via RPCs

---

## ORDEM DE APLICAÇÃO (importante)

### Passo 1 — Banco: sessão + agendamentos (SQL Editor)
Rode `_blindagem_agendamentos.sql`. Ele cria a tabela de sessão, o token e as
RPCs de agendamento. Confira:
```sql
select * from public.sessao_abrir('NOME_DE_UM_PROFISSIONAL', 'SENHA_DELE');
-- deve voltar { "token": "...", "profissional": {...} } (sem senha)
```

### Passo 2 — Banco: perfil (SQL Editor)
Rode `_blindagem_perfil.sql` (depende da sessão do Passo 1). Ele esconde
`senha`/`senha_hash` da leitura pública e cria `admin_ver_senha` e
`push_verify_token`. Confira que o atacante não vê mais senha:
```sql
select senha from public.profissionais limit 1;  -- deve dar ERRO (sem permissão)
select * from public.profissionais limit 1;      -- volta normal, sem a coluna senha
```

### Passo 3 — Banco: serviços e promoções (SQL Editor)
Rode `_blindagem_servicos_promocoes.sql` (depende da sessão do Passo 1).
Ele cria as RPCs de serviços/promoções e fecha a escrita direta: o catálogo
continua legível pelo público, mas **só o dono (via token) escreve**. Confira:
```sql
-- escrita direta deve FALHAR (permission denied):
update public.servicos set valor = 1 where id = 1;
-- leitura continua OK:
select * from public.servicos limit 1;
```

### Passo 4 — Publicar o app novo + a Edge Function
- `npm run build` + publicar o site/APK.
- Publique também a Edge Function: `supabase functions deploy manage-push-device`
  (o push agora usa token; a função antiga só aceita senha).

### Passo 5 — Testar (com uma conta real)
- [ ] Login do profissional entra normal
- [ ] Push chega em dispositivo novo (registrar) e reassocia ao entrar
- [ ] Admin "👁️ Ver senha" mostra a senha (via RPC)
- [ ] Admin "Salvar" só troca a senha se preencher uma nova (blanco = mantém)
- [ ] Agenda do profissional lista/atualiza (polling ~20s)
- [ ] Cliente agenda pelo link público e **não** vê dados de outros clientes
- [ ] Aprovar / recusar / concluir / cancelar / remarcar / valor / recorrência / excluir
- [ ] Criar / editar / desativar / reativar / excluir serviço
- [ ] Criar promoção (💲), salvar meses/semanas/dias, ativar/desativar, excluir
- [ ] "Aplicar para todas" copia períodos sem mexer em valor/duração

---

## Resumo do que mudou

| Antes | Depois |
|---|---|
| `supabase.from("agendamentos")` direto do navegador | Tudo via **RPCs** `security definer` |
| `select senha from profissionais` aberto ao público | Senha **escondida**; só super_admin vê via RPC |
| Push autenticava com **senha pura** | Push autentica com **token de sessão** |
| Login expunha a senha no retorno | Login devolve **token** (sem senha) |
| Cliente via nome/WhatsApp dos outros | Cliente vê **só horários ocupados** |
| `agendamentos` com RLS desligado | RLS **ligado** + sem acesso direto da chave pública |

---

## Ponto de atenção: tempo real

Antes, a agenda do profissional atualizava na hora via **Realtime**. Com o RLS
ligado, esse canal não entrega mais eventos para a chave pública. A sincronização
agora é por **polling a cada 20 segundos** (já estava no app e continua válido).
Na prática: um agendamento novo aparece na tela do profissional em até ~20s.

Se quiser tempo real de volta no futuro, o caminho é autenticar o profissional
com Supabase Auth (JWT) e ligar uma policy de Realtime — falamos disso depois.

---

## ROLLBACK (voltar ao estado anterior, se algo der errado)

**Opção A — só o banco (app novo continua no ar):**
Não feche a porta. No SQL Editor, rode o **BLOCO DE ROLLBACK** que está no fim
de `_blindagem_agendamentos.sql` (descomente as linhas). Isso desliga o RLS e
devolve o acesso direto. **Mas** o app novo não usa mais `from("agendamentos")`,
então ele continuaria chamando as RPCs — que você acabou de dropar. Por isso,
para rollback completo, use a Opção B.

**Opção B — rollback completo (banco + app antigo):**
1. Rode o BLOCO DE ROLLBACK do SQL (desliga RLS, dropa RPCs e a tabela de sessão).
2. Republica a versão **anterior** do app (o `App.jsx` antigo, que usa
   `supabase.from("agendamentos")`).
   - Dica: `src/App copy.jsx` é um backup antigo; o ideal é restaurar do git
     o último commit antes desta mudança.

---

## Detalhes de segurança aplicados

- **Sessão por token:** o profissional só age nos próprios agendamentos
  (a RPC confere o dono pelo token). Token expira em 30 dias.
- **Whitelist de colunas:** não dá para mudar `profissional_id`, `id`, `nome`,
  `whatsapp` de um agendamento já existente pelo painel.
- **Regras no servidor:** não agenda no passado; valida nome/serviço/horário;
  profissional precisa existir e estar ativo.
- **Cliente anônimo:** só cria e vê horários ocupados — sem dados de terceiros.
- **Edge Function de push:** usa `service_role`, ignora RLS e continua ok.
