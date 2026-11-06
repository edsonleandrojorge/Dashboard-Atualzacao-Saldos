# Saldos de Lotes DMS

Painel de saldos dos lotes produzidos pela Dois Marcos Sementes, publicado no GitHub Pages.
Ele se atualiza sozinho sempre que uma nova planilha do **Resumo de Produção** é enviada para a pasta `planilhas/`.

## Como atualizar o painel

1. Extraia o Resumo de Produção do sistema, do jeito de sempre (.xls).
2. No GitHub, abra a pasta **planilhas** → **Add file** → **Upload files**.
3. Arraste o arquivo e clique em **Commit changes**.
4. Aguarde 1 a 2 minutos. O painel publicado já mostra a nova carga.

O andamento aparece na aba **Actions** do repositório. Se a planilha tiver algum problema, a execução fica vermelha e o motivo aparece no passo "Processar planilhas novas".

## Regras de cálculo

- Saldo = Produzido (I) − Descarte (IND, U) − Embarcado (Indiceemb, AK)
- Reserva de plantio = coluna RP, limitada ao saldo do lote; Disponível = saldo − reserva
- Em lotes com reserva, ela é abatida primeiro do saldo tratado
- Produção pelo prefixo do lote: NNDM = Dois Marcos · UWML = BASF · demais = Terceiros
- Tecnologia pelo nome da cultivar: I2X, IPRO, CE

## Estrutura

- `index.html` – o painel
- `core.js` – leitura da planilha e cálculo dos saldos (o mesmo código está embutido no `index.html`)
- `planilhas/` – planilhas enviadas
- `data/` – cargas processadas (gerado automaticamente; não editar)
- `scripts/processar.js` – converte as planilhas novas em dados do painel
- `.github/workflows/atualizar.yml` – automação que processa e publica

> Atenção: o site é público. Qualquer pessoa com o link vê os saldos.
