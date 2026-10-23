# LogiSync Pro - Micro-SaaS de Logística, Rotas e BI ⚡

Sistema completo e moderno para gestão de logística, rotas de entregas, acompanhamento em tempo real e Business Intelligence (BI) para pequenas e médias empresas, farmácias, e-commerces e distribuidores.

---

## 🚀 Funcionalidades Principais

1. **Multi-Tenancy Completo (Isolamento por Empresa):**
   - Cada empresa possui seu próprio ecossistema isolado de clientes, motoristas e pedidos via `empresa_id`.
   - Perfil de **Gestor** (administração completa, cadastro e BI) e **Motorista/Entregador** (visão focada na rota).

2. **Rastreamento em Tempo Real (Supabase Realtime):**
   - Atualização instantânea na tela do Gestor quando o entregador altera o status para *"Em Rota"* ou *"Entregue"*, sem precisar atualizar a página.
   - Página pública de rastreio para o cliente final: [`rastreio.html?id=ID`](rastreio.html).

3. **Painel do Entregador Otimizado para Mobile:**
   - Botões de navegação GPS direta com **Google Maps** e **Waze**.
   - Disparo de mensagem no **WhatsApp** com link de rastreamento do cliente em 1 clique.
   - Botões grandes e de toque rápido para início e conclusão de entregas.

4. **CRM de Clientes & Frota de Motoristas:**
   - Busca automática de endereço pelo **CEP** (ViaCEP).
   - Máscaras dinâmicas de telefone/WhatsApp e CEP.
   - Alerta visual para pedidos com data de entrega **atrasada**.

5. **Relatórios & Business Intelligence (BI):**
   - Filtro flexível por período (Data Inicial e Data Final).
   - KPIs automáticos: Faturamento total, Ticket Médio e Taxa de Conclusão de Entregas.
   - Gráficos interativos com **Chart.js** (Status de Entregas e Faturamento Diário).
   - Análise de densidade de entregas por **Bairro**.
   - Ranking de desempenho e produtividade por **Motorista**.
   - Exportação completa dos dados para planilha em formato **CSV**.

6. **Segurança & Experiência de Uso:**
   - Proteção rigorosa contra **XSS** com sanitização de HTML em todas as listagens.
   - Sistema moderno de notificações **Toast** e **Modais de Confirmação** (sem `alert()` ou `confirm()` nativos).
   - Estados visuais de carregamento (*Loading spinners*) nos botões.

---

## 📁 Estrutura de Arquivos

* [`index.html`](index.html): Aplicação principal (Login, Dashboard Operacional, CRM, Painel Entregador e Relatórios BI).
* [`cadastro.html`](cadastro.html): Página de onboarding e criação de nova conta de empresa.
* [`rastreio.html`](rastreio.html): Página pública de rastreamento de entregas para o cliente final com stepper visual.
* [`config.js`](config.js): Configuração centralizada do Supabase, utilitários anti-XSS, máscaras e sistema de Toast/Modais.
* [`app.js`](app.js): Lógica de negócio, integração com Supabase, Realtime, navegação de abas e gráficos.

---

## 🛠️ Tecnologias Utilizadas

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+).
* **Estilização:** Tailwind CSS & Google Fonts (*Inter*).
* **Gráficos:** Chart.js.
* **Backend as a Service:** Supabase (Auth, PostgreSQL Database & Supabase Realtime).