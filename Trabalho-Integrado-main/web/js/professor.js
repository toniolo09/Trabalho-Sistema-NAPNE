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
    
    // Verificar se é docente, caso contrário redirecionar para dashboard principal
    const tipo = currentUser.tipo ? currentUser.tipo.toUpperCase() : '';
    if (tipo !== 'DOCENTE') {
        // Usar replace para evitar loop de redirecionamento
        window.location.replace('dashboard.html');
        return;
    }

    // Elementos DOM
    const logoutBtn = document.getElementById('logout');
    const userWelcome = document.getElementById('user-welcome');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const peiModal = document.getElementById('peiModal');
    const responseModal = document.getElementById('responseModal');
    const closeModal = document.querySelector('.close');
    const closeResponseModal = document.querySelector('#responseModal .close');
    const cancelResponseBtn = document.getElementById('cancelResponse');
    const responseForm = document.getElementById('responseForm');
    
    // Dados carregados do backend
    let peisAdaptacao = [];
    let peisGeral = [];
    let students = [];
    let courses = [];
    let subjects = [];
    let matriculas = [];

    userWelcome.textContent = `Bem-vindo, Professor ${currentUser.username || currentUser.name || 'Professor'}`;

    // Inicialização
    initPage();

    logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchTab(tab);
        });
    });

    if (closeModal) {
        closeModal.addEventListener('click', function() {
            closeModalWindow();
        });
    }

    if (closeResponseModal) {
        closeResponseModal.addEventListener('click', function() {
            closeModalWindow();
        });
    }

    if (cancelResponseBtn) {
        cancelResponseBtn.addEventListener('click', function() {
            closeModalWindow();
        });
    }

    // Clicar fora do modal para fechar
    window.addEventListener('click', function(event) {
        if (event.target === peiModal) {
            closeModalWindow();
        }
        if (event.target === responseModal) {
            closeModalWindow();
        }
    });

    // Enviar resposta do PEI
    if (responseForm) {
        responseForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveResponse();
        });
    }

    // Função para inicializar a página
    async function initPage() {
        await loadData();
        loadPeis();
        
        // Verificar se há parâmetros na URL (para visualização/resposta)
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const id = urlParams.get('id');
        
        if (action && id) {
            if (action === 'view') {
                viewPei(id);
            } else if (action === 'respond') {
                respondToPei(id);
            }
        }
    }

    // Função para carregar dados do backend
    async function loadData() {
        try {
            // Buscar PEI_GERAL atribuídos a este professor
            const professorSiape = currentUser.siape || currentUser.siape;
            
            // Usar Promise.allSettled para não travar se algum falhar
            const results = await Promise.allSettled([
                professorSiape ? API_CONFIG.get(`peis?professor=${professorSiape}`) : API_CONFIG.get('peis'),
                API_CONFIG.get('adaptacoes'),
                API_CONFIG.get('estudantes'),
                API_CONFIG.get('cursos'),
                API_CONFIG.get('componentes'),
                API_CONFIG.get('matriculas')
            ]);
            
            // Processar resultados
            peisGeral = results[0].status === 'fulfilled' ? (results[0].value || []) : [];
            peisAdaptacao = results[1].status === 'fulfilled' ? (results[1].value || []) : [];
            students = results[2].status === 'fulfilled' ? (results[2].value || []) : [];
            courses = results[3].status === 'fulfilled' ? (results[3].value || []) : [];
            subjects = results[4].status === 'fulfilled' ? (results[4].value || []) : [];
            matriculas = results[5].status === 'fulfilled' ? (results[5].value || []) : [];
            
            // Log de erros se houver
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const endpoints = ['peis', 'adaptacoes', 'estudantes', 'cursos', 'componentes', 'matriculas'];
                    console.warn(`Erro ao carregar ${endpoints[index]}:`, result.reason);
                }
            });
        } catch (error) {
            console.error('Erro geral ao carregar dados:', error);
            // Não quebrar a aplicação, apenas inicializar arrays vazios
            peisGeral = [];
            peisAdaptacao = [];
            students = [];
            courses = [];
            subjects = [];
            matriculas = [];
        }
    }

    // Função para carregar e exibir PEIs
    function loadPeis() {
        const pendingTableBody = document.getElementById('pending-table-body');
        const respondedTableBody = document.getElementById('responded-table-body');
        
        if (!pendingTableBody || !respondedTableBody) return;
        
        // Limpar tabelas
        pendingTableBody.innerHTML = '';
        respondedTableBody.innerHTML = '';
        
        // PEI_GERAL atribuídos a este professor (criados pelo NAPNE)
        // Separar os que têm PEI_ADAPTACAO (respondidos) dos que não têm (pendentes)
        const peisCompletos = peisGeral.map(pg => {
            const matricula = matriculas.find(m => m.matricula === pg.matricula);
            const student = students.find(s => matricula && s.id_aluno === matricula.estudante_id);
            const course = courses.find(c => matricula && c.codigo === matricula.curso_id);
            const peiAdaptacao = peisAdaptacao.find(pa => pa.pei_geral_id === pg.id);
            const subjectFromGeral = pg && pg.codigo_componente ? subjects.find(s => s.codigo_componente === pg.codigo_componente) : null;
            const subject = peiAdaptacao
                ? subjects.find(s => s.codigo_componente === peiAdaptacao.codigo_componente)
                : subjectFromGeral;
            
            return {
                id: pg.id,
                pei_adaptacao_id: peiAdaptacao ? peiAdaptacao.id : null,
                studentName: student ? student.nome : 'N/A',
                course: course ? course.nome : 'N/A',
                subject: subject ? subject.componente : 'Não definido',
                subjectId: subject ? subject.codigo_componente : null,
                yearSemester: pg.periodo || 'N/A',
                necessidade_especifica: pg.necessidade_especifica || 'N/A',
                // Campos do PEI_GERAL (criado pelo NAPNE)
                objetivo_geral: pg.objetivo_geral || '',
                conteudos: pg.conteudos || '',
                parecer_napne: pg.parecer || '',
                // Campos do PEI_ADAPTACAO (se existir)
                objetivos_especificos: peiAdaptacao ? peiAdaptacao.objetivos_especificos : '',
                metodologia: peiAdaptacao ? peiAdaptacao.metodologia : '',
                avaliacao: peiAdaptacao ? peiAdaptacao.avaliacao : '',
                parecer_professor: peiAdaptacao ? peiAdaptacao.parecer : '',
                status: peiAdaptacao ? peiAdaptacao.status : 'pendente',
                tem_adaptacao: !!peiAdaptacao
            };
        });
        
        // Separar PEIs pendentes (sem PEI_ADAPTACAO) dos respondidos (com PEI_ADAPTACAO)
        const pendingPeis = peisCompletos.filter(pei => !pei.tem_adaptacao);
        const respondedPeis = peisCompletos.filter(pei => pei.tem_adaptacao);
        
        // Preencher tabela de PEIs pendentes
        if (pendingPeis.length === 0) {
            pendingTableBody.innerHTML = '<tr><td colspan="7" class="empty-message">Nenhum PEI pendente.</td></tr>';
        } else {
            pendingPeis.forEach(pei => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${pei.studentName}</td>
                    <td>${pei.course}</td>
                    <td>${pei.subject}</td>
                    <td>${pei.yearSemester}</td>
                    <td>${pei.necessidade_especifica}</td>
                    <td><span class="status-badge status-pending">Pendente</span></td>
                    <td>
                        <button class="btn btn-view" onclick="viewPei(${pei.id})">Ver PEI Geral</button>
                        <button class="btn btn-respond" onclick="respondToPei(${pei.id})">Criar Adaptação</button>
                    </td>
                `;
                pendingTableBody.appendChild(row);
            });
        }
        
        // Preencher tabela de PEIs respondidos
        if (respondedPeis.length === 0) {
            respondedTableBody.innerHTML = '<tr><td colspan="7" class="empty-message">Nenhum PEI respondido.</td></tr>';
        } else {
            respondedPeis.forEach(pei => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${pei.studentName}</td>
                    <td>${pei.course}</td>
                    <td>${pei.subject}</td>
                    <td>${pei.yearSemester}</td>
                    <td>${pei.necessidade_especifica}</td>
                    <td><span class="status-badge status-${pei.status}">${getStatusText(pei.status)}</span></td>
                    <td>
                        <button class="btn btn-view" onclick="viewPei(${pei.id}, ${pei.pei_adaptacao_id})">Ver</button>
                        <button class="btn btn-edit" onclick="editAdaptacao(${pei.pei_adaptacao_id})">Editar</button>
                    </td>
                `;
                respondedTableBody.appendChild(row);
            });
        }
    }
    
    // Função para obter texto do status
    function getStatusText(status) {
        const statusMap = {
            'pending': 'Pendente',
            'in_progress': 'Em Andamento',
            'completed': 'Concluído',
            'rejected': 'Rejeitado'
        };
        return statusMap[status] || 'Pendente';
    }
    
    // Função para visualizar PEI
    window.viewPei = function(peiGeralId, peiAdaptacaoId = null) {
        const peiGeral = peisGeral.find(pg => pg.id == peiGeralId);
        
        if (peiGeral) {
            const peiAdaptacao = peiAdaptacaoId ? peisAdaptacao.find(p => p.id == peiAdaptacaoId) : null;
            const matricula = matriculas.find(m => peiGeral && m.matricula === peiGeral.matricula);
            const student = students.find(s => matricula && s.id_aluno === matricula.estudante_id);
            const course = courses.find(c => matricula && c.codigo === matricula.curso_id);
            const subject = peiAdaptacao
                ? subjects.find(s => s.codigo_componente === peiAdaptacao.codigo_componente)
                : (peiGeral && peiGeral.codigo_componente ? subjects.find(s => s.codigo_componente === peiGeral.codigo_componente) : null);
            
            if (document.getElementById('modalTitle')) {
                document.getElementById('modalTitle').textContent = `PEI - ${subject ? subject.componente : 'Geral'}`;
            }
            if (document.getElementById('detail-student')) {
                document.getElementById('detail-student').textContent = student ? student.nome : 'N/A';
            }
            if (document.getElementById('detail-course')) {
                document.getElementById('detail-course').textContent = course ? course.nome : 'N/A';
            }
            if (document.getElementById('detail-subject')) {
                document.getElementById('detail-subject').textContent = subject ? subject.componente : (peiAdaptacao ? 'N/A' : 'Definido pelo NAPNE');
            }
            if (document.getElementById('detail-yearSemester')) {
                document.getElementById('detail-yearSemester').textContent = peiGeral ? peiGeral.periodo : 'N/A';
            }
            if (document.getElementById('detail-need')) {
                document.getElementById('detail-need').textContent = peiGeral ? peiGeral.necessidade_especifica || 'Não informado' : 'Não informado';
            }
            if (document.getElementById('detail-ementa')) {
                const ementaBase = subject ? (subject.ementa || 'Não informado') : 'Não informado';
                document.getElementById('detail-ementa').textContent = peiAdaptacao ? (peiAdaptacao.ementa || ementaBase) : ementaBase;
            }
            // Campos do PEI_GERAL (criado pelo NAPNE)
            if (document.getElementById('detail-generalObjective')) {
                document.getElementById('detail-generalObjective').textContent = peiGeral ? (peiGeral.objetivo_geral || 'Não informado') : 'Não informado';
            }
            if (document.getElementById('detail-contents')) {
                document.getElementById('detail-contents').textContent = peiGeral ? (peiGeral.conteudos || 'Não informado') : 'Não informado';
            }
            // Campos do PEI_ADAPTACAO (criado pelo professor)
            if (document.getElementById('detail-specificObjectives')) {
                document.getElementById('detail-specificObjectives').textContent = peiAdaptacao ? (peiAdaptacao.objetivos_especificos || 'Não informado') : 'Ainda não cadastrado pelo professor';
            }
            if (document.getElementById('detail-methodology')) {
                document.getElementById('detail-methodology').textContent = peiAdaptacao ? (peiAdaptacao.metodologia || 'Não informado') : 'Ainda não cadastrado pelo professor';
            }
            if (document.getElementById('detail-evaluation')) {
                document.getElementById('detail-evaluation').textContent = peiAdaptacao ? (peiAdaptacao.avaliacao || 'Não informado') : 'Ainda não cadastrado pelo professor';
            }
            if (document.getElementById('detail-opinion')) {
                document.getElementById('detail-opinion').textContent = peiAdaptacao ? (peiAdaptacao.parecer || 'Não informado') : 'Ainda não cadastrado pelo professor';
            }
            
            // Exibir comentários do NAPNE (linkados com o backend - campo comentarios_napne)
            const napneCommentsDiv = document.getElementById('detail-napne-comments');
            if (napneCommentsDiv) {
                if (peiAdaptacao && peiAdaptacao.comentarios_napne && peiAdaptacao.comentarios_napne.trim()) {
                    napneCommentsDiv.textContent = peiAdaptacao.comentarios_napne;
                } else {
                    napneCommentsDiv.textContent = 'Nenhum comentário do NAPNE ainda.';
                }
            }
            
            if (peiModal) {
                peiModal.style.display = 'block';
            }
        }
    };
    
    // Função para criar PEI_ADAPTACAO sobre um PEI_GERAL
    window.respondToPei = function(peiGeralId) {
        const peiGeral = peisGeral.find(pg => pg.id == peiGeralId);
        
        if (peiGeral) {
            const matricula = matriculas.find(m => m.matricula === peiGeral.matricula);
            const student = students.find(s => matricula && s.id_aluno === matricula.estudante_id);
            const course = courses.find(c => matricula && c.codigo === matricula.curso_id);
            
            if (document.getElementById('responseModalTitle')) {
                document.getElementById('responseModalTitle').textContent = `Criar PEI Adaptação - ${student ? student.nome : 'N/A'}`;
            }
            if (document.getElementById('responsePeiId')) {
                document.getElementById('responsePeiId').value = peiGeralId; // Guardar ID do PEI_GERAL
            }
            
            // Preencher informações básicas
            if (document.getElementById('response-student')) {
                document.getElementById('response-student').textContent = student ? student.nome : 'N/A';
            }
            if (document.getElementById('response-course')) {
                document.getElementById('response-course').textContent = course ? course.nome : 'N/A';
            }
            // Preencher select de matérias
            const subjectSelect = document.getElementById('response-subject-select');
            if (subjectSelect) {
                subjectSelect.innerHTML = '<option value="">Selecione a matéria</option>';
                subjects.forEach(s => {
                    const option = document.createElement('option');
                    option.value = s.codigo_componente || s.id;
                    option.textContent = s.componente || s.name || '';
                    option.dataset.ementa = s.ementa || '';
                    subjectSelect.appendChild(option);
                });
                
                // Preencher ementa quando selecionar matéria
                subjectSelect.onchange = function() {
                    const selectedOption = this.options[this.selectedIndex];
                    const ementaField = document.getElementById('ementa-response');
                    if (ementaField && selectedOption.dataset.ementa) {
                        ementaField.value = selectedOption.dataset.ementa;
                    }
                };

                const subjectFromGeral = peiGeral && peiGeral.codigo_componente
                    ? subjects.find(s => s.codigo_componente === peiGeral.codigo_componente)
                    : null;
                if (subjectFromGeral) {
                    subjectSelect.value = subjectFromGeral.codigo_componente;
                    subjectSelect.disabled = true;
                    subjectSelect.classList.add('select-locked');
                    subjectSelect.title = 'Componente curricular definido pelo NAPNE';
                    subjectSelect.dispatchEvent(new Event('change'));
                    const ementaField = document.getElementById('ementa-response');
                    if (ementaField) {
                        ementaField.value = subjectFromGeral.ementa || subjectFromGeral.description || '';
                    }
                } else {
                    subjectSelect.disabled = false;
                    subjectSelect.classList.remove('select-locked');
                    subjectSelect.title = '';
                }
            }
            
            // Limpar formulário
            if (document.getElementById('specificObjectives')) {
                document.getElementById('specificObjectives').value = '';
            }
            if (document.getElementById('methodology')) {
                document.getElementById('methodology').value = '';
            }
            if (document.getElementById('evaluation')) {
                document.getElementById('evaluation').value = '';
            }
            if (document.getElementById('parecer')) {
                document.getElementById('parecer').value = '';
            }
            
            // Mostrar modal de resposta
            if (responseModal) {
                responseModal.style.display = 'block';
            }
        }
    };
    
    // Função para salvar PEI_ADAPTACAO
    async function saveResponse() {
        const peiGeralId = document.getElementById('responsePeiId')?.value;
        const codigoComponente = document.getElementById('response-subject-select')?.value;
        const ementa = document.getElementById('ementa-response')?.value || '';
        const objetivosEspecificos = document.getElementById('specificObjectives')?.value || '';
        const methodology = document.getElementById('methodology')?.value || '';
        const evaluation = document.getElementById('evaluation')?.value || '';
        const parecer = document.getElementById('parecer')?.value || '';
        
        if (!peiGeralId) {
            alert('Erro: ID do PEI Geral não encontrado');
            return;
        }
        
        if (!codigoComponente) {
            alert('Por favor, selecione um componente curricular');
            return;
        }
        
        try {
            // Verificar se já existe PEI_ADAPTACAO para este PEI_GERAL
            const peiAdaptacaoExistente = peisAdaptacao.find(pa => pa.pei_geral_id == peiGeralId);
            
            const peiGeral = peisGeral.find(pg => pg.id == peiGeralId);
            if (!peiGeral) {
                alert('PEI Geral não encontrado');
                return;
            }
            
            // Obter siape do professor logado
            const professorSiape = currentUser.siape ? parseInt(currentUser.siape) : null;
            
            if (peiAdaptacaoExistente) {
                // Atualizar PEI_ADAPTACAO existente
                const updatedData = {
                    pei_geral_id: parseInt(peiGeralId),
                    codigo_componente: parseInt(codigoComponente),
                    ementa: ementa,
                    objetivos_especificos: objetivosEspecificos,
                    metodologia: methodology,
                    avaliacao: evaluation,
                    parecer: parecer,
                    status: peiAdaptacaoExistente.status || 'rascunho'
                };
                
                if (professorSiape) {
                    updatedData.professor_siape = professorSiape;
                }
                
                await API_CONFIG.put(`adaptacoes/${peiAdaptacaoExistente.id}`, updatedData);
                alert('PEI Adaptação atualizado com sucesso!');
            } else {
                // Criar novo PEI_ADAPTACAO
                const newData = {
                    pei_geral_id: parseInt(peiGeralId),
                    codigo_componente: parseInt(codigoComponente),
                    ementa: ementa,
                    objetivos_especificos: objetivosEspecificos,
                    metodologia: methodology,
                    avaliacao: evaluation,
                    parecer: parecer,
                    status: 'rascunho'
                };
                
                if (professorSiape) {
                    newData.professor_siape = professorSiape;
                }
                
                await API_CONFIG.post('adaptacoes', newData);
                alert('PEI Adaptação criado com sucesso!');
            }
            
            // Fechar modal e recarregar dados
            if (responseModal) {
                responseModal.style.display = 'none';
            }
            await loadData();
            loadPeis();
        } catch (error) {
            console.error('Erro ao salvar PEI Adaptação:', error);
            alert('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
        }
    }
    
    // Função para alternar entre abas
    function switchTab(tab) {
        // Remover classe active de todas as abas e conteúdos
        tabBtns.forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Adicionar classe active à aba clicada e ao conteúdo correspondente
        const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
        const activeContent = document.getElementById(`${tab}-content`);
        if (activeBtn) activeBtn.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
    }
    
    // Função para fechar modal
    function closeModalWindow() {
        if (peiModal) {
            peiModal.style.display = 'none';
        }
        if (responseModal) {
            responseModal.style.display = 'none';
        }
    }
});
