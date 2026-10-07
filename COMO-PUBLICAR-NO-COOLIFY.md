# Como publicar no Coolify e ligar o Asaas

O site já está pronto para vender: a sacola, a finalização e a ponte com o Asaas estão feitas.
Falta só configurar as contas. Faça primeiro tudo no **modo de testes (sandbox)** e, quando a compra de teste der certo, troque para a conta real.

---

## 1. Asaas: pegar a chave de testes

1. Crie uma conta de testes em **https://sandbox.asaas.com** (é separada da conta real).
2. No menu, vá em **Integrações → Chave de API** e gere a chave. Guarde-a: você vai colar no Coolify (passo 2.4).

> A chave é como a senha da conta. Cole **só** no Coolify; não mande por chat nem e-mail.

## 2. Coolify: criar o site

1. **+ New → Resource → Public Repository** (ou *Private Repository (with GitHub App)* se o repositório ficar privado).
2. Repositório: `https://github.com/guisguimaraes/maison-louree` · Branch: `main`.
3. Na configuração:
   - **Build Pack:** `Dockerfile`
   - **Base Directory:** `/site`
   - **Ports Exposes:** `3000`
   - **Domains:** o domínio do site (ex.: `https://maisonlouree.com.br`)
4. Em **Environment Variables**, crie (a lista está também em `site/.env.exemplo`):

   | Nome | Valor |
   |---|---|
   | `ASAAS_API_KEY` | a chave do passo 1 |
   | `ASAAS_AMBIENTE` | `sandbox` (na fase de testes) |
   | `ASAAS_WEBHOOK_TOKEN` | um texto secreto qualquer, ex.: `louree-8f3k2-pagamentos` |
   | `SITE_URL` | o endereço do site, sem barra no fim |
   | `FRETE_VALOR` | frete fixo em reais, ex.: `25.00` (deixe vazio para "frete a combinar") |

5. Em **Storages / Persistent Storage**, adicione um volume com **Destination Path** `/app/data` (é onde ficam os pedidos; sem isso eles somem a cada atualização).
6. Clique em **Deploy**. Quando terminar, abra o site e confira em `https://SEU-DOMINIO/api/saude` (deve aparecer `{"ok":true}`).

## 3. Asaas: avisar o site quando o pagamento cair (webhook)

1. No Asaas (sandbox), vá em **Integrações → Webhooks → Adicionar**.
2. Preencha:
   - **URL:** `https://SEU-DOMINIO/api/asaas/webhook`
   - **Token de autenticação:** o **mesmo** texto que você pôs em `ASAAS_WEBHOOK_TOKEN`
   - **Versão da API:** v3
   - **Eventos:** de **cobranças** — pelo menos *Cobrança confirmada*, *Cobrança recebida*, *Cobrança vencida*, *Cobrança estornada* e *Cobrança removida*.
3. Salve e deixe o webhook **ativo**.

## 4. Compra de teste

1. No site, coloque um perfume na sacola e finalize (dá para usar um CPF de teste válido, como `529.982.247-25`).
2. Você vai para a página do Asaas. No sandbox, pague com Pix ou cartão de teste (o próprio Asaas mostra como simular).
3. Ao voltar ao site, aparece **"Obrigado"**. No painel do Asaas a cobrança aparece como recebida.

Se aparecer erro dizendo que o **domínio não está cadastrado**: no Asaas, cadastre o domínio do site nas informações da conta (é exigido para o retorno automático). Enquanto isso, dá para apagar `SITE_URL` no Coolify — o pagamento funciona igual, só não volta sozinho para o site.

## 5. Virar a chave para vendas reais

1. Na conta **real** do Asaas (asaas.com), aprovada, gere a **Chave de API** de produção.
2. No Coolify, troque `ASAAS_API_KEY` pela chave real e **apague** o valor de `ASAAS_AMBIENTE`. Faça **Redeploy**.
3. Repita o passo 3 (webhook) na conta **real**, com o mesmo token.
4. Faça uma compra pequena de verdade para conferir.

---

## Onde ver os pedidos

- **No painel do Asaas** (Cobranças): é o lugar principal — mostra quem pagou, quanto e como. O Asaas também manda o e-mail da cobrança para o cliente.
- **No servidor**: cada pedido (itens, endereço de entrega e situação) fica salvo no volume `/app/data/pedidos.json`.

## Para mudar preço ou frete

- **Preço:** `site/server/catalogo.js` (é o que vale na cobrança) e `site/src/cart.js` (o que aparece na tela).
- **Frete fixo:** variável `FRETE_VALOR` no Coolify (não precisa mexer no código).
