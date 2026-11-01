# Simulador de Frete

Ferramenta para comparar opções de transporte e acompanhar a economia
potencial e a economia confirmada nas operações.

## Status do projeto

Em desenvolvimento. Ainda não liberado para uso operacional.

Este manual será atualizado conforme as funcionalidades forem
implementadas e testadas.

## Objetivo

Disponibilizar o Simulador de Frete em uma aplicação web independente
do Validador de Shipping.

O projeto contempla a simulação de fretes, a consulta de resultados,
o histórico das análises e a gestão das bases utilizadas no cálculo.

## Acessos previstos

### Administrador

- Gerenciar tabelas de frete e base de materiais.
- Ajustar as configurações disponíveis no sistema.
- Executar simulações e consultar resultados.
- Consultar o histórico e corrigir validações.

### Funcionários

A equipe utilizará uma conta compartilhada.

- Executar simulações.
- Consultar resultados e histórico.
- Confirmar a aplicação das recomendações.
- Consultar os indicadores de economia.

A conta compartilhada não identifica individualmente quem realizou
cada ação.

## Áreas previstas

- Dashboard.
- Nova Simulação.
- Validações.
- Histórico.
- Administração de tabelas de frete e base de materiais.

## Manual de utilização

As instruções detalhadas serão adicionadas após a implementação
e a verificação de cada tela.

### 1. Acessar o sistema

Em elaboração.

### 2. Inserir os dados das remessas

Em elaboração.

### 3. Executar uma simulação

Em elaboração.

### 4. Consultar o comparativo de transportadoras

Em elaboração.

### 5. Confirmar as alterações realizadas

Em elaboração.

### 6. Consultar o dashboard e o histórico

Em elaboração.

### 7. Atualizar as tabelas — administrador

Em elaboração.

## Conceitos de economia

### Economia potencial

Valor que poderá ser economizado caso a recomendação do simulador
seja aplicada.

### Economia realizada

Valor referente às recomendações que tiveram sua aplicação
confirmada pelo operador.

Uma simulação não gera economia realizada automaticamente.

## Validação dos cálculos

Antes da liberação operacional, os resultados serão comparados
com o simulador original em Excel/VBA.

A comparação deverá considerar os custos por transportadora,
os pesos, a cubagem, a elegibilidade e a economia calculada.

## Cuidados com os arquivos

Não adicionar a este repositório:

- Senhas ou chaves secretas.
- Planilhas com dados operacionais.
- Tabelas comerciais de frete.
- Dados reais de clientes e remessas.
- Arquivos de configuração contendo credenciais.

## Publicação prevista

- Interface: GitHub Pages.
- Autenticação, banco de dados e processamento protegido: Supabase.

Endereço do sistema: será informado após a publicação.
