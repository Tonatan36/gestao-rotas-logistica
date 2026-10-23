// ========================================================
// LogiSync Pro - Configuração Centralizada & Utilitários
// ========================================================

const SUPABASE_URL = 'https://haflwftqakcvcuuuswdp.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rWoa2AQikbAN9USkLOW__Q_iwB8HDvZ';

// Inicializa o cliente do Supabase
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

// ================= UTILITÁRIOS DE SEGURANÇA (Anti-XSS) =================
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ================= FORMATAÇÃO E MÁSCARAS =================
function formatarMoeda(valor) {
    const num = Number(valor) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarTelefone(telefone) {
    if (!telefone) return '';
    const limpo = telefone.replace(/\D/g, '');
    if (limpo.length === 11) {
        return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    } else if (limpo.length === 10) {
        return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
    }
    return telefone;
}

function aplicarMascaraTelefone(input) {
    input.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 11) v = v.slice(0, 11);
        if (v.length > 6) {
            e.target.value = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
        } else if (v.length > 2) {
            e.target.value = `(${v.slice(0, 2)}) ${v.slice(2)}`;
        } else if (v.length > 0) {
            e.target.value = `(${v}`;
        } else {
            e.target.value = '';
        }
    });
}

function aplicarMascaraCEP(input) {
    input.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 8) v = v.slice(0, 8);
        if (v.length > 5) {
            e.target.value = `${v.slice(0, 5)}-${v.slice(5)}`;
        } else {
            e.target.value = v;
        }
    });
}

// Consulta automática de CEP via ViaCEP
async function consultarViaCEP(cep) {
    const limpo = cep.replace(/\D/g, '');
    if (limpo.length !== 8) return null;
    try {
        const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
        const dados = await res.json();
        if (dados.erro) return null;
        return dados;
    } catch (e) {
        console.warn('Erro ao consultar ViaCEP:', e);
        return null;
    }
}

// ================= SISTEMA MODERNO DE TOASTS =================
function showToast(mensagem, tipo = 'info', duracao = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto flex items-center gap-3 p-4 rounded-xl shadow-2xl border text-sm font-semibold transition-all duration-300 transform translate-x-full opacity-0';

    let icon = 'ℹ️';
    if (tipo === 'success') {
        toast.classList.add('bg-emerald-900/90', 'text-white', 'border-emerald-500', 'backdrop-blur-md');
        icon = '✅';
    } else if (tipo === 'error') {
        toast.classList.add('bg-rose-900/90', 'text-white', 'border-rose-500', 'backdrop-blur-md');
        icon = '❌';
    } else if (tipo === 'warning') {
        toast.classList.add('bg-amber-900/90', 'text-white', 'border-amber-500', 'backdrop-blur-md');
        icon = '⚠️';
    } else {
        toast.classList.add('bg-slate-900/90', 'text-white', 'border-slate-700', 'backdrop-blur-md');
    }

    toast.innerHTML = `
        <span class="text-lg">${icon}</span>
        <div class="flex-grow">${escapeHTML(mensagem)}</div>
        <button class="text-white/60 hover:text-white text-base font-bold ml-2" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
    });

    setTimeout(() => {
        toast.classList.remove('translate-x-0', 'opacity-100');
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, duracao);
}

// ================= MODAL DE CONFIRMAÇÃO MODERNO =================
function showConfirmModal({ titulo, mensagem, confirmText = 'Confirmar', cancelText = 'Cancelar', onConfirm, perigo = false }) {
    let modalOverlay = document.getElementById('modal-confirm-overlay');
    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'modal-confirm-overlay';
        modalOverlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 hidden opacity-0 transition-opacity duration-200';
        modalOverlay.innerHTML = `
            <div id="modal-confirm-card" class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform scale-95 transition-transform duration-200 border border-gray-100">
                <h3 id="modal-confirm-titulo" class="text-lg font-bold text-gray-900 mb-2"></h3>
                <p id="modal-confirm-msg" class="text-sm text-gray-600 mb-6"></p>
                <div class="flex justify-end gap-3">
                    <button id="modal-btn-cancelar" class="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
                    <button id="modal-btn-confirmar" class="px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-md transition"></button>
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);
    }

    const card = document.getElementById('modal-confirm-card');
    const tituloEl = document.getElementById('modal-confirm-titulo');
    const msgEl = document.getElementById('modal-confirm-msg');
    const btnConfirm = document.getElementById('modal-btn-confirmar');
    const btnCancel = document.getElementById('modal-btn-cancelar');

    tituloEl.textContent = titulo;
    msgEl.textContent = mensagem;
    btnConfirm.textContent = confirmText;
    btnCancel.textContent = cancelText;

    if (perigo) {
        btnConfirm.className = 'px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-md transition';
    } else {
        btnConfirm.className = 'px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition';
    }

    const fechar = () => {
        modalOverlay.classList.remove('opacity-100');
        modalOverlay.classList.add('opacity-0');
        card.classList.remove('scale-100');
        card.classList.add('scale-95');
        setTimeout(() => modalOverlay.classList.add('hidden'), 200);
    };

    btnCancel.onclick = fechar;
    btnConfirm.onclick = () => {
        fechar();
        if (typeof onConfirm === 'function') onConfirm();
    };

    modalOverlay.classList.remove('hidden');
    requestAnimationFrame(() => {
        modalOverlay.classList.remove('opacity-0');
        modalOverlay.classList.add('opacity-100');
        card.classList.remove('scale-95');
        card.classList.add('scale-100');
    });
}
