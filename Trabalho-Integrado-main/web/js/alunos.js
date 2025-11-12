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

    // Formatação de Telefone
    function formatTelefone(telefone) {
        if (!telefone) return '';
        telefone = telefone.replace(/\D/g, '');
        if (telefone.length <= 10) {
            telefone = telefone.replace(/(\d{2})(\d)/, '($1) $2');
            telefone = telefone.replace(/(\d{4})(\d)/, '$1-$2');
        } else {
            telefone = telefone.replace(/(\d{2})(\d)/, '($1) $2');
            telefone = telefone.replace(/(\d{5})(\d)/, '$1-$2');
        }
        return telefone;
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
    const newStudentBtn = document.getElementById('newStudentBtn');
    const studentModal = document.getElementById('studentModal');
    const studentForm = document.getElementById('studentForm');
    const studentsTableBody = document.getElementById('students-table-body');
    // Removidos - não são mais necessários

    // Dados carregados do backend
    let students = [];
    let courses = [];
    let matriculas = [];
    let necessidades = [];
    let estudantesNecessidades = [];
    let responsaveis = [];
    let respEstudantes = [];

    // Removido - não é mais necessário, as necessidades vêm do backend

    // Inicialização
    init();
    
    // Popular select de cursos ao carregar
    setTimeout(() => {
        const courseSelect = document.getElementById('studentCourse');
        if (courseSelect) {
            populateCourseSelect();
        }
    }, 500);

    async function init() {
        setupEventListeners();
        await loadData();
        loadStudentsTable();
        setupFilters();
    }

    async function loadData() {
        try {
            // Carregar cursos, estudantes, matrículas, necessidades, responsáveis e relações em paralelo
            const [coursesData, studentsData, matriculasData, necessidadesData, estudantesNecessidadesData, responsaveisData, respEstudantesData] = await Promise.all([
                API_CONFIG.get('cursos'),
                API_CONFIG.get('estudantes'),
                API_CONFIG.get('matriculas'),
                API_CONFIG.get('necessidades'),
                API_CONFIG.get('estudantes-necessidades'),
                API_CONFIG.get('responsaveis'),
                API_CONFIG.get('resp-estudantes')
            ]);

            // Garantir que são arrays válidos
            courses = Array.isArray(coursesData) && coursesData.length > 0 
                ? coursesData.map(c => ({
                    id: c.codigo || c.id,
                    code: c.codigo || c.code,
                    name: c.nome || c.name || '',
                    level: c.modalidade || c.level || 'Técnico'
                }))
                : [];

            students = Array.isArray(studentsData) && studentsData.length > 0
                ? studentsData
                : [];

            matriculas = Array.isArray(matriculasData) && matriculasData.length > 0
                ? matriculasData
                : [];

            necessidades = Array.isArray(necessidadesData) && necessidadesData.length > 0
                ? necessidadesData.map(n => ({
                    id: n.necessidade_id || n.id,
                    nome: n.nome || n.name || '',
                    descricao: n.descricao || n.description || ''
                }))
                : [];

            estudantesNecessidades = Array.isArray(estudantesNecessidadesData) && estudantesNecessidadesData.length > 0
                ? estudantesNecessidadesData
                : [];

            responsaveis = Array.isArray(responsaveisData) && responsaveisData.length > 0
                ? responsaveisData.map(r => ({
                    id: r.id_responsavel || r.id,
                    nome: r.nome_responsavel || r.nome || '',
                    cpf: r.cpf_responsavel || r.cpf || '',
                    contato: r.contato_responsavel || r.contato || '',
                    endereco: r.endereco_responsavel || r.endereco || ''
                }))
                : [];

            respEstudantes = Array.isArray(respEstudantesData) && respEstudantesData.length > 0
                ? respEstudantesData
                : [];

            // Popular o select de necessidades
            populateNecessidadesSelect();

        } catch (error) {
            // SyntaxError não deve quebrar a aplicação - tratar silenciosamente
            if (error instanceof SyntaxError) {
                console.warn('SyntaxError capturado em alunos.js (silencioso):', error.message);
                // Não mostrar toast para SyntaxError, apenas inicializar arrays vazios
            } else {
                let errorMessage = error.message || 'Erro ao carregar dados do servidor';
                console.error('Erro ao carregar dados:', errorMessage, error);
                // Só mostrar toast se não for SyntaxError
                if (typeof showToast === 'function') {
                    showToast(errorMessage, 'error');
                }
            }
            
            // Sempre inicializar arrays vazios em caso de erro
            courses = [];
            students = [];
            matriculas = [];
            necessidades = [];
            estudantesNecessidades = [];
            responsaveis = [];
            respEstudantes = [];
        }
    }

    function populateNecessidadesSelect() {
        const necessidadeSelect = document.getElementById('necessidade');
        if (!necessidadeSelect) return;

        const currentValue = necessidadeSelect.value;
        necessidadeSelect.innerHTML = '<option value="">Selecione uma necessidade</option>';
        
        if (Array.isArray(necessidades) && necessidades.length > 0) {
            necessidades.forEach(need => {
                const option = document.createElement('option');
                option.value = need.id;
                option.textContent = need.nome;
                necessidadeSelect.appendChild(option);
            });
            
            // Restaurar valor selecionado se existir
            if (currentValue) {
                necessidadeSelect.value = currentValue;
            }
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Nenhuma necessidade cadastrada';
            necessidadeSelect.appendChild(option);
        }
    }
    
    async function criarOuAtualizarMatricula(estudanteId, matriculaNum, cursoId) {
        try {
            // Validar que matrícula e curso foram fornecidos
            if (!matriculaNum || !matriculaNum.trim()) {
                throw new Error('Número de matrícula é obrigatório!');
            }
            
            if (!cursoId || !cursoId.toString().trim()) {
                throw new Error('Curso é obrigatório!');
            }
            
            // Verificar se já existe matrícula para este aluno
            const matriculaExistente = Array.isArray(matriculas) 
                ? matriculas.find(m => {
                    const matriculaEstudanteId = m.estudante_id || m.estudanteId || m.id_aluno;
                    return matriculaEstudanteId == estudanteId || 
                           matriculaEstudanteId === estudanteId || 
                           parseInt(matriculaEstudanteId) === parseInt(estudanteId);
                })
                : null;
            
            if (matriculaExistente) {
                // Atualizar matrícula existente (ou criar nova se o número mudou)
                if (matriculaExistente.matricula === matriculaNum) {
                    // Mesma matrícula, apenas atualizar curso se necessário
                    await API_CONFIG.put(`matriculas/${matriculaExistente.matricula}`, {
                        estudante_id: estudanteId,
                        curso_id: cursoId.toString(), // Garantir que é string (VARCHAR(50))
                        ativo: true
                    });
                } else {
                    // Matrícula diferente - deletar a antiga e criar nova
                    try {
                        await API_CONFIG.delete(`matriculas/${matriculaExistente.matricula}`);
                    } catch (e) {
                        console.warn('Erro ao deletar matrícula antiga:', e);
                    }
                    // Criar nova matrícula
                    await API_CONFIG.post('matriculas', {
                        matricula: matriculaNum.trim(),
                        estudante_id: estudanteId,
                        curso_id: cursoId.toString(), // Garantir que é string (VARCHAR(50))
                        ativo: true
                    });
                }
            } else {
                // Criar nova matrícula
                await API_CONFIG.post('matriculas', {
                    matricula: matriculaNum.trim(),
                    estudante_id: estudanteId,
                    curso_id: cursoId.toString(), // Garantir que é string (VARCHAR(50))
                    ativo: true
                });
            }
            
            // Recarregar matrículas para atualizar a lista local
            try {
                const matriculasAtualizadas = await API_CONFIG.get('matriculas');
                if (Array.isArray(matriculasAtualizadas)) {
                    matriculas = matriculasAtualizadas;
                }
            } catch (e) {
                console.warn('Erro ao recarregar matrículas:', e);
            }
        } catch (error) {
            console.error('Erro ao criar/atualizar matrícula:', error);
            throw error; // Lançar erro para ser tratado no handler
        }
    }

    // Obter dados dos estudantes com suas necessidades e responsáveis
    function getStudentsWithMatricula() {
        // Garantir que students é array válido
        if (!Array.isArray(students) || students.length === 0) {
            return [];
        }
        
        return students.map(estudante => {
            if (!estudante) return null;
            
            // Buscar necessidades do estudante
            const cpfEstudante = estudante.cpf ? estudante.cpf.replace(/\D/g, '') : '';
            const necessidadesEstudante = Array.isArray(estudantesNecessidades)
                ? estudantesNecessidades
                    .filter(en => {
                        const cpfRelacao = en.estudante_cpf ? en.estudante_cpf.replace(/\D/g, '') : '';
                        return cpfRelacao === cpfEstudante;
                    })
                    .map(en => {
                        const necessidade = necessidades.find(n => n.id === en.necessidade_id);
                        return necessidade ? necessidade.nome : null;
                    })
                    .filter(n => n !== null)
                : [];
            
            // Buscar responsável do estudante
            const responsavelRelacao = Array.isArray(respEstudantes)
                ? respEstudantes.find(re => re.id_aluno === estudante.id_aluno || re.id_aluno === estudante.id)
                : null;
            
            let responsavelNome = 'N/A';
            let ehProprioResponsavel = false;
            if (responsavelRelacao) {
                const responsavel = responsaveis.find(r => r.id === responsavelRelacao.id_responsavel);
                if (responsavel) {
                    responsavelNome = responsavel.nome || 'N/A';
                    // Verificar se é o próprio aluno
                    const cpfResp = (responsavel.cpf || '').replace(/\D/g, '');
                    ehProprioResponsavel = cpfResp === cpfEstudante;
                    if (ehProprioResponsavel) {
                        responsavelNome = 'Próprio aluno';
                    }
                }
            }
            
            // Buscar matrícula: primeiro da tabela ESTUDANTES (campo matricula), depois da tabela MATRICULAS
            const idAluno = estudante.id_aluno || estudante.id;
            
            // Prioridade 1: Matrícula direta da tabela ESTUDANTES
            let matriculaNum = estudante.matricula || 'N/A';
            
            // Prioridade 2: Buscar da tabela MATRICULAS (para obter curso)
            let matriculaObj = null;
            if (Array.isArray(matriculas) && matriculas.length > 0) {
                matriculaObj = matriculas.find(m => {
                    const matriculaEstudanteId = m.estudante_id || m.estudanteId || m.id_aluno;
                    return matriculaEstudanteId == idAluno || 
                           matriculaEstudanteId === idAluno || 
                           parseInt(matriculaEstudanteId) === parseInt(idAluno);
                });
                
                // Se encontrou na tabela MATRICULAS e não tinha na ESTUDANTES, usar da MATRICULAS
                if (matriculaObj && (!matriculaNum || matriculaNum === 'N/A')) {
                    matriculaNum = matriculaObj.matricula || matriculaObj.numero || 'N/A';
                }
            }
            
            // Buscar curso da matrícula (tabela MATRICULAS)
            let cursoNome = 'N/A';
            if (matriculaObj) {
                const cursoIdMatricula = matriculaObj.curso_id || matriculaObj.cursoId || matriculaObj.curso;
                if (cursoIdMatricula) {
                    const curso = courses.find(c => {
                        const cursoId = c.id || c.codigo || c.code;
                        return cursoId == cursoIdMatricula || 
                               cursoId === cursoIdMatricula || 
                               cursoId === cursoIdMatricula.toString();
                    });
                    if (curso) {
                        cursoNome = curso.name || curso.nome || curso.code || curso.codigo || 'N/A';
                    }
                }
            }
            
            // Se não encontrou matrícula em nenhum lugar, usar 'N/A'
            if (!matriculaNum || matriculaNum === '') {
                matriculaNum = 'N/A';
            }
            
            return {
                id: estudante.id_aluno || estudante.id,
                id_aluno: estudante.id_aluno || estudante.id,
                name: estudante.nome || estudante.name || '',
                cpf: formatCPF(estudante.cpf || ''),
                cpfRaw: cpfEstudante,
                contato: estudante.contato || '',
                matricula: matriculaNum,
                curso: cursoNome,
                cursoId: matriculaObj ? (matriculaObj.curso_id || matriculaObj.cursoId) : null,
                precisa_atendimento_psicopedagogico: estudante.precisa_atendimento_psicopedagogico === 1 || 
                                                      estudante.precisa_atendimento_psicopedagogico === true ||
                                                      estudante.psychopedagogical === true,
                psychopedagogical: estudante.precisa_atendimento_psicopedagogico === 1 || 
                                 estudante.precisa_atendimento_psicopedagogico === true ||
                                 estudante.psychopedagogical === true,
                necessidades: necessidadesEstudante,
                necessidadesIds: Array.isArray(estudantesNecessidades)
                    ? estudantesNecessidades
                        .filter(en => {
                            const cpfRelacao = en.estudante_cpf ? en.estudante_cpf.replace(/\D/g, '') : '';
                            return cpfRelacao === cpfEstudante;
                        })
                        .map(en => en.necessidade_id)
                    : [],
                responsavel: responsavelNome,
                ehProprioResponsavel: ehProprioResponsavel,
                idResponsavel: responsavelRelacao ? responsavelRelacao.id_responsavel : null
            };
        }).filter(s => s !== null); // Remover nulls
    }

    function setupEventListeners() {
        newStudentBtn.addEventListener('click', () => openStudentModal());
        studentForm.addEventListener('submit', handleStudentSubmit);
        
        // CPF formatting
        const cpfInput = document.getElementById('cpf');
        if (cpfInput) {
            cpfInput.addEventListener('input', function(e) {
                e.target.value = formatCPF(e.target.value);
            });
        }
        
        // CPF do responsável formatting
        const responsavelCpfInput = document.getElementById('responsavelCpf');
        if (responsavelCpfInput) {
            responsavelCpfInput.addEventListener('input', function(e) {
                e.target.value = formatCPF(e.target.value);
            });
        }
        
        // Telefone do responsável formatting
        const responsavelContatoInput = document.getElementById('responsavelContato');
        if (responsavelContatoInput) {
            responsavelContatoInput.addEventListener('input', function(e) {
                e.target.value = formatTelefone(e.target.value);
            });
        }
        
        // Checkbox "é maior de idade"
        const ehMaiorIdadeCheck = document.getElementById('ehMaiorIdade');
        const responsavelSection = document.getElementById('responsavelSection');
        if (ehMaiorIdadeCheck && responsavelSection) {
            ehMaiorIdadeCheck.addEventListener('change', function() {
                if (this.checked) {
                    // Se for maior de idade, ocultar seção de responsável e preencher automaticamente
                    responsavelSection.style.display = 'none';
                    // Preencher dados do responsável com os dados do aluno
                    const nome = document.getElementById('name').value;
                    const cpf = document.getElementById('cpf').value;
                    const contato = document.getElementById('contato').value;
                    // Endereço removido da tabela ESTUDANTES - não existe mais
                    const endereco = '';
                    
                    document.getElementById('responsavelNome').value = nome;
                    document.getElementById('responsavelCpf').value = cpf;
                    document.getElementById('responsavelContato').value = contato;
                    document.getElementById('responsavelEndereco').value = endereco;
                } else {
                    // Se não for maior, mostrar seção de responsável
                    responsavelSection.style.display = 'block';
                }
            });
        }
        
        // Verificar idade automaticamente removido - data de nascimento não está no banco
        // Se precisar calcular idade, pode usar outro campo ou adicionar data_nascimento ao banco
        
        // Modal events
        setupModalEvents();
        
        // Filter events
        setupFilterEvents();
        
        // Logout
        const logoutBtn = document.getElementById('logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logout);
        }
    }

    function setupModalEvents() {
        const closeBtn = studentModal.querySelector('.close');
        const cancelBtn = document.getElementById('cancelStudent');
        
        if (closeBtn) closeBtn.addEventListener('click', () => closeModal(studentModal));
        if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal(studentModal));
        
        studentModal.addEventListener('click', (e) => {
            if (e.target === studentModal) closeModal(studentModal);
        });
    }

    function setupFilterEvents() {
        const filterButtons = document.querySelectorAll('#applyFilters, #clearFilters');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.target.id === 'applyFilters') {
                    applyFilters();
                } else {
                    clearFilters();
                }
            });
        });
    }

    // Funções removidas - não são mais necessárias

    function openStudentModal(student = null) {
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('studentForm');
        
        if (student) {
            title.textContent = 'Editar Estudante';
            populateForm(student);
        } else {
            title.textContent = 'Novo Estudante';
            form.reset();
            document.getElementById('studentId').value = '';
            // Limpar campos de responsável
            document.getElementById('responsavelNome').value = '';
            document.getElementById('responsavelCpf').value = '';
            document.getElementById('responsavelContato').value = '';
            document.getElementById('responsavelEndereco').value = '';
            document.getElementById('ehMaiorIdade').checked = false;
            document.getElementById('responsavelSection').style.display = 'block';
            // Popular select de necessidades
            populateNecessidadesSelect();
            // Popular select de cursos
            populateCourseSelect();
        }
        
        studentModal.style.display = 'block';
    }
    
    function populateCourseSelect() {
        const courseSelect = document.getElementById('studentCourse');
        if (!courseSelect) return;
        
        const currentValue = courseSelect.value;
        courseSelect.innerHTML = '<option value="">Selecione um curso (opcional)</option>';
        
        if (Array.isArray(courses) && courses.length > 0) {
            courses.forEach(course => {
                const option = document.createElement('option');
                const courseId = course.id || course.codigo || course.code;
                const courseName = course.name || course.nome || course.code || course.codigo || 'Curso sem nome';
                option.value = courseId;
                option.textContent = courseName;
                courseSelect.appendChild(option);
            });
            
            // Restaurar valor selecionado se existir
            if (currentValue) {
                courseSelect.value = currentValue;
            }
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Nenhum curso cadastrado';
            courseSelect.appendChild(option);
        }
    }

    function populateForm(student) {
        document.getElementById('studentId').value = student.id || student.id_aluno || '';
        document.getElementById('name').value = student.name || student.nome || '';
        document.getElementById('cpf').value = formatCPF(student.cpf || '');
        document.getElementById('contato').value = student.contato || '';
        // Endereço removido - não existe mais no banco de dados
        // Matrícula agora vem diretamente da tabela ESTUDANTES
        
        const psychopedagogical = document.getElementById('psychopedagogical');
        if (psychopedagogical) {
            // Converter valor booleano/inteiro para string 'true' ou 'false'
            const psychValue = student.precisa_atendimento_psicopedagogico || 
                             student.psychopedagogical || 
                             false;
            psychopedagogical.value = (psychValue === true || psychValue === 1 || psychValue === '1' || psychValue === 'true') ? 'true' : 'false';
        }
        
        // Preencher necessidade selecionada (apenas a primeira se houver múltiplas)
        const necessidadeSelect = document.getElementById('necessidade');
        if (necessidadeSelect && student.necessidadesIds && student.necessidadesIds.length > 0) {
            // Selecionar apenas a primeira necessidade
            necessidadeSelect.value = student.necessidadesIds[0];
        } else if (necessidadeSelect) {
            necessidadeSelect.value = '';
        }
        
        // Preencher matrícula e curso
        const matriculaInput = document.getElementById('studentMatricula');
        const courseSelect = document.getElementById('studentCourse');
        
        // Preencher matrícula (prioridade: do objeto student, que pode vir de ESTUDANTES ou MATRICULAS)
        if (matriculaInput) {
            if (student.matricula && student.matricula !== 'N/A' && student.matricula !== '') {
                matriculaInput.value = student.matricula;
            } else {
                matriculaInput.value = '';
            }
        }
        
        // Preencher curso
        if (courseSelect) {
            // Garantir que o select de cursos está populado primeiro
            populateCourseSelect();
            
            // Depois preencher o valor
            if (student.cursoId) {
                // Usar setTimeout para garantir que o select foi populado
                setTimeout(() => {
                    courseSelect.value = student.cursoId;
                }, 50);
            } else {
                courseSelect.value = '';
            }
        }
        
        // Buscar responsável do estudante
        const responsavelRelacao = Array.isArray(respEstudantes)
            ? respEstudantes.find(re => re.id_aluno === student.id || re.id_aluno === student.id_aluno)
            : null;
        
        if (responsavelRelacao) {
            const responsavel = responsaveis.find(r => r.id === responsavelRelacao.id_responsavel);
            if (responsavel) {
                // Verificar se é o próprio aluno (mesmo CPF)
                const cpfAluno = (student.cpf || '').replace(/\D/g, '');
                const cpfResponsavel = (responsavel.cpf || '').replace(/\D/g, '');
                const ehProprioResponsavel = cpfAluno === cpfResponsavel;
                
                const ehMaiorIdadeCheck = document.getElementById('ehMaiorIdade');
                if (ehMaiorIdadeCheck) {
                    ehMaiorIdadeCheck.checked = ehProprioResponsavel;
                    ehMaiorIdadeCheck.dispatchEvent(new Event('change'));
                }
                
                if (!ehProprioResponsavel) {
                    document.getElementById('responsavelNome').value = responsavel.nome || '';
                    document.getElementById('responsavelCpf').value = formatCPF(responsavel.cpf || '');
                    document.getElementById('responsavelContato').value = responsavel.contato || '';
                    document.getElementById('responsavelEndereco').value = responsavel.endereco || '';
                }
            }
        }
    }

    function closeModal(modal) {
        modal.style.display = 'none';
    }

    async function handleStudentSubmit(e) {
        e.preventDefault();
        
        const studentId = document.getElementById('studentId').value;
        const cpfRaw = document.getElementById('cpf').value.replace(/\D/g, '');
        
        // Obter valor do select de atendimento psicopedagógico
        const psychopedagogicalSelect = document.getElementById('psychopedagogical');
        let precisaAtendimento = 0;
        if (psychopedagogicalSelect && psychopedagogicalSelect.value) {
            precisaAtendimento = (psychopedagogicalSelect.value === 'true' || psychopedagogicalSelect.value === '1') ? 1 : 0;
        }
        
        // Formatar telefone (remover caracteres não numéricos)
        const contatoRaw = document.getElementById('contato')?.value.replace(/\D/g, '') || '';
        
        // Obter necessidade selecionada (apenas uma)
        const necessidadeSelect = document.getElementById('necessidade');
        const necessidadeSelecionada = necessidadeSelect && necessidadeSelect.value 
            ? [parseInt(necessidadeSelect.value)].filter(id => id > 0)
            : [];
        
        // Obter matrícula e curso (obrigatórios)
        const matriculaInput = document.getElementById('studentMatricula');
        const courseSelect = document.getElementById('studentCourse');
        const matricula = matriculaInput ? matriculaInput.value.trim() : '';
        const courseId = courseSelect && courseSelect.value ? courseSelect.value : '';
        
        // Validar matrícula e curso
        if (!matricula) {
            alert('Por favor, informe o número de matrícula do estudante!');
            if (matriculaInput) matriculaInput.focus();
            return;
        }
        
        if (!courseId) {
            alert('Por favor, selecione o curso do estudante!');
            if (courseSelect) courseSelect.focus();
            return;
        }
        
        const formData = {
            cpf: cpfRaw,
            nome: document.getElementById('name').value.trim(),
            contato: contatoRaw,
            precisa_atendimento_psicopedagogico: precisaAtendimento, // Sempre inteiro: 0 ou 1
            matricula: matricula, // Obrigatório - vai direto na tabela ESTUDANTES
            courseId: courseId // Obrigatório - para criar registro na tabela MATRICULAS
        };

        try {
            let estudanteSalvo;
            if (studentId) {
                // Editar estudante existente
                // Atualizar os dados do estudante (incluindo matrícula)
                const estudanteData = {
                    cpf: cpfRaw,
                    nome: document.getElementById('name').value.trim(),
                    contato: contatoRaw,
                    matricula: matricula, // Matrícula agora vai direto na tabela ESTUDANTES
                    precisa_atendimento_psicopedagogico: precisaAtendimento
                };
                
                estudanteSalvo = await API_CONFIG.put(`estudantes/${studentId}`, estudanteData);
                
                // Atualizar registro na tabela MATRICULAS também (relaciona com curso)
                await criarOuAtualizarMatricula(estudanteSalvo.id_aluno || estudanteSalvo.id, matricula, courseId);
                
                // Gerenciar necessidade do estudante
                await gerenciarNecessidadesEstudante(cpfRaw, necessidadeSelecionada);
                
                // Gerenciar responsável
                await gerenciarResponsavelEstudante(parseInt(studentId), estudanteSalvo);
                
                showToast('Estudante atualizado com sucesso!', 'success');
            } else {
                // Criar novo estudante (matrícula será criada pelo backend automaticamente)
                estudanteSalvo = await API_CONFIG.post('estudantes', formData);
                
                // Verificar se a matrícula foi criada pelo backend
                // Se não foi criada, criar manualmente (fallback)
                try {
                    const matriculasAtualizadas = await API_CONFIG.get('matriculas');
                    const matriculaCriada = Array.isArray(matriculasAtualizadas) 
                        ? matriculasAtualizadas.find(m => m.estudante_id === (estudanteSalvo.id_aluno || estudanteSalvo.id))
                        : null;
                    
                    if (!matriculaCriada) {
                        console.log('Matrícula não foi criada pelo backend, criando manualmente...');
                        await criarOuAtualizarMatricula(estudanteSalvo.id_aluno || estudanteSalvo.id, matricula, courseId);
                    } else {
                        console.log('Matrícula criada com sucesso pelo backend');
                        // Atualizar lista local
                        matriculas = matriculasAtualizadas;
                    }
                } catch (e) {
                    console.error('Erro ao verificar matrícula:', e);
                    // Tentar criar manualmente
                    await criarOuAtualizarMatricula(estudanteSalvo.id_aluno || estudanteSalvo.id, matricula, courseId);
                }
                
                // Adicionar necessidade do estudante
                await gerenciarNecessidadesEstudante(cpfRaw, necessidadeSelecionada);
                
                // Gerenciar responsável
                const idAluno = estudanteSalvo.id_aluno || estudanteSalvo.id;
                await gerenciarResponsavelEstudante(idAluno, estudanteSalvo);
                
                showToast('Estudante cadastrado com sucesso!', 'success');
            }
            
            // Recarregar dados
            await loadData();
            loadStudentsTable();
            closeModal(studentModal);
        } catch (error) {
            console.error('Erro ao salvar estudante:', error);
            const errorMessage = error.message || 'Erro ao salvar estudante';
            showToast(errorMessage, 'error');
            // Se for erro de matrícula, focar no campo de matrícula
            if (errorMessage.includes('matrícula') || errorMessage.includes('Matrícula')) {
                const matriculaInput = document.getElementById('studentMatricula');
                if (matriculaInput) {
                    matriculaInput.focus();
                }
            }
        }
    }

    async function gerenciarResponsavelEstudante(idAluno, estudante) {
        if (!idAluno) return;

        const ehMaiorIdade = document.getElementById('ehMaiorIdade')?.checked || false;
        
        // Buscar responsável atual
        const responsavelAtual = Array.isArray(respEstudantes)
            ? respEstudantes.find(re => re.id_aluno === idAluno)
            : null;

        if (ehMaiorIdade) {
            // Se é maior de idade, criar responsável com os dados do aluno
            const cpfAluno = (estudante.cpf || document.getElementById('cpf').value).replace(/\D/g, '');
            const nomeAluno = estudante.nome || document.getElementById('name').value;
            const contatoAluno = estudante.contato || document.getElementById('contato').value || '';
            // Endereço removido da tabela ESTUDANTES - usar apenas endereço do responsável
            const enderecoAluno = '';
            
            // Verificar se já existe responsável com esse CPF
            let responsavelExistente = responsaveis.find(r => {
                const cpfResp = (r.cpf || '').replace(/\D/g, '');
                return cpfResp === cpfAluno;
            });
            
            let idResponsavel;
            
            if (!responsavelExistente) {
                // Criar novo responsável com dados do aluno
                const novoResponsavel = await API_CONFIG.post('responsaveis', {
                    nome_responsavel: nomeAluno,
                    cpf_responsavel: cpfAluno,
                    contato_responsavel: contatoAluno.replace(/\D/g, ''),
                    endereco_responsavel: enderecoAluno
                });
                idResponsavel = novoResponsavel.id_responsavel || novoResponsavel.id;
            } else {
                idResponsavel = responsavelExistente.id;
            }
            
            // Se já existe relação, verificar se precisa atualizar
            if (responsavelAtual) {
                if (responsavelAtual.id_responsavel !== idResponsavel) {
                    // Remover relação antiga
                    try {
                        await API_CONFIG.delete(`resp-estudantes/${responsavelAtual.id_responsavel}-${idAluno}`);
                    } catch (error) {
                        console.warn('Erro ao remover relação antiga:', error);
                    }
                    
                    // Criar nova relação
                    try {
                        await API_CONFIG.post('resp-estudantes', {
                            id_responsavel: idResponsavel,
                            id_aluno: idAluno
                        });
                    } catch (error) {
                        console.warn('Erro ao criar relação:', error);
                    }
                }
            } else {
                // Criar nova relação
                try {
                    await API_CONFIG.post('resp-estudantes', {
                        id_responsavel: idResponsavel,
                        id_aluno: idAluno
                    });
                } catch (error) {
                    console.warn('Erro ao criar relação:', error);
                }
            }
        } else {
            // Se não é maior de idade, usar dados do formulário de responsável
            const responsavelNome = document.getElementById('responsavelNome')?.value.trim() || '';
            const responsavelCpfRaw = document.getElementById('responsavelCpf')?.value.replace(/\D/g, '') || '';
            const responsavelContatoRaw = document.getElementById('responsavelContato')?.value.replace(/\D/g, '') || '';
            const responsavelEndereco = document.getElementById('responsavelEndereco')?.value.trim() || '';
            
            if (!responsavelNome || !responsavelCpfRaw) {
                // Se não preencheu responsável e não é maior, remover relação existente se houver
                if (responsavelAtual) {
                    try {
                        await API_CONFIG.delete(`resp-estudantes/${responsavelAtual.id_responsavel}-${idAluno}`);
                    } catch (error) {
                        console.warn('Erro ao remover relação:', error);
                    }
                }
                return;
            }
            
            // Verificar se já existe responsável com esse CPF
            let responsavelExistente = responsaveis.find(r => {
                const cpfResp = (r.cpf || '').replace(/\D/g, '');
                return cpfResp === responsavelCpfRaw;
            });
            
            let idResponsavel;
            
            if (!responsavelExistente) {
                // Criar novo responsável
                const novoResponsavel = await API_CONFIG.post('responsaveis', {
                    nome_responsavel: responsavelNome,
                    cpf_responsavel: responsavelCpfRaw,
                    contato_responsavel: responsavelContatoRaw,
                    endereco_responsavel: responsavelEndereco
                });
                idResponsavel = novoResponsavel.id_responsavel || novoResponsavel.id;
            } else {
                idResponsavel = responsavelExistente.id;
                
                // Atualizar dados do responsável se necessário
                if (responsavelNome !== responsavelExistente.nome || 
                    responsavelEndereco !== responsavelExistente.endereco ||
                    responsavelContatoRaw !== (responsavelExistente.contato || '').replace(/\D/g, '')) {
                    try {
                        await API_CONFIG.put(`responsaveis/${idResponsavel}`, {
                            nome_responsavel: responsavelNome,
                            cpf_responsavel: responsavelCpfRaw,
                            contato_responsavel: responsavelContatoRaw,
                            endereco_responsavel: responsavelEndereco
                        });
                    } catch (error) {
                        console.warn('Erro ao atualizar responsável:', error);
                    }
                }
            }
            
            // Se já existe relação, verificar se precisa atualizar
            if (responsavelAtual) {
                if (responsavelAtual.id_responsavel !== idResponsavel) {
                    // Remover relação antiga
                    try {
                        await API_CONFIG.delete(`resp-estudantes/${responsavelAtual.id_responsavel}-${idAluno}`);
                    } catch (error) {
                        console.warn('Erro ao remover relação antiga:', error);
                    }
                    
                    // Criar nova relação
                    try {
                        await API_CONFIG.post('resp-estudantes', {
                            id_responsavel: idResponsavel,
                            id_aluno: idAluno
                        });
                    } catch (error) {
                        console.warn('Erro ao criar relação:', error);
                    }
                }
            } else {
                // Criar nova relação
                try {
                    await API_CONFIG.post('resp-estudantes', {
                        id_responsavel: idResponsavel,
                        id_aluno: idAluno
                    });
                } catch (error) {
                    console.warn('Erro ao criar relação:', error);
                }
            }
        }
    }

    async function gerenciarNecessidadesEstudante(cpfEstudante, necessidadesSelecionadas) {
        if (!cpfEstudante) return;

        // Buscar necessidades atuais do estudante
        const cpfLimpo = cpfEstudante.replace(/\D/g, '');
        const necessidadesAtuais = Array.isArray(estudantesNecessidades)
            ? estudantesNecessidades
                .filter(en => {
                    const cpfRelacao = en.estudante_cpf ? en.estudante_cpf.replace(/\D/g, '') : '';
                    return cpfRelacao === cpfLimpo;
                })
                .map(en => en.necessidade_id)
            : [];

        const necessidadeSelecionada = necessidadesSelecionadas.length > 0 ? necessidadesSelecionadas[0] : null;

        // Se há uma necessidade selecionada
        if (necessidadeSelecionada) {
            // Se já existe essa necessidade, não fazer nada
            if (necessidadesAtuais.includes(necessidadeSelecionada)) {
                // Se há outras necessidades além da selecionada, remover as outras
                const outrasNecessidades = necessidadesAtuais.filter(id => id !== necessidadeSelecionada);
                for (const necessidadeId of outrasNecessidades) {
                    try {
                        await API_CONFIG.delete(`estudantes-necessidades/${cpfLimpo}-${necessidadeId}`);
                    } catch (error) {
                        console.warn('Erro ao remover necessidade:', error);
                    }
                }
            } else {
                // Remover todas as necessidades antigas e adicionar a nova
                for (const necessidadeId of necessidadesAtuais) {
                    try {
                        await API_CONFIG.delete(`estudantes-necessidades/${cpfLimpo}-${necessidadeId}`);
                    } catch (error) {
                        console.warn('Erro ao remover necessidade:', error);
                    }
                }
                
                // Adicionar a nova necessidade
                try {
                    await API_CONFIG.post('estudantes-necessidades', {
                        estudante_cpf: cpfLimpo,
                        necessidade_id: necessidadeSelecionada
                    });
                } catch (error) {
                    console.warn('Erro ao adicionar necessidade:', error);
                }
            }
        } else {
            // Se nenhuma necessidade foi selecionada, remover todas
            for (const necessidadeId of necessidadesAtuais) {
                try {
                    await API_CONFIG.delete(`estudantes-necessidades/${cpfLimpo}-${necessidadeId}`);
                } catch (error) {
                    console.warn('Erro ao remover necessidade:', error);
                }
            }
        }
    }

    function loadStudentsTable() {
        studentsTableBody.innerHTML = '';
        
        const studentsWithData = getStudentsWithMatricula();
        
        if (studentsWithData.length === 0) {
            studentsTableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-state">
                        <i class="fas fa-user-graduate"></i>
                        <h3>Nenhum estudante cadastrado</h3>
                        <p>Clique em "Novo Estudante" para começar</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        studentsWithData.forEach(student => {
            const necessidadesTexto = student.necessidades && student.necessidades.length > 0
                ? student.necessidades.join(', ')
                : 'Nenhuma';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${student.name}</td>
                <td class="cpf-input">${student.cpf}</td>
                <td>${student.matricula || 'N/A'}</td>
                <td>${student.curso || 'N/A'}</td>
                <td>${student.contato || 'N/A'}</td>
                <td>${student.responsavel || 'N/A'}</td>
                <td><span class="badge" title="${necessidadesTexto}">${student.necessidades && student.necessidades.length > 0 ? student.necessidades.length + ' necessidade(s)' : 'Nenhuma'}</span></td>
                <td><span class="badge ${student.psychopedagogical ? 'sim' : 'não'}">${student.psychopedagogical ? 'Sim' : 'Não'}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editStudent(${student.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteStudent(${student.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            studentsTableBody.appendChild(row);
        });
    }

    function setupFilters() {
        // Filtros simplificados - apenas psicopedagógico
    }

    function applyFilters() {
        showToast('Filtros aplicados!', 'info');
    }

    function clearFilters() {
        const filterSelects = document.querySelectorAll('.filter-item select');
        filterSelects.forEach(select => select.value = 'all');
        loadStudentsTable();
        showToast('Filtros limpos!', 'info');
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }

    // Global functions for buttons
    window.editStudent = function(id) {
        const studentsWithData = getStudentsWithMatricula();
        const student = studentsWithData.find(s => s.id === id);
        if (student) openStudentModal(student);
    };

    window.deleteStudent = async function(id) {
        if (confirm('Tem certeza que deseja excluir este estudante?')) {
            try {
                await API_CONFIG.delete(`estudantes/${id}`);
                showToast('Estudante excluído com sucesso!', 'success');
                await loadData();
                loadStudentsTable();
            } catch (error) {
                console.error('Erro ao excluir estudante:', error);
                showToast(error.message || 'Erro ao excluir estudante', 'error');
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
