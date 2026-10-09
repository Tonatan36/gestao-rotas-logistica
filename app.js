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
const formMotorista = document.getElementById('form-motorista');
const formPedido = document.getElementById('form-pedido');

const tabelaClientes = document.getElementById('tabela-clientes');
const tabelaMotoristas = document.getElementById('tabela-motoristas');
const tabelaPedidos = document.getElementById('tabela-pedidos');

const selectCliente = document.getElementById('select-cliente');
const selectMotorista = document.getElementById('select-motorista');

const filtroData = document.getElementById('filtro-data');
const inputBusca = document.getElementById('input-busca');
const filtroDataEntregador = document.getElementById('filtro-data-entregador');
const listaEntregador = document.getElementById('lista-entregador');
const filtroMesRelatorio = document.getElementById('filtro-mes-relatorio');

let todosPedidos = [];
let todosClientes = [];
let todosMotoristas = [];
let usuarioLogado = null;
let perfilUsuario = null;
let chartStatusInstance = null;
let chartFaturamentoInstance = null;

const hojeISO = new Date().toISOString().split('T')[0];
const mesAtualISO = hojeISO.substring(0, 7);
if (filtroData) filtroData.value = '';
if (filtroDataEntregador) filtroDataEntregador.value = hojeISO;
if (filtroMesRelatorio) filtroMesRelatorio.value = mesAtualISO;

// ================= AUTENTICAÇÃO & PERFIS =================

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    erroLogin.textContent = "Autenticando...";

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
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
        const { data: perfil, error: erroPerfil } = await supabaseClient
            .from('perfis')
            .select('*, empresas(nome_empresa, plano)')
            .eq('id', usuarioLogado.id)
            .single();

        if (erroPerfil || !perfil) {
            erroLogin.textContent = "❌ Erro: Perfil não encontrado.";
            await supabaseClient.auth.signOut();
            return;
        }

        perfilUsuario = perfil;
        telaLogin.classList.add('hidden');
        appPrincipal.classList.remove('hidden');
        
        const nomeEmpresa = perfil.empresas ? perfil.empresas.nome_empresa : 'Empresa';
        infoUsuario.textContent = `Empresa: ${nomeEmpresa} | Logado como: ${perfil.nome} (${perfil.cargo})`;

        if (perfil.cargo === 'motorista') {
            document.getElementById('menu-abas').classList.add('hidden');
            mudarAba('entregador');
        } else {
            carregarClientes();
            carregarMotoristas();
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

// ================= NAVEGAÇÃO =================

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

// ================= CRM: CLIENTES =================

async function carregarClientes() {
    try {
        const { data, error } = await supabaseClient.from('clientes').select('*').order('id', { ascending: false });
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
                    <button onclick="prepararEdicaoCliente(${cliente.id})" class="bg-amber-500 text-white px-2 py-1 rounded text-xs hover:bg-amber-600">✏️</button>
                    <button onclick="excluirCliente(${cliente.id})" class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600">🗑️</button>
                </td>
            `;
            tabelaClientes.appendChild(linha);

            const opt = document.createElement('option');
            opt.value = cliente.id;
            opt.textContent = `${cliente.nome} (${cliente.endereco} - ${cliente.bairro || ''})`;
            selectCliente.appendChild(opt);
        });
    } catch (err) { console.error("Erro clientes:", err); }
}

formCliente.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idEditando = document.getElementById('cliente-id-editando').value;
    const dados = {
        nome: document.getElementById('nome').value,
        telefone: document.getElementById('telefone').value,
        endereco: document.getElementById('endereco').value,
        bairro: document.getElementById('bairro').value,
        empresa_id: perfilUsuario.empresa_id
    };

    try {
        if (idEditando) {
            await supabaseClient.from('clientes').update(dados).eq('id', idEditando);
            cancelarEdicaoCliente();
        } else {
            await supabaseClient.from('clientes').insert([dados]);
            formCliente.reset();
        }
        carregarClientes();
        carregarPedidos();
    } catch (err) { alert('Erro: ' + err.message); }
});

window.prepararEdicaoCliente = function(id) {
    const c = todosClientes.find(x => x.id === id);
    if (!c) return;
    document.getElementById('cliente-id-editando').value = c.id;
    document.getElementById('nome').value = c.nome;
    document.getElementById('telefone').value = c.telefone || '';
    document.getElementById('endereco').value = c.endereco;
    document.getElementById('bairro').value = c.bairro || '';
    document.getElementById('titulo-form-cliente').textContent = "✏️ Editar Cliente";
    document.getElementById('btn-salvar-cliente').textContent = "Atualizar Cliente";
    document.getElementById('btn-cancelar-edicao').classList.remove('hidden');
};

window.cancelarEdicaoCliente = function() {
    formCliente.reset();
    document.getElementById('cliente-id-editando').value = '';
    document.getElementById('titulo-form-cliente').textContent = "👥 Cadastrar Novo Cliente";
    document.getElementById('btn-salvar-cliente').textContent = "Salvar Cliente";
    document.getElementById('btn-cancelar-edicao').classList.add('hidden');
};

window.excluirCliente = async function(id) {
    if (!confirm('Excluir cliente?')) return;
    try {
        await supabaseClient.from('clientes').delete().eq('id', id);
        carregarClientes();
        carregarPedidos();
    } catch (err) { alert('Erro: ' + err.message); }
};

// ================= GESTÃO DE MOTORISTAS =================

async function carregarMotoristas() {
    try {
        const { data, error } = await supabaseClient.from('motoristas').select('*').order('id', { ascending: false });
        if (error) throw error;
        todosMotoristas = data || [];
        tabelaMotoristas.innerHTML = '';
        selectMotorista.innerHTML = '<option value="">Nenhum / Atribuição livre</option>';

        if (todosMotoristas.length === 0) {
            tabelaMotoristas.innerHTML = `<tr><td colspan="4" class="px-4 py-3 text-center text-gray-500">Nenhum motorista cadastrado.</td></tr>`;
            return;
        }

        todosMotoristas.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-4 py-2 font-medium text-gray-900">${m.nome}</td>
                <td class="px-4 py-2 text-gray-500">${m.telefone || '-'}</td>
                <td class="px-4 py-2 text-gray-500">${m.veiculo || '-'}</td>
                <td class="px-4 py-2">
                    <button onclick="excluirMotorista(${m.id})" class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600">🗑️</button>
                </td>
            `;
            tabelaMotoristas.appendChild(tr);

            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.nome} (${m.veiculo || 'Moto/Carro'})`;
            selectMotorista.appendChild(opt);
        });
    } catch (err) { console.error("Erro motoristas:", err); }
}

formMotorista.addEventListener('submit', async (e) => {
    e.preventDefault();
    const novoMoto = {
        nome: document.getElementById('moto-nome').value,
        telefone: document.getElementById('moto-telefone').value,
        veiculo: document.getElementById('moto-veiculo').value,
        empresa_id: perfilUsuario.empresa_id
    };
    try {
        const { error } = await supabaseClient.from('motoristas').insert([novoMoto]);
        if (error) throw error;
        formMotorista.reset();
        carregarMotoristas();
        alert('Motorista cadastrado com sucesso!');
    } catch (err) { alert('Erro: ' + err.message); }
});

window.excluirMotorista = async function(id) {
    if (!confirm('Excluir este motorista?')) return;
    try {
        await supabaseClient.from('motoristas').delete().eq('id', id);
        carregarMotoristas();
    } catch (err) { alert('Erro: ' + err.message); }
};

// ================= GESTÃO DE PEDIDOS =================

async function carregarPedidos() {
    try {
        const { data, error } = await supabaseClient
            .from('pedidos')
            .select(`*, clientes (nome, endereco, telefone, bairro), motoristas (id, nome, veiculo)`)
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
    } catch (err) { console.error("Erro pedidos:", err); }
}

function renderizarTabelaPedidos(pedidos) {
    tabelaPedidos.innerHTML = '';
    const dataFiltro = filtroData.value;
    const termoBusca = inputBusca.value.toLowerCase();

    const pedidosFiltrados = pedidos.filter(p => {
        const nomeCliente = p.clientes ? p.clientes.nome.toLowerCase() : '';
        const enderecoCliente = p.clientes ? p.clientes.endereco.toLowerCase() : '';
        const descricao = p.descricao_pedido.toLowerCase();
        const matchData = dataFiltro ? p.data_entrega === dataFiltro : true;
        const matchBusca = nomeCliente.includes(termoBusca) || enderecoCliente.includes(termoBusca) || descricao.includes(termoBusca);
        return matchData && matchBusca;
    });

    if (pedidosFiltrados.length === 0) {
        tabelaPedidos.innerHTML = `<tr><td colspan="8" class="px-6 py-4 text-center text-gray-500">Nenhum pedido encontrado.</td></tr>`;
        return;
    }

    pedidosFiltrados.forEach(p => {
        const nomeCliente = p.clientes ? p.clientes.nome : 'Não encontrado';
        const enderecoCliente = p.clientes ? p.clientes.endereco : '-';
        const motoristaAtualId = p.motorista_id || '';

        let optionsMotoristas = `<option value="">(Livre / Sem Atribuição)</option>`;
        todosMotoristas.forEach(m => {
            const selected = m.id == motoristaAtualId ? 'selected' : '';
            optionsMotoristas += `<option value="${m.id}" ${selected}>${m.nome}</option>`;
        });

        let statusBadge = '';
        if (p.status === 'Pendente') statusBadge = 'bg-yellow-100 text-yellow-800';
        else if (p.status === 'Em Separação') statusBadge = 'bg-blue-100 text-blue-800';
        else if (p.status === 'Em Rota') statusBadge = 'bg-purple-100 text-purple-800';
        else if (p.status === 'Entregue') statusBadge = 'bg-green-100 text-green-800';
        else statusBadge = 'bg-red-100 text-red-800';

        const linha = document.createElement('tr');
        linha.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${nomeCliente}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${enderecoCliente}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.descricao_pedido}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <select onchange="atribuirMotoristaDireto(${p.id}, this.value)" class="p-1 border border-gray-300 rounded text-xs bg-gray-50 text-orange-700 font-medium">
                    ${optionsMotoristas}
                </select>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">R$ ${Number(p.valor).toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.data_entrega}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <select onchange="atualizarStatusPedido(${p.id}, this.value)" class="px-2 py-1 text-xs font-semibold rounded-full ${statusBadge} border border-gray-200 cursor-pointer">
                    <option value="Pendente" ${p.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                    <option value="Em Separação" ${p.status === 'Em Separação' ? 'selected' : ''}>Em Separação</option>
                    <option value="Em Rota" ${p.status === 'Em Rota' ? 'selected' : ''}>Em Rota</option>
                    <option value="Entregue" ${p.status === 'Entregue' ? 'selected' : ''}>Entregue</option>
                    <option value="Cancelado" ${p.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="excluirPedido(${p.id})" class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600">🗑️</button>
            </td>
        `;
        tabelaPedidos.appendChild(linha);
    });
}

window.atribuirMotoristaDireto = async function(pedidoId, motoristaId) {
    try {
        const novoId = motoristaId ? motoristaId : null;
        await supabaseClient.from('pedidos').update({ motorista_id: novoId }).eq('id', pedidoId);
        carregarPedidos();
    } catch (err) { alert('Erro ao atribuir motorista: ' + err.message); }
};

window.atualizarStatusPedido = async function(pedidoId, novoStatus) {
    try {
        await supabaseClient.from('pedidos').update({ status: novoStatus }).eq('id', pedidoId);
        carregarPedidos();
    } catch (err) { alert('Erro ao atualizar status: ' + err.message); }
};

function renderizarPainelEntregador(pedidos) {
    if (!listaEntregador) return;
    listaEntregador.innerHTML = '';
    const dataSelecionada = filtroDataEntregador.value;
    
    let pedidosRua = pedidos.filter(p => dataSelecionada ? p.data_entrega === dataSelecionada : true);

    if (perfilUsuario && perfilUsuario.cargo === 'motorista') {
        const nomeLogado = perfilUsuario.nome.trim().toLowerCase();
        pedidosRua = pedidosRua.filter(p => {
            if (!p.motoristas || !p.motoristas.nome) return false;
            const nomePedidoMoto = p.motoristas.nome.trim().toLowerCase();
            return nomePedidoMoto.includes(nomeLogado) || nomeLogado.includes(nomePedidoMoto);
        });
    }

    if (pedidosRua.length === 0) {
        listaEntregador.innerHTML = `<div class="p-6 text-center text-gray-500 bg-gray-50 rounded-lg">Nenhuma entrega agendada para esta data ou atribuída a si (${perfilUsuario ? perfilUsuario.nome : ''}).</div>`;
        return;
    }

    pedidosRua.forEach(p => {
        const cliente = p.clientes || {};
        const nome = cliente.nome || 'Cliente';
        const endereco = cliente.endereco || 'Endereço';
        const bairro = cliente.bairro ? ` - ${cliente.bairro}` : '';
        const telefone = cliente.telefone ? cliente.telefone.replace(/\D/g, '') : '';
        const isEntregue = p.status === 'Entregue';

        const linkMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco + bairro)}`;
        const linkWaze = `https://waze.com/ul?q=${encodeURIComponent(endereco + bairro)}&navigate=yes`;
        const linkWhats = telefone ? `https://wa.me/55${telefone}?text=${encodeURIComponent(`Olá ${nome}, o seu pedido está a caminho! 🛵💨`)}` : '#';

        const card = document.createElement('div');
        card.className = `p-4 rounded-lg border shadow-sm ${isEntregue ? 'bg-green-50 border-green-200 opacity-75' : 'bg-white border-gray-200'}`;
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h3 class="font-bold text-lg text-gray-800">${nome}</h3>
                    <p class="text-sm text-gray-600">📍 ${endereco}${bairro}</p>
                </div>
                <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">${p.status}</span>
            </div>
            <div class="mb-3 text-sm text-gray-700">
                <p><strong>📦 Pedido:</strong> ${p.descricao_pedido}</p>
                <p><strong>💰 Valor:</strong> R$ ${Number(p.valor).toFixed(2)}</p>
                <p><strong>🛵 Motorista:</strong> ${p.motoristas ? p.motoristas.nome : 'Livre'}</p>
            </div>
            <div class="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                <a href="${linkMaps}" target="_blank" class="bg-blue-600 text-white px-3 py-2 rounded text-xs font-medium hover:bg-blue-700">🗺️ Google Maps</a>
                <a href="${linkWaze}" target="_blank" class="bg-sky-500 text-white px-3 py-2 rounded text-xs font-medium hover:bg-sky-600">🚗 Waze</a>
                ${telefone ? `<a href="${linkWhats}" target="_blank" class="bg-emerald-600 text-white px-3 py-2 rounded text-xs font-medium hover:bg-emerald-700">💬 WhatsApp</a>` : ''}
                <div class="ml-auto flex gap-2">
                    <button onclick="atualizarStatusPedido(${p.id}, 'Em Rota')" class="bg-purple-600 text-white px-3 py-2 rounded text-xs font-bold hover:bg-purple-700">🚀 Em Rota</button>
                    <button onclick="atualizarStatusPedido(${p.id}, 'Entregue')" class="bg-green-600 text-white px-3 py-2 rounded text-xs font-bold hover:bg-green-700">✅ Concluir</button>
                </div>
            </div>
        `;
        listaEntregador.appendChild(card);
    });
}

// ================= RELATÓRIOS & BI =================

function atualizarRelatoriosBI(pedidos) {
    const mesSelecionado = filtroMesRelatorio.value;
    const pedidosMes = pedidos.filter(p => p.data_entrega && p.data_entrega.startsWith(mesSelecionado));

    const totalMes = pedidosMes.length;
    const concluidasMes = pedidosMes.filter(p => p.status === 'Entregue').length;
    const pendentesMes = pedidosMes.filter(p => p.status !== 'Entregue').length;
    const faturamentoMes = pedidosMes.reduce((acc, p) => acc + Number(p.valor), 0);
    const ticketMedio = totalMes > 0 ? faturamentoMes / totalMes : 0;
    const taxaConclusao = totalMes > 0 ? (concluidasMes / totalMes) * 100 : 0;

    document.getElementById('rel-faturamento').textContent = `R$ ${faturamentoMes.toFixed(2)}`;
    document.getElementById('rel-ticket').textContent = `R$ ${ticketMedio.toFixed(2)}`;
    document.getElementById('rel-taxa').textContent = `${taxaConclusao.toFixed(1)}%`;

    const ctxStatus = document.getElementById('graficoStatus').getContext('2d');
    if (chartStatusInstance) chartStatusInstance.destroy();
    chartStatusInstance = new Chart(ctxStatus, {
        type: 'doughnut',
        data: { labels: ['Concluídas', 'Outros/Pendentes'], datasets: [{ data: [concluidasMes, pendentesMes], backgroundColor: ['#10B981', '#F59E0B'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const faturamentoPorDia = {};
    pedidosMes.forEach(p => { faturamentoPorDia[p.data_entrega] = (faturamentoPorDia[p.data_entrega] || 0) + Number(p.valor); });
    const diasOrdenados = Object.keys(faturamentoPorDia).sort();

    const ctxFat = document.getElementById('graficoFaturamento').getContext('2d');
    if (chartFaturamentoInstance) chartFaturamentoInstance.destroy();
    chartFaturamentoInstance = new Chart(ctxFat, {
        type: 'bar',
        data: { labels: diasOrdenados.map(d => d.split('-').reverse().join('/')), datasets: [{ label: 'Faturamento (R$)', data: diasOrdenados.map(d => faturamentoPorDia[d]), backgroundColor: '#6366F1' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

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
        tabelaBairros.innerHTML = `<tr><td colspan="3" class="px-4 py-3 text-center text-gray-500">Nenhum dado.</td></tr>`;
        return;
    }

    bairrosOrdenados.forEach(bairro => {
        const d = bairrosMap[bairro];
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="px-4 py-2 font-medium text-gray-800">${bairro}</td><td class="px-4 py-2 text-gray-600">${d.qtd} entregas</td><td class="px-4 py-2 text-gray-600">R$ ${d.valor.toFixed(2)}</td>`;
        tabelaBairros.appendChild(tr);
    });
}

window.exportarParaCSV = function() {
    const mesSelecionado = filtroMesRelatorio.value;
    const pedidosMes = todosPedidos.filter(p => p.data_entrega && p.data_entrega.startsWith(mesSelecionado));

    if (pedidosMes.length === 0) {
        alert('Não há dados no mês selecionado para exportar.');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,ID;Cliente;Bairro;Endereco;Motorista;Valor;Data;Status\r\n";
    
    pedidosMes.forEach(p => {
        const cliente = p.clientes ? p.clientes.nome : 'Sem Cliente';
        const bairro = p.clientes && p.clientes.bairro ? p.clientes.bairro : 'Sem Bairro';
        const endereco = p.clientes ? p.clientes.endereco : 'Sem Endereço';
        const motorista = p.motoristas ? p.motoristas.nome : 'Sem Motorista';
        const valor = Number(p.valor).toFixed(2).replace('.', ',');
        
        csvContent += `${p.id};"${cliente}";"${bairro}";"${endereco}";"${motorista}";${valor};${p.data_entrega};${p.status}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_logistica_${mesSelecionado}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ================= AÇÕES & EVENTOS =================

window.excluirPedido = async function(id) {
    if (!confirm('Excluir pedido?')) return;
    try {
        await supabaseClient.from('pedidos').delete().eq('id', id);
        carregarPedidos();
    } catch (err) { alert('Erro: ' + err.message); }
};

function atualizarDashboard(pedidos) {
    document.getElementById('stat-total').textContent = pedidos.length;
    document.getElementById('stat-pendentes').textContent = pedidos.filter(p => p.status !== 'Entregue').length;
    document.getElementById('stat-concluidas').textContent = pedidos.filter(p => p.status === 'Entregue').length;
    document.getElementById('stat-faturamento').textContent = `R$ ${pedidos.reduce((acc, p) => acc + Number(p.valor), 0).toFixed(2)}`;
}

if (filtroData) filtroData.addEventListener('change', () => renderizarTabelaPedidos(todosPedidos));
if (inputBusca) inputBusca.addEventListener('input', () => renderizarTabelaPedidos(todosPedidos));
if (filtroDataEntregador) filtroDataEntregador.addEventListener('change', () => renderizarPainelEntregador(todosPedidos));
if (filtroMesRelatorio) filtroMesRelatorio.addEventListener('change', () => atualizarRelatoriosBI(todosPedidos));

if (formPedido) {
    formPedido.addEventListener('submit', async (e) => {
        e.preventDefault();
        const motoristaId = document.getElementById('select-motorista').value;
        const novoPedido = {
            cliente_id: document.getElementById('select-cliente').value,
            motorista_id: motoristaId ? motoristaId : null,
            data_entrega: document.getElementById('data-entrega').value,
            descricao_pedido: document.getElementById('descricao-pedido').value,
            valor: document.getElementById('valor-pedido').value,
            status: 'Pendente',
            empresa_id: perfilUsuario.empresa_id
        };
        try {
            await supabaseClient.from('pedidos').insert([novoPedido]);
            formPedido.reset();
            carregarPedidos();
            alert('Pedido lançado com sucesso!');
        } catch (err) { alert('Erro: ' + err.message); }
    });
}

carregarPerfilEVerificarSessao();