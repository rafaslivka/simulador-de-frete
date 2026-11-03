# Simulador de Frete — Manual do usuário

O Simulador de Frete compara os custos de transporte das remessas,
ajuda a identificar opções mais baratas e acompanha a economia
das mudanças que você confirmou ter realizado.

O acesso será feito pelo navegador, sem instalar programas.

**Link de acesso:** será incluído após a publicação.

**Situação:** em validação antes da liberação para uso operacional.

## 1. Entrar e sair do sistema

1. Abra o endereço do site.
2. Digite o e-mail e a senha fornecidos pelo administrador.
3. Clique em **Entrar na plataforma**.

Você pode usar **Mostrar** para conferir a senha digitada.

Para encerrar o acesso, clique em **Sair**, no canto superior da tela.

Se precisar de acesso ou ajuda com a senha, procure o administrador.

## 2. Conhecer as telas

| Tela | Para que serve |
|---|---|
| Dashboard | Acompanhar os custos e a economia das mudanças confirmadas. |
| Nova simulação | Inserir remessas e comparar as opções de frete. |
| Validações | Registrar se a mudança de transportadora foi realizada. |
| Histórico | Consultar análises salvas e seus resultados. |
| Tabelas de frete | Atualizar as tabelas e a base de materiais. Disponível somente para o administrador. |

## 3. Fazer uma nova simulação

### Copiar os dados do Excel

Copie os dados das remessas com a linha dos títulos das colunas.

A seleção precisa conter estas colunas:

- Remessa
- Data de criação
- Preço Crédito
- Nome
- Material
- Qtd.remessa
- Incoterms
- Região
- Cidade
- Centro
- Depósito
- Denominação de item
- Tipo doc.vendas
- Transportadora
- Código

É possível inserir blocos de diferentes transportadoras,
inclusive quando os títulos das colunas se repetem entre os blocos.

### Inserir e conferir

1. Acesse **Nova simulação**.
2. Cole os dados copiados do Excel na área indicada.
3. Faça a conferência dos dados pela tela.
4. Verifique a quantidade de remessas, os itens e o valor total.
5. Leia as mensagens apresentadas antes de continuar.
6. Clique em **Calcular frete**.

Se aparecer uma mensagem de erro, confira os dados indicados,
corrija a origem e faça a leitura novamente.

**Como o valor das remessas é considerado:** o sistema soma o campo
**Preço Crédito** de cada linha. Esse valor não é multiplicado
novamente pela quantidade de itens.

## 4. Entender o comparativo de frete

Após o cálculo, consulte os resultados de cada remessa.

| Informação | Significado |
|---|---|
| Transportadora atual | Transportadora informada nos dados que você inseriu. |
| Frete atual | Custo calculado para a transportadora atual. |
| Melhor opção | Transportadora com o menor custo entre as opções disponíveis no cálculo. |
| Melhor frete | Valor calculado para essa opção. |
| Economia potencial | Quanto poderá ser economizado se a mudança for realizada. |
| Economia % | Percentual de economia em relação ao custo atual calculado. |
| Recomendação | Orientação apresentada a partir da comparação de custos. |

### Usar os filtros

- **Oportunidades:** mostra as remessas com economia identificada.
- **Todas:** mostra todas as remessas da simulação.
- **Sem cotação:** mostra as remessas sem opção de frete calculada.

Use a busca para localizar uma remessa, cidade, UF ou transportadora.

Utilize **Anterior** e **Próxima** para navegar entre as páginas.

Os filtros da listagem não alteram os indicadores gerais
apresentados acima dela.

### Quando aparecer “Sem cotação”

Abra os detalhes da remessa e consulte a observação
de cada transportadora.

A mensagem pode indicar, por exemplo:

- Rota sem tarifa cadastrada.
- Transportadora não elegível para aquela remessa.
- Item sem peso ou cubagem na base de materiais.
- Faixa de peso ou informação da tabela não localizada.

**“Sem cotação” não significa frete gratuito.**

Se precisar de ajuda, informe ao administrador o número
da remessa e a mensagem apresentada.

### Quando não houver oportunidade de economia

Isso significa que o cálculo não encontrou uma troca com
economia positiva entre as opções que conseguiu comparar.

Você ainda pode consultar todas as remessas e salvar a análise.

## 5. Salvar a análise

Após conferir o resultado, clique em **Salvar análise**.

Aguarde a mensagem de confirmação antes de sair da tela.

Salvar permite consultar posteriormente as remessas,
as cotações e as referências das tabelas usadas naquele cálculo.

Uma atualização futura das tabelas de frete não altera
automaticamente os resultados das análises já salvas.

**Salvar a análise não confirma uma mudança de transportadora
e não gera economia confirmada automaticamente.**

## 6. Registrar se você fez a mudança

As decisões podem ser registradas na área de decisões da análise
salva ou pela tela **Validações**.

Para cada oportunidade, escolha o estado correspondente:

| Estado | Quando utilizar | Entra na economia confirmada? |
|---|---|---|
| Pendente | Você ainda não concluiu ou confirmou a decisão. | Não |
| Fiz a mudança | Você realmente realizou a troca de transportadora. | Sim |
| Não fiz a mudança | Você decidiu manter a operação sem realizar a troca sugerida. | Não |

1. Localize a remessa.
2. Confira a transportadora atual e a opção sugerida.
3. Selecione o estado da decisão.
4. Acrescente uma observação, quando necessário.
5. Clique em **Salvar decisão**.
6. Aguarde a confirmação da gravação.

**Marque “Fiz a mudança” somente depois de realizar a troca.**
Não utilize essa opção apenas porque pretende mudar.

As decisões são individuais: salvar uma decisão não confirma
as demais remessas.

### O que a ferramenta considera

O sistema compara custos de frete.

Ele não avalia prazo de trânsito, SLA, qualidade do atendimento
ou preferência por transportadora.

Cabe a você considerar esses fatores e decidir se vale a pena
realizar a troca.

## 7. Consultar a tela Validações

Use essa tela para localizar oportunidades salvas e acompanhar
as decisões por remessa.

Você pode filtrar por:

- Estado da decisão.
- Número da remessa.
- Data inicial e data final.

Depois de preencher os filtros, clique em **Consultar**.

Para começar uma nova consulta, utilize **Limpar filtros**.

O período considera a data da remessa.

Se não aparecer nenhum registro, confira os filtros selecionados
e se a análise com oportunidade de economia foi salva.

Quando disponível, utilize **Histórico da decisão**
para consultar as alterações registradas.

## 8. Acompanhar o Dashboard

O dashboard reúne os resultados das mudanças confirmadas.

**Somente remessas marcadas como “Fiz a mudança” entram
nos indicadores.**

Remessas pendentes ou marcadas como “Não fiz a mudança”
ficam fora dessas somas.

### Indicadores

| Indicador | O que representa |
|---|---|
| Mudanças confirmadas | Quantidade de remessas com troca confirmada. |
| Custo original | Soma dos custos calculados nas transportadoras originais dessas remessas. |
| Custo após as mudanças | Soma dos custos calculados nas transportadoras escolhidas. |
| Economia confirmada | Diferença entre o custo original e o custo após as mudanças. |
| Redução de custo | Economia confirmada dividida pelo custo original, apresentada em percentual. |

Os gráficos e comparativos ajudam a acompanhar os resultados
por transportadora e por data.

A listagem das maiores economias destaca as remessas
com os maiores valores confirmados no período.

### Selecionar um período

1. Escolha uma opção em **Período**.
2. Preencha as datas, quando solicitado.
3. Clique em **Atualizar**.

Opções disponíveis:

- Última análise.
- Hoje.
- Data específica.
- Intervalo personalizado.
- Esta semana.
- Este mês.
- Todo o histórico.

Os períodos consideram a **data da remessa**.

A opção **Última análise** considera as mudanças confirmadas
vinculadas à análise salva mais recente.

### Por que o dashboard está zerado?

Confira se:

- Existe uma análise salva com oportunidade de economia.
- A mudança foi registrada como **Fiz a mudança**.
- A decisão foi salva com sucesso.
- A data da remessa está dentro do período selecionado.
- Você está utilizando a conta que possui esses registros.

Ter feito uma simulação, por si só, não preenche os indicadores
de economia confirmada.

## 9. Consultar o Histórico

1. Acesse **Histórico**.
2. Localize a análise desejada.
3. Abra os detalhes.
4. Consulte as remessas, as cotações e as decisões apresentadas.

Nos detalhes, você pode buscar remessas, consultar oportunidades
e navegar entre as páginas.

A seção de tabelas utilizadas informa as referências
das bases que participaram daquela análise.

Os valores apresentados são os resultados preservados
quando a análise foi salva.

## 10. Atualizar tabelas — administrador

A tela **Tabelas de frete** está disponível somente
para o administrador.

Ela permite importar tabelas de transporte e a base de materiais,
além de consultar as versões cadastradas.

### Importar um arquivo

1. Acesse **Tabelas de frete**.
2. Selecione a base correspondente ao arquivo.
3. Escolha a planilha.
4. Confira as abas identificadas e a prévia dos dados.
5. Leia as observações apresentadas.
6. Clique em **Importar arquivo completo**.
7. Aguarde a mensagem de conclusão.
8. Confira a versão ativa na listagem.

A prévia mostra apenas uma parte da planilha para conferência.
A importação utiliza os dados completos das abas lidas.

Não altere os nomes e a estrutura das planilhas sem conferir
a compatibilidade com o sistema.

Após atualizar uma tabela, faça uma nova simulação para utilizar
os dados atualizados. Análises antigas permanecem com
os resultados que foram salvos.

## 11. Alternar entre tema claro e escuro

Use o botão de tema na tela de login ou no cabeçalho do sistema.

- **Tema claro:** muda a aparência para o modo claro.
- **Tema escuro:** muda a aparência para o modo escuro.

O texto do botão indica o tema que será ativado ao clicar.

A preferência fica salva no navegador quando disponível.
A mudança de tema não altera os cálculos ou os registros salvos.

## 12. Entender os acessos

### Administrador

Utiliza as telas operacionais e gerencia as tabelas
e a base de materiais.

### Colaborador

Realiza simulações, salva análises, registra decisões
e consulta os resultados disponíveis para sua conta.

### Conta compartilhada da equipe

Se várias pessoas utilizarem a mesma conta, os registros
ficam associados a essa conta.

O sistema não identifica individualmente qual pessoa
realizou a ação usando o acesso compartilhado.

**Na configuração atual, cada conta consulta seus próprios
registros. O administrador não visualiza automaticamente
as análises criadas pela conta da equipe.**

## 13. Transportadoras consideradas

O cálculo contempla:

- Rodonaves
- Venkon
- Favorita
- Rodobrás
- Brasil Web
- Modular
- ANEG

CCA não participa da comparação de custos.

As opções disponíveis variam conforme a remessa,
as regras de atendimento e as tabelas cadastradas.

## 14. Dúvidas frequentes

### A opção mais barata é escolhida automaticamente na operação?

Não. O sistema apresenta o comparativo.
Você decide se realizará a troca e registra o que fez.

### Economia potencial e economia confirmada são a mesma coisa?

Não.

**Economia potencial** é a possibilidade identificada no cálculo.

**Economia confirmada** é a economia das remessas
em que você confirmou ter realizado a mudança.

### O sistema confere a cobrança da transportadora?

Não. Os valores são calculados com base nas tabelas utilizadas
na análise. Eles não representam uma conferência da cobrança efetiva.

### Atualizei uma tabela. O histórico será recalculado?

Não. O histórico preserva os resultados das análises salvas.

### Posso sair sem salvar a análise?

Se quiser consultar os resultados depois, salve a análise
e aguarde a confirmação antes de sair.

### Não consigo ver a tela Tabelas de frete.

Essa tela é exclusiva do administrador.

### Ocorreu um erro. O que devo enviar ao administrador?

Informe:

- A tela em que estava.
- O que tentou fazer.
- A mensagem apresentada.
- O número da remessa, quando aplicável.
- Uma captura da tela, se necessário.

Nunca envie sua senha.
