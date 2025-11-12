// Necessidades Especiais - Gerenciamento
(function() {
    'use strict';

    // Elementos DOM
    const needModal = document.getElementById('needModal');
    const needForm = document.getElementById('needForm');
    const needModalTitle = document.getElementById('needModalTitle');
    const needsTableBody = document.getElementById('needs-table-body');
    const newNeedBtn = document.getElementById('newNeedBtn');
    const cancelNeedBtn = document.getElementById('cancelNeed');
    const filterSearch = document.getElementById('filter-search');
    const logoutBtn = document.getElementById('logout');

    // Dados
    let needs = [];

    // Inicialização
    init();

    async function init() {
        setupEventListeners();
        await loadData();
        loadNeedsTable();
    }

    function setupEventListeners() {
        // Modal
        const closeBtn = needModal.querySelector('.close');
        if (closeBtn) closeBtn.addEventListener('click', () => closeModal(needModal));
        if (cancelNeedBtn) cancelNeedBtn.addEventListener('click', () => closeModal(needModal));
        
        needModal.addEventListener('click', (e) => {
            if (e.target === needModal) closeModal(needModal);
        });

        // Botões
        if (newNeedBtn) newNeedBtn.addEventListener('click', () => openNeedModal());
        if (needForm) needForm.addEventListener('submit', handleSubmit);
        
        // Filtro
        if (filterSearch) {
            filterSearch.addEventListener('input', () => loadNeedsTable());
        }

        // Logout
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logout);
        }
    }

    async function loadData() {
        try {
            const data = await API_CONFIG.get('necessidades');
            
            if (Array.isArray(data) && data.length > 0) {
                needs = data.map(need => ({
                    id: need.necessidade_id || need.id,
                    nome: need.nome || need.name || '',
                    descricao: need.descricao || need.description || ''
                }));
            } else {
                needs = [];
            }
        } catch (error) {
            if (error instanceof SyntaxError) {
                console.warn('Erro ao fazer parse da resposta:', error);
                needs = [];
            } else {
                console.error('Erro ao carregar necessidades:', error);
                needs = [];
            }
        }
    }

    function getFilteredNeeds() {
        if (!Array.isArray(needs) || needs.length === 0) {
            return [];
        }

        const searchTerm = filterSearch ? filterSearch.value.toLowerCase().trim() : '';
        
        if (!searchTerm) {
            return needs;
        }

        return needs.filter(need => {
            const nome = (need.nome || '').toLowerCase();
            const descricao = (need.descricao || '').toLowerCase();
            return nome.includes(searchTerm) || descricao.includes(searchTerm);
        });
    }

    function loadNeedsTable() {
        if (!needsTableBody) return;
        
        needsTableBody.innerHTML = '';
        
        const filteredNeeds = getFilteredNeeds();
        
        if (!Array.isArray(filteredNeeds) || filteredNeeds.length === 0) {
            needsTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <i class="fas fa-heart"></i>
                        <h3>Nenhuma necessidade cadastrada</h3>
                        <p>Clique em "Nova Necessidade" para começar</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        filteredNeeds.forEach(need => {
            if (!need) return;
            
            const row = document.createElement('tr');
            const descricao = need.descricao || 'Sem descrição';
            const descricaoTruncada = descricao.length > 100 
                ? descricao.substring(0, 100) + '...' 
                : descricao;
            
            row.innerHTML = `
                <td><strong>#${need.id}</strong></td>
                <td>${need.nome || ''}</td>
                <td title="${descricao}">${descricaoTruncada}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editNeed(${need.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteNeed(${need.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            needsTableBody.appendChild(row);
        });
    }

    function openNeedModal(need = null) {
        const title = document.getElementById('needModalTitle');
        const form = document.getElementById('needForm');
        
        if (need) {
            title.textContent = 'Editar Necessidade Especial';
            populateForm(need);
        } else {
            title.textContent = 'Nova Necessidade Especial';
            form.reset();
            document.getElementById('needId').value = '';
        }
        
        needModal.style.display = 'block';
    }

    function populateForm(need) {
        document.getElementById('needId').value = need.id || '';
        document.getElementById('needName').value = need.nome || '';
        document.getElementById('needDescription').value = need.descricao || '';
    }

    async function handleSubmit(e) {
        e.preventDefault();
        
        const id = document.getElementById('needId').value;
        const nome = document.getElementById('needName').value.trim();
        const descricao = document.getElementById('needDescription').value.trim();
        
        if (!nome) {
            showToast('O nome da necessidade é obrigatório', 'error');
            return;
        }
        
        try {
            const data = {
                nome: nome,
                descricao: descricao
            };
            
            let result;
            if (id) {
                // Editar
                result = await API_CONFIG.put(`necessidades/${id}`, data);
            } else {
                // Criar
                result = await API_CONFIG.post('necessidades', data);
            }
            
            if (result) {
                showToast(
                    id ? 'Necessidade atualizada com sucesso!' : 'Necessidade criada com sucesso!',
                    'success'
                );
                await loadData();
                loadNeedsTable();
                closeModal(needModal);
            }
        } catch (error) {
            console.error('Erro ao salvar necessidade:', error);
            showToast(error.message || 'Erro ao salvar necessidade', 'error');
        }
    }

    async function handleEdit(id) {
        try {
            const need = await API_CONFIG.get(`necessidades/${id}`);
            
            if (need) {
                const needData = {
                    id: need.necessidade_id || need.id,
                    nome: need.nome || need.name || '',
                    descricao: need.descricao || need.description || ''
                };
                openNeedModal(needData);
            } else {
                showToast('Necessidade não encontrada', 'error');
            }
        } catch (error) {
            console.error('Erro ao carregar necessidade:', error);
            showToast(error.message || 'Erro ao carregar necessidade', 'error');
        }
    }

    async function handleDelete(id) {
        if (!confirm('Tem certeza que deseja excluir esta necessidade?')) {
            return;
        }
        
        try {
            const result = await API_CONFIG.delete(`necessidades/${id}`);
            
            if (result) {
                showToast('Necessidade excluída com sucesso!', 'success');
                await loadData();
                loadNeedsTable();
            }
        } catch (error) {
            console.error('Erro ao excluir necessidade:', error);
            showToast(error.message || 'Erro ao excluir necessidade', 'error');
        }
    }

    function closeModal(modal) {
        if (modal) {
            modal.style.display = 'none';
        }
    }

    function showToast(message, type) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            document.body.appendChild(toast);
        }
        
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.style.display = 'block';
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.style.display = 'none';
            }, 300);
        }, 3000);
    }

    function logout() {
        if (confirm('Deseja realmente sair?')) {
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        }
    }

    // Funções globais para botões onclick
    window.editNeed = handleEdit;
    window.deleteNeed = handleDelete;

})();

