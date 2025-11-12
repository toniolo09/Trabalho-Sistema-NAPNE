// Incluir o script de configuração da API antes deste arquivo
document.addEventListener('DOMContentLoaded', function() {
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
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const newCourseBtn = document.getElementById('newCourseBtn');
    const newSubjectBtn = document.getElementById('newSubjectBtn');
    const courseModal = document.getElementById('courseModal');
    const subjectModal = document.getElementById('subjectModal');
    const courseDetailsModal = document.getElementById('courseDetailsModal');
    const courseForm = document.getElementById('courseForm');
    const subjectForm = document.getElementById('subjectForm');
    const coursesTableBody = document.getElementById('courses-table-body');
    const subjectsTableBody = document.getElementById('subjects-table-body');

    // Dados carregados do backend
    let courses = [];
    let subjects = [];

    // Inicialização
    init();

    async function init() {
        setupEventListeners();
        await loadData();
        loadCoursesTable();
        loadSubjectsTable();
    }

    async function loadData() {
        try {
            const [coursesData, subjectsData] = await Promise.all([
                API_CONFIG.get('cursos'),
                API_CONFIG.get('componentes')
            ]);

            // Garantir que são arrays válidos antes de mapear
            courses = Array.isArray(coursesData) && coursesData.length > 0
                ? coursesData.map(c => ({
                    id: c.codigo || c.id,
                    code: c.codigo || c.code || '',
                    codigo: c.codigo || c.code || '',
                    name: c.nome || c.name || '',
                    nome: c.nome || c.name || '',
                    level: c.modalidade || c.level || 'Técnico',
                    modalidade: c.modalidade || c.level || 'Técnico',
                    description: c.duracao || c.description || '',
                    carga_horaria: c.carga_horaria || c.workload || null,
                    workload: c.carga_horaria || c.workload || null,
                    duracao: c.duracao || c.duration || '',
                    duration: c.duracao || c.duration || '',
                    coordenador_cpf: c.coordenador_cpf || c.coordinator_cpf || null
                }))
                : [];

            subjects = Array.isArray(subjectsData) && subjectsData.length > 0
                ? subjectsData.map(s => ({
                    id: s.codigo_componente || s.id,
                    codigo_componente: s.codigo_componente || s.id,
                    name: s.componente || s.name || '',
                    componente: s.componente || s.name || '',
                    cargaHoraria: s.carga_horaria || s.cargaHoraria || 0,
                    carga_horaria: s.carga_horaria || s.cargaHoraria || 0,
                    ementa: s.ementa || s.description || '',
                    description: s.ementa || s.description || ''
                }))
                : [];

        } catch (error) {
            // SyntaxError não deve quebrar a aplicação - tratar silenciosamente
            if (error instanceof SyntaxError) {
                console.warn('SyntaxError capturado em cursos.js (silencioso):', error.message);
                // Não mostrar toast para SyntaxError, apenas inicializar arrays vazios
            } else {
                let errorMessage = error.message || 'Erro ao carregar dados do servidor';
                console.error('Erro ao carregar dados:', errorMessage);
                // Só mostrar toast se não for SyntaxError
                if (typeof showToast === 'function') {
                    showToast(errorMessage, 'error');
                }
            }
            
            // Sempre inicializar arrays vazios em caso de erro
            courses = [];
            subjects = [];
        }
    }

    function setupEventListeners() {
        // Tabs
        tabButtons.forEach(button => {
            button.addEventListener('click', () => switchTab(button.dataset.tab));
        });

        // Botões principais
        if (newCourseBtn) newCourseBtn.addEventListener('click', () => openCourseModal());
        if (newSubjectBtn) newSubjectBtn.addEventListener('click', () => openSubjectModal());

        // Formulários
        if (courseForm) courseForm.addEventListener('submit', handleCourseSubmit);
        if (subjectForm) subjectForm.addEventListener('submit', handleSubjectSubmit);

        // Modais
        setupModalEvents();

        // Filtros removidos - matérias não têm mais link com cursos

        // Logout
        const logoutBtn = document.getElementById('logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logout);
        }
    }

    function setupModalEvents() {
        const modals = [courseModal, subjectModal, courseDetailsModal];
        
        modals.forEach(modal => {
            if (!modal) return;
            const closeBtn = modal.querySelector('.close');
            if (closeBtn) closeBtn.addEventListener('click', () => closeModal(modal));
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal(modal);
            });
        });

        // Botões de cancelar
        const cancelCourse = document.getElementById('cancelCourse');
        const cancelSubject = document.getElementById('cancelSubject');
        if (cancelCourse) cancelCourse.addEventListener('click', () => closeModal(courseModal));
        if (cancelSubject) cancelSubject.addEventListener('click', () => closeModal(subjectModal));
        
        // Máscara de CPF
        const coordinatorCpfInput = document.getElementById('courseCoordinatorCpf');
        if (coordinatorCpfInput) {
            coordinatorCpfInput.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length <= 11) {
                    if (value.length <= 3) {
                        value = value;
                    } else if (value.length <= 6) {
                        value = value.replace(/(\d{3})(\d+)/, '$1.$2');
                    } else if (value.length <= 9) {
                        value = value.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
                    } else {
                        value = value.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4');
                    }
                    e.target.value = value;
                }
            });
        }
    }

    function switchTab(tabName) {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const activeContent = document.getElementById(`${tabName}-content`);
        if (activeBtn) activeBtn.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
    }

    function openCourseModal(course = null) {
        const title = document.getElementById('courseModalTitle');
        const form = document.getElementById('courseForm');
        
        if (course) {
            if (title) title.textContent = 'Editar Curso';
            if (document.getElementById('courseId')) document.getElementById('courseId').value = course.id || course.codigo;
            if (document.getElementById('courseCode')) document.getElementById('courseCode').value = course.code || course.codigo || '';
            if (document.getElementById('courseName')) document.getElementById('courseName').value = course.name || course.nome || '';
            if (document.getElementById('courseLevel')) document.getElementById('courseLevel').value = course.level || course.modalidade || '';
            if (document.getElementById('courseDescription')) document.getElementById('courseDescription').value = course.description || '';
            
            // Preencher novos campos
            const coordinatorCpf = course.coordenador_cpf || '';
            if (document.getElementById('courseCoordinatorCpf')) {
                // Formatar CPF com pontos e traços
                const formattedCpf = coordinatorCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                document.getElementById('courseCoordinatorCpf').value = formattedCpf || '';
            }
            if (document.getElementById('courseWorkload')) {
                document.getElementById('courseWorkload').value = course.carga_horaria || course.workload || '';
            }
            if (document.getElementById('courseDuration')) {
                // Extrair apenas a parte de duração (sem anos)
                const duration = course.duracao || '';
                const durationOnly = duration.includes('ano') ? duration.split('-')[1]?.trim() || '' : duration;
                document.getElementById('courseDuration').value = durationOnly;
            }
            if (document.getElementById('courseYears')) {
                // Extrair anos da duração
                const duration = course.duracao || '';
                const yearsMatch = duration.match(/(\d+)\s*ano/i);
                document.getElementById('courseYears').value = yearsMatch ? yearsMatch[1] : '';
            }
        } else {
            if (title) title.textContent = 'Novo Curso';
            if (form) form.reset();
            if (document.getElementById('courseId')) document.getElementById('courseId').value = '';
        }
        
        if (courseModal) courseModal.style.display = 'block';
    }

    function openSubjectModal(subject = null) {
        const title = document.getElementById('subjectModalTitle');
        const form = document.getElementById('subjectForm');
        
        if (subject) {
            if (title) title.textContent = 'Editar Matéria';
            // Usar apenas id (codigo_componente)
            if (document.getElementById('subjectId')) {
                document.getElementById('subjectId').value = subject.id || subject.codigo_componente || '';
            }
            if (document.getElementById('subjectName')) {
                document.getElementById('subjectName').value = subject.name || subject.componente || '';
            }
            if (document.getElementById('subjectWorkload')) {
                document.getElementById('subjectWorkload').value = subject.carga_horaria || subject.cargaHoraria || '';
            }
            if (document.getElementById('subjectEmenta')) {
                document.getElementById('subjectEmenta').value = subject.ementa || subject.description || '';
            }
        } else {
            if (title) title.textContent = 'Nova Matéria';
            if (form) form.reset();
            if (document.getElementById('subjectId')) document.getElementById('subjectId').value = '';
        }
        
        if (subjectModal) subjectModal.style.display = 'block';
    }

    function closeModal(modal) {
        if (modal) modal.style.display = 'none';
    }

    async function handleCourseSubmit(e) {
        e.preventDefault();
        
        const courseId = document.getElementById('courseId')?.value;
        
        // Formatar CPF (remover pontos e traços)
        const coordinatorCpf = document.getElementById('courseCoordinatorCpf')?.value?.replace(/\D/g, '') || '';
        const workload = parseInt(document.getElementById('courseWorkload')?.value) || 0;
        const duration = document.getElementById('courseDuration')?.value || '';
        const years = parseInt(document.getElementById('courseYears')?.value) || 0;
        
        // Combinar duração com anos se necessário
        const fullDuration = years > 0 ? `${years} ano(s) - ${duration}` : duration;

        // Mapear para formato do backend
        const backendData = {
            codigo: document.getElementById('courseCode')?.value || undefined,
            nome: document.getElementById('courseName')?.value || '',
            modalidade: document.getElementById('courseLevel')?.value || '',
            carga_horaria: workload,
            duracao: fullDuration,
            coordenador_cpf: coordinatorCpf && coordinatorCpf.length === 11 ? coordinatorCpf : null // Só enviar se tiver 11 dígitos, senão null
        };

        try {
            if (courseId) {
                // Editar curso existente
                await API_CONFIG.put(`cursos/${courseId}`, backendData);
                showToast('Curso atualizado com sucesso!', 'success');
            } else {
                // Criar novo curso
                await API_CONFIG.post('cursos', backendData);
                showToast('Curso criado com sucesso!', 'success');
            }
            
            await loadData();
            loadCoursesTable();
            closeModal(courseModal);
        } catch (error) {
            console.error('Erro ao salvar curso:', error);
            showToast(error.message || 'Erro ao salvar curso', 'error');
        }
    }

    async function handleSubjectSubmit(e) {
        e.preventDefault();
        
        const subjectId = document.getElementById('subjectId')?.value;
        
        // Dados da matéria - nome, carga horária e ementa (sem link com curso)
        const subjectData = {
            componente: document.getElementById('subjectName')?.value || '',
            carga_horaria: parseInt(document.getElementById('subjectWorkload')?.value) || 0,
            ementa: document.getElementById('subjectEmenta')?.value || ''
        };
        
        // Remover explicitamente qualquer codigo_componente
        delete subjectData.codigo_componente;

        try {
            if (subjectId) {
                // Editar matéria existente
                await API_CONFIG.put(`componentes/${subjectId}`, subjectData);
                showToast('Matéria atualizada com sucesso!', 'success');
            } else {
                // Criar nova matéria - o backend vai gerar o código automaticamente
                await API_CONFIG.post('componentes', subjectData);
                showToast('Matéria criada com sucesso!', 'success');
            }
            
            await loadData();
            loadSubjectsTable();
            closeModal(subjectModal);
        } catch (error) {
            console.error('Erro ao salvar matéria:', error);
            showToast(error.message || 'Erro ao salvar matéria', 'error');
        }
    }

    function loadCoursesTable() {
        if (!coursesTableBody) return;
        coursesTableBody.innerHTML = '';
        
        // Garantir que courses é array válido
        if (!Array.isArray(courses) || courses.length === 0) {
            coursesTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum curso encontrado</td></tr>';
            return;
        }
        
        courses.forEach(course => {
            if (!course) return;
            
            const subjectCount = Array.isArray(subjects)
                ? subjects.filter(s => s.courseId === course.id).length
                : 0;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${course.code || course.codigo || ''}</td>
                <td>${course.name || course.nome || ''}</td>
                <td><span class="badge ${course.level ? course.level.toLowerCase() : ''}">${course.level || course.modalidade || ''}</span></td>
                <td>${subjectCount}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="viewCourseDetails('${course.id || course.codigo}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="editCourse('${course.id || course.codigo}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCourse('${course.id || course.codigo}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            coursesTableBody.appendChild(row);
        });
    }

    function loadSubjectsTable() {
        if (!subjectsTableBody) return;
        
        const filteredSubjects = getFilteredSubjects();
        subjectsTableBody.innerHTML = '';
        
        // Garantir que filteredSubjects é array válido
        if (!Array.isArray(filteredSubjects) || filteredSubjects.length === 0) {
            subjectsTableBody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhuma matéria encontrada</td></tr>';
            return;
        }
        
        filteredSubjects.forEach(subject => {
            if (!subject) return;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${subject.name || subject.componente || ''}</td>
                <td>${subject.carga_horaria || subject.cargaHoraria || 0} horas</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editSubject(${subject.id || subject.codigo_componente})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSubject(${subject.id || subject.codigo_componente})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            subjectsTableBody.appendChild(row);
        });
    }

    function populateCourseSelects() {
        // Removido - matérias não têm mais link com cursos
    }

    function populateFilterOptions() {
        // Removido - matérias não têm mais link com cursos
    }

    function getFilteredSubjects() {
        // Retornar todas as matérias (sem filtro por curso)
        return subjects;
    }

    // Funções globais para os botões
    window.editCourse = function(id) {
        const course = courses.find(c => c.id === id || c.codigo === id);
        if (course) openCourseModal(course);
    };

    window.deleteCourse = async function(id) {
        if (confirm('Tem certeza que deseja excluir este curso? Todas as matérias associadas também serão removidas.')) {
            try {
                await API_CONFIG.delete(`cursos/${id}`);
                showToast('Curso excluído com sucesso!', 'success');
                await loadData();
                loadCoursesTable();
                loadSubjectsTable();
            } catch (error) {
                console.error('Erro ao excluir curso:', error);
                showToast(error.message || 'Erro ao excluir curso', 'error');
            }
        }
    };

    window.viewCourseDetails = function(id) {
        const course = courses.find(c => c.id === id || c.codigo === id);
        if (!course) return;

        const title = document.getElementById('courseDetailsTitle');
        if (title) title.textContent = `Detalhes: ${course.name}`;
        
        const detailCode = document.getElementById('detail-course-code');
        const detailName = document.getElementById('detail-course-name');
        const detailLevel = document.getElementById('detail-course-level');
        const detailDescription = document.getElementById('detail-course-description');
        
        if (detailCode) detailCode.textContent = course.code || '';
        if (detailName) detailName.textContent = course.name || '';
        if (detailLevel) detailLevel.textContent = course.level || '';
        if (detailDescription) detailDescription.textContent = course.description || 'Nenhuma descrição disponível.';

        // Listar todas as matérias (sem filtro por curso)
        const courseSubjects = subjects;
        const subjectsList = document.getElementById('course-subjects-list');
        
        if (subjectsList) {
            if (courseSubjects.length === 0) {
                subjectsList.innerHTML = '<p class="empty-message">Nenhuma matéria cadastrada para este curso.</p>';
            } else {
                subjectsList.innerHTML = courseSubjects.map(subject => `
                    <div class="subject-item">
                        <h4>${subject.name}</h4>
                        <p><strong>Carga Horária:</strong> ${subject.cargaHoraria || 'N/A'} horas</p>
                    </div>
                `).join('');
            }
        }

        if (courseDetailsModal) courseDetailsModal.style.display = 'block';
    };

    window.editSubject = function(id) {
        const subject = subjects.find(s => s.id === id);
        if (subject) openSubjectModal(subject);
    };

    window.deleteSubject = async function(id) {
        if (confirm('Tem certeza que deseja excluir esta matéria?')) {
            try {
                await API_CONFIG.delete(`componentes/${id}`);
                showToast('Matéria excluída com sucesso!', 'success');
                await loadData();
                loadSubjectsTable();
                loadCoursesTable();
            } catch (error) {
                console.error('Erro ao excluir matéria:', error);
                showToast(error.message || 'Erro ao excluir matéria', 'error');
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
