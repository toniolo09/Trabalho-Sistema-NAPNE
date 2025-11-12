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
    
    // Verificar se o usuário é um professor ou NAPNE (ambos podem gerenciar PEIs)
    const tipo = currentUser.tipo ? currentUser.tipo.toUpperCase() : '';
    const isNapne = tipo === 'NAPNE';
    const isCae = tipo === 'CAE';
    const isDocente = tipo === 'DOCENTE';

    if (!isDocente && !isNapne && !isCae) {
        alert('Apenas usuários autorizados (Professores, NAPNE ou CAE) podem acessar a gestão de PEIs.');
        window.location.href = 'dashboard.html';
        return;
    }

    // Elementos do DOM
    const logoutBtn = document.getElementById('logout');
    const newPeiBtn = document.getElementById('newPeiBtn');
    const applyFiltersBtn = document.getElementById('applyFilters');
    const clearFiltersBtn = document.getElementById('clearFilters');
    const peiModal = document.getElementById('peiModal');
    const closeModal = document.querySelector('.close');
    const cancelPeiBtn = document.getElementById('cancelPei');
    const peiForm = document.getElementById('peiForm');
    const peiViewContainer = document.getElementById('peiViewContainer');
    const generatePdfBtn = document.getElementById('generatePdf');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const specificNeedFilter = document.getElementById('filter-specific');
    const courseFilter = document.getElementById('filter-course');
    const studentNameSelect = document.getElementById('studentName');
    const studentCourseSelect = document.getElementById('studentCourse');
    const teacherInput = document.getElementById('teacher');
    
    // Utilidades de visualização
    function resetPeiView() {
        if (peiViewContainer) {
            peiViewContainer.innerHTML = '';
            peiViewContainer.style.display = 'none';
        }
        if (peiForm) {
            peiForm.style.display = 'block';
        }
        const subjectSelect = document.getElementById('subject');
        if (subjectSelect) {
            subjectSelect.disabled = false;
            subjectSelect.classList.remove('select-locked');
            subjectSelect.removeAttribute('title');
        }
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/[&<>"']/g, function(match) {
            const entities = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return entities[match] || match;
        });
    }

    function formatMultiline(value) {
        const safe = escapeHtml(value || '');
        return safe.replace(/\r\n|\r|\n/g, '<br>');
    }

    function formatDateTime(value) {
        if (!value) return '';
        const date = new Date(value);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    }

    function getNecessidadeDoEstudante(estudante) {
        if (!estudante || !estudante.cpf) return '';
        const cpfEstudante = estudante.cpf.replace(/\D/g, '');
        const relacaoNecessidade = Array.isArray(estudantesNecessidades)
            ? estudantesNecessidades.find(en => {
                const cpfRelacao = en.estudante_cpf ? en.estudante_cpf.replace(/\D/g, '') : '';
                return cpfRelacao === cpfEstudante;
            })
            : null;
        if (!relacaoNecessidade) return '';
        const necessidade = necessidades.find(n => n.id === relacaoNecessidade.necessidade_id);
        return necessidade ? necessidade.nome : '';
    }

    function buildStatusChip(status) {
        const statusMap = {
            'rascunho': { text: 'Rascunho', className: 'chip-info' },
            'enviado_para_napne': { text: 'Enviado para NAPNE', className: 'chip-warning' },
            'em_avaliacao': { text: 'Em Avaliação', className: 'chip-warning' },
            'aprovado': { text: 'Aprovado', className: 'chip-success' },
            'rejeitado': { text: 'Rejeitado', className: 'chip-danger' },
            'pendente': { text: 'Sem adaptação', className: 'chip-neutral' }
        };
        return statusMap[status] || statusMap['pendente'];
    }

    function renderPeiView(config) {
        if (!peiViewContainer || !peiForm) return;
        const {
            title,
            subtitle,
            updatedAt,
            statusChip,
            basicInfo = [],
            sections = []
        } = config || {};

        const infoHtml = basicInfo
            .filter(item => item && item.label)
            .map(item => {
                const value = item.value && String(item.value).trim() !== '' ? formatMultiline(item.value) : '<span class="pei-view__placeholder">—</span>';
                return `
                    <div class="pei-view__info">
                        <span class="pei-view__label">${escapeHtml(item.label)}</span>
                        <span class="pei-view__value">${value}</span>
                    </div>
                `;
            })
            .join('');

        const sectionsHtml = sections.map(section => {
            const items = (section.items || []).filter(item => item && item.value && String(item.value).trim() !== '');
            let content = '';
            if (items.length > 0) {
                content = items.map(item => `
                    <div class="pei-view__card ${item.highlight ? 'pei-view__card--highlight' : ''}">
                        <span class="pei-view__card-label">${escapeHtml(item.label)}</span>
                        <p class="pei-view__card-value">${formatMultiline(item.value)}</p>
                    </div>
                `).join('');
            } else if (section.emptyMessage) {
                content = `<p class="pei-view__empty">${escapeHtml(section.emptyMessage)}</p>`;
            }
            return `
                <section class="pei-view__section">
                    <h3>${escapeHtml(section.title || '')}</h3>
                    ${content}
                </section>
            `;
        }).join('');

        const statusHtml = statusChip ? `
            <div class="pei-view__meta">
                <span class="pei-view__chip ${escapeHtml(statusChip.className || '')}">${escapeHtml(statusChip.text || '')}</span>
                ${updatedAt ? `<span class="pei-view__date">${escapeHtml(updatedAt)}</span>` : ''}
            </div>
        ` : (updatedAt ? `<div class="pei-view__meta"><span class="pei-view__date">${escapeHtml(updatedAt)}</span></div>` : '');

        peiViewContainer.innerHTML = `
            <div class="pei-view">
                <div class="pei-view__header">
                    <div>
                        <h2>${escapeHtml(title || 'Plano Educacional Individualizado')}</h2>
                        ${subtitle ? `<p class="pei-view__subtitle">${escapeHtml(subtitle)}</p>` : ''}
                    </div>
                    ${statusHtml}
                </div>
                ${basicInfo.length ? `
                    <section class="pei-view__section">
                        <h3>Informações Básicas</h3>
                        <div class="pei-view__grid">
                            ${infoHtml}
                        </div>
                    </section>
                ` : ''}
                ${sectionsHtml}
            </div>
        `;

        peiForm.style.display = 'none';
        peiViewContainer.style.display = 'block';
    }

    function createPeiViewConfig({ peiGeral, peiAdaptacao, student, course, subject, professor }) {
        const subjectName = subject ? (subject.componente || subject.name || '') : '';
        const subjectEmenta = subject ? (subject.ementa || subject.description || '') : '';
        const necessidadeNome = peiGeral?.necessidade_especifica || getNecessidadeDoEstudante(student);
        const professorNome = professor ? (professor.nome || professor.name || professor.docente || '') : '';
        const updatedAt = formatDateTime(peiAdaptacao?.data_atualizacao || peiGeral?.data_atualizacao);
        const statusChip = buildStatusChip(peiAdaptacao ? peiAdaptacao.status : 'pendente');

        const basicInfo = [
            { label: 'Estudante', value: student ? student.nome : 'N/A' },
            { label: 'Curso', value: course ? (course.name || course.nome) : 'N/A' },
            { label: 'Componente Curricular', value: subjectName || 'Não definido' },
            { label: 'Professor Responsável', value: professorNome || 'N/A' },
            { label: 'Ano/Semestre', value: peiGeral?.periodo || 'N/A' },
            { label: 'Necessidade Específica', value: necessidadeNome || 'Não informado' },
            { label: 'Status do PEI', value: statusChip.text }
        ];

        const generalItems = [];
        if (subjectEmenta) {
            generalItems.push({ label: 'Ementa do Componente Curricular', value: subjectEmenta });
        }
        generalItems.push(
            { label: 'Objetivo Geral', value: peiGeral?.objetivo_geral },
            { label: 'Conteúdos', value: peiGeral?.conteudos },
            { label: 'Parecer do NAPNE', value: peiGeral?.parecer },
            { label: 'Dificuldades', value: peiGeral?.dificuldades },
            { label: 'Interesses e Habilidades', value: peiGeral?.interesses_habilidades },
            { label: 'Estratégias', value: peiGeral?.estrategias },
            { label: 'Observações', value: peiGeral?.observacoes },
            { label: 'Histórico', value: peiGeral?.historico }
        );

        const sections = [
            {
                title: 'PEI Geral (NAPNE)',
                items: generalItems
            }
        ];

        if (peiAdaptacao) {
            const adaptItems = [
                { label: 'Objetivos Específicos', value: peiAdaptacao.objetivos_especificos },
                { label: 'Metodologia', value: peiAdaptacao.metodologia },
                { label: 'Avaliação', value: peiAdaptacao.avaliacao },
                { label: 'Parecer do Professor', value: peiAdaptacao.parecer },
                { label: 'Ementa Complementar', value: peiAdaptacao.ementa }
            ];
            sections.push({
                title: 'PEI Adaptação (Professor)',
                items: adaptItems
            });

            if (peiAdaptacao.comentarios_napne && peiAdaptacao.comentarios_napne.trim()) {
                sections.push({
                    title: 'Comentários do NAPNE',
                    items: [
                        { label: 'Registro', value: peiAdaptacao.comentarios_napne, highlight: true }
                    ]
                });
            }
        } else {
            sections.push({
                title: 'PEI Adaptação (Professor)',
                items: [],
                emptyMessage: 'Nenhum PEI de adaptação foi cadastrado pelo professor até o momento.'
            });
        }

        return {
            title: subjectName ? `PEI - ${subjectName}` : 'PEI Geral',
            subtitle: course ? `Curso: ${course.name || course.nome || ''}` : '',
            updatedAt,
            statusChip,
            basicInfo,
            sections
        };
    }

    // Dados carregados do backend
    let peisGeral = [];
    let peisAdaptacao = [];
    let students = [];
    let courses = [];
    let teachers = [];
    let subjects = [];
    let matriculas = [];
    let necessidades = [];
    let estudantesNecessidades = [];
    let servidores = []; // Lista de servidores para validação
    
    // Removido - as necessidades vêm do banco de dados agora
    
    // Inicializar a página
    initPage();
    
    // Logout
    logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
    
    // Abrir modal para novo PEI (apenas PEI_GERAL no NAPNE)
    if (isCae && newPeiBtn) {
        newPeiBtn.style.display = 'none';
    } else {
        newPeiBtn.addEventListener('click', function() {
            if (isCae) {
                alert('Usuários CAE possuem acesso somente para visualização.');
                return;
            }
            window.openModalGeral(); // Criar apenas PEI_GERAL
        });
    }
    
    // Fechar modal
    closeModal.addEventListener('click', function() {
        closeModalWindow();
    });
    
    cancelPeiBtn.addEventListener('click', function() {
        closeModalWindow();
    });
    
    // Clicar fora do modal para fechar
    window.addEventListener('click', function(event) {
        if (event.target === peiModal) {
            closeModalWindow();
        }
    });
    
    // Alternar entre abas
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchTab(tab);
        });
    });
    
    // Aplicar filtros
    applyFiltersBtn.addEventListener('click', function() {
        applyFilters();
    });
    
    // Limpar filtros
    clearFiltersBtn.addEventListener('click', function() {
        clearFilters();
    });
    
    // Gerar PDF
    generatePdfBtn.addEventListener('click', function() {
        generatePdf();
    });
    
    // Alterar estudante selecionado
    studentNameSelect.addEventListener('change', function() {
        updateStudentInfo(this.value); // Atualizar curso e necessidade automaticamente
    });

    // Alterar matéria selecionada - preencher ementa
    const subjectSelect = document.getElementById('subject');
    if (subjectSelect) {
        subjectSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            if (selectedOption && selectedOption.dataset.description) {
                const ementaValue = selectedOption.dataset.description;
                // Preencher ementa no campo de PEI_ADAPTACAO
                const ementaAdaptacao = document.getElementById('ementaAdaptacao');
                if (ementaAdaptacao) {
                    ementaAdaptacao.value = ementaValue;
                }
                // Também preencher no campo antigo (se existir) para compatibilidade
                const ementaTextarea = document.getElementById('ementa');
                if (ementaTextarea) {
                    ementaTextarea.value = ementaValue;
                }
            }
        });
    }

    // Enviar formulário de PEI
    peiForm.addEventListener('submit', function(e) {
        e.preventDefault();
        savePei();
    });
    
    // Modal de comentário do NAPNE
    const napneCommentModal = document.getElementById('napneCommentModal');
    const napneCommentForm = document.getElementById('napneCommentForm');
    const cancelCommentBtn = document.getElementById('cancelComment');
    const closeNapneCommentModal = napneCommentModal ? napneCommentModal.querySelector('.close') : null;
    
    if (napneCommentForm) {
        napneCommentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveNapneComment();
        });
    }
    
    if (cancelCommentBtn) {
        cancelCommentBtn.addEventListener('click', function() {
            if (napneCommentModal) {
                napneCommentModal.style.display = 'none';
            }
        });
    }
    
    if (closeNapneCommentModal) {
        closeNapneCommentModal.addEventListener('click', function() {
            if (napneCommentModal) {
                napneCommentModal.style.display = 'none';
            }
        });
    }
    
    if (napneCommentModal) {
        window.addEventListener('click', function(event) {
            if (event.target === napneCommentModal) {
                napneCommentModal.style.display = 'none';
            }
        });
    }
    
    // Função para inicializar a página
    async function initPage() {
        await loadData();
        
        // Preencher opções de cursos
        populateCourseOptions();

        // Preencher opções de alunos
        populateStudentOptions();

        // Preencher opções de professores
        populateTeacherOptions();

        // Preencher opções de matérias
        populateSubjectOptions();

        // Carregar e exibir PEIs
        loadPeis();

        // Verificar se há parâmetros na URL (para edição/visualização)
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const id = urlParams.get('id');

        if (action && id) {
            if (action === 'edit') {
                openModal(id);
            } else if (action === 'view') {
                viewPei(id);
            }
        }
    }

    // Carregar dados do backend
    async function loadData() {
        try {
            [students, courses, subjects, servidores, peisGeral, peisAdaptacao, matriculas, necessidadesData, estudantesNecessidadesData] = await Promise.all([
                API_CONFIG.get('estudantes'),
                API_CONFIG.get('cursos'),
                API_CONFIG.get('componentes'),
                API_CONFIG.get('servidores'),
                API_CONFIG.get('peis'),
                API_CONFIG.get('adaptacoes'),
                API_CONFIG.get('matriculas'),
                API_CONFIG.get('necessidades'),
                API_CONFIG.get('estudantes-necessidades')
            ]);
            
            // Processar necessidades
            necessidades = Array.isArray(necessidadesData) ? necessidadesData.map(n => ({
                id: n.necessidade_id || n.id,
                nome: n.nome || n.name || '',
                descricao: n.descricao || n.description || ''
            })) : [];
            
            estudantesNecessidades = Array.isArray(estudantesNecessidadesData) ? estudantesNecessidadesData : [];

            // Garantir que servidores é um array
            servidores = Array.isArray(servidores) ? servidores : [];

            // Mapear servidores para teachers (apenas Docentes)
            teachers = servidores.filter(s => s.tipo === 'Docente').map(t => ({
                id: t.siape,
                name: t.nome,
                email: t.email,
                tipo: t.tipo
            }));

            // Mapear cursos para formato esperado
            courses = courses.map(c => ({
                codigo: c.codigo,
                id: c.codigo,
                nome: c.nome,
                name: c.nome,
                modalidade: c.modalidade,
                level: c.modalidade || 'Técnico'
            }));

            // Mapear componentes (subjects) para formato esperado
            subjects = subjects.map(s => ({
                codigo_componente: s.codigo_componente,
                id: s.codigo_componente,
                componente: s.componente,
                name: s.componente,
                carga_horaria: s.carga_horaria,
                cargaHoraria: s.carga_horaria,
                ementa: s.ementa || s.description || '',
                description: s.ementa || s.description || ''
            }));
        } catch (error) {
            let errorMessage = 'Erro ao carregar dados do servidor';
            
            // SyntaxError não deve quebrar a aplicação
            if (error instanceof SyntaxError) {
                errorMessage = 'Erro ao processar resposta do servidor. Verifique a conexão.';
                console.warn('SyntaxError capturado em peis.js:', error.message);
                // Não mostrar toast para SyntaxError
            } else if (error instanceof Error) {
                errorMessage = error.message || errorMessage;
                console.error('Erro ao carregar dados:', errorMessage, error);
            }
            
            students = [];
            courses = [];
            teachers = [];
            subjects = [];
            peisGeral = [];
            peisAdaptacao = [];
            matriculas = [];
            necessidades = [];
            estudantesNecessidades = [];
        }
    }
    
    // Função para preencher opções de cursos
    function populateCourseOptions() {
        const filterCourseSelect = document.getElementById('filter-course');

        // Limpar opções existentes
        studentCourseSelect.innerHTML = '<option value="">Selecione o curso</option>';
        filterCourseSelect.innerHTML = '<option value="all">Todos</option>';

        // Adicionar cursos
        courses.forEach(course => {
            const courseId = course.id;
            const courseName = course.name;
            studentCourseSelect.innerHTML += `<option value="${courseId}">${courseName}</option>`;
            filterCourseSelect.innerHTML += `<option value="${courseName}">${courseName}</option>`;
        });
    }
    
    // Função para preencher opções de alunos
    function populateStudentOptions() {
        if (!studentNameSelect) return;
        // Limpar opções existentes
        studentNameSelect.innerHTML = '<option value="">Selecione o estudante</option>';

        // Adicionar alunos com matrícula e curso
        students.forEach(student => {
            // Buscar matrícula do estudante
            const matricula = matriculas.find(m => m.estudante_id === student.id_aluno);
            const course = courses.find(c => matricula && c.id === matricula.curso_id);
            const courseName = course ? course.name : 'Curso não informado';
            
            studentNameSelect.innerHTML += `<option value="${student.nome}" data-matricula="${matricula ? matricula.matricula : ''}" data-course-id="${course ? course.id : ''}" data-course="${courseName}">${student.nome}</option>`;
        });
    }

    // Função para preencher opções de professores
    function populateTeacherOptions() {
        const teacherSelect = document.getElementById('teacher');
        const professorSelect = document.getElementById('professorSelect');
        
        // Preencher select de professor para PEI_GERAL (NAPNE)
        if (professorSelect) {
            professorSelect.innerHTML = '<option value="">Selecione o professor</option>';
            servidores.forEach(servidor => {
                if (servidor.tipo === 'Docente') {
                    const option = document.createElement('option');
                    option.value = servidor.siape;
                    option.textContent = `${servidor.nome} (SIAPE: ${servidor.siape})`;
                    professorSelect.appendChild(option);
                }
            });
        }
        
        // Preencher select de docente para PEI_ADAPTACAO (se existir)
        if (teacherSelect) {
            teacherSelect.innerHTML = '<option value="">Selecione o docente</option>';
            servidores.forEach(servidor => {
                if (servidor.tipo === 'Docente') {
                    const option = document.createElement('option');
                    option.value = servidor.nome;
                    option.textContent = servidor.nome;
                    teacherSelect.appendChild(option);
                }
            });
        }
    }

    // Função para preencher opções de matérias (todas as matérias criadas)
    function populateSubjectOptions() {
        const subjectSelect = document.getElementById('subject');
        const ementaTextarea = document.getElementById('ementa');
        
        if (!subjectSelect) return;
        
        subjectSelect.innerHTML = '<option value="">Selecione a matéria</option>';
        ementaTextarea.value = ''; // Limpar ementa

        // Mostrar todas as matérias criadas (não filtrar por curso)
        if (Array.isArray(subjects) && subjects.length > 0) {
            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject.codigo_componente || subject.id;
                option.textContent = subject.componente || subject.name || '';
                // Adicionar ementa do banco de dados
                option.dataset.description = subject.ementa || subject.description || '';
                subjectSelect.appendChild(option);
            });
        }
    }
    
    // Nova função para atualizar curso e necessidade específica baseado no aluno selecionado
    function updateStudentInfo(studentName) {
        const selectedOption = studentNameSelect.options[studentNameSelect.selectedIndex];
        if (selectedOption && studentName) {
            const courseId = selectedOption.dataset.courseId;
            const courseName = selectedOption.dataset.course;

            // Atualizar curso
            if (courseId) {
            studentCourseSelect.value = courseId;
            }

            // Preencher todas as matérias (não filtrar por curso)
            populateSubjectOptions();

            // Buscar necessidade específica do estudante
            const student = students.find(s => s.nome === studentName || s.name === studentName);
            if (student && student.cpf) {
                const cpfEstudante = student.cpf.replace(/\D/g, '');
                
                // Buscar necessidade do estudante
                const relacaoNecessidade = Array.isArray(estudantesNecessidades)
                    ? estudantesNecessidades.find(en => {
                        const cpfRelacao = en.estudante_cpf ? en.estudante_cpf.replace(/\D/g, '') : '';
                        return cpfRelacao === cpfEstudante;
                    })
                    : null;
                
                if (relacaoNecessidade) {
                    const necessidade = necessidades.find(n => n.id === relacaoNecessidade.necessidade_id);
                    const specificNeedSelect = document.getElementById('specificNeed');
                    if (specificNeedSelect && necessidade) {
                        // Limpar e preencher com todas as necessidades
                        specificNeedSelect.innerHTML = '<option value="">Nenhuma necessidade</option>';
                        necessidades.forEach(need => {
                            const option = document.createElement('option');
                            option.value = need.id;
                            option.textContent = need.nome;
                            if (need.id === necessidade.id) {
                                option.selected = true;
                            }
                            specificNeedSelect.appendChild(option);
                        });
                    }
                } else {
                    // Se não há necessidade, preencher select com todas as opções
        const specificNeedSelect = document.getElementById('specificNeed');
                    if (specificNeedSelect) {
                        specificNeedSelect.innerHTML = '<option value="">Nenhuma necessidade cadastrada</option>';
                        necessidades.forEach(need => {
                            const option = document.createElement('option');
                            option.value = need.id;
                            option.textContent = need.nome;
                            specificNeedSelect.appendChild(option);
            });
        }
    }
            }
        }
    }
    
    // Funções removidas - não são mais necessárias
    
    // Função para carregar e exibir PEIs
    function loadPeis() {
        const peiGeralTableBody = document.getElementById('pei-geral-table-body');
        const peiAdaptacaoTableBody = document.getElementById('pei-adaptacao-table-body');
        
        // Carregar PEI_GERAL (criados pelo NAPNE)
        if (peiGeralTableBody) {
            peiGeralTableBody.innerHTML = '';
            
            if (peisGeral.length === 0) {
                peiGeralTableBody.innerHTML = '<tr><td colspan="9" class="empty-message">Nenhum PEI Geral cadastrado.</td></tr>';
            } else {
                peisGeral.forEach(peiGeral => {
                    const matricula = matriculas.find(m => m.matricula === peiGeral.matricula);
                    const student = students.find(s => matricula && s.id_aluno === matricula.estudante_id);
                    const course = courses.find(c => matricula && c.id === matricula.curso_id);
                    const subject = subjects.find(s => (s.codigo_componente || s.id) == peiGeral.codigo_componente);
                    
                    // Verificar se tem PEI_ADAPTACAO criado
                    const peiAdaptacao = peisAdaptacao.find(pa => pa.pei_geral_id === peiGeral.id);
                    const temAdaptacao = !!peiAdaptacao;
                    
                    // Buscar professor responsável
                    const professor = servidores.find(s => s.siape === peiGeral.professor_siape);
                    const nomeProfessor = professor ? professor.nome : 'N/A';
                    
                    // Buscar necessidade do estudante
                    let necessidadeNome = 'N/A';
                    if (student && student.cpf) {
                        const cpfEstudante = student.cpf.replace(/\D/g, '');
                        const relacaoNecessidade = Array.isArray(estudantesNecessidades)
                            ? estudantesNecessidades.find(en => {
                                const cpfRelacao = en.estudante_cpf ? en.estudante_cpf.replace(/\D/g, '') : '';
                                return cpfRelacao === cpfEstudante;
                            })
                            : null;
                        if (relacaoNecessidade) {
                            const necessidade = necessidades.find(n => n.id === relacaoNecessidade.necessidade_id);
                            necessidadeNome = necessidade ? necessidade.nome : 'N/A';
                        }
                    }
                    
                    // Status baseado em se tem adaptação
                    const status = temAdaptacao ? 'Com Adaptação' : 'Pendente';
                    const statusClass = temAdaptacao ? 'status-completed' : 'status-pending';
                    const subjectName = subject ? (subject.name || subject.componente || subject.codigo_componente) : 'Não definido';
                    
                    const row = document.createElement('tr');
                    const actionsGeral = isCae
                        ? `<button class="btn btn-view" onclick="viewPeiGeral(${peiGeral.id})">Visualizar</button>`
                        : `<button class="btn btn-view" onclick="viewPeiGeral(${peiGeral.id})">Visualizar</button>
                           <button class="btn btn-edit" onclick="editPeiGeral(${peiGeral.id})">Editar</button>
                           <button class="btn btn-danger" onclick="deletePeiGeral(${peiGeral.id})">Excluir</button>`;
                    row.innerHTML = `
                        <td>${student ? student.nome : 'N/A'}</td>
                        <td>${course ? course.name : 'N/A'}</td>
                        <td>${subjectName}</td>
                        <td>${peiGeral.periodo || 'N/A'}</td>
                        <td>${necessidadeNome}</td>
                        <td>${nomeProfessor}</td>
                        <td><span class="status-badge ${statusClass}">${status}</span></td>
                        <td>${peiGeral.data_atualizacao ? new Date(peiGeral.data_atualizacao).toLocaleDateString('pt-BR') : 'N/A'}</td>
                        <td>
                            ${actionsGeral}
                        </td>
                    `;
                    peiGeralTableBody.appendChild(row);
                });
            }
        }
        
        // Carregar PEI_ADAPTACAO (criados pelos professores)
        if (peiAdaptacaoTableBody) {
            peiAdaptacaoTableBody.innerHTML = '';
            
            if (peisAdaptacao.length === 0) {
                peiAdaptacaoTableBody.innerHTML = '<tr><td colspan="8" class="empty-message">Nenhum PEI Adaptação cadastrado.</td></tr>';
        } else {
                peisAdaptacao.forEach(pa => {
                    const peiGeral = peisGeral.find(pg => pg.id === pa.pei_geral_id);
                    const matricula = matriculas.find(m => peiGeral && m.matricula === peiGeral.matricula);
                const student = students.find(s => matricula && s.id_aluno === matricula.estudante_id);
                const course = courses.find(c => matricula && c.id === matricula.curso_id);
                    const subject = subjects.find(s => (s.codigo_componente || s.id) == pa.codigo_componente);
                    const professor = servidores.find(s => s.siape === pa.professor_siape);
                    
                    // Mapear status para texto
                    const statusMap = {
                        'rascunho': 'Rascunho',
                        'enviado_para_napne': 'Enviado para NAPNE',
                        'em_avaliacao': 'Em Avaliação',
                        'aprovado': 'Aprovado',
                        'rejeitado': 'Rejeitado'
                    };
                    const statusText = statusMap[pa.status] || pa.status || 'N/A';
                    const statusClass = pa.status === 'aprovado' ? 'status-completed' : 
                                      pa.status === 'rejeitado' ? 'status-rejected' : 
                                      pa.status === 'em_avaliacao' ? 'status-pending' : 'status-draft';
                
                const row = document.createElement('tr');
                const actionsAdapt = isCae
                    ? `<button class="btn btn-view" onclick="viewPeiAdaptacao(${pa.id})">Visualizar</button>`
                    : `<button class="btn btn-view" onclick="viewPeiAdaptacao(${pa.id})">Visualizar</button>
                       <button class="btn btn-comment" onclick="commentPeiAdaptacao(${pa.id})">Comentar</button>
                       <button class="btn btn-danger" onclick="deletePeiAdaptacao(${pa.id})">Excluir</button>`;
                row.innerHTML = `
                    <td>${student ? student.nome : 'N/A'}</td>
                    <td>${course ? course.name : 'N/A'}</td>
                        <td>${subject ? subject.name : 'N/A'}</td>
                        <td>${professor ? professor.nome : pa.docente || 'N/A'}</td>
                        <td>${peiGeral ? peiGeral.periodo : 'N/A'}</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td>${pa.data_envio_napne ? new Date(pa.data_envio_napne).toLocaleDateString('pt-BR') : 'N/A'}</td>
                        <td>
                            ${actionsAdapt}
                    </td>
                `;
                    peiAdaptacaoTableBody.appendChild(row);
            });
            }
        }
    }
    
    window.viewPeiGeral = function(id) {
        window.openModalGeral(id, true); // Visualizar PEI_GERAL
    };
    
    window.editPeiGeral = function(id) {
        if (isCae) {
            alert('Usuários CAE possuem acesso somente para visualização.');
            return;
        }
        window.openModalGeral(id, false); // Editar PEI_GERAL
    };
    
    // Função para abrir modal de PEI_GERAL (criar novo ou editar)
    window.openModalGeral = function(peiGeralId = null, readOnly = false) {
        if (isCae && !readOnly) {
            alert('Usuários CAE possuem acesso somente para visualização.');
            return;
        }
        resetPeiView();
        const modalTitle = document.getElementById('modalTitle');
        const peiIdField = document.getElementById('peiId');
        const peiTypeField = document.getElementById('peiType');
        const saveBtn = document.getElementById('savePei');
        const generatePdfBtn = document.getElementById('generatePdf');
        
        if (peiGeralId) {
            // Modo edição ou visualização
            const peiGeral = peisGeral.find(p => p.id == peiGeralId);
            if (!peiGeral) {
                alert('PEI Geral não encontrado');
                return;
            }
            
            const matricula = matriculas.find(m => m.matricula === peiGeral.matricula);
            const student = students.find(s => matricula && s.id_aluno === matricula.estudante_id);
            const course = courses.find(c => matricula && c.id === matricula.curso_id);
            const subject = subjects.find(s => (s.codigo_componente || s.id) == peiGeral.codigo_componente);
            const professor = servidores.find(s => s.siape === peiGeral.professor_siape);
            const peiAdaptacaoRelacionado = peisAdaptacao.find(pa => pa.pei_geral_id === peiGeral.id);
            
            modalTitle.textContent = readOnly ? 'Visualizar PEI Geral' : 'Editar PEI Geral';
            peiIdField.value = peiGeral.id;
            peiTypeField.value = 'geral';
            
            // Preencher formulário com dados do PEI_GERAL
            document.getElementById('studentName').value = student ? student.nome : '';
            document.getElementById('studentCourse').value = course ? course.id : '';
            document.getElementById('yearSemester').value = peiGeral.periodo || '';
            document.getElementById('generalObjective').value = peiGeral.objetivo_geral || '';
            document.getElementById('contents').value = peiGeral.conteudos || '';
            document.getElementById('napneOpinion').value = peiGeral.parecer || '';
            document.getElementById('dificuldades').value = peiGeral.dificuldades || '';
            document.getElementById('interessesHabilidades').value = peiGeral.interesses_habilidades || '';
            document.getElementById('historico').value = peiGeral.historico || '';
            document.getElementById('estrategias').value = peiGeral.estrategias || '';
            document.getElementById('observacoes').value = peiGeral.observacoes || '';
            
            // Preencher professor responsável
            const professorSelect = document.getElementById('professorSelect');
            if (professorSelect && peiGeral.professor_siape) {
                professorSelect.value = peiGeral.professor_siape;
            }
            
            // Atualizar necessidade do aluno
            updateStudentInfo(student ? student.nome : '');

            // Exibir e configurar componente curricular
            const subjectGroup = document.getElementById('subject-group');
            if (subjectGroup) {
                subjectGroup.style.display = 'block';
                const select = subjectGroup.querySelector('select');
                if (select) {
                    select.disabled = readOnly;
                    select.required = true;
                    if (readOnly) {
                        select.classList.add('select-locked');
                        select.title = 'Componente curricular definido pelo NAPNE';
                    } else {
                        select.classList.remove('select-locked');
                        select.removeAttribute('title');
                    }
                    if (peiGeral.codigo_componente) {
                        select.value = peiGeral.codigo_componente.toString();
                        if (select.value !== peiGeral.codigo_componente.toString()) {
                            const optionToSelect = Array.from(select.options).find(opt => opt.value == peiGeral.codigo_componente);
                            if (optionToSelect) {
                                optionToSelect.selected = true;
                            }
                        }
                        select.dispatchEvent(new Event('change'));
                    }
                }
            }

            const ementaGroup = document.getElementById('ementa-group');
            if (ementaGroup) {
                ementaGroup.style.display = 'block';
                const ementaTextarea = ementaGroup.querySelector('textarea');
                if (ementaTextarea) {
                    ementaTextarea.value = subject ? (subject.ementa || subject.description || '') : '';
                }
            }
            
            // Ocultar campos de PEI_ADAPTACAO (professor cria)
            const adaptacaoFields = ['teacher-group', 'specificObjectives-group', 'methodology-group', 'evaluation-group', 'opinion-group', 'ementa-adaptacao-group'];
            adaptacaoFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.style.display = 'none';
                    // Remover required dos campos ocultos
                    const inputs = field.querySelectorAll('input, select, textarea');
                    inputs.forEach(input => {
                        if (input) {
                            input.removeAttribute('required');
                            input.disabled = true;
                        }
                    });
                }
            });
            
            // Mostrar apenas campos de PEI_GERAL e professor
            const geralFields = ['professor-select-group', 'generalObjective', 'contents', 'napneOpinion', 'dificuldades', 'interessesHabilidades', 'estrategias', 'observacoes', 'historico'];
            geralFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    const group = field.closest('.form-group') || field;
                    if (group) group.style.display = 'block';
                    // Garantir que campos visíveis estejam habilitados
                    const inputs = group.querySelectorAll('input, select, textarea');
                    inputs.forEach(input => {
                        if (input && !readOnly) {
                            input.disabled = false;
                        }
                    });
                }
            });
            
            if (readOnly) {
                const viewConfig = createPeiViewConfig({
                    peiGeral,
                    peiAdaptacao: peiAdaptacaoRelacionado,
                    student,
                    course,
                    subject,
                    professor
                });
                renderPeiView(viewConfig);

                const inputs = peiForm.querySelectorAll('input, select, textarea');
                inputs.forEach(input => input.disabled = true);
                saveBtn.style.display = 'none';
                generatePdfBtn.style.display = 'inline-block';
            } else {
                const inputs = peiForm.querySelectorAll('input, select, textarea');
                inputs.forEach(input => input.disabled = false);
                saveBtn.style.display = 'inline-block';
                generatePdfBtn.style.display = 'inline-block';
            }
        } else {
            // Modo novo - criar PEI_GERAL
            modalTitle.textContent = 'Novo PEI Geral';
            peiForm.reset();
            peiIdField.value = '';
            peiTypeField.value = 'geral';
            
            // Ocultar campos de PEI_ADAPTACAO
            const adaptacaoFields = ['teacher-group', 'specificObjectives-group', 'methodology-group', 'evaluation-group', 'opinion-group', 'ementa-adaptacao-group'];
            adaptacaoFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.style.display = 'none';
                    // Remover required dos campos ocultos
                    const inputs = field.querySelectorAll('input, select, textarea');
                    inputs.forEach(input => {
                        if (input) {
                            input.removeAttribute('required');
                            input.disabled = true;
                        }
                    });
                }
            });
            
            // Mostrar apenas campos de PEI_GERAL e professor
            const geralFields = ['professor-select-group', 'generalObjective', 'contents', 'napneOpinion', 'dificuldades', 'interessesHabilidades', 'estrategias', 'observacoes', 'historico'];
            geralFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    const group = field.closest('.form-group') || field;
                    if (group) group.style.display = 'block';
                    // Garantir que campos visíveis estejam habilitados
                    const inputs = group.querySelectorAll('input, select, textarea');
                    inputs.forEach(input => {
                        if (input) {
                            input.disabled = false;
                        }
                    });
                }
            });
            
            // Mostrar campos de componente curricular (novo PEI)
            const subjectGroup = document.getElementById('subject-group');
            if (subjectGroup) {
                subjectGroup.style.display = 'block';
                const select = subjectGroup.querySelector('select');
                if (select) {
                    select.disabled = false;
                    select.required = true;
                    select.value = '';
                    select.classList.remove('select-locked');
                    select.removeAttribute('title');
                }
            }
            const ementaGroup = document.getElementById('ementa-group');
            if (ementaGroup) {
                ementaGroup.style.display = 'block';
                const ementaTextarea = ementaGroup.querySelector('textarea');
                if (ementaTextarea) {
                    ementaTextarea.value = '';
                }
            }
            
            // Ocultar seção de comentários do NAPNE no modo novo
            const napneCommentsSection = document.getElementById('napne-comments-section');
            if (napneCommentsSection) {
                napneCommentsSection.style.display = 'none';
            }
            
            // Habilitar campos
            const inputs = peiForm.querySelectorAll('input, select, textarea');
            inputs.forEach(input => input.disabled = false);
            saveBtn.style.display = 'inline-block';
            generatePdfBtn.style.display = 'inline-block';
        }
        
        // Mostrar modal
        const modal = document.getElementById('peiModal');
        if (modal) {
            modal.style.display = 'block';
        }
    };
    
    // Função antiga (manter para compatibilidade se necessário)
    window.viewPeiGeralOld = function(id) {
        const pei = peisGeral.find(p => p.id == id);
        if (pei) {
            alert(`PEI Geral ID: ${pei.id}\nMatrícula: ${pei.matricula}\nPeríodo: ${pei.periodo}\nDificuldades: ${pei.dificuldades || 'N/A'}`);
        }
    };
    
    // Função para abrir modal (novo, edição ou visualização)
    function openModal(id = null, readOnly = false) {
        if (isCae && !readOnly) {
            alert('Usuários CAE possuem acesso somente para visualização.');
            return;
        }
        resetPeiView();
        const modalTitle = document.getElementById('modalTitle');
        const peiIdField = document.getElementById('peiId');
        const peiTypeField = document.getElementById('peiType');
        const saveBtn = document.getElementById('savePei');
        const generatePdfBtn = document.getElementById('generatePdf');

        if (id) {
            // Modo edição ou visualização
            // Buscar PEI de adaptação
            const peiAdaptacao = peisAdaptacao.find(p => p.id == id);
            if (peiAdaptacao) {
                const peiGeral = peisGeral.find(pg => pg.id === peiAdaptacao.pei_geral_id);
                const matricula = matriculas.find(m => peiGeral && m.matricula === peiGeral.matricula);
                const student = students.find(s => matricula && s.id_aluno === matricula.estudante_id);
                const course = courses.find(c => matricula && c.id === matricula.curso_id);
                const subject = subjects.find(s => (s.codigo_componente || s.id) == peiAdaptacao.codigo_componente);
                const professor = servidores.find(s => s.siape === (peiAdaptacao.professor_siape || peiGeral?.professor_siape));
                
                const pei = {
                    id: peiAdaptacao.id,
                    studentName: student ? student.nome : '',
                    course: course ? course.id : '',
                    subject: subject ? (subject.codigo_componente || subject.id).toString() : '',
                    teacher: peiAdaptacao.docente || '',
                    yearSemester: peiGeral ? peiGeral.periodo : '',
                    ementa: peiAdaptacao.ementa || '',
                    // Campos do PEI_GERAL (criado pelo NAPNE)
                    generalObjective: peiGeral ? peiGeral.objetivo_geral : '',
                    contents: peiGeral ? peiGeral.conteudos : '',
                    napneOpinion: peiGeral ? peiGeral.parecer : '',
                    // Campos do PEI_ADAPTACAO (criado pelo professor)
                    specificObjectives: peiAdaptacao.objetivos_especificos || '',
                    methodology: peiAdaptacao.metodologia || '',
                    evaluation: peiAdaptacao.avaliacao || '',
                    opinion: peiAdaptacao.parecer || '',
                    comentarios_napne: peiAdaptacao.comentarios_napne || '',
                    type: 'adaptacao'
                };
                
                // Mostrar campos de PEI_ADAPTACAO e ocultar campos extras de PEI_GERAL
                const adaptacaoFields = ['subject-group', 'teacher-group', 'specificObjectives-group', 'methodology-group', 'evaluation-group', 'opinion-group', 'ementa-adaptacao-group'];
                adaptacaoFields.forEach(fieldId => {
                    const field = document.getElementById(fieldId);
                    if (field) {
                        field.style.display = 'block';
                    }
                });
                
                // Ocultar campos extras de PEI_GERAL (só mostrar os principais quando visualizar)
                const geralExtraFields = ['professor-select-group', 'dificuldades', 'interessesHabilidades', 'estrategias', 'observacoes', 'historico'];
                geralExtraFields.forEach(fieldId => {
                    const field = document.getElementById(fieldId);
                    if (field) {
                        const group = field.closest('.form-group') || field;
                        if (group) group.style.display = 'none';
                    }
                });
                
                // Mostrar campos de PEI_GERAL (para visualização - só objetivo geral, conteúdos e parecer)
                const geralViewFields = ['generalObjective', 'contents', 'napneOpinion'];
                geralViewFields.forEach(fieldId => {
                    const field = document.getElementById(fieldId);
                    if (field) {
                        const group = field.closest('.form-group');
                        if (group) group.style.display = 'block';
                    }
                });
                
                if (readOnly) {
                    modalTitle.textContent = 'Visualizar PEI - Adaptação Curricular';
                    const viewConfig = createPeiViewConfig({
                        peiGeral,
                        peiAdaptacao,
                        student,
                        course,
                        subject,
                        professor
                    });
                    renderPeiView(viewConfig);

                    // Desabilitar todos os campos
                    const inputs = peiForm.querySelectorAll('input, select, textarea');
                    inputs.forEach(input => input.disabled = true);
                    saveBtn.style.display = 'none';
                    generatePdfBtn.style.display = 'inline-block';
                } else {
                    modalTitle.textContent = 'Editar PEI - Adaptação Curricular';
                    // Habilitar apenas campos de PEI_ADAPTACAO (professor pode editar)
                    const inputs = peiForm.querySelectorAll('input, select, textarea');
                    inputs.forEach(input => {
                        // Manter campos de PEI_GERAL desabilitados (só visualização)
                        const isGeralField = ['generalObjective', 'contents', 'napneOpinion', 'dificuldades', 'interessesHabilidades', 'estrategias', 'observacoes', 'historico', 'professorSelect'].includes(input.id);
                        if (!isGeralField) {
                            input.disabled = false;
                        }
                    });
                    saveBtn.style.display = 'inline-block';
                    generatePdfBtn.style.display = 'inline-block';
                }
                peiIdField.value = pei.id;
                peiTypeField.value = pei.type;

                // Preencher formulário com dados existentes
                document.getElementById('studentName').value = pei.studentName;
                document.getElementById('studentCourse').value = pei.course;
                const subjectSelect = document.getElementById('subject');
                if (subjectSelect) {
                    subjectSelect.value = pei.subject;
                    subjectSelect.disabled = true;
                    subjectSelect.classList.add('select-locked');
                }
                teacherInput.value = pei.teacher; // Preencher o campo do professor
                document.getElementById('yearSemester').value = pei.yearSemester;
                
                // Carregar necessidade do aluno automaticamente
                updateStudentInfo(pei.studentName);

                    // Preencher ementa baseada na matéria selecionada (para PEI_ADAPTACAO)
                    setTimeout(() => {
                        const subjectSelect = document.getElementById('subject');
                        if (subjectSelect) {
                            const selectedOption = subjectSelect.options[subjectSelect.selectedIndex];
                            if (selectedOption) {
                                const description = selectedOption.dataset.description;
                                const ementaValue = description || pei.ementa || '';
                                // Preencher ementa no campo de adaptação
                                const ementaAdaptacao = document.getElementById('ementaAdaptacao');
                                if (ementaAdaptacao) {
                                    ementaAdaptacao.value = ementaValue;
                                }
                            }
                        }
                    }, 300);
                // Preencher campos do PEI_GERAL (criado pelo NAPNE)
                document.getElementById('generalObjective').value = pei.generalObjective || '';
                document.getElementById('contents').value = pei.contents || '';
                document.getElementById('napneOpinion').value = pei.napneOpinion || '';
                // Preencher campos do PEI_ADAPTACAO (criado pelo professor)
                document.getElementById('specificObjectives').value = pei.specificObjectives || '';
                document.getElementById('methodology').value = pei.methodology || '';
                document.getElementById('evaluation').value = pei.evaluation || '';
                document.getElementById('opinion').value = pei.opinion || '';
                
                // Preencher ementa de adaptação (vem da matéria)
                const ementaAdaptacao = document.getElementById('ementaAdaptacao');
                if (ementaAdaptacao) {
                    ementaAdaptacao.value = pei.ementa || '';
                }
                
                // Exibir comentários do NAPNE se existirem
                const napneCommentsSection = document.getElementById('napne-comments-section');
                const napneCommentsDisplay = document.getElementById('napne-comments-display');
                if (napneCommentsSection && napneCommentsDisplay) {
                    if (pei.comentarios_napne && pei.comentarios_napne.trim()) {
                        napneCommentsDisplay.textContent = pei.comentarios_napne;
                        napneCommentsSection.style.display = 'block';
                    } else {
                        napneCommentsDisplay.textContent = 'Nenhum comentário do NAPNE ainda.';
                        napneCommentsSection.style.display = readOnly ? 'block' : 'none'; // Mostrar sempre se for visualização
                    }
                }
            }
        } else {
            // Modo novo - NAPNE só cria PEI_GERAL, não PEI_ADAPTACAO
            // Esta função não deve ser chamada para criar novo PEI no NAPNE
            // Use openModalGeral() para criar PEI_GERAL
            alert('NAPNE cria apenas PEI Geral. PEI Adaptação é criado pelos professores.');
            closeModalWindow();
        }

        peiModal.style.display = 'block';
    }
    
    // Função para fechar modal
    function closeModalWindow() {
        if (peiModal) {
            peiModal.style.display = 'none';
        }
        resetPeiView();
    }
    
    // Função para salvar PEI
    async function savePei() {
        if (isCae) {
            alert('Usuários CAE possuem acesso somente para visualização.');
            return;
        }
        const peiId = document.getElementById('peiId').value;
        const peiType = document.getElementById('peiType').value;
        const studentName = document.getElementById('studentName').value;
        let courseId = document.getElementById('studentCourse').value;
        const subjectId = document.getElementById('subject').value;
        const subjectIdNumber = subjectId ? parseInt(subjectId, 10) : null;
        const teacher = document.getElementById('teacher').value;
        const yearSemester = document.getElementById('yearSemester').value;
        const specificNeedId = document.getElementById('specificNeed').value;
        
        // Buscar nome da necessidade específica
        const necessidade = necessidades.find(n => n.id == specificNeedId);
        const specificNeed = necessidade ? necessidade.nome : '';
        
        // Campos de PEI_ADAPTACAO (podem estar ocultos)
        const ementaEl = document.getElementById('ementa');
        const ementa = ementaEl ? ementaEl.value : '';
        
        // Campos do PEI_GERAL (criado pelo NAPNE)
        const generalObjective = document.getElementById('generalObjective').value;
        const contents = document.getElementById('contents').value;
        const napneOpinion = document.getElementById('napneOpinion').value;
        const dificuldades = document.getElementById('dificuldades').value;
        const interessesHabilidades = document.getElementById('interessesHabilidades').value;
        const estrategias = document.getElementById('estrategias').value;
        const observacoes = document.getElementById('observacoes').value;
        const historico = document.getElementById('historico').value;
        
        // Campos do PEI_ADAPTACAO (criado pelo professor - podem estar ocultos)
        const specificObjectivesEl = document.getElementById('specificObjectives');
        const methodologyEl = document.getElementById('methodology');
        const evaluationEl = document.getElementById('evaluation');
        const opinionEl = document.getElementById('opinion');
        
        const specificObjectives = specificObjectivesEl ? specificObjectivesEl.value : '';
        const methodology = methodologyEl ? methodologyEl.value : '';
        const evaluation = evaluationEl ? evaluationEl.value : '';
        const opinion = opinionEl ? opinionEl.value : '';
        
        try {
            // Buscar estudante e matrícula
            const student = students.find(s => s.nome === studentName);
            if (!student) {
                alert('Estudante não encontrado!');
                return;
            }

            let matricula = matriculas.find(m => m.estudante_id === student.id_aluno);
            if (!matricula || !matricula.matricula) {
                // Se não tem matrícula, tentar buscar o curso do estudante de outra forma
                if (!courseId || courseId === '') {
                    // Tentar buscar o primeiro curso disponível para usar como padrão
                    if (courses && courses.length > 0) {
                        courseId = courses[0].id || courses[0].codigo;
                        // Atualizar o select para refletir o curso selecionado
                        document.getElementById('studentCourse').value = courseId;
                        alert('Matrícula não encontrada para este estudante. Usando o primeiro curso disponível para criar a matrícula automaticamente.');
                    } else {
                        alert('Matrícula não encontrada para este estudante! Selecione um curso para criar a matrícula automaticamente.');
                        return;
                    }
                }
                // Matrícula será criada pelo backend automaticamente
                matricula = { matricula: '', estudante_id: student.id_aluno, curso_id: courseId };
            } else if (!courseId || courseId === '') {
                // Se tem matrícula mas não tem courseId, buscar do objeto matrícula
                courseId = matricula.curso_id || matricula.cursoId;
                if (courseId) {
                    document.getElementById('studentCourse').value = courseId;
                }
            }

            // Obter usuário logado uma vez (para usar em todo o escopo da função)
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

            if (peiId) {
                // Editar PEI existente
                const peiAdaptacao = peisAdaptacao.find(p => p.id == peiId);
                if (peiAdaptacao) {
                    // Primeiro atualizar PEI_GERAL (criado pelo NAPNE)
                    const peiGeral = peisGeral.find(pg => pg.id === peiAdaptacao.pei_geral_id);
                    if (peiGeral) {
                        const peiGeralData = {
                            id_aluno: peiGeral.id_aluno,
                            matricula: peiGeral.matricula || matricula.matricula,
                            periodo: yearSemester,
                            codigo_componente: subjectIdNumber || peiGeral.codigo_componente || null,
                            necessidade_especifica: specificNeed || '',
                            objetivo_geral: generalObjective || '',
                            conteudos: contents || '',
                            parecer: napneOpinion || '',
                            dificuldades: dificuldades || '',
                            interesses_habilidades: interessesHabilidades || '',
                            estrategias: estrategias || '',
                            observacoes: observacoes || '',
                            historico: historico || ''
                        };
                        
                        // Atualizar professor_siape do select
                        const professorSelect = document.getElementById('professorSelect');
                        if (professorSelect && professorSelect.value) {
                            const professorSiape = parseInt(professorSelect.value);
                            const servidorDocente = servidores.find(s => s.siape == professorSiape && s.tipo === 'Docente');
                            if (servidorDocente) {
                                peiGeralData.professor_siape = professorSiape;
                            } else {
                                peiGeralData.professor_siape = peiGeral.professor_siape; // Manter o atual se inválido
                            }
                        } else if (peiGeral.professor_siape) {
                            peiGeralData.professor_siape = peiGeral.professor_siape;
                        } else {
                            alert('Por favor, selecione um professor responsável!');
                            return;
                        }
                        
                        await API_CONFIG.put(`peis/${peiGeral.id}`, peiGeralData);
                    }
                    
                    // Depois atualizar PEI_ADAPTACAO (criado pelo professor)
                    // Pegar ementa do campo de adaptação (vem da matéria)
                    const ementaAdaptacaoEl = document.getElementById('ementaAdaptacao');
                    const ementaAdaptacao = ementaAdaptacaoEl ? ementaAdaptacaoEl.value : ementa;
                    
                    const peiData = {
                        pei_geral_id: peiAdaptacao.pei_geral_id,
                        codigo_componente: subjectIdNumber || peiGeral?.codigo_componente || 0,
                        ementa: ementaAdaptacao, // Ementa vem da matéria selecionada
                        objetivos_especificos: specificObjectives,
                        metodologia: methodology,
                        avaliacao: evaluation,
                        parecer: opinion,
                        docente: teacher
                    };
                    
                    // Tentar adicionar professor_siape válido
                    if (peiAdaptacao.professor_siape) {
                        peiData.professor_siape = peiAdaptacao.professor_siape;
                    } else if (currentUser.siape && !isNaN(parseInt(currentUser.siape))) {
                        // Verificar se o siape corresponde a um docente
                        const servidorDocente = servidores.find(s => s.siape == currentUser.siape && s.tipo === 'Docente');
                        if (servidorDocente) {
                            peiData.professor_siape = parseInt(currentUser.siape);
                        }
                    }
                    // Se não encontrar, deixar o backend buscar automaticamente
                    
                    await API_CONFIG.put(`adaptacoes/${peiId}`, peiData);
                    showToast('PEI atualizado com sucesso!', 'success');
                } else if (peiType === 'geral') {
                    // Atualizar PEI_GERAL diretamente
                    const peiGeral = peisGeral.find(pg => pg.id == peiId);
                    if (!peiGeral) {
                        alert('PEI Geral não encontrado para atualização.');
                        return;
                    }

                    if (!subjectIdNumber) {
                        alert('Por favor, selecione a matéria vinculada ao PEI.');
                        return;
                    }

                    const professorSelect = document.getElementById('professorSelect');
                    const professorSiape = professorSelect ? parseInt(professorSelect.value, 10) : null;
                    if (!professorSiape || isNaN(professorSiape)) {
                        alert('Por favor, selecione um professor responsável!');
                        return;
                    }

                    const servidorDocente = servidores.find(s => s.siape == professorSiape && s.tipo === 'Docente');
                    if (!servidorDocente) {
                        alert('Professor selecionado não é válido!');
                        return;
                    }

                    const peiGeralData = {
                        id_aluno: student.id_aluno || student.id,
                        matricula: peiGeral.matricula || (matricula ? matricula.matricula : ''),
                        periodo: yearSemester,
                        codigo_componente: subjectIdNumber,
                        necessidade_especifica: specificNeed || '',
                        objetivo_geral: generalObjective || '',
                        conteudos: contents || '',
                        parecer: napneOpinion || '',
                        dificuldades: dificuldades || '',
                        interesses_habilidades: interessesHabilidades || '',
                        estrategias: estrategias || '',
                        observacoes: observacoes || '',
                        historico: historico || '',
                        professor_siape: professorSiape
                    };

                    await API_CONFIG.put(`peis/${peiId}`, peiGeralData);
                    showToast('PEI Geral atualizado com sucesso!', 'success');
                } else {
                    alert('Tipo de PEI não suportado para atualização.');
                    return;
                }
            } else {
                // Criar novo PEI
                // Primeiro criar PEI_GERAL (criado pelo NAPNE)
                const professorSelect = document.getElementById('professorSelect');
                const professorSiape = professorSelect ? parseInt(professorSelect.value) : null;
                
                if (!professorSiape || isNaN(professorSiape)) {
                    alert('Por favor, selecione um professor responsável!');
                    return;
                }
                
                // Verificar se o siape é válido
                const servidorDocente = servidores.find(s => s.siape == professorSiape && s.tipo === 'Docente');
                if (!servidorDocente) {
                    alert('Professor selecionado não é válido!');
                    return;
                }
                
                // Validar campos obrigatórios antes de enviar
                if (!generalObjective || generalObjective.trim() === '') {
                    alert('Por favor, preencha o objetivo geral!');
                    return;
                }
                
                if (!contents || contents.trim() === '') {
                    alert('Por favor, preencha os conteúdos!');
                    return;
                }
                
                if (!napneOpinion || napneOpinion.trim() === '') {
                    alert('Por favor, preencha o parecer do NAPNE!');
                    return;
                }
                
                if (!subjectIdNumber) {
                    alert('Por favor, selecione o componente curricular vinculado ao PEI.');
                    return;
                }
                
                // Garantir que courseId esteja presente
                if (!courseId || courseId === '') {
                    // Se tem matrícula, buscar o curso dela
                    if (matricula && matricula.curso_id) {
                        courseId = matricula.curso_id;
                    } else if (courses && courses.length > 0) {
                        // Usar primeiro curso disponível
                        courseId = courses[0].id || courses[0].codigo;
                    }
                }
                
                const peiGeralData = {
                    id_aluno: student.id_aluno || student.id,
                    matricula: matricula ? matricula.matricula : '',
                    courseId: courseId || '', // Sempre enviar courseId (para criar matrícula se necessário)
                    professor_siape: professorSiape,
                    periodo: yearSemester,
                    codigo_componente: subjectIdNumber,
                    necessidade_especifica: specificNeed || '',
                    objetivo_geral: generalObjective,
                    conteudos: contents,
                    parecer: napneOpinion,
                    dificuldades: dificuldades || '',
                    interesses_habilidades: interessesHabilidades || '',
                    estrategias: estrategias || '',
                    observacoes: observacoes || '',
                    historico: historico || ''
                };
                
                const peiGeral = await API_CONFIG.post('peis', peiGeralData);
                
                // NAPNE só cria PEI_GERAL, não cria PEI_ADAPTACAO
                // O professor criará o PEI_ADAPTACAO depois através do dashboard dele
                showToast('PEI Geral criado com sucesso! O professor poderá criar a adaptação.', 'success');
            }
            
            // Recarregar dados
            await loadData();
            
            // Fechar modal e recarregar exibição
            closeModalWindow();
            loadPeis();
            
        } catch (error) {
            console.error('Erro ao salvar PEI:', error);
            alert('Erro ao salvar PEI: ' + (error.message || 'Erro desconhecido'));
        }
    }

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
    
    // Função para visualizar PEI
    window.viewPei = function(id) {
        openModal(id, true);
    };

    // Função para visualizar detalhes do aluno
    window.viewStudentDetails = function(studentName) {
        const student = students.find(s => s.nome === studentName);
        if (!student) {
            alert('Detalhes do aluno não encontrados.');
            return;
        }
        // Buscar matrícula e curso
        const matricula = matriculas.find(m => m.estudante_id === student.id_aluno);
        const course = courses.find(c => matricula && c.codigo === matricula.curso_id);
        const courseName = course ? course.nome : 'Curso não informado';
        
        const details = `
            Nome: ${student.nome}
            CPF: ${student.cpf}
            Curso: ${courseName}
            Contato: ${student.contato || 'Não informado'}
        `;
        alert(details);
    };

    // Função para visualizar detalhes do professor
    window.viewProfessorDetails = function(professorName) {
        const professor = servidores.find(t => t.nome === professorName || t.docente === professorName);
        if (!professor) {
            alert('Detalhes do professor não encontrados.');
            return;
        }
        // Construir mensagem com detalhes do professor
        const details = `
            Nome: ${professor.nome}
            Email: ${professor.email || 'Não informado'}
            Tipo: ${professor.tipo || 'Não informado'}
        `;
        alert(details);
    };
    
    // Função para visualizar PEI_ADAPTACAO
    window.viewPeiAdaptacao = function(id) {
        const peiAdaptacao = peisAdaptacao.find(p => p.id == id);
        if (!peiAdaptacao) {
            alert('PEI Adaptação não encontrado');
            return;
        }
        
        // Abrir modal de visualização (usar o mesmo modal do PEI, mas apenas visualização)
        openModal(id, true);
    };
    
    // Função para comentar PEI_ADAPTACAO (NAPNE)
    window.commentPeiAdaptacao = function(id) {
        if (isCae) {
            alert('Usuários CAE possuem acesso somente para visualização.');
            return;
        }
        const peiAdaptacao = peisAdaptacao.find(p => p.id == id);
        if (!peiAdaptacao) {
            alert('PEI Adaptação não encontrado');
            return;
        }
        
        const peiGeral = peisGeral.find(pg => pg.id === peiAdaptacao.pei_geral_id);
        const matricula = matriculas.find(m => peiGeral && m.matricula === peiGeral.matricula);
        const student = students.find(s => matricula && s.id_aluno === matricula.estudante_id);
        const course = courses.find(c => matricula && c.id === matricula.curso_id);
        const subject = subjects.find(s => (s.codigo_componente || s.id) == peiAdaptacao.codigo_componente);
        const professor = servidores.find(s => s.siape === peiAdaptacao.professor_siape);
        
        // Preencher informações do modal
        if (document.getElementById('comment-student')) {
            document.getElementById('comment-student').textContent = student ? student.nome : 'N/A';
        }
        if (document.getElementById('comment-subject')) {
            document.getElementById('comment-subject').textContent = subject ? subject.name : 'N/A';
        }
        if (document.getElementById('comment-teacher')) {
            document.getElementById('comment-teacher').textContent = professor ? professor.nome : peiAdaptacao.docente || 'N/A';
        }
        if (document.getElementById('comment-status')) {
            const statusMap = {
                'rascunho': 'Rascunho',
                'enviado_para_napne': 'Enviado para NAPNE',
                'em_avaliacao': 'Em Avaliação',
                'aprovado': 'Aprovado',
                'rejeitado': 'Rejeitado'
            };
            document.getElementById('comment-status').textContent = statusMap[peiAdaptacao.status] || peiAdaptacao.status || 'N/A';
        }
        if (document.getElementById('comment-pei-adaptacao-id')) {
            document.getElementById('comment-pei-adaptacao-id').value = peiAdaptacao.id;
        }
        if (document.getElementById('napne-comment')) {
            document.getElementById('napne-comment').value = peiAdaptacao.comentarios_napne || '';
        }
        if (document.getElementById('napne-status')) {
            document.getElementById('napne-status').value = '';
        }
        
        // Mostrar modal
        const napneCommentModal = document.getElementById('napneCommentModal');
        if (napneCommentModal) {
            napneCommentModal.style.display = 'block';
        }
    };
    
    // Função para salvar comentário do NAPNE
    async function saveNapneComment() {
        const peiAdaptacaoId = document.getElementById('comment-pei-adaptacao-id')?.value;
        const comentario = document.getElementById('napne-comment')?.value || '';
        const novoStatus = document.getElementById('napne-status')?.value || '';
        
        if (!peiAdaptacaoId) {
            alert('Erro: ID do PEI Adaptação não encontrado');
            return;
        }
        
        if (!comentario.trim()) {
            alert('Por favor, digite um comentário');
            return;
        }
        
        try {
            const peiAdaptacao = peisAdaptacao.find(p => p.id == peiAdaptacaoId);
            if (!peiAdaptacao) {
                alert('PEI Adaptação não encontrado');
                return;
            }
            
            // Atualizar PEI_ADAPTACAO com comentário e status
            const updatedData = {
                pei_geral_id: peiAdaptacao.pei_geral_id,
                codigo_componente: peiAdaptacao.codigo_componente,
                ementa: peiAdaptacao.ementa || '',
                objetivos_especificos: peiAdaptacao.objetivos_especificos || '',
                metodologia: peiAdaptacao.metodologia || '',
                avaliacao: peiAdaptacao.avaliacao || '',
                parecer: peiAdaptacao.parecer || '',
                comentarios_napne: comentario,
                status: novoStatus || peiAdaptacao.status || 'em_avaliacao'
            };
            
            // Atualizar data_resposta_napne se estiver mudando status ou adicionando comentário
            // Sempre atualizar a data quando há comentário do NAPNE
            if (comentario.trim()) {
                // Usar data atual no formato MySQL (YYYY-MM-DD HH:MM:SS)
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                updatedData.data_resposta_napne = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            }
            
            // Manter professor_siape
            if (peiAdaptacao.professor_siape) {
                updatedData.professor_siape = peiAdaptacao.professor_siape;
            }
            
            await API_CONFIG.put(`adaptacoes/${peiAdaptacaoId}`, updatedData);
            
            // Fechar modal e recarregar dados
            const napneCommentModal = document.getElementById('napneCommentModal');
            if (napneCommentModal) {
                napneCommentModal.style.display = 'none';
            }
            await loadData();
            loadPeis();
            
            alert('Comentário salvo com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar comentário:', error);
            alert('Erro ao salvar comentário: ' + (error.message || 'Erro desconhecido'));
        }
    }

    // Função para editar PEI
    window.editPei = function(id) {
        openModal(id);
    };
    
    // Função para excluir PEI_GERAL
    window.deletePeiGeral = async function(id) {
        if (isCae) {
            alert('Usuários CAE possuem acesso somente para visualização.');
            return;
        }
        if (confirm('Tem certeza que deseja excluir este PEI Geral? Isso também excluirá o PEI Adaptação associado, se houver.')) {
            try {
                // Verificar se há PEI_ADAPTACAO associado e excluir primeiro
                const peiAdaptacao = peisAdaptacao.find(pa => pa.pei_geral_id == id);
                if (peiAdaptacao) {
                    await API_CONFIG.delete(`adaptacoes/${peiAdaptacao.id}`);
                }
                
                // Excluir PEI_GERAL
                await API_CONFIG.delete(`peis/${id}`);
                alert('PEI Geral excluído com sucesso!');
                await loadData();
                loadPeis();
            } catch (error) {
                console.error('Erro ao excluir PEI Geral:', error);
                alert('Erro ao excluir PEI Geral: ' + (error.message || 'Erro desconhecido'));
            }
        }
    };
    
    // Função para excluir PEI_ADAPTACAO
    window.deletePeiAdaptacao = async function(id) {
        if (isCae) {
            alert('Usuários CAE possuem acesso somente para visualização.');
            return;
        }
        if (confirm('Tem certeza que deseja excluir este PEI Adaptação?')) {
            try {
                await API_CONFIG.delete(`adaptacoes/${id}`);
                alert('PEI Adaptação excluído com sucesso!');
                await loadData();
                loadPeis();
            } catch (error) {
                console.error('Erro ao excluir PEI Adaptação:', error);
                alert('Erro ao excluir PEI Adaptação: ' + (error.message || 'Erro desconhecido'));
            }
        }
    };
    
    // Função antiga (manter para compatibilidade)
    window.deletePei = async function(id) {
        // Tenta excluir como PEI_ADAPTACAO
        await window.deletePeiAdaptacao(id);
    };
    
    // Função para alternar entre abas
    function switchTab(tab) {
        // Remover classe active de todas as abas e conteúdos
        tabBtns.forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Adicionar classe active à aba clicada e ao conteúdo correspondente
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`${tab}-content`).classList.add('active');
    }
    
    // Função para aplicar filtros
    function applyFilters() {
        const needType = document.getElementById('filter-need-type')?.value || 'all';
        const specificNeed = document.getElementById('filter-specific')?.value || 'all';
        const course = document.getElementById('filter-course')?.value || 'all';
        
        // Combinar dados de PEI_ADAPTACAO com PEI_GERAL e outras informações (mesma lógica de loadPeis)
        const peisCompletos = peisAdaptacao.map(pa => {
            const peiGeral = peisGeral.find(pg => pg.id === pa.pei_geral_id);
            const matricula = matriculas.find(m => peiGeral && m.matricula === peiGeral.matricula);
            const student = students.find(s => matricula && s.id_aluno === matricula.estudante_id);
            const courseObj = courses.find(c => matricula && c.codigo === matricula.curso_id);
            const subject = subjects.find(s => s.codigo_componente === pa.codigo_componente);
            
            return {
                id: pa.id,
                pei_geral_id: pa.pei_geral_id,
                studentName: student ? student.nome : 'N/A',
                course: courseObj ? courseObj.nome : 'N/A',
                courseId: courseObj ? courseObj.codigo : null,
                subject: subject ? subject.componente : 'N/A',
                teacher: pa.docente || 'N/A',
                yearSemester: peiGeral ? peiGeral.periodo : 'N/A',
                specificNeed: peiGeral ? peiGeral.dificuldades : '',
                needType: 'all' // TODO: Implementar mapeamento de necessidade específica
            };
        });
        
        // Filtrar PEIs
        let filteredPeis = peisCompletos;
        
        if (needType !== 'all') {
            // TODO: Implementar filtro por tipo de necessidade quando tiver mapeamento
        }
        
        if (specificNeed !== 'all') {
            filteredPeis = filteredPeis.filter(pei => pei.specificNeed === specificNeed);
        }
        
        if (course !== 'all') {
            filteredPeis = filteredPeis.filter(pei => pei.courseId === course);
        }
        
        // Exibir PEIs filtrados usando a mesma estrutura de loadPeis
        displayFilteredPeis(filteredPeis);
    }
    
    // Função para exibir PEIs filtrados
    function displayFilteredPeis(filteredPeis) {
        const peiTableBody = document.getElementById('pei-table-body');
        const historicoTableBody = document.getElementById('pei-historico-table-body');
        
        if (!peiTableBody || !historicoTableBody) return;
        
        // Limpar tabelas
        peiTableBody.innerHTML = '';
        historicoTableBody.innerHTML = '';
        
        if (filteredPeis.length === 0) {
            peiTableBody.innerHTML = '<tr><td colspan="7" class="empty-message">Nenhum PEI encontrado com os filtros aplicados.</td></tr>';
            historicoTableBody.innerHTML = '<tr><td colspan="6" class="empty-message">Nenhum PEI encontrado com os filtros aplicados.</td></tr>';
            return;
        }
        
        // Preencher tabela de adaptação curricular
        if (filteredPeis.length === 0) {
            peiTableBody.innerHTML = '<tr><td colspan="7" class="empty-message">Nenhum PEI de adaptação curricular encontrado.</td></tr>';
        } else {
            filteredPeis.forEach(pei => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${pei.studentName}</td>
                    <td>${pei.course}</td>
                    <td>${pei.subject}</td>
                    <td>${pei.teacher}</td>
                    <td>${pei.yearSemester}</td>
                    <td>-</td>
                    <td>
                        <button class="btn btn-view" onclick="viewPei(${pei.id})">Visualizar</button>
                        <button class="btn btn-edit" onclick="editPei(${pei.id})">Editar</button>
                        <button class="btn btn-danger" onclick="deletePei(${pei.id})">Excluir</button>
                    </td>
                `;
                peiTableBody.appendChild(row);
            });
        }
        
        // Histórico vazio (filtros aplicam apenas a adaptações)
        historicoTableBody.innerHTML = '<tr><td colspan="6" class="empty-message">Use a aba "Histórico" para ver todos os PEIs gerais.</td></tr>';
    }
    
    // Função para limpar filtros
    function clearFilters() {
        document.getElementById('filter-need-type').value = 'all';
        document.getElementById('filter-specific').value = 'all';
        document.getElementById('filter-course').value = 'all';
        
        // Recarregar todos os PEIs
        loadPeis();
    }
    
    // Função para gerar PDF
    function generatePdf() {
        const peiId = document.getElementById('peiId').value;
        const peiType = document.getElementById('peiType')?.value || '';
        let content = '';

        if (peiId) {
            let peiGeral = null;
            let peiAdaptacao = null;

            if (peiType === 'geral') {
                peiGeral = peisGeral.find(pg => pg.id == peiId);
                if (!peiGeral) return;
                peiAdaptacao = peisAdaptacao.find(pa => pa.pei_geral_id === peiGeral.id) || null;
            } else {
                peiAdaptacao = peisAdaptacao.find(p => p.id == peiId);
                if (!peiAdaptacao) return;
                peiGeral = peisGeral.find(pg => pg.id === peiAdaptacao.pei_geral_id);
            }

            if (!peiGeral) return;

            const matricula = matriculas.find(m => peiGeral && m.matricula === peiGeral.matricula);
            const student = students.find(s => matricula && s.id_aluno === matricula.estudante_id);
            const course = courses.find(c => matricula && c.codigo === matricula.curso_id);
            const subject = subjects.find(s => (s.codigo_componente || s.id) == (peiAdaptacao ? peiAdaptacao.codigo_componente : peiGeral.codigo_componente));
            const professor = servidores.find(s => s.siape === peiGeral.professor_siape);
            
            // Buscar necessidade específica
            const necessidadeEspecifica = peiGeral && peiGeral.necessidade_especifica ? 
                necessidades.find(n => n.id === peiGeral.necessidade_especifica) : null;
            const necessidadeNome = necessidadeEspecifica ? necessidadeEspecifica.nome : 'N/A';

            const professorAdaptacao = peiAdaptacao ? servidores.find(s => s.siape === peiAdaptacao.professor_siape) : null;
            const teacherName = peiAdaptacao
                ? (professorAdaptacao ? professorAdaptacao.nome : (peiAdaptacao.docente || 'N/A'))
                : (professor ? professor.nome : 'N/A');
            const ementaBase = subject ? (subject.ementa || subject.description || '') : '';
            
            const pei = {
                studentName: student ? student.nome : 'N/A',
                course: course ? course.nome : 'N/A',
                subject: subject ? (subject.componente || subject.name || 'N/A') : 'N/A',
                teacher: teacherName,
                yearSemester: peiGeral ? peiGeral.periodo : 'N/A',
                ementa: peiAdaptacao ? (peiAdaptacao.ementa || ementaBase) : ementaBase,
                necessidadeEspecifica: necessidadeNome,
                // Campos do PEI_GERAL (criado pelo NAPNE)
                generalObjective: peiGeral ? peiGeral.objetivo_geral : '',
                contents: peiGeral ? peiGeral.conteudos : '',
                napneOpinion: peiGeral ? peiGeral.parecer : '',
                dificuldades: peiGeral ? peiGeral.dificuldades : '',
                interessesHabilidades: peiGeral ? peiGeral.interesses_habilidades : '',
                estrategias: peiGeral ? peiGeral.estrategias : '',
                observacoes: peiGeral ? peiGeral.observacoes : '',
                historico: peiGeral ? peiGeral.historico : '',
                // Campos do PEI_ADAPTACAO (criado pelo professor)
                specificObjectives: peiAdaptacao ? peiAdaptacao.objetivos_especificos || '' : '',
                methodology: peiAdaptacao ? peiAdaptacao.metodologia || '' : '',
                evaluation: peiAdaptacao ? peiAdaptacao.avaliacao || '' : '',
                opinion: peiAdaptacao ? peiAdaptacao.parecer || '' : '',
                comentarios_napne: peiAdaptacao ? peiAdaptacao.comentarios_napne || '' : ''
            };
            
            if (pei) {
                const currentDate = new Date().toLocaleDateString('pt-BR');
                content = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            @page {
                                margin: 15mm;
                            }
                            body {
                                font-family: 'Arial', 'Helvetica', sans-serif;
                                font-size: 11pt;
                                line-height: 1.6;
                                color: #333;
                                padding: 0;
                                margin: 0;
                            }
                            .header {
                                text-align: center;
                                border-bottom: 3px solid #2c3e50;
                                padding-bottom: 15px;
                                margin-bottom: 25px;
                            }
                            .header h1 {
                                color: #2c3e50;
                                font-size: 20pt;
                                margin: 0 0 10px 0;
                                font-weight: bold;
                            }
                            .header .subtitle {
                                color: #7f8c8d;
                                font-size: 11pt;
                                margin: 0;
                            }
                            .section {
                                margin-bottom: 25px;
                                page-break-inside: avoid;
                            }
                            .section-title {
                                background-color: #3498db;
                                color: white;
                                padding: 10px 15px;
                                font-size: 13pt;
                                font-weight: bold;
                                margin: 0 0 15px 0;
                                border-radius: 4px;
                            }
                            .info-grid {
                                display: grid;
                                grid-template-columns: 1fr 1fr;
                                gap: 15px;
                                margin-bottom: 20px;
                            }
                            .info-item {
                                padding: 10px;
                                background-color: #f8f9fa;
                                border-left: 4px solid #3498db;
                                border-radius: 4px;
                            }
                            .info-item strong {
                                display: block;
                                color: #2c3e50;
                                font-size: 10pt;
                                margin-bottom: 5px;
                                text-transform: uppercase;
                            }
                            .info-item span {
                                color: #333;
                                font-size: 11pt;
                            }
                            .content-box {
                                background-color: #ffffff;
                                border: 1px solid #ddd;
                                border-radius: 4px;
                                padding: 15px;
                                margin-bottom: 15px;
                                min-height: 60px;
                            }
                            .content-box strong {
                                display: block;
                                color: #2c3e50;
                                font-size: 10pt;
                                margin-bottom: 10px;
                                text-transform: uppercase;
                                border-bottom: 1px solid #eee;
                                padding-bottom: 5px;
                            }
                            .content-box p {
                                margin: 0;
                                color: #333;
                                white-space: pre-wrap;
                                word-wrap: break-word;
                            }
                            .footer {
                                margin-top: 30px;
                                padding-top: 15px;
                                border-top: 2px solid #ddd;
                                text-align: center;
                                color: #7f8c8d;
                                font-size: 9pt;
                            }
                            .full-width {
                                grid-column: 1 / -1;
                            }
                            @media print {
                                .section {
                                    page-break-inside: avoid;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>PLANO EDUCACIONAL INDIVIDUALIZADO (PEI)</h1>
                            <p class="subtitle">${peiAdaptacao ? 'Adaptação Curricular' : 'PEI Geral'}</p>
                    </div>

                        <div class="section">
                            <div class="section-title">INFORMAÇÕES DO ESTUDANTE</div>
                            <div class="info-grid">
                                <div class="info-item">
                                    <strong>Nome do Estudante</strong>
                                    <span>${pei.studentName}</span>
                                </div>
                                <div class="info-item">
                                    <strong>Curso</strong>
                                    <span>${pei.course}</span>
                                </div>
                                <div class="info-item">
                                    <strong>Componente Curricular</strong>
                                    <span>${pei.subject}</span>
                                </div>
                                <div class="info-item">
                                    <strong>Professor</strong>
                                    <span>${pei.teacher}</span>
                                </div>
                                <div class="info-item">
                                    <strong>Ano/Semestre</strong>
                                    <span>${pei.yearSemester}</span>
                                </div>
                                <div class="info-item">
                                    <strong>Necessidade Específica</strong>
                                    <span>${pei.necessidadeEspecifica}</span>
                                </div>
                            </div>
                            ${pei.ementa ? `
                            <div class="content-box full-width">
                                <strong>Ementa do Componente Curricular</strong>
                                <p>${pei.ementa}</p>
                            </div>
                            ` : ''}
                        </div>

                        <div class="section">
                            <div class="section-title">PEI GERAL (Criado pelo NAPNE)</div>
                            ${pei.generalObjective ? `
                            <div class="content-box">
                                <strong>Objetivo Geral</strong>
                                <p>${pei.generalObjective}</p>
                            </div>
                            ` : ''}
                            ${pei.contents ? `
                            <div class="content-box">
                                <strong>Conteúdos</strong>
                                <p>${pei.contents}</p>
                            </div>
                            ` : ''}
                            ${pei.dificuldades ? `
                            <div class="content-box">
                                <strong>Dificuldades Identificadas</strong>
                                <p>${pei.dificuldades}</p>
                            </div>
                            ` : ''}
                            ${pei.interessesHabilidades ? `
                            <div class="content-box">
                                <strong>Interesses e Habilidades</strong>
                                <p>${pei.interessesHabilidades}</p>
                            </div>
                            ` : ''}
                            ${pei.estrategias ? `
                            <div class="content-box">
                                <strong>Estratégias Pedagógicas</strong>
                                <p>${pei.estrategias}</p>
                            </div>
                            ` : ''}
                            ${pei.observacoes ? `
                            <div class="content-box">
                                <strong>Observações</strong>
                                <p>${pei.observacoes}</p>
                            </div>
                            ` : ''}
                            ${pei.historico ? `
                            <div class="content-box">
                                <strong>Histórico</strong>
                                <p>${pei.historico}</p>
                            </div>
                            ` : ''}
                            ${pei.napneOpinion ? `
                            <div class="content-box">
                                <strong>Parecer do NAPNE</strong>
                                <p>${pei.napneOpinion}</p>
                            </div>
                            ` : ''}
                        </div>

                        <div class="section">
                            <div class="section-title">PEI ADAPTAÇÃO (Criado pelo Professor)</div>
                            ${pei.specificObjectives ? `
                            <div class="content-box">
                                <strong>Objetivos Específicos</strong>
                                <p>${pei.specificObjectives}</p>
                            </div>
                            ` : ''}
                            ${pei.methodology ? `
                            <div class="content-box">
                                <strong>Metodologia</strong>
                                <p>${pei.methodology}</p>
                            </div>
                            ` : ''}
                            ${pei.evaluation ? `
                            <div class="content-box">
                                <strong>Avaliação</strong>
                                <p>${pei.evaluation}</p>
                            </div>
                            ` : ''}
                            ${pei.opinion ? `
                            <div class="content-box">
                                <strong>Parecer do Professor</strong>
                                <p>${pei.opinion}</p>
                            </div>
                            ` : ''}
                            ${pei.comentarios_napne ? `
                            <div class="content-box" style="background-color: #fff3cd; border-color: #ffc107;">
                                <strong>Comentários do NAPNE sobre a Adaptação</strong>
                                <p>${pei.comentarios_napne}</p>
                            </div>
                            ` : ''}
                        </div>

                        <div class="footer">
                            <p>Documento gerado em ${currentDate} - Sistema NAPNE</p>
                        </div>
                    </body>
                    </html>
                `;
            }
        } else {
            // Usar formulário atual - melhorar formatação
            const peiForm = document.querySelector("#peiForm");
            const clone = peiForm.cloneNode(true);
            clone.querySelector(".form-actions")?.remove();
            
            // Adicionar estilos ao clone
            const style = document.createElement('style');
            style.textContent = `
                body { font-family: Arial, sans-serif; padding: 20px; }
                .form-group { margin-bottom: 20px; }
                .form-group label { font-weight: bold; color: #2c3e50; display: block; margin-bottom: 5px; }
                .form-group input, .form-group select, .form-group textarea { 
                    width: 100%; 
                    padding: 8px; 
                    border: 1px solid #ddd; 
                    border-radius: 4px;
                    font-size: 11pt;
                }
                .form-group textarea { 
                    min-height: 80px; 
                    white-space: pre-wrap;
                }
                h3 { color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 5px; }
                hr { margin: 20px 0; border: 1px solid #ddd; }
            `;
            clone.appendChild(style);
            
            content = clone.outerHTML;
        }

        // Pega o nome do aluno para ser o nome do arquivo pdf
        const select = document.getElementById("studentName");
        const studentName = select ? select.options[select.selectedIndex]?.text || select.value : 'PEI';
        const valor = studentName.replace(/[^a-zA-Z0-9]/g, '_') || 'PEI';

        // Configuração do pdf (final)
        const options = {
            margin: [15, 15, 15, 15],
            filename: valor + '_PEI',
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false
            },
            jsPDF: {
                unit: 'mm', 
                format: 'a4', 
                orientation: 'portrait'
            }
        }

        // Gerar e baixar PDF
        html2pdf().set(options).from(content).save();
    }
    
    // Funções globais já definidas acima (viewPei, editPei, deletePei, viewStudentDetails, viewProfessorDetails)
    
    // Garantir que todas as funções estão no escopo global
    // (já definidas acima como window.functionName)
});

// Funções que precisam estar disponíveis imediatamente (fora do DOMContentLoaded)
// Elas são redefinidas dentro do DOMContentLoaded, mas ter uma definição aqui garante que não haverá erro
if (typeof window.openModalGeral === 'undefined') {
    window.openModalGeral = function() {
        console.warn('openModalGeral ainda não foi inicializada. Aguarde o carregamento da página.');
    };
}

if (typeof window.deletePeiGeral === 'undefined') {
    window.deletePeiGeral = function() {
        console.warn('deletePeiGeral ainda não foi inicializada. Aguarde o carregamento da página.');
    };
}

if (typeof window.deletePeiAdaptacao === 'undefined') {
    window.deletePeiAdaptacao = function() {
        console.warn('deletePeiAdaptacao ainda não foi inicializada. Aguarde o carregamento da página.');
    };
}