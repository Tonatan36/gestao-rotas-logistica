// ========================================================
// LogiSync Pro - Lógica Principal da Aplicação
// ========================================================

// Elementos do DOM - Autenticação & Telas
const telaLogin = document.getElementById('tela-login');
const appPrincipal = document.getElementById('app-principal');
const formLogin = document.getElementById('form-login');
const btnLogin = document.getElementById('btn-login');
const erroLogin = document.getElementById('erro-login');
const infoUsuario = document.getElementById('info-usuario-logado');
const badgeRealtime = document.getElementById('badge-realtime');

// Elementos do DOM - Formulários
const formCliente = document.getElementById('form-cliente');
const btnSalvarCliente = document.getElementById('btn-salvar-cliente');
const btnCancelarEdicao = document.getElementById('btn-cancelar-edicao');
const formMotorista = document.getElementById('form-motorista');
const btnSalvarMotorista = document.getElementById('btn-salvar-motorista');
const formPedido = document.getElementById('form-pedido');
const btnLancarPedido = document.getElementById('btn-lancar-pedido');

// Elementos do DOM - Tabelas & Selects
const tabelaClientes = document.getElementById('tabela-clientes');
const tabelaMotoristas = document.getElementById('tabela-motoristas');
const tabelaPedidos = document.getElementById('tabela-pedidos');
const selectCliente = document.getElementById('select-cliente');
const selectMotorista = document.getElementById('select-motorista');

// Elementos do DOM - Filtros
const filtroData = document.getElementById('filtro-data');
const inputBusca = document.getElementById('input-busca');
const filtroDataEntregador = document.getElementById('filtro-data-entregador');
const listaEntregador = document.getElementById('lista-entregador');
const filtroDataInicio = document.getElementById('filtro-data-inicio');
const filtroDataFim = document.getElementById('filtro-data-fim');

// Estado da Aplicação
let todosPedidos = [];
let todosClientes = [];
let todosMotoristas = [];
let usuarioLogado = null;
let perfilUsuario = null;
let motoristaIdLogado = null;
let realtimeChannel = null;

// Instâncias dos Gráficos Chart.js
let chartStatusInstance = null;
let chartFaturamentoInstance = null;

// Data atual no formato YYYY-MM-DD
const hojeISO = new Date().toISOString().split('T')[0];
const primeiroDiaMes = hojeISO.substring(0, 8) + '01';

// Inicialização dos campos de data
if (filtroData) filtroData.value = '';
if (filtroDataEntregador) filtroDataEntregador.value = hojeISO;
if (filtroDataInicio) filtroDataInicio.value = primeiroDiaMes;
if (filtroDataFim) filtroDataFim.value = hojeISO;

const inputDataEntrega = document.getElementById('data-entrega');
if (inputDataEntrega) inputDataEntrega.value = hojeISO;

// ================= MÁSCARAS E BUSCA DE CEP =================
const inputTelefoneCliente = document.getElementById('telefone');
const inputTelefoneMotorista = document.getElementById('moto-telefone');
const inputCep = document.getElementById('cep');

if (inputTelefoneCliente) aplicarMascaraTelefone(inputTelefoneCliente);
if (inputTelefoneMotorista) aplicarMascaraTelefone(inputTelefoneMotorista);
if (inputCep) {
    aplicarMascaraCEP(inputCep);
    inputCep.addEventListener('blur', async () => {
        const cepVal = inputCep.value.trim();
        if (cepVal.replace(/\D/g, '').length === 8) {
            showToast('Consultando CEP...', 'info', 1500);
            const dados = await consultarViaCEP(cepVal);
            if (dados) {
                const campoEnd = document.getElementById('endereco');
                const campoBairro = document.getElementById('bairro');
                if (dados.logradouro) campoEnd.value = dados.logradouro;
                if (dados.bairro) campoBairro.value = dados.bairro;
                showToast('Endereço preenchido automaticamente!', 'success');
            } else {
                showToast('CEP não localizado.', 'warning');
            }
        }
    });
}

// ================= AUTENTICAÇÃO & SESSÃO =================

if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const senha = document.getElementById('login-senha').value;
        
        btnLogin.disabled = true;
        btnLogin.innerHTML = `<span class="inline-block animate-spin mr-2">🔄</span> Entrando...`;
        erroLogin.textContent = '';

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
            if (error) throw error;
            usuarioLogado = data.user;
            await carregarPerfilEVerificarSessao();
            showToast('Login realizado com sucesso!', 'success');
        } catch (err) {
            console.error('Erro no login:', err);
            erroLogin.textContent = '❌ Credenciais inválidas ou erro: ' + err.message;
            showToast(err.message, 'error');
        } finally {
            btnLogin.disabled = false;
            btnLogin.innerHTML = `<span>Entrar na Plataforma</span>`;
        }
    });
}

async function carregarPerfilEVerificarSessao() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (session) {
            usuarioLogado = session.user;
            const { data: perfil, error: erroPerfil } = await supabaseClient
                .from('perfis')
                .select('*, empresas(nome_empresa, plano)')
                .eq('id', usuarioLogado.id)
                .single();

            if (erroPerfil || !perfil) {
                erroLogin.textContent = "❌ Perfil vinculado não foi encontrado.";
                await supabaseClient.auth.signOut();
                return;
            }

            perfilUsuario = perfil;
            telaLogin.classList.add('hidden');
            appPrincipal.classList.remove('hidden');
            
            const nomeEmpresa = perfil.empresas ? perfil.empresas.nome_empresa : 'Empresa';
            const cargoFormatado = perfil.cargo === 'motorista' ? 'Entregador' : 'Gestor';
            infoUsuario.textContent = `Empresa: ${nomeEmpresa} • Logado como: ${perfil.nome} (${cargoFormatado})`;

            // Inicializa subscrição de tempo real para esta empresa
            iniciarRealtimePedidos();

            if (perfil.cargo === 'motorista') {
                // Motorista acessa apenas a visão de entregas
                document.getElementById('menu-abas').classList.add('hidden');
                
                // Busca motorista vinculado na tabela motoristas da mesma empresa
                const { data: mData } = await supabaseClient
                    .from('motoristas')
                    .select('id')
                    .eq('empresa_id', perfilUsuario.empresa_id)
                    .ilike('nome', perfil.nome.trim())
                    .maybeSingle();
                    
                if (mData) {
                    motoristaIdLogado = mData.id;
                }
                
                await carregarMotoristasParaFundo();
                mudarAba('entregador');
            } else {
                // Gestor tem acesso total
                document.getElementById('menu-abas').classList.remove('hidden');
                await Promise.all([
                    carregarClientes(),
                    carregarMotoristas(),
                    carregarPedidos()
                ]);
            }
        } else {
            telaLogin.classList.remove('hidden');
            appPrincipal.classList.add('hidden');
        }
    } catch (e) {
        console.error('Erro na verificação de sessão:', e);
        telaLogin.classList.remove('hidden');
        appPrincipal.classList.add('hidden');
    }
}

window.fazerLogout = async function() {
    showConfirmModal({
        titulo: 'Sair da Plataforma',
        mensagem: 'Deseja realmente encerrar a sua sessão agora?',
        confirmText: 'Sair',
        onConfirm: async () => {
            if (realtimeChannel) {
                supabaseClient.removeChannel(realtimeChannel);
            }
            await supabaseClient.auth.signOut();
            window.location.reload();
        }
    });
};

// ================= SUBSCRIÇÃO EM TEMPO REAL (REALTIME) =================
function iniciarRealtimePedidos() {
    if (!perfilUsuario || realtimeChannel) return;

    if (badgeRealtime) badgeRealtime.classList.remove('hidden');

    realtimeChannel = supabaseClient
        .channel('pedidos-realtime-channel')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'pedidos' },
            (payload) => {
                // Só processa alterações pertencentes à empresa do usuário
                if (payload.new && payload.new.empresa_id === perfilUsuario.empresa_id) {
                    carregarPedidos(true); // recarga silenciosa
                } else if (payload.eventType === 'DELETE') {
                    carregarPedidos(true);
                }
            }
        )
        .subscribe((status) => {
            console.log('Status Realtime Supabase:', status);
        });
}

// ================= NAVEGAÇÃO ENTRE ABAS =================

window.mudarAba = function(aba) {
    const btnGestor = document.getElementById('btn-aba-gestor');
    const btnEntregador = document.getElementById('btn-aba-entregador');
    const btnRelatorios = document.getElementById('btn-aba-relatorios');

    const divGestor = document.getElementById('aba-gestor');
    const divEntregador = document.getElementById('aba-entregador');
    const divRelatorios = document.getElementById('aba-relatorios');

    const estiloInativo = "bg-transparent text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg font-semibold transition text-xs sm:text-sm flex items-center gap-1.5";
    const estiloAtivo = "bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition text-xs sm:text-sm flex items-center gap-1.5";
    const estiloAtivoLaranja = "bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition text-xs sm:text-sm flex items-center gap-1.5";
    const estiloAtivoRoxo = "bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition text-xs sm:text-sm flex items-center gap-1.5";

    if (btnGestor) btnGestor.className = estiloInativo;
    if (btnEntregador) btnEntregador.className = estiloInativo;
    if (btnRelatorios) btnRelatorios.className = estiloInativo;

    if (divGestor) divGestor.classList.add('hidden');
    if (divEntregador) divEntregador.classList.add('hidden');
    if (divRelatorios) divRelatorios.classList.add('hidden');

    if (aba === 'gestor' && divGestor) {
        divGestor.classList.remove('hidden');
        if (btnGestor) btnGestor.className = estiloAtivo;
    } else if (aba === 'entregador' && divEntregador) {
        divEntregador.classList.remove('hidden');
        if (btnEntregador) btnEntregador.className = estiloAtivoLaranja;
        carregarPedidos(true);
    } else if (aba === 'relatorios' && divRelatorios) {
        divRelatorios.classList.remove('hidden');
        if (btnRelatorios) btnRelatorios.className = estiloAtivoRoxo;
        atualizarRelatoriosBI(todosPedidos);
    }
};

// ================= CRM: CLIENTES (MULTI-TENANT & ANTI-XSS) =================

async function carregarClientes() {
    if (!perfilUsuario) return;
    try {
        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .eq('empresa_id', perfilUsuario.empresa_id)
            .order('id', { ascending: false });

        if (error) throw error;
        todosClientes = data || [];
        tabelaClientes.innerHTML = '';
        selectCliente.innerHTML = '<option value="">Selecione um cliente cadastrado...</option>';

        if (todosClientes.length === 0) {
            tabelaClientes.innerHTML = `<tr><td colspan="4" class="px-4 py-3 text-center text-slate-400 text-xs">Nenhum cliente cadastrado ainda.</td></tr>`;
            return;
        }

        todosClientes.forEach(cliente => {
            const linha = document.createElement('tr');
            linha.innerHTML = `
                <td class="px-3 py-2.5 whitespace-nowrap text-xs font-semibold text-slate-900">${escapeHTML(cliente.nome)}</td>
                <td class="px-3 py-2.5 whitespace-nowrap text-xs text-slate-500">${escapeHTML(cliente.telefone || '-')}</td>
                <td class="px-3 py-2.5 whitespace-nowrap text-xs text-slate-500">${escapeHTML(cliente.bairro || '-')}</td>
                <td class="px-3 py-2.5 whitespace-nowrap text-xs font-medium text-right space-x-1">
                    <button onclick="prepararEdicaoCliente(${cliente.id})" title="Editar" class="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-[11px] font-bold hover:bg-amber-200 transition">✏️</button>
                    <button onclick="excluirCliente(${cliente.id})" title="Excluir" class="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[11px] font-bold hover:bg-rose-200 transition">🗑️</button>
                </td>
            `;
            tabelaClientes.appendChild(linha);

            const opt = document.createElement('option');
            opt.value = cliente.id;
            opt.textContent = `${cliente.nome} (${cliente.endereco} - ${cliente.bairro || ''})`;
            selectCliente.appendChild(opt);
        });
    } catch (err) {
        console.error("Erro clientes:", err);
        showToast("Erro ao carregar clientes: " + err.message, "error");
    }
}

if (formCliente) {
    formCliente.addEventListener('submit', async (e) => {
        e.preventDefault();
        btnSalvarCliente.disabled = true;
        btnSalvarCliente.innerHTML = `<span class="inline-block animate-spin mr-1">🔄</span> Salvando...`;

        const idEditando = document.getElementById('cliente-id-editando').value;
        const dados = {
            nome: document.getElementById('nome').value.trim(),
            telefone: document.getElementById('telefone').value.trim(),
            endereco: document.getElementById('endereco').value.trim(),
            bairro: document.getElementById('bairro').value.trim(),
            empresa_id: perfilUsuario.empresa_id
        };

        try {
            if (idEditando) {
                const { error } = await supabaseClient.from('clientes').update(dados).eq('id', idEditando).eq('empresa_id', perfilUsuario.empresa_id);
                if (error) throw error;
                showToast('Cliente atualizado com sucesso!', 'success');
                cancelarEdicaoCliente();
            } else {
                const { error } = await supabaseClient.from('clientes').insert([dados]);
                if (error) throw error;
                showToast('Cliente cadastrado com sucesso!', 'success');
                formCliente.reset();
            }
            await carregarClientes();
            await carregarPedidos(true);
        } catch (err) {
            showToast('Erro ao salvar cliente: ' + err.message, 'error');
        } finally {
            btnSalvarCliente.disabled = false;
            btnSalvarCliente.innerHTML = `<span>Salvar Cliente</span>`;
        }
    });
}

window.prepararEdicaoCliente = function(id) {
    const c = todosClientes.find(x => x.id === id);
    if (!c) return;
    document.getElementById('cliente-id-editando').value = c.id;
    document.getElementById('nome').value = c.nome;
    document.getElementById('telefone').value = c.telefone || '';
    document.getElementById('endereco').value = c.endereco;
    document.getElementById('bairro').value = c.bairro || '';
    
    document.getElementById('titulo-form-cliente').innerHTML = "<span>✏️</span> <span>Editar Cliente</span>";
    btnSalvarCliente.innerHTML = "<span>Atualizar Cliente</span>";
    btnCancelarEdicao.classList.remove('hidden');
    document.getElementById('nome').focus();
};

window.cancelarEdicaoCliente = function() {
    formCliente.reset();
    document.getElementById('cliente-id-editando').value = '';
    document.getElementById('titulo-form-cliente').innerHTML = "<span>👥</span> <span>Cadastrar Novo Cliente</span>";
    btnSalvarCliente.innerHTML = "<span>Salvar Cliente</span>";
    btnCancelarEdicao.classList.add('hidden');
};

window.excluirCliente = function(id) {
    showConfirmModal({
        titulo: 'Excluir Cliente',
        mensagem: 'Tem certeza de que deseja excluir este cliente? Se houver pedidos vinculados a ele, eles poderão ser afetados.',
        confirmText: 'Excluir',
        perigo: true,
        onConfirm: async () => {
            try {
                const { error } = await supabaseClient.from('clientes').delete().eq('id', id).eq('empresa_id', perfilUsuario.empresa_id);
                if (error) throw error;
                showToast('Cliente excluído com sucesso.', 'success');
                await carregarClientes();
                await carregarPedidos(true);
            } catch (err) {
                showToast('Erro ao excluir: ' + err.message, 'error');
            }
        }
    });
};

// ================= GESTÃO DE MOTORISTAS (CORREÇÃO DE MULTI-TENANCY) =================

async function carregarMotoristas() {
    if (!perfilUsuario) return;
    try {
        // CORREÇÃO CRÍTICA: Filtrar por perfilUsuario.empresa_id e NÃO por ID estático!
        const { data, error } = await supabaseClient
            .from('motoristas')
            .select('*')
            .eq('empresa_id', perfilUsuario.empresa_id)
            .order('id', { ascending: false });

        if (error) throw error;
        todosMotoristas = data || [];
        if (tabelaMotoristas) tabelaMotoristas.innerHTML = '';
        if (selectMotorista) selectMotorista.innerHTML = '<option value="">Nenhum / Atribuição livre</option>';

        if (todosMotoristas.length === 0) {
            if (tabelaMotoristas) tabelaMotoristas.innerHTML = `<tr><td colspan="4" class="px-4 py-3 text-center text-slate-400 text-xs">Nenhum motorista cadastrado ainda.</td></tr>`;
            return;
        }

        todosMotoristas.forEach(m => {
            if (tabelaMotoristas) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-3 py-2.5 whitespace-nowrap text-xs font-semibold text-slate-900">${escapeHTML(m.nome)}</td>
                    <td class="px-3 py-2.5 whitespace-nowrap text-xs text-slate-500">${escapeHTML(m.telefone || '-')}</td>
                    <td class="px-3 py-2.5 whitespace-nowrap text-xs text-slate-500">${escapeHTML(m.veiculo || '-')}</td>
                    <td class="px-3 py-2.5 whitespace-nowrap text-xs text-right">
                        <button onclick="excluirMotorista(${m.id})" title="Excluir" class="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[11px] font-bold hover:bg-rose-200 transition">🗑️</button>
                    </td>
                `;
                tabelaMotoristas.appendChild(tr);
            }

            if (selectMotorista) {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = `${m.nome} (${m.veiculo || 'Veículo'})`;
                selectMotorista.appendChild(opt);
            }
        });
    } catch (err) {
        console.error("Erro motoristas:", err);
        showToast("Erro ao carregar motoristas: " + err.message, "error");
    }
}

async function carregarMotoristasParaFundo() {
    if (!perfilUsuario) return;
    try {
        const { data } = await supabaseClient
            .from('motoristas')
            .select('*')
            .eq('empresa_id', perfilUsuario.empresa_id);
        todosMotoristas = data || [];
    } catch (err) {
        console.error("Erro motoristas fundo:", err);
    }
}

if (formMotorista) {
    formMotorista.addEventListener('submit', async (e) => {
        e.preventDefault();
        btnSalvarMotorista.disabled = true;
        btnSalvarMotorista.innerHTML = `<span class="inline-block animate-spin mr-1">🔄</span> Cadastrando...`;

        const novoMoto = {
            nome: document.getElementById('moto-nome').value.trim(),
            telefone: document.getElementById('moto-telefone').value.trim(),
            veiculo: document.getElementById('moto-veiculo').value.trim(),
            empresa_id: perfilUsuario.empresa_id
        };

        try {
            const { error } = await supabaseClient.from('motoristas').insert([novoMoto]);
            if (error) throw error;
            formMotorista.reset();
            showToast('Motorista cadastrado com sucesso!', 'success');
            await carregarMotoristas();
        } catch (err) {
            showToast('Erro ao cadastrar motorista: ' + err.message, 'error');
        } finally {
            btnSalvarMotorista.disabled = false;
            btnSalvarMotorista.innerHTML = `<span>Cadastrar Motorista</span>`;
        }
    });
}

window.excluirMotorista = function(id) {
    showConfirmModal({
        titulo: 'Excluir Motorista',
        mensagem: 'Deseja realmente remover este motorista da sua frota?',
        confirmText: 'Excluir',
        perigo: true,
        onConfirm: async () => {
            try {
                const { error } = await supabaseClient.from('motoristas').delete().eq('id', id).eq('empresa_id', perfilUsuario.empresa_id);
                if (error) throw error;
                showToast('Motorista excluído com sucesso.', 'success');
                await carregarMotoristas();
                await carregarPedidos(true);
            } catch (err) {
                showToast('Erro: ' + err.message, 'error');
            }
        }
    });
};

// ================= GESTÃO DE PEDIDOS (MULTI-TENANT & RASTREIO) =================

async function carregarPedidos(silencioso = false) {
    if (!perfilUsuario) return;
    try {
        // CORREÇÃO CRÍTICA: Filtrar estritamente pela empresa_id
        const { data, error } = await supabaseClient
            .from('pedidos')
            .select(`*, clientes (nome, endereco, telefone, bairro), motoristas (id, nome, veiculo)`)
            .eq('empresa_id', perfilUsuario.empresa_id)
            .order('id', { ascending: false });

        if (error) throw error;
        todosPedidos = data || [];

        atualizarDashboard(todosPedidos);
        if (tabelaPedidos) renderizarTabelaPedidos(todosPedidos);
        renderizarPainelEntregador(todosPedidos);

        const abaRelatorios = document.getElementById('aba-relatorios');
        if (abaRelatorios && !abaRelatorios.classList.contains('hidden')) {
            atualizarRelatoriosBI(todosPedidos);
        }

        if (!silencioso) {
            // carregar sem barulho
        }
    } catch (err) {
        console.error("Erro pedidos:", err);
        if (!silencioso) showToast("Erro ao carregar pedidos: " + err.message, "error");
    }
}

function renderizarTabelaPedidos(pedidos) {
    if (!tabelaPedidos) return;
    tabelaPedidos.innerHTML = '';
    const dataFiltro = filtroData.value;
    const termoBusca = inputBusca.value.toLowerCase().trim();

    const pedidosFiltrados = pedidos.filter(p => {
        const nomeCliente = p.clientes ? p.clientes.nome.toLowerCase() : '';
        const enderecoCliente = p.clientes ? p.clientes.endereco.toLowerCase() : '';
        const descricao = p.descricao_pedido ? p.descricao_pedido.toLowerCase() : '';
        const matchData = dataFiltro ? p.data_entrega === dataFiltro : true;
        const matchBusca = nomeCliente.includes(termoBusca) || enderecoCliente.includes(termoBusca) || descricao.includes(termoBusca);
        return matchData && matchBusca;
    });

    if (pedidosFiltrados.length === 0) {
        tabelaPedidos.innerHTML = `<tr><td colspan="8" class="px-6 py-6 text-center text-slate-400 text-xs">Nenhum pedido encontrado para os filtros selecionados.</td></tr>`;
        return;
    }

    pedidosFiltrados.forEach(p => {
        const nomeCliente = p.clientes ? escapeHTML(p.clientes.nome) : '<span class="text-rose-500">Cliente Removido</span>';
        const enderecoCliente = p.clientes ? `${escapeHTML(p.clientes.endereco)} ${p.clientes.bairro ? '<span class="text-slate-400 text-[11px]">(' + escapeHTML(p.clientes.bairro) + ')</span>' : ''}` : '-';
        const motoristaAtualId = p.motorista_id || '';

        // Detecção de Atraso
        const isAtrasado = p.data_entrega < hojeISO && p.status !== 'Entregue' && p.status !== 'Cancelado';

        let optionsMotoristas = `<option value="">(Sem Motorista)</option>`;
        todosMotoristas.forEach(m => {
            const selected = m.id == motoristaAtualId ? 'selected' : '';
            optionsMotoristas += `<option value="${m.id}" ${selected}>${escapeHTML(m.nome)}</option>`;
        });

        let statusBadge = '';
        if (p.status === 'Pendente') statusBadge = 'bg-amber-100 text-amber-800 border-amber-200';
        else if (p.status === 'Em Separação') statusBadge = 'bg-blue-100 text-blue-800 border-blue-200';
        else if (p.status === 'Em Rota') statusBadge = 'bg-purple-100 text-purple-800 border-purple-200';
        else if (p.status === 'Entregue') statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-200';
        else statusBadge = 'bg-rose-100 text-rose-800 border-rose-200';

        const linha = document.createElement('tr');
        linha.className = isAtrasado ? 'bg-rose-50/60 border-l-4 border-rose-500' : 'hover:bg-slate-50 transition';

        const linkRastreioCompleto = `${window.location.origin}${window.location.pathname.replace('index.html', '')}rastreio.html?id=${p.id}`;

        linha.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-900">
                <div class="flex items-center gap-1.5">
                    <span>#${p.id}</span>
                    <span>${nomeCliente}</span>
                    ${isAtrasado ? '<span class="text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full font-extrabold uppercase">Atrasado</span>' : ''}
                </div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-xs text-slate-600">${enderecoCliente}</td>
            <td class="px-4 py-3 whitespace-nowrap text-xs text-slate-600">${escapeHTML(p.descricao_pedido)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-xs">
                <select onchange="atribuirMotoristaDireto(${p.id}, this.value)" class="p-1 border border-slate-200 rounded-lg text-xs bg-slate-50 text-orange-700 font-semibold outline-none">
                    ${optionsMotoristas}
                </select>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-800">${formatarMoeda(p.valor)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-xs text-slate-500">${p.data_entrega.split('-').reverse().join('/')}</td>
            <td class="px-4 py-3 whitespace-nowrap text-xs">
                <select onchange="atualizarStatusPedido(${p.id}, this.value)" class="px-2.5 py-1 text-xs font-bold rounded-full ${statusBadge} border cursor-pointer outline-none transition">
                    <option value="Pendente" ${p.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                    <option value="Em Separação" ${p.status === 'Em Separação' ? 'selected' : ''}>Em Separação</option>
                    <option value="Em Rota" ${p.status === 'Em Rota' ? 'selected' : ''}>Em Rota</option>
                    <option value="Entregue" ${p.status === 'Entregue' ? 'selected' : ''}>Entregue</option>
                    <option value="Cancelado" ${p.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-xs text-right space-x-1.5">
                <button onclick="copiarLinkRastreio('${linkRastreioCompleto}')" title="Copiar Link de Rastreio" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-xs font-bold border border-indigo-200 transition">
                    🔗 Rastreio
                </button>
                <button onclick="excluirPedido(${p.id})" title="Excluir Ordem" class="bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-xs font-bold border border-rose-200 transition">
                    🗑️
                </button>
            </td>
        `;
        tabelaPedidos.appendChild(linha);
    });
}

window.copiarLinkRastreio = function(url) {
    navigator.clipboard.writeText(url).then(() => {
        showToast('Link de rastreamento copiado com sucesso! Pode enviar no WhatsApp.', 'success');
    }).catch(() => {
        prompt('Copie o link de rastreamento:', url);
    });
};

window.atribuirMotoristaDireto = async function(pedidoId, motoristaId) {
    try {
        const novoId = motoristaId ? Number(motoristaId) : null;
        const { error } = await supabaseClient
            .from('pedidos')
            .update({ motorista_id: novoId })
            .eq('id', pedidoId)
            .eq('empresa_id', perfilUsuario.empresa_id);

        if (error) throw error;
        showToast('Motorista atribuído com sucesso!', 'success');
        carregarPedidos(true);
    } catch (err) {
        showToast('Erro ao atribuir motorista: ' + err.message, 'error');
    }
};

window.atualizarStatusPedido = async function(pedidoId, novoStatus) {
    try {
        const { error } = await supabaseClient
            .from('pedidos')
            .update({ status: novoStatus })
            .eq('id', pedidoId)
            .eq('empresa_id', perfilUsuario.empresa_id);

        if (error) throw error;
        showToast(`Status do pedido #${pedidoId} atualizado para "${novoStatus}"!`, 'success');
        carregarPedidos(true);
    } catch (err) {
        showToast('Erro ao atualizar status: ' + err.message, 'error');
    }
};

// ================= PAINEL DO ENTREGADOR (INTERFACE OTIMIZADA PARA MOBILE) =================

function renderizarPainelEntregador(pedidos) {
    if (!listaEntregador) return;
    listaEntregador.innerHTML = '';
    const dataSelecionada = filtroDataEntregador.value;
    
    let pedidosRua = pedidos.filter(p => dataSelecionada ? p.data_entrega === dataSelecionada : true);

    if (perfilUsuario && perfilUsuario.cargo === 'motorista') {
        if (motoristaIdLogado) {
            pedidosRua = pedidosRua.filter(p => p.motorista_id === motoristaIdLogado);
        } else {
            pedidosRua = [];
        }
    }

    if (pedidosRua.length === 0) {
        listaEntregador.innerHTML = `
            <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200/80 shadow-sm">
                <span class="text-4xl block mb-2">🛵</span>
                <h4 class="text-base font-bold text-slate-800">Nenhuma entrega para esta data</h4>
                <p class="text-xs text-slate-500 mt-1">Nenhum pacote atribuído para ${perfilUsuario ? escapeHTML(perfilUsuario.nome) : 'você'} nesta rota.</p>
            </div>
        `;
        return;
    }

    pedidosRua.forEach(p => {
        const cliente = p.clientes || {};
        const nome = cliente.nome || 'Cliente';
        const endereco = cliente.endereco || 'Endereço não informado';
        const bairro = cliente.bairro ? ` - ${cliente.bairro}` : '';
        const telefoneNumeros = cliente.telefone ? cliente.telefone.replace(/\D/g, '') : '';
        const isEntregue = p.status === 'Entregue';

        const enderecoCompleto = `${endereco}${bairro}`;
        const linkMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;
        const linkWaze = `https://waze.com/ul?q=${encodeURIComponent(enderecoCompleto)}&navigate=yes`;
        
        // Link de rastreamento enviado diretamente no WhatsApp do cliente
        const linkRastreio = `${window.location.origin}${window.location.pathname.replace('index.html', '')}rastreio.html?id=${p.id}`;
        const msgWhats = `Olá ${nome}! Seu pedido (#${p.id}) está a caminho com o entregador da LogiSync. 🛵💨\n\nAcompanhe em tempo real pelo link:\n${linkRastreio}`;
        const linkWhats = telefoneNumeros ? `https://wa.me/55${telefoneNumeros}?text=${encodeURIComponent(msgWhats)}` : '#';

        let badgeStatus = 'bg-blue-100 text-blue-800';
        if (p.status === 'Pendente') badgeStatus = 'bg-amber-100 text-amber-800';
        else if (p.status === 'Em Rota') badgeStatus = 'bg-purple-100 text-purple-800';
        else if (p.status === 'Entregue') badgeStatus = 'bg-emerald-100 text-emerald-800';

        const card = document.createElement('div');
        card.className = `p-5 rounded-2xl border transition shadow-sm ${isEntregue ? 'bg-emerald-50/50 border-emerald-200 opacity-80' : 'bg-white border-slate-200/80 hover:shadow-md'}`;
        
        card.innerHTML = `
            <div class="flex justify-between items-start gap-2 mb-3">
                <div>
                    <div class="flex items-center gap-1.5">
                        <span class="text-xs font-bold text-slate-400">#${p.id}</span>
                        <h3 class="font-extrabold text-base text-slate-900 leading-snug">${escapeHTML(nome)}</h3>
                    </div>
                    <p class="text-xs font-medium text-slate-600 mt-0.5">📍 ${escapeHTML(enderecoCompleto)}</p>
                </div>
                <span class="px-2.5 py-1 text-xs font-bold rounded-full ${badgeStatus} shrink-0">${escapeHTML(p.status)}</span>
            </div>

            <div class="bg-slate-50 rounded-xl p-3 mb-4 text-xs text-slate-700 grid grid-cols-2 gap-2 border border-slate-100">
                <p><strong>📦 Pacote:</strong> ${escapeHTML(p.descricao_pedido)}</p>
                <p><strong>💰 Cobrança:</strong> ${formatarMoeda(p.valor)}</p>
            </div>

            <!-- Botões GPS e WhatsApp Grandes (Amigáveis para smartphone) -->
            <div class="grid grid-cols-3 gap-2 mb-3">
                <a href="${linkMaps}" target="_blank" class="py-2.5 px-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-center text-xs font-bold hover:bg-blue-100 transition flex flex-col items-center gap-1">
                    <span class="text-base">🗺️</span>
                    <span>Maps</span>
                </a>
                <a href="${linkWaze}" target="_blank" class="py-2.5 px-2 bg-sky-50 text-sky-700 border border-sky-200 rounded-xl text-center text-xs font-bold hover:bg-sky-100 transition flex flex-col items-center gap-1">
                    <span class="text-base">🚗</span>
                    <span>Waze</span>
                </a>
                ${telefoneNumeros ? `
                    <a href="${linkWhats}" target="_blank" class="py-2.5 px-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-center text-xs font-bold hover:bg-emerald-100 transition flex flex-col items-center gap-1">
                        <span class="text-base">💬</span>
                        <span>WhatsApp</span>
                    </a>
                ` : `
                    <button disabled class="py-2.5 px-2 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-center text-xs font-bold flex flex-col items-center gap-1 cursor-not-allowed">
                        <span class="text-base">🚫</span>
                        <span>Sem Fone</span>
                    </button>
                `}
            </div>

            <!-- Botões de Ação de Rota -->
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <button onclick="atualizarStatusPedido(${p.id}, 'Em Rota')" class="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/20 transition flex items-center justify-center gap-1">
                    <span>🚀 Iniciar Rota</span>
                </button>
                <button onclick="atualizarStatusPedido(${p.id}, 'Entregue')" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-1">
                    <span>✅ Concluir Entrega</span>
                </button>
            </div>
        `;
        listaEntregador.appendChild(card);
    });
}

// ================= RELATÓRIOS & BI =================

function atualizarRelatoriosBI(pedidos) {
    const dataInicio = filtroDataInicio ? filtroDataInicio.value : '';
    const dataFim = filtroDataFim ? filtroDataFim.value : '';

    const pedidosFiltrados = pedidos.filter(p => {
        if (!p.data_entrega) return false;
        const matchInicio = dataInicio ? p.data_entrega >= dataInicio : true;
        const matchFim = dataFim ? p.data_entrega <= dataFim : true;
        return matchInicio && matchFim;
    });

    const totalPeriodo = pedidosFiltrados.length;
    const concluidasPeriodo = pedidosFiltrados.filter(p => p.status === 'Entregue').length;
    const pendentesPeriodo = pedidosFiltrados.filter(p => p.status !== 'Entregue').length;
    const faturamentoPeriodo = pedidosFiltrados.reduce((acc, p) => acc + Number(p.valor || 0), 0);
    const ticketMedio = totalPeriodo > 0 ? faturamentoPeriodo / totalPeriodo : 0;
    const taxaConclusao = totalPeriodo > 0 ? (concluidasPeriodo / totalPeriodo) * 100 : 0;

    const elFat = document.getElementById('rel-faturamento');
    const elTick = document.getElementById('rel-ticket');
    const elTaxa = document.getElementById('rel-taxa');

    if (elFat) elFat.textContent = formatarMoeda(faturamentoPeriodo);
    if (elTick) elTick.textContent = formatarMoeda(ticketMedio);
    if (elTaxa) elTaxa.textContent = `${taxaConclusao.toFixed(1)}%`;

    // Gráfico de Status (Doughnut)
    const canvasStatus = document.getElementById('graficoStatus');
    if (canvasStatus) {
        const ctxStatus = canvasStatus.getContext('2d');
        if (chartStatusInstance) chartStatusInstance.destroy();
        chartStatusInstance = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: ['Entregues', 'Pendentes / Em Rota'],
                datasets: [{
                    data: [concluidasPeriodo, pendentesPeriodo],
                    backgroundColor: ['#10B981', '#F59E0B'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // Gráfico de Faturamento por Dia (Bar)
    const canvasFat = document.getElementById('graficoFaturamento');
    if (canvasFat) {
        const faturamentoPorDia = {};
        pedidosFiltrados.forEach(p => {
            faturamentoPorDia[p.data_entrega] = (faturamentoPorDia[p.data_entrega] || 0) + Number(p.valor || 0);
        });
        const diasOrdenados = Object.keys(faturamentoPorDia).sort();

        const ctxFat = canvasFat.getContext('2d');
        if (chartFaturamentoInstance) chartFaturamentoInstance.destroy();
        chartFaturamentoInstance = new Chart(ctxFat, {
            type: 'bar',
            data: {
                labels: diasOrdenados.map(d => d.split('-').reverse().join('/')),
                datasets: [{
                    label: 'Faturamento (R$)',
                    data: diasOrdenados.map(d => faturamentoPorDia[d]),
                    backgroundColor: '#6366F1',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // Tabela de Bairros
    const bairrosMap = {};
    pedidosFiltrados.forEach(p => {
        const bairro = p.clientes && p.clientes.bairro ? p.clientes.bairro : 'Não informado';
        if (!bairrosMap[bairro]) bairrosMap[bairro] = { qtd: 0, valor: 0 };
        bairrosMap[bairro].qtd += 1;
        bairrosMap[bairro].valor += Number(p.valor || 0);
    });

    const tabelaBairros = document.getElementById('tabela-bairros');
    if (tabelaBairros) {
        tabelaBairros.innerHTML = '';
        const bairrosOrdenados = Object.keys(bairrosMap).sort((a, b) => bairrosMap[b].qtd - bairrosMap[a].qtd);

        if (bairrosOrdenados.length === 0) {
            tabelaBairros.innerHTML = `<tr><td colspan="3" class="px-4 py-3 text-center text-slate-400 text-xs">Nenhum dado no período.</td></tr>`;
        } else {
            bairrosOrdenados.forEach(bairro => {
                const d = bairrosMap[bairro];
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-4 py-2 font-semibold text-slate-800 text-xs">${escapeHTML(bairro)}</td>
                    <td class="px-4 py-2 text-slate-600 text-xs">${d.qtd} entregas</td>
                    <td class="px-4 py-2 text-slate-800 font-bold text-xs text-right">${formatarMoeda(d.valor)}</td>
                `;
                tabelaBairros.appendChild(tr);
            });
        }
    }

    // Tabela de Desempenho por Motorista
    renderizarTabelaDesempenhoMotoristas(pedidosFiltrados);
}

function renderizarTabelaDesempenhoMotoristas(pedidosPeriodo) {
    const container = document.getElementById('tabela-desempenho-motoristas');
    if (!container) return;
    container.innerHTML = '';

    const motoristasMap = {};
    pedidosPeriodo.forEach(p => {
        const nomeMoto = p.motoristas && p.motoristas.nome ? p.motoristas.nome : 'Sem Atribuição / Livre';
        if (!motoristasMap[nomeMoto]) motoristasMap[nomeMoto] = { concluidas: 0, valorTotal: 0 };
        
        if (p.status === 'Entregue') {
            motoristasMap[nomeMoto].concluidas += 1;
        }
        motoristasMap[nomeMoto].valorTotal += Number(p.valor || 0);
    });

    const nomesOrdenados = Object.keys(motoristasMap).sort((a, b) => motoristasMap[b].concluidas - motoristasMap[a].concluidas);

    if (nomesOrdenados.length === 0) {
        container.innerHTML = `<tr><td colspan="3" class="px-4 py-3 text-center text-slate-400 text-xs">Nenhum registro de motorista no período.</td></tr>`;
        return;
    }

    nomesOrdenados.forEach(nome => {
        const dados = motoristasMap[nome];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-4 py-2 font-semibold text-slate-800 text-xs">${escapeHTML(nome)}</td>
            <td class="px-4 py-2 text-emerald-600 font-bold text-xs">${dados.concluidas} concluídas</td>
            <td class="px-4 py-2 text-slate-800 font-bold text-xs text-right">${formatarMoeda(dados.valorTotal)}</td>
        `;
        container.appendChild(tr);
    });
}

window.exportarParaCSV = function() {
    const dataInicio = filtroDataInicio ? filtroDataInicio.value : '';
    const dataFim = filtroDataFim ? filtroDataFim.value : '';

    const pedidosPeriodo = todosPedidos.filter(p => {
        if (!p.data_entrega) return false;
        const matchInicio = dataInicio ? p.data_entrega >= dataInicio : true;
        const matchFim = dataFim ? p.data_entrega <= dataFim : true;
        return matchInicio && matchFim;
    });

    if (pedidosPeriodo.length === 0) {
        showToast('Não há dados no período selecionado para exportar.', 'warning');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,ID;Cliente;Bairro;Endereco;Motorista;Valor;Data;Status\r\n";
    
    pedidosPeriodo.forEach(p => {
        const cliente = p.clientes ? p.clientes.nome : 'Sem Cliente';
        const bairro = p.clientes && p.clientes.bairro ? p.clientes.bairro : 'Sem Bairro';
        const endereco = p.clientes ? p.clientes.endereco : 'Sem Endereço';
        const motorista = p.motoristas ? p.motoristas.nome : 'Sem Motorista';
        const valor = Number(p.valor || 0).toFixed(2).replace('.', ',');
        
        csvContent += `${p.id};"${cliente}";"${bairro}";"${endereco}";"${motorista}";${valor};${p.data_entrega};${p.status}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_logistica_${dataInicio}_a_${dataFim}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Relatório CSV exportado com sucesso!', 'success');
};

// ================= AÇÕES & EVENTOS DE PEDIDO =================

window.excluirPedido = function(id) {
    showConfirmModal({
        titulo: 'Excluir Ordem de Entrega',
        mensagem: `Tem certeza que deseja remover o pedido #${id}?`,
        confirmText: 'Excluir',
        perigo: true,
        onConfirm: async () => {
            try {
                const { error } = await supabaseClient.from('pedidos').delete().eq('id', id).eq('empresa_id', perfilUsuario.empresa_id);
                if (error) throw error;
                showToast(`Pedido #${id} excluído com sucesso.`, 'success');
                carregarPedidos(true);
            } catch (err) {
                showToast('Erro ao excluir: ' + err.message, 'error');
            }
        }
    });
};

function atualizarDashboard(pedidos) {
    const elTotal = document.getElementById('stat-total');
    const elPendentes = document.getElementById('stat-pendentes');
    const elConcluidas = document.getElementById('stat-concluidas');
    const elFaturamento = document.getElementById('stat-faturamento');

    if (elTotal) elTotal.textContent = pedidos.length;
    if (elPendentes) elPendentes.textContent = pedidos.filter(p => p.status !== 'Entregue').length;
    if (elConcluidas) elConcluidas.textContent = pedidos.filter(p => p.status === 'Entregue').length;
    if (elFaturamento) {
        const total = pedidos.reduce((acc, p) => acc + Number(p.valor || 0), 0);
        elFaturamento.textContent = formatarMoeda(total);
    }
}

// Listeners de filtros
if (filtroData) filtroData.addEventListener('change', () => renderizarTabelaPedidos(todosPedidos));
if (inputBusca) inputBusca.addEventListener('input', () => renderizarTabelaPedidos(todosPedidos));
if (filtroDataEntregador) filtroDataEntregador.addEventListener('change', () => renderizarPainelEntregador(todosPedidos));
if (filtroDataInicio) filtroDataInicio.addEventListener('change', () => atualizarRelatoriosBI(todosPedidos));
if (filtroDataFim) filtroDataFim.addEventListener('change', () => atualizarRelatoriosBI(todosPedidos));

// Lançamento de novos pedidos
if (formPedido) {
    formPedido.addEventListener('submit', async (e) => {
        e.preventDefault();
        btnLancarPedido.disabled = true;
        btnLancarPedido.innerHTML = `<span class="inline-block animate-spin mr-1">🔄</span> Lançando...`;

        const motoristaId = document.getElementById('select-motorista').value;
        const novoPedido = {
            cliente_id: Number(document.getElementById('select-cliente').value),
            motorista_id: motoristaId ? Number(motoristaId) : null,
            data_entrega: document.getElementById('data-entrega').value,
            descricao_pedido: document.getElementById('descricao-pedido').value.trim(),
            valor: parseFloat(document.getElementById('valor-pedido').value) || 0,
            status: 'Pendente',
            empresa_id: perfilUsuario.empresa_id
        };

        try {
            const { error } = await supabaseClient.from('pedidos').insert([novoPedido]);
            if (error) throw error;
            formPedido.reset();
            if (inputDataEntrega) inputDataEntrega.value = hojeISO;
            showToast('Pedido lançado com sucesso na rota!', 'success');
            await carregarPedidos(true);
        } catch (err) {
            showToast('Erro ao lançar pedido: ' + err.message, 'error');
        } finally {
            btnLancarPedido.disabled = false;
            btnLancarPedido.innerHTML = `<span>🚀 Lançar Pedido</span>`;
        }
    });
}

// Inicia verificação de sessão ao carregar a página
carregarPerfilEVerificarSessao();