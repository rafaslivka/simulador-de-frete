<div align="left">

# Simulador de Frete

### Compare custos. Registre decisões. Acompanhe a economia.

Manual de utilização · CD Extrema

[**🌐 Acessar o sistema**](https://rafaslivka.github.io/simulador-de-frete/)

</div>

## 🧭 Navegue pelo manual

- [Começar a usar](#começar-a-usar)
- [Conhecer as telas](#conhecer-as-telas)
- [Fazer uma simulação](#fazer-uma-simulação)
- [Entender os resultados](#entender-os-resultados)
- [Salvar a análise](#salvar-a-análise)
- [Registrar uma mudança](#registrar-uma-mudança)
- [Consultar validações](#consultar-validações)
- [Acompanhar o dashboard](#acompanhar-o-dashboard)
- [Revisar remessas como administrador](#revisar-remessas-como-administrador)
- [Consultar o histórico](#consultar-o-histórico)
- [Atualizar tabelas de frete](#atualizar-tabelas-de-frete)
- [Alternar o tema](#alternar-o-tema)
- [Entender os acessos](#entender-os-acessos)
- [Transportadoras consideradas](#transportadoras-consideradas)
- [Dúvidas frequentes](#dúvidas-frequentes)

---

## Começar a usar

O Simulador de Frete compara os custos de transporte das remessas, identifica alternativas mais baratas e acompanha a economia das mudanças realizadas.

**Não é necessário instalar programas.** Acesse pelo navegador usando o endereço:

**https://rafaslivka.github.io/simulador-de-frete/**

### Entrar

1. Abra o site.
2. Digite o e-mail e a senha fornecidos pelo administrador.
3. Clique em **Entrar na plataforma**.

Use **Mostrar** para conferir a senha digitada, se necessário.

### Sair

Clique em **Sair**, no canto superior da tela.

Se precisar de acesso ou ajuda com a senha, procure o administrador.

> As credenciais são fornecidas separadamente. Este manual não contém senhas.

---

## Conhecer as telas

| Tela | O que você pode fazer |
| :--- | :--- |
| **Dashboard** | Consultar custos, economia confirmada, gráficos e resultados por período. |
| **Nova simulação** | Colar remessas do Excel, conferir os dados e comparar os fretes. |
| **Validações** | Registrar e consultar decisões por remessa. |
| **Histórico** | Abrir análises salvas, consultar cotações e verificar as tabelas utilizadas. |
| **Tabelas de frete** | Importar tarifas e atualizar a base de materiais. Exclusiva do administrador. |

### Fluxo de utilização

**Copiar do Excel → Simular → Conferir → Salvar análise → Realizar a troca → Confirmar a decisão → Acompanhar o dashboard**

> **A sugestão do sistema não realiza a troca de transportadora.**  
> Você faz a alteração na operação e depois registra o que foi realizado.

---

## Fazer uma simulação

### 1. Copiar os dados do Excel

Selecione e copie os dados das remessas **incluindo a linha dos títulos das colunas**.

<details>
<summary><strong>📋 Ver as 15 colunas necessárias</strong></summary>

| Coluna | Coluna | Coluna |
| :--- | :--- | :--- |
| Remessa | Data de criação | Preço Crédito |
| Nome | Material | Qtd.remessa |
| Incoterms | Região | Cidade |
| Centro | Depósito | Denominação de item |
| Tipo doc.vendas | Transportadora | Código |

</details>

É possível inserir blocos de diferentes transportadoras, inclusive com títulos de colunas repetidos entre os blocos.

### 2. Colar e conferir

1. Acesse **Nova simulação**.
2. Cole os dados na área indicada.
3. Faça a leitura e a conferência pela tela.
4. Confira a quantidade de remessas, as linhas de itens e o valor total.
5. Leia as mensagens apresentadas.
6. Clique em **Calcular frete**.

Se houver erro, confira a informação indicada, corrija os dados de origem e faça a leitura novamente.

> **Valor das remessas:** o sistema soma o campo **Preço Crédito** de cada linha. Esse valor não é multiplicado novamente pela quantidade de itens.

---

## Entender os resultados

O comparativo apresenta os valores calculados para cada remessa.

| Informação | Como interpretar |
| :--- | :--- |
| **Transportadora atual** | Transportadora informada nos dados inseridos. |
| **Frete atual** | Custo calculado para a transportadora atual. |
| **Melhor opção** | Transportadora com o menor custo entre as opções disponíveis no cálculo. |
| **Melhor frete** | Valor calculado para essa opção. |
| **Economia potencial** | Diferença que poderá ser economizada se a troca for realizada. |
| **Economia %** | Economia potencial em relação ao custo atual calculado. |
| **Recomendação** | Orientação baseada na comparação de custos. |

### Filtrar e buscar

| Filtro | O que mostra |
| :--- | :--- |
| **Oportunidades** | Remessas com economia identificada. |
| **Todas** | Todas as remessas da simulação. |
| **Sem cotação** | Remessas sem opção de frete calculada. |

Use a busca para localizar uma **remessa, cidade, UF ou transportadora**.

Os botões **Anterior** e **Próxima** permitem navegar entre as páginas.

Os filtros da listagem não alteram os indicadores gerais apresentados acima dela.

### Quando aparecer “Sem cotação”

Abra os detalhes da remessa e leia a observação de cada transportadora.

A mensagem pode indicar:

- Rota sem tarifa cadastrada.
- Transportadora não elegível para aquela remessa.
- Item sem peso ou cubagem na base de materiais.
- Faixa de peso ou informação da tabela não localizada.

> **“Sem cotação” não significa frete gratuito.**

Se precisar de ajuda, informe ao administrador o número da remessa e a mensagem apresentada.

### Quando não houver oportunidade

O cálculo não encontrou uma troca com economia positiva entre as opções que conseguiu comparar.

Você pode consultar **Todas** as remessas e salvar a análise mesmo assim.

---

## Salvar a análise

Depois de conferir o resultado:

1. Clique em **Salvar análise**.
2. Aguarde a mensagem de confirmação.
3. Continue para o registro das decisões, quando houver oportunidades.

A análise salva preserva as remessas, as cotações e as referências das tabelas utilizadas.

Atualizações futuras das tabelas não recalculam automaticamente as análises antigas.

> **Salvar a análise não confirma uma troca e não gera economia confirmada automaticamente.**

---

## Registrar uma mudança

As decisões podem ser registradas na área de decisões da análise salva ou em **Validações**.

| Estado | Quando utilizar | Entra no dashboard? |
| :--- | :--- | :---: |
| **Pendente** | A decisão ainda não foi concluída ou confirmada. | Não |
| **Fiz a mudança** | A troca de transportadora foi realmente realizada. | Sim¹ |
| **Não fiz a mudança** | A troca sugerida não foi realizada. | Não |

¹ Considerando uma confirmação válida com economia positiva, dentro do período consultado e sem retirada administrativa.

### Salvar a decisão

1. Localize a remessa.
2. Confira a transportadora atual e a opção sugerida.
3. Selecione o estado correspondente.
4. Acrescente uma observação, quando necessário.
5. Clique em **Salvar decisão**.
6. Aguarde a confirmação da gravação.

**Marque “Fiz a mudança” somente depois de realizar a troca.**

As decisões são individuais: salvar uma decisão não confirma as outras remessas.

### A equipe precisa aguardar aprovação?

**Não.** A confirmação da equipe entra diretamente nos indicadores, respeitando o período consultado.

O administrador pode revisar os resultados posteriormente e retirar uma remessa, se necessário.

### O que considerar antes de decidir

O sistema compara **custos de frete**. Ele não avalia:

- Prazo de trânsito.
- SLA.
- Qualidade do atendimento.
- Indicadores de desempenho.
- Preferência por transportadora.

Cabe ao responsável pela operação considerar esses fatores antes de realizar a mudança.

---

## Consultar validações

A tela **Validações** permite localizar oportunidades salvas e acompanhar as decisões por remessa.

### Filtros disponíveis

- Estado da decisão.
- Número da remessa.
- Data inicial e data final.

Preencha os filtros e clique em **Consultar**.

Para iniciar outra consulta, utilize **Limpar filtros**.

O período considera a **data da remessa**.

Se não aparecer nenhum registro, confira os filtros e verifique se a análise com oportunidade de economia foi salva.

Quando disponível, use **Histórico da decisão** para consultar as alterações registradas.

---

## Acompanhar o dashboard

O dashboard reúne os resultados das mudanças confirmadas com economia positiva.

**Pendências, mudanças não realizadas e remessas retiradas pelo administrador ficam fora das somas.**

### Indicadores

| Indicador | O que representa |
| :--- | :--- |
| **Mudanças confirmadas** | Quantidade de remessas incluídas nos resultados. |
| **Custo original** | Soma dos custos calculados nas transportadoras originais dessas remessas. |
| **Custo após as mudanças** | Soma dos custos calculados nas transportadoras escolhidas. |
| **Economia confirmada** | Diferença entre os custos originais e os custos após as mudanças. |
| **Redução de custo** | Economia confirmada dividida pelo custo original, em percentual. |

### Gráficos e comparativos

Quando houver resultados, consulte:

- **Comparativo de custos:** valores antes e depois das mudanças.
- **Economia por transportadora:** resultado agrupado pela transportadora escolhida.
- **Economia por data:** resultado agrupado pela data da remessa.
- **10 maiores economias confirmadas:** remessas com maior economia no período.

### Selecionar um período

1. Escolha uma opção em **Período**.
2. Preencha as datas, quando solicitado.
3. Clique em **Atualizar**.

| Período | Como funciona |
| :--- | :--- |
| **Última análise** | Confirmações vinculadas à análise salva mais recente das contas consultadas. |
| **Hoje** | Remessas com a data de hoje. |
| **Data específica** | Remessas da data informada. |
| **Intervalo personalizado** | Remessas entre a data inicial e a final, incluindo ambas. |
| **Esta semana** | Remessas da semana atual, de segunda-feira a domingo. |
| **Este mês** | Remessas do mês atual. |
| **Todo o histórico** | Todas as confirmações disponíveis na visão consultada. |

> Os filtros usam a **data da remessa**, não a data em que a decisão foi registrada.

**Exemplo — consultar outubro:** escolha **Intervalo personalizado**, informe **01/10/2026** e **31/10/2026** e clique em **Atualizar**.

### Resultados oficiais e testes do administrador

O administrador tem o campo **Consultar**:

| Visão | Registros apresentados |
| :--- | :--- |
| **Resultados oficiais — equipe** | Confirmações das contas com perfil Colaborador. |
| **Meus testes** | Confirmações da própria conta de administrador, separadas dos resultados oficiais. |

Depois de trocar a visão, clique em **Atualizar**.

A conta da equipe consulta os registros disponíveis para sua própria conta.

### Remessas repetidas

Uma remessa é contabilizada uma única vez na visão consultada.

Quando existem confirmações para o mesmo número em diferentes contas consultadas, o dashboard considera a confirmação mais recente.

### Por que o dashboard está zerado?

Confira se:

- Existe uma análise salva com oportunidade de economia positiva.
- A troca foi registrada como **Fiz a mudança**.
- A decisão foi salva com sucesso.
- A data da remessa está dentro do período selecionado.
- A visão selecionada contém esses registros.
- A remessa não foi retirada pelo administrador.

**Testes feitos na conta de administrador não preenchem a visão oficial da equipe.**

---

## Revisar remessas como administrador

Na visão **Resultados oficiais — equipe**, o administrador pode usar a seção **Revisão administrativa**.

Essa revisão permite retirar resultados incorretos sem apagar a confirmação original da equipe.

### Retirar uma remessa

1. Selecione o período desejado e clique em **Atualizar**.
2. Na revisão administrativa, escolha **Incluídas nos indicadores**.
3. Busque o número da remessa.
4. Clique em **Retirar / histórico**.
5. Informe o motivo.
6. Clique em **Confirmar retirada**.
7. Aguarde a atualização dos resultados.

A remessa deixa de participar dos indicadores e gráficos.

### Restaurar uma remessa

1. Na revisão administrativa, escolha **Retiradas dos indicadores**.
2. Localize a remessa.
3. Clique em **Restaurar / histórico**.
4. Informe o motivo.
5. Clique em **Confirmar restauração**.
6. Aguarde a atualização.

A restauração permite que a confirmação válida volte a participar dos resultados, respeitando os filtros.

> **A retirada vale pelo número da remessa, em todas as contas e análises, inclusive novas análises.**  
> A confirmação original é preservada. Retiradas e restaurações ficam registradas com motivo, data e administrador responsável.

A listagem da revisão também respeita o período selecionado. Se não encontrar uma remessa, consulte **Todo o histórico**.

---

## Consultar o histórico

1. Acesse **Histórico**.
2. Localize a análise desejada.
3. Abra os detalhes.
4. Consulte as remessas, as cotações e as decisões apresentadas.

Nos detalhes, você pode buscar remessas, consultar oportunidades e navegar entre as páginas.

A seção **Tabelas utilizadas nesta análise** apresenta as referências das bases que participaram do cálculo.

**Os valores são os resultados preservados quando a análise foi salva.**

---

## Atualizar tabelas de frete

**Disponível somente para o administrador.**

A tela **Tabelas de frete** permite importar tarifas e a base de materiais, além de consultar as versões cadastradas.

### Importar um arquivo

1. Acesse **Tabelas de frete**.
2. Selecione a base correspondente ao arquivo.
3. Escolha a planilha.
4. Confira as abas identificadas e a prévia dos dados.
5. Leia as observações apresentadas.
6. Clique em **Importar arquivo completo**.
7. Aguarde a conclusão.
8. Confira a versão ativa na listagem.

A prévia apresenta apenas uma parte da planilha. A importação utiliza os dados completos das abas lidas.

Não altere os nomes e a estrutura das planilhas sem conferir a compatibilidade com o sistema.

Após atualizar uma tabela, faça **uma nova simulação** para utilizar os dados atualizados.

---

## Alternar o tema

Use o botão de tema na tela de login ou no cabeçalho do sistema.

| Botão exibido | Ação ao clicar |
| :--- | :--- |
| **Tema claro** | Ativa a aparência clara. |
| **Tema escuro** | Ativa a aparência escura. |

A preferência fica salva no navegador quando disponível.

A mudança de tema não altera os cálculos ou os registros.

---

## Entender os acessos

| Recurso | Colaborador | Administrador |
| :--- | :---: | :---: |
| Fazer simulações | ✓ | ✓ |
| Salvar análises | ✓ | ✓ |
| Registrar decisões da própria conta | ✓ | ✓ |
| Consultar os próprios registros | ✓ | ✓ |
| Consultar registros da equipe | Pela conta compartilhada | ✓ |
| Separar resultados oficiais dos próprios testes no dashboard | — | ✓ |
| Retirar e restaurar remessas no dashboard | — | ✓ |
| Gerenciar tabelas de frete e materiais | — | ✓ |

### Conta compartilhada da equipe

Quando várias pessoas utilizam o mesmo acesso, os registros ficam associados à **conta da equipe**.

O sistema não identifica individualmente qual pessoa realizou a ação usando esse acesso compartilhado.

Use as observações para acrescentar informações úteis à operação.

### Conta de administrador

O administrador pode consultar registros da equipe e revisar sua participação no dashboard.

A revisão administrativa **não substitui a decisão original do colaborador**: ela controla se aquela remessa participa dos indicadores.

As confirmações feitas na própria conta do administrador ficam em **Meus testes**.

---

## Transportadoras consideradas

| Transportadoras |
| :--- |
| Rodonaves |
| Venkon |
| Favorita |
| Rodobrás |
| Brasil Web |
| Modular |
| ANEG |

**CCA não participa da comparação de custos.**

As opções disponíveis variam conforme a remessa, as regras de atendimento e as tabelas cadastradas.

---

## Dúvidas frequentes

<details>
<summary><strong>A transportadora mais barata é escolhida automaticamente na operação?</strong></summary>

Não. O sistema apresenta o comparativo. Você avalia a operação, realiza a troca quando for adequada e registra a decisão.

</details>

<details>
<summary><strong>Economia potencial e economia confirmada são a mesma coisa?</strong></summary>

Não.

- **Economia potencial:** possibilidade identificada no cálculo.
- **Economia confirmada:** diferença dos custos das remessas em que a troca foi confirmada e que estão incluídas nos resultados consultados.

</details>

<details>
<summary><strong>Preciso da aprovação do administrador para a economia aparecer?</strong></summary>

Não. A confirmação da equipe entra diretamente no dashboard, respeitando os filtros e eventuais retiradas administrativas.

O administrador pode revisar o resultado posteriormente.

</details>

<details>
<summary><strong>Retirar uma remessa apaga a análise ou a decisão?</strong></summary>

Não. A retirada exclui a remessa das somas do dashboard.

A análise, a decisão original e o histórico administrativo são preservados.

</details>

<details>
<summary><strong>Posso confirmar apenas a intenção de trocar a transportadora?</strong></summary>

Não. Marque **Fiz a mudança** somente depois de realizar a troca na operação.

Enquanto isso, mantenha a decisão pendente.

</details>

<details>
<summary><strong>O sistema confere a cobrança da transportadora?</strong></summary>

Não. Os valores são calculados pelas tabelas utilizadas na análise e não representam uma conferência da cobrança efetiva.

</details>

<details>
<summary><strong>Atualizei uma tabela. O histórico será recalculado?</strong></summary>

Não. O histórico preserva os resultados das análises salvas.

Faça uma nova simulação para utilizar a tabela atualizada.

</details>

<details>
<summary><strong>Posso sair sem salvar a análise?</strong></summary>

Se quiser consultar os resultados depois, salve a análise e aguarde a confirmação antes de sair.

</details>

<details>
<summary><strong>Por que não vejo a tela Tabelas de frete?</strong></summary>

Essa tela está disponível somente para o administrador.

</details>

<details>
<summary><strong>Já posso exportar o dashboard para Excel?</strong></summary>

A exportação para Excel com gráficos e detalhes está prevista, mas ainda não está disponível nesta versão.

</details>

<details>
<summary><strong>Ocorreu um erro. O que devo informar?</strong></summary>

Envie ao administrador:

- A tela em que estava.
- O que tentou fazer.
- A mensagem apresentada.
- O número da remessa, quando aplicável.
- Uma captura da tela, se necessário.

**Nunca envie sua senha.**

</details>

---

<div align="center">

**Simulador de Frete · CD Extrema**

Comparação de custos e acompanhamento das mudanças realizadas.

[**Abrir o sistema →**](https://rafaslivka.github.io/simulador-de-frete/)

</div>
