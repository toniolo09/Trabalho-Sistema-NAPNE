// Incluir o script de configuração da API antes deste arquivo
document.addEventListener('DOMContentLoaded', function() {
    // Formatação de CPF
    function formatCPF(cpf) {
        if (!cpf) return '';
        cpf = cpf.replace(/\D/g, '');
        cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
        cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
        cpf = cpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        return cpf;
    }

    // Verificar autenticação
    const currentUserStr = localStorage.getItem('currentUser');
    if (!currentUserStr) {
        window.location.href = 'index.html';
        return;
    }
    
    let currentUser;
    try {
        currentUser = JSON.parse(currentUserStr);
    } catch (e) {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
        return;
    }
    
    // Verificar se tem token e tipo válido
    if (!currentUser || !currentUser.token) {
        window.location.href = 'index.html';
        return;
    }
    
    // Permitir acesso para NAPNE, CAE ou Docente
    const tipo = currentUser.tipo ? currentUser.tipo.toUpperCase() : '';
    if (tipo !== 'NAPNE' && tipo !== 'CAE' && tipo !== 'DOCENTE') {
        window.location.href = 'index.html';
        return;
    }

    // Elementos DOM
    const newTeacherBtn = document.getElementById('newTeacherBtn');
    const teacherModal = document.getElementById('teacherModal');
    const teacherForm = document.getElementById('teacherForm');
    const teachersTableBody = document.getElementById('teachers-table-body');

    // Dados carregados do backend
    let teachers = [];

    // Inicialização
    init();

    async function init() {
        setupEventListeners();
        await loadData();
        loadTeachersTable();
    }

    async function loadData() {
        try {
            const data = await API_CONFIG.get('servidores');
            
            if (Array.isArray(data) && data.length > 0) {
                teachers = data.map(t => ({
                    id: t.siape || t.id,
                    siape: t.siape || t.id,
                    name: t.nome || t.name || '',
                    email: t.email || '',
                    cpf: formatCPF(t.cpf || ''),
                    phone: t.telefone || t.telefone || '',
                    type: t.tipo || t.type || ''
                }));
            } else {
                teachers = [];
            }
        } catch (error) {
            // SyntaxError não deve quebrar a aplicação - tratar silenciosamente
            if (error instanceof SyntaxError) {
                console.warn('SyntaxError capturado em professores.js (silencioso):', error.message);
                // Não mostrar toast para SyntaxError, apenas inicializar array vazio
            } else {
                let errorMessage = error.message || 'Erro ao carregar dados do servidor';
                console.error('Erro ao carregar servidores:', errorMessage, error);
                // Só mostrar toast se não for SyntaxError
                if (typeof showToast === 'function') {
                    showToast(errorMessage, 'error');
                }
            }
            
            // Sempre inicializar array vazio em caso de erro
            teachers = [];
        }
    }

    function setupEventListeners() {
        if (newTeacherBtn) newTeacherBtn.addEventListener('click', () => openTeacherModal());
        if (teacherForm) teacherForm.addEventListener('submit', handleTeacherSubmit);
        
        // CPF formatting
        const cpfInput = document.getElementById('cpf');
        if (cpfInput) {
            cpfInput.addEventListener('input', function(e) {
                e.target.value = formatCPF(e.target.value);
            });
        }
        
        // Telefone formatting
        const telefoneInput = document.getElementById('telefone');
        if (telefoneInput) {
            telefoneInput.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length <= 10) {
                    value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
                } else {
                    value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
                }
                e.target.value = value;
            });
        }
        
        // Modal events
        setupModalEvents();
        
        // Logout
        const logoutBtn = document.getElementById('logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logout);
        }
    }

    function setupModalEvents() {
        if (!teacherModal) return;
        const closeBtn = teacherModal.querySelector('.close');
        const cancelBtn = document.getElementById('cancelTeacher');
        
        if (closeBtn) closeBtn.addEventListener('click', () => closeModal(teacherModal));
        if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal(teacherModal));
        
        teacherModal.addEventListener('click', (e) => {
            if (e.target === teacherModal) closeModal(teacherModal);
        });
    }

    function openTeacherModal(teacher = null) {
        if (!teacherModal) return;
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('teacherForm');
        
        if (teacher) {
            if (title) title.textContent = 'Editar Servidor';
            populateForm(teacher);
        } else {
            if (title) title.textContent = 'Novo Servidor';
            if (form) form.reset();
            const teacherId = document.getElementById('teacherId');
            if (teacherId) teacherId.value = '';
            const siapeInput = document.getElementById('siape');
            if (siapeInput) siapeInput.removeAttribute('readonly');
        }
        
        teacherModal.style.display = 'block';
    }

    function populateForm(teacher) {
        const teacherId = document.getElementById('teacherId');
        const siapeInput = document.getElementById('siape');
        const tipoInput = document.getElementById('tipo');
        const teacherName = document.getElementById('teacherName');
        const email = document.getElementById('email');
        const cpf = document.getElementById('cpf');
        const telefone = document.getElementById('telefone');
        
        if (teacherId) teacherId.value = teacher.id || teacher.siape || '';
        if (siapeInput) {
            siapeInput.value = teacher.siape || teacher.id || '';
            siapeInput.setAttribute('readonly', 'readonly');
        }
        if (tipoInput) tipoInput.value = teacher.type || teacher.tipo || '';
        if (teacherName) teacherName.value = teacher.name || teacher.nome || '';
        if (email) email.value = teacher.email || '';
        if (cpf) cpf.value = formatCPF(teacher.cpf || '');
        if (telefone) telefone.value = teacher.phone || teacher.telefone || '';
    }

    function closeModal(modal) {
        if (modal) modal.style.display = 'none';
    }

    async function handleTeacherSubmit(e) {
        e.preventDefault();
        
        const teacherId = document.getElementById('teacherId')?.value;
        const siape = document.getElementById('siape')?.value;
        const tipo = document.getElementById('tipo')?.value;
        const cpfRaw = document.getElementById('cpf')?.value.replace(/\D/g, '') || '';
        const telefoneRaw = document.getElementById('telefone')?.value.replace(/\D/g, '') || '';
        
        if (!siape || !tipo) {
            showToast('SIAPE e Tipo são obrigatórios!', 'error');
            return;
        }
        
        const formData = {
            siape: parseInt(siape),
            nome: document.getElementById('teacherName')?.value || '',
            email: document.getElementById('email')?.value || '',
            cpf: cpfRaw,
            telefone: telefoneRaw,
            tipo: tipo
        };

        try {
            if (teacherId) {
                // Editar servidor existente
                await API_CONFIG.put(`servidores/${teacherId}`, formData);
                showToast('Servidor atualizado com sucesso!', 'success');
            } else {
                // Criar novo servidor
                await API_CONFIG.post('servidores', formData);
                showToast('Servidor cadastrado com sucesso!', 'success');
            }
            
            // Recarregar dados
            await loadData();
            loadTeachersTable();
            closeModal(teacherModal);
        } catch (error) {
            console.error('Erro ao salvar servidor:', error);
            showToast(error.message || 'Erro ao salvar servidor', 'error');
        }
    }

    function loadTeachersTable() {
        if (!teachersTableBody) return;
        teachersTableBody.innerHTML = '';
        
        if (!Array.isArray(teachers) || teachers.length === 0) {
            teachersTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-user-tie"></i>
                        <h3>Nenhum servidor cadastrado</h3>
                        <p>Clique em "Novo Servidor" para começar</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        teachers.forEach(teacher => {
            if (!teacher) return;
            
            const tipoBadge = teacher.type === 'Docente' ? 'badge-primary' : 
                            teacher.type === 'CAE' ? 'badge-secondary' : 
                            teacher.type === 'NAPNE' ? 'badge-success' : 'badge';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${teacher.siape || teacher.id}</strong></td>
                <td><strong>${teacher.name || ''}</strong></td>
                <td>${teacher.email || 'N/A'}</td>
                <td class="cpf-input">${teacher.cpf || 'N/A'}</td>
                <td>${teacher.phone || 'N/A'}</td>
                <td><span class="badge ${tipoBadge}">${teacher.type || 'N/A'}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editTeacher(${teacher.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTeacher(${teacher.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            teachersTableBody.appendChild(row);
        });
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }

    // Global functions for buttons
    window.editTeacher = function(id) {
        const teacher = teachers.find(t => t.id === id);
        if (teacher) openTeacherModal(teacher);
    };

    window.deleteTeacher = async function(id) {
        if (confirm('Tem certeza que deseja excluir este servidor?')) {
            try {
                await API_CONFIG.delete(`servidores/${id}`);
                showToast('Servidor excluído com sucesso!', 'success');
                await loadData();
                loadTeachersTable();
            } catch (error) {
                console.error('Erro ao excluir servidor:', error);
                showToast(error.message || 'Erro ao excluir servidor', 'error');
            }
        }
    };

    function showToast(message, type) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.className = `toast show ${type}`;

        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    }

    function logout() {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
});
