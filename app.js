// Configuração do Supabase
const SUPABASE_URL = 'https://haflwftqakcvcuuuswdp.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rWoa2AQikbAN9USkLOW__Q_iwB8HDvZ';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const telaLogin = document.getElementById('tela-login');
const appPrincipal = document.getElementById('app-principal');
const formLogin = document.getElementById('form-login');
const erroLogin = document.getElementById('erro-login');
const infoUsuario = document.getElementById('info-usuario-logado');

const formCliente = document.getElementById('form-cliente');
const formPedido = document.getElementById('form-pedido');
const tabelaClientes = document.getElementById('tabela-clientes');
const tabelaPedidos = document.getElementById('tabela-pedidos');
const selectCliente = document.getElementById('select-cliente');

const filtroData = document.getElementById('filtro-data');
const inputBusca = document.getElementById('input-busca');
const filtroDataEntregador = document.getElementById('filtro-data-entregador');
const listaEntregador = document.getElementById('lista-entregador');
const filtroMesRelatorio = document.getElementById('filtro-mes-relatorio');

let todosPedidos = [];
let todosClientes = [];
let usuarioLogado = null;
let perfilUsuario = null; // Guarda os dados da tabela 'perfis' (incluindo empresa_id e cargo)
let chartStatusInstance = null;
let chartFaturamentoInstance = null;

const hojeISO = new Date().toISOString().split('T')[0];
const mesAtualISO = hojeISO.substring(0, 7);
if (filtroData) filtroData.value = '';
if (filtroDataEntregador) filtroDataEntregador.value = hojeISO;
if (filtroMesRelatorio) filtroMesRelatorio.value = mesAtualISO;

// ================= AUTENTICAÇÃO & CONTROLE DE PERFIS =================

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    erroLogin.textContent = "Autenticando...";

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: senha
        });

        if (error) throw error;

        usuarioLogado = data.user;
        await carregarPerfilEVerificarSessao();
    } catch (err) {
        erroLogin.textContent = "❌ Erro ao entrar: " + err.message;
    }
});

async function carregarPerfilEVerificarSessao() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        usuarioLogado = session.user;

        // Busca o perfil na tabela 'perfis' para descobrir a empresa_id e o cargo exato
        const { data: perfil, error: erroPerfil } = await supabaseClient
            .from('perfis')
            .select('*, empresas(nome_empresa, plano)')
            .eq('id', usuarioLogado.id)
            .single();

        if (erroPerfil || !perfil) {
            erroLogin.textContent = "❌ Erro: Perfil de utilizador não encontrado na base de dados.";
            await supabaseClient.auth.signOut();
            return;
        }

        perfilUsuario = perfil;
        telaLogin.classList.add('hidden');
        appPrincipal.classList.remove('hidden');
        
        const nomeEmpresa = perfil.empresas ? perfil.empresas.nome_empresa : 'Empresa';
        infoUsuario.textContent = `Empresa: ${nomeEmpresa} | Logado como: ${perfil.nome} (${perfil.cargo})`;

        if (perfil.cargo === 'motorista') {
            // Oculta abas de gestor e relatórios, força o modo entregador
            document.getElementById('menu-abas').classList.add('hidden');
            mudarAba('entregador');
        } else {
            carregarClientes();
            carregarPedidos();
        }
    } else {
        telaLogin.classList.remove('hidden');
        appPrincipal.classList.add('hidden');
    }
}

window.fazerLogout = async function() {
    await supabaseClient.auth.signOut();
    location.reload();
};

// ================= NAVEGAÇÃO POR ABAS =================

window.mudarAba = function(aba) {
    const btnGestor = document.getElementById('btn-aba-gestor');
    const btnEntregador = document.getElementById('btn-aba-entregador');
    const btnRelatorios = document.getElementById('btn-aba-relatorios');

    const divGestor = document.getElementById('aba-gestor');
    const divEntregador = document.getElementById('aba-entregador');
    const divRelatorios = document.getElementById('aba-relatorios');

    if (btnGestor) btnGestor.className = "bg-gray-200 text-gray-700 px-5 py-2 rounded-lg font-semibold shadow transition hover:bg-gray-300";
    if (btnEntregador) btnEntregador.className = "bg-gray-200 text-gray-700 px-5 py-2 rounded-lg font-semibold shadow transition hover:bg-gray-300";
    if (btnRelatorios) btnRelatorios.className = "bg-gray-200 text-gray-700 px-5 py-2 rounded-lg font-semibold shadow transition hover:bg-gray-300";

    if (divGestor) divGestor.classList.add('hidden');
    if (divEntregador) divEntregador.classList.add('hidden');
    if (divRelatorios) divRelatorios.classList.add('hidden');

    if (aba === 'gestor' && divGestor) {
        divGestor.classList.remove('hidden');
        if (btnGestor) btnGestor.className = "bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold shadow transition";
    } else if (aba === 'entregador' && divEntregador) {
        divEntregador.classList.remove('hidden');
        if (btnEntregador) btnEntregador.className = "bg-orange-600 text-white px-5 py-2 rounded-lg font-semibold shadow transition";
        renderizarPainelEntregador(todosPedidos);
    } else if (aba === 'relatorios' && divRelatorios) {
        divRelatorios.classList.remove('hidden');
        if (btnRelatorios) btnRelatorios.className = "bg-purple-600 text-white px-5 py-2 rounded-lg font-semibold shadow transition";
        atualizarRelatoriosBI(todosPedidos);
    }
};

// ================= CRM: CLIENTES (COM FILTRO DE EMPRESA) =================

async function carregarClientes() {
    try {
        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;

        todosClientes = data || [];
        tabelaClientes.innerHTML = '';
        selectCliente.innerHTML = '<option value="">Selecione um cliente...</option>';

        if (todosClientes.length === 0) {
            tabelaClientes.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Nenhum cliente cadastrado.</td></tr>`;
            return;
        }

        todosClientes.forEach(cliente => {
            const linha = document.createElement('tr');
            linha.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${cliente.nome}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${cliente.telefone || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${cliente.endereco}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${cliente.bairro || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-2">
                    <button onclick="prepararEdicaoCliente(${cliente.id})" class="bg-amber-500 text-white px-2 py-1 rounded text-xs hover:bg-amber-600 transition" title="Editar">✏️</button>
                    <button onclick="excluirCliente(${cliente.id})" class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 transition" title="Excluir">🗑️</button>
                </td>
            `;
            tabelaClientes.appendChild(linha);

            const option = document.createElement('option');
            option.value = cliente.id;
            option.textContent = `${cliente.nome} (${cliente.endereco} - ${cliente.bairro || ''})`;
            selectCliente.appendChild(option);
        });
    } catch (err) {
        console.error("Erro ao carregar clientes:", err);
    }
}

formCliente.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idEditando = document.getElementById('cliente-id-editando').value;
    
    const dadosCliente = {
        nome: document.getElementById('nome').value,
        telefone: document.getElementById('telefone').value,
        endereco: document.getElementById('endereco').value,
        bairro: document.getElementById('bairro').value,
        empresa_id: perfilUsuario.empresa_id // <--- Atrela o cliente à empresa logada
    };

    try {
        if (idEditando) {
            const { error } = await supabaseClient.from('clientes').update(dadosCliente).eq('id', idEditando);
            if (error) throw error;
            alert('Cliente atualizado com sucesso!');
            cancelarEdicaoCliente();
        } else {
            const { error } = await supabaseClient.from('clientes').insert([dadosCliente]);
            if (error) throw error;
            formCliente.reset();
            alert('Cliente cadastrado com sucesso!');
        }
        carregarClientes();
        carregarPedidos();
    } catch (err) {
        alert('Erro ao salvar cliente: ' + err.message);
    }
});

window.prepararEdicaoCliente = function(id) {
    const cliente = todosClientes.find(c => c.id === id);
    if (!cliente) return;

    document.getElementById('cliente-id-editando').value = cliente.id;
    document.getElementById('nome').value = cliente.nome;
    document.getElementById('telefone').value = cliente.telefone || '';
    document.getElementById('endereco').value = cliente.endereco;
    document.getElementById('bairro').value = cliente.bairro || '';

    document.getElementById('titulo-form-cliente').textContent = "✏️ Editar Cliente";
    document.getElementById('btn-salvar-cliente').textContent = "Atualizar Cliente";
    document.getElementById('btn-cancelar-edicao').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.cancelarEdicaoCliente = function() {
    formCliente.reset();
    document.getElementById('cliente-id-editando').value = '';
    document.getElementById('titulo-form-cliente').textContent = "👥 Cadastrar Novo Cliente";
    document.getElementById('btn-salvar-cliente').textContent = "Salvar Cliente";
    document.getElementById('btn-cancelar-edicao').classList.add('hidden');
};

window.excluirCliente = async function(id) {
    if (!confirm('Tem certeza que deseja excluir este cliente? Pedidos vinculados podem ser afetados.')) return;
    try {
        const { error } = await supabaseClient.from('clientes').delete().eq('id', id);
        if (error) throw error;
        carregarClientes();
        carregarPedidos();
    } catch (err) {
        alert('Erro ao excluir cliente: ' + err.message);
    }
};

// ================= GESTÃO DE PEDIDOS =================

async function carregarPedidos() {
    try {
        const { data, error } = await supabaseClient
            .from('pedidos')
            .select(`*, clientes (nome, endereco, telefone, bairro)`)
            .order('id', { ascending: false });

        if (error) throw error;

        todosPedidos = data || [];
        atualizarDashboard(todosPedidos);
        renderizarTabelaPedidos(todosPedidos);
        renderizarPainelEntregador(todosPedidos);

        const abaRelatorios = document.getElementById('aba-relatorios');
        if (abaRelatorios && !abaRelatorios.classList.contains('hidden')) {
            atualizarRelatoriosBI(todosPedidos);
        }
    } catch (err) {
        console.error("Erro ao carregar pedidos:", err);
    }
}

function renderizarTabelaPedidos(pedidos) {
    tabelaPedidos.innerHTML = '';
    const dataFiltro = filtroData.value;
    const termoBusca = inputBusca.value.toLowerCase();

    const pedidosFiltrados = pedidos.filter(pedido => {
        const nomeCliente = pedido.clientes ? pedido.clientes.nome.toLowerCase() : '';
        const enderecoCliente = pedido.clientes ? pedido.clientes.endereco.toLowerCase() : '';
        const descricao = pedido.descricao_pedido.toLowerCase();

        const matchData = dataFiltro ? pedido.data_entrega === dataFiltro : true;
        const matchBusca = nomeCliente.includes(termoBusca) || enderecoCliente.includes(termoBusca) || descricao.includes(termoBusca);

        return matchData && matchBusca;
    });

    if (pedidosFiltrados.length === 0) {
        tabelaPedidos.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">Nenhum pedido encontrado.</td></tr>`;
        return;
    }

    pedidosFiltrados.forEach(pedido => {
        const nomeCliente = pedido.clientes ? pedido.clientes.nome : 'Cliente não encontrado';
        const enderecoCliente = pedido.clientes ? pedido.clientes.endereco : '-';
        const isEntregue = pedido.status === 'Entregue';

        const linha = document.createElement('tr');
        linha.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${nomeCliente}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${enderecoCliente}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${pedido.descricao_pedido}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">R$ ${Number(pedido.valor).toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${pedido.data_entrega}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isEntregue ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                    ${pedido.status}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-2">
                ${!isEntregue ? `
                    <button onclick="marcarComoEntregue(${pedido.id})" class="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition">Entregar</button>
                ` : `<span class="text-gray-400 text-xs self-center">Concluído</span>`}
                <button onclick="excluirPedido(${pedido.id})" class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 transition" title="Excluir">🗑️</button>
            </td>
        `;
        tabelaPedidos.appendChild(linha);
    });
}

function renderizarPainelEntregador(pedidos) {
    if (!listaEntregador) return;
    listaEntregador.innerHTML = '';
    const dataSelecionada = filtroDataEntregador.value;
    const pedidosRua = pedidos.filter(p => dataSelecionada ? p.data_entrega === dataSelecionada : true);

    if (pedidosRua.length === 0) {
        listaEntregador.innerHTML = `<div class="p-6 text-center text-gray-500 bg-gray-50 rounded-lg">Nenhuma entrega agendada para esta data.</div>`;
        return;
    }

    pedidosRua.forEach(pedido => {
        const cliente = pedido.clientes || {};
        const nome = cliente.nome || 'Cliente não informado';
        const endereco = cliente.endereco || 'Endereço não informado';
        const bairro = cliente.bairro ? ` - ${cliente.bairro}` : '';
        const telefone = cliente.telefone ? cliente.telefone.replace(/\D/g, '') : '';
        const isEntregue = pedido.status === 'Entregue';

        const linkGoogleMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco + bairro)}`;
        const linkWaze = `https://waze.com/ul?q=${encodeURIComponent(endereco + bairro)}&navigate=yes`;
        const mensagemWhats = encodeURIComponent(`Olá ${nome}, seu pedido (${pedido.descricao_pedido}) está a caminho para entrega! 🛵💨`);
        const linkWhatsApp = telefone ? `https://wa.me/55${telefone}?text=${mensagemWhats}` : `#`;

        const card = document.createElement('div');
        card.className = `p-4 rounded-lg border shadow-sm ${isEntregue ? 'bg-green-50 border-green-200 opacity-75' : 'bg-white border-gray-200'}`;
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h3 class="font-bold text-lg text-gray-800">${nome}</h3>
                    <p class="text-sm text-gray-600">📍 ${endereco}${bairro}</p>
                </div>
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${isEntregue ? 'bg-green-200 text-green-900' : 'bg-yellow-100 text-yellow-800'}">${pedido.status}</span>
            </div>
            <div class="mb-3 text-sm text-gray-700">
                <p><strong>📦 Pedido:</strong> ${pedido.descricao_pedido}</p>
                <p><strong>💰 Valor:</strong> R$ ${Number(pedido.valor).toFixed(2)}</p>
            </div>
            <div class="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                <a href="${linkGoogleMaps}" target="_blank" class="bg-blue-600 text-white px-3 py-2 rounded text-xs font-medium hover:bg-blue-700 transition">🗺️ Google Maps</a>
                <a href="${linkWaze}" target="_blank" class="bg-sky-500 text-white px-3 py-2 rounded text-xs font-medium hover:bg-sky-600 transition">🚗 Waze</a>
                ${telefone ? `<a href="${linkWhatsApp}" target="_blank" class="bg-emerald-600 text-white px-3 py-2 rounded text-xs font-medium hover:bg-emerald-700 transition">💬 WhatsApp</a>` : ''}
                <div class="ml-auto">
                    ${!isEntregue ? `<button onclick="marcarComoEntregue(${pedido.id})" class="bg-green-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-green-700 transition">✅ Concluir</button>` : `<span class="text-green-700 font-semibold text-xs self-center">Entregue!</span>`}
                </div>
            </div>
        `;
        listaEntregador.appendChild(card);
    });
}

// ================= RELATÓRIOS & MÉTRICAS POR BAIRRO =================

function atualizarRelatoriosBI(pedidos) {
    const mesSelecionado = filtroMesRelatorio.value;
    const pedidosMes = pedidos.filter(p => p.data_entrega && p.data_entrega.startsWith(mesSelecionado));

    const totalMes = pedidosMes.length;
    const concluidasMes = pedidosMes.filter(p => p.status === 'Entregue').length;
    const pendentesMes = pedidosMes.filter(p => p.status === 'Pendente').length;
    const faturamentoMes = pedidosMes.reduce((acc, p) => acc + Number(p.valor), 0);
    const ticketMedio = totalMes > 0 ? faturamentoMes / totalMes : 0;
    const taxaConclusao = totalMes > 0 ? (concluidasMes / totalMes) * 100 : 0;

    document.getElementById('rel-faturamento').textContent = `R$ ${faturamentoMes.toFixed(2)}`;
    document.getElementById('rel-ticket').textContent = `R$ ${ticketMedio.toFixed(2)}`;
    document.getElementById('rel-taxa').textContent = `${taxaConclusao.toFixed(1)}%`;

    // Gráfico de Status
    const ctxStatus = document.getElementById('graficoStatus').getContext('2d');
    if (chartStatusInstance) chartStatusInstance.destroy();
    chartStatusInstance = new Chart(ctxStatus, {
        type: 'doughnut',
        data: { labels: ['Concluídas', 'Pendentes'], datasets: [{ data: [concluidasMes, pendentesMes], backgroundColor: ['#10B981', '#F59E0B'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Gráfico de Faturamento por Dia
    const faturamentoPorDia = {};
    pedidosMes.forEach(p => {
        faturamentoPorDia[p.data_entrega] = (faturamentoPorDia[p.data_entrega] || 0) + Number(p.valor);
    });
    const diasOrdenados = Object.keys(faturamentoPorDia).sort();

    const ctxFat = document.getElementById('graficoFaturamento').getContext('2d');
    if (chartFaturamentoInstance) chartFaturamentoInstance.destroy();
    chartFaturamentoInstance = new Chart(ctxFat, {
        type: 'bar',
        data: {
            labels: diasOrdenados.map(d => d.split('-').reverse().join('/')),
            datasets: [{ label: 'Faturamento (R$)', data: diasOrdenados.map(d => faturamentoPorDia[d]), backgroundColor: '#6366F1' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Métricas por Bairro
    const bairrosMap = {};
    pedidosMes.forEach(p => {
        const bairro = p.clientes && p.clientes.bairro ? p.clientes.bairro : 'Não informado';
        if (!bairrosMap[bairro]) bairrosMap[bairro] = { qtd: 0, valor: 0 };
        bairrosMap[bairro].qtd += 1;
        bairrosMap[bairro].valor += Number(p.valor);
    });

    const tabelaBairros = document.getElementById('tabela-bairros');
    tabelaBairros.innerHTML = '';
    const bairrosOrdenados = Object.keys(bairrosMap).sort((a, b) => bairrosMap[b].qtd - bairrosMap[a].qtd);

    if (bairrosOrdenados.length === 0) {
        tabelaBairros.innerHTML = `<tr><td colspan="3" class="px-4 py-3 text-center text-gray-500">Nenhum dado para este mês.</td></tr>`;
        return;
    }

    bairrosOrdenados.forEach(bairro => {
        const dados = bairrosMap[bairro];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-4 py-2 font-medium text-gray-800">${bairro}</td>
            <td class="px-4 py-2 text-gray-600">${dados.qtd} entregas</td>
            <td class="px-4 py-2 text-gray-600">R$ ${dados.valor.toFixed(2)}</td>
        `;
        tabelaBairros.appendChild(tr);
    });
}

// ================= EXPORTAÇÃO CSV =================

window.exportarParaCSV = function() {
    if (todosPedidos.length === 0) { alert('Sem dados.'); return; }
    let csvContent = "data:text/csv;charset=utf-8,ID,Cliente,Endereco,Bairro,Pedido,Valor,Data,Status\n";
    todosPedidos.forEach(p => {
        const c = p.clientes || {};
        csvContent += [p.id, `"${c.nome || ''}"`, `"${c.endereco || ''}"`, `"${c.bairro || ''}"`, `"${p.descricao_pedido || ''}"`, p.valor, p.data_entrega, p.status].join(",") + "\r\n";
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `relatorio_rotas_${hojeISO}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ================= AÇÕES DO SISTEMA =================

window.marcarComoEntregue = async function(id) {
    try {
        await supabaseClient.from('pedidos').update({ status: 'Entregue' }).eq('id', id);
        carregarPedidos();
    } catch (err) { alert('Erro: ' + err.message); }
};

window.excluirPedido = async function(id) {
    if (!confirm('Excluir este pedido?')) return;
    try {
        await supabaseClient.from('pedidos').delete().eq('id', id);
        carregarPedidos();
    } catch (err) { alert('Erro: ' + err.message); }
};

function atualizarDashboard(pedidos) {
    document.getElementById('stat-total').textContent = pedidos.length;
    document.getElementById('stat-pendentes').textContent = pedidos.filter(p => p.status === 'Pendente').length;
    document.getElementById('stat-concluidas').textContent = pedidos.filter(p => p.status === 'Entregue').length;
    document.getElementById('stat-faturamento').textContent = `R$ ${pedidos.reduce((acc, p) => acc + Number(p.valor), 0).toFixed(2)}`;
}

// Eventos
if (filtroData) filtroData.addEventListener('change', () => renderizarTabelaPedidos(todosPedidos));
if (inputBusca) inputBusca.addEventListener('input', () => renderizarTabelaPedidos(todosPedidos));
if (filtroDataEntregador) filtroDataEntregador.addEventListener('change', () => renderizarPainelEntregador(todosPedidos));
if (filtroMesRelatorio) filtroMesRelatorio.addEventListener('change', () => atualizarRelatoriosBI(todosPedidos));

if (formPedido) {
    formPedido.addEventListener('submit', async (e) => {
        e.preventDefault();
        const novoPedido = {
            cliente_id: document.getElementById('select-cliente').value,
            data_entrega: document.getElementById('data-entrega').value,
            descricao_pedido: document.getElementById('descricao-pedido').value,
            valor: document.getElementById('valor-pedido').value,
            status: 'Pendente',
            empresa_id: perfilUsuario.empresa_id // <--- Atrela o pedido à empresa logada
        };
        try {
            await supabaseClient.from('pedidos').insert([novoPedido]);
            formPedido.reset();
            carregarPedidos();
            alert('Pedido lançado!');
        } catch (err) { alert('Erro: ' + err.message); }
    });
}

// Inicialização: Verifica se já tem sessão ativa no Supabase
carregarPerfilEVerificarSessao();