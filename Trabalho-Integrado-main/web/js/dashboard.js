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
    
    // Permitir acesso se for NAPNE ou CAE (não Docente)
    const tipo = currentUser.tipo ? currentUser.tipo.toUpperCase() : '';
    if (tipo === 'DOCENTE') {
        // Se for docente, redirecionar para dashboard do professor (usar replace para evitar loop)
        window.location.replace('professor.html');
        return;
    }

    // Elementos DOM
    const userWelcome = document.getElementById('user-welcome');
    const totalStudents = document.getElementById('total-students');
    const totalPeis = document.getElementById('total-peis');
    const totalTeachers = document.getElementById('total-teachers');
    const totalCourses = document.getElementById('total-courses');
    const recentPeis = document.getElementById('recent-peis');

    // Dados do backend
    let students = [];
    let teachers = [];
    let courses = [];
    let peisGeral = [];
    let peisAdaptacao = [];

    // Inicialização
    init();

    async function init() {
        setupEventListeners();
        loadUserInfo();
        await loadData();
        loadStats();
        loadRecentPeis();
    }

    async function loadData() {
        try {
            // Carregar todos os dados em paralelo
            // Usar Promise.allSettled para não quebrar se algum falhar
            const results = await Promise.allSettled([
                API_CONFIG.get('estudantes'),
                API_CONFIG.get('cursos'),
                API_CONFIG.get('peis'),
                API_CONFIG.get('adaptacoes'),
                API_CONFIG.get('servidores')
            ]);

            // Processar resultados
            students = results[0].status === 'fulfilled' ? (results[0].value || []) : [];
            courses = results[1].status === 'fulfilled' ? (results[1].value || []) : [];
            peisGeral = results[2].status === 'fulfilled' ? (results[2].value || []) : [];
            peisAdaptacao = results[3].status === 'fulfilled' ? (results[3].value || []) : [];
            const servidores = results[4].status === 'fulfilled' ? (results[4].value || []) : [];

            // Filtrar apenas professores (tipo = 'Docente')
            teachers = Array.isArray(servidores) ? servidores.filter(s => s.tipo === 'Docente' || s.tipo === 'DOCENTE') : [];
            
            // Log de erros se houver
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const endpoints = ['estudantes', 'cursos', 'peis', 'adaptacoes', 'servidores'];
                    console.warn(`Erro ao carregar ${endpoints[index]}:`, result.reason);
                }
            });
        } catch (error) {
            console.error('Erro geral ao carregar dados:', error);
            // Não quebrar a aplicação, apenas inicializar arrays vazios
            students = [];
            teachers = [];
            courses = [];
            peisGeral = [];
            peisAdaptacao = [];
        }
    }

    function setupEventListeners() {
        // Logout
        const logoutBtn = document.getElementById('logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logout);
        }
        
        // Stats cards click events
        setupStatsClickEvents();
    }

    function setupStatsClickEvents() {
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach((card, index) => {
            card.addEventListener('click', () => {
                switch(index) {
                    case 0: // Estudantes
                        window.location.href = 'alunos.html';
                        break;
                    case 1: // PEIs
                        window.location.href = 'peis.html';
                        break;
                    case 2: // Professores
                        window.location.href = 'professores.html';
                        break;
                    case 3: // Cursos
                        window.location.href = 'cursos.html';
                        break;
                }
            });
            
            // Add cursor pointer
            card.style.cursor = 'pointer';
        });
    }

    function loadUserInfo() {
        if (userWelcome) {
            userWelcome.textContent = `Olá, ${currentUser.username || 'Usuário'}!`;
        }
    }

    function loadStats() {
        // Update counters with animation
        animateCounter(totalStudents, students.length);
        animateCounter(totalTeachers, teachers.length);
        animateCounter(totalCourses, courses.length);
        animateCounter(totalPeis, peisGeral.length + peisAdaptacao.length);
    }

    function animateCounter(element, targetValue) {
        if (!element) return;
        
        const startValue = 0;
        const duration = 1000;
        const startTime = performance.now();

        function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOutQuart);
            
            element.textContent = currentValue;
            
            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            } else {
                element.textContent = targetValue;
            }
        }
        
        requestAnimationFrame(updateCounter);
    }

    function loadRecentPeis() {
        if (!recentPeis) return;
        
        // Combinar PEIs gerais e adaptações
        const allPeis = [];
        
        peisGeral.forEach(pei => {
            allPeis.push({
                id: pei.id,
                type: 'geral',
                matricula: pei.matricula,
                data_criacao: pei.data_criacao,
                periodo: pei.periodo
            });
        });
        
        peisAdaptacao.forEach(pei => {
            allPeis.push({
                id: pei.id,
                type: 'adaptacao',
                pei_geral_id: pei.pei_geral_id,
                data_criacao: pei.data_criacao,
                docente: pei.docente
            });
        });
        
        // Sort by creation date (most recent first)
        const recentPeisList = allPeis
            .sort((a, b) => new Date(b.data_criacao) - new Date(a.data_criacao))
            .slice(0, 5);

        if (recentPeisList.length === 0) {
            recentPeis.innerHTML = '<p class="empty-message">Nenhum PEI cadastrado ainda.</p>';
            return;
        }

        recentPeis.innerHTML = '';
        
        recentPeisList.forEach(pei => {
            // Buscar dados do estudante relacionado
            let studentName = 'Estudante não encontrado';
            let subjectName = '';
            
            if (pei.type === 'adaptacao') {
                // Buscar PEI geral relacionado
                const peiGeral = peisGeral.find(p => p.id === pei.pei_geral_id);
                if (peiGeral) {
                    // Buscar matrícula
                    const matricula = peiGeral.matricula;
                    // Buscar estudante pela matrícula
                    // TODO: Melhorar busca quando tiver endpoint de matrículas com estudante
                    subjectName = pei.docente || 'Docente não informado';
                }
            } else {
                subjectName = pei.periodo || 'Período não informado';
            }
            
            const peiItem = document.createElement('div');
            peiItem.className = 'recent-item';
            peiItem.innerHTML = `
                <div class="recent-item-info">
                    <div class="recent-item-title">PEI ${pei.type === 'adaptacao' ? 'Adaptação' : 'Geral'}</div>
                    <div class="recent-item-subtitle">${subjectName}</div>
                    <div class="recent-item-date">${formatDate(pei.data_criacao)}</div>
                </div>
                <div class="status-badge active">Ativo</div>
            `;
            
            // Add click event to view PEI details
            peiItem.addEventListener('click', () => {
                window.location.href = `peis.html?id=${pei.id}`;
            });
            
            recentPeis.appendChild(peiItem);
        });
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            return 'Hoje';
        } else if (diffDays === 2) {
            return 'Ontem';
        } else if (diffDays <= 7) {
            return `${diffDays - 1} dias atrás`;
        } else {
            return date.toLocaleDateString('pt-BR');
        }
    }

    function logout() {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }

    // Auto-refresh stats every 30 seconds (desabilitado temporariamente para evitar travamentos)
    // setInterval(async () => {
    //     await loadData();
    //     loadStats();
    //     loadRecentPeis();
    // }, 30000);
});
