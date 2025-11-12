// Incluir o script de configuração da API antes deste arquivo
document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('container');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const toast = document.getElementById('toast');

    // Verificar se já está logado APENAS na página de login (index.html)
    // Não redirecionar em outras páginas - cada página tem sua própria verificação
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage === 'index.html' || currentPage === '' || currentPage === 'web/' || currentPage === 'web') {
        const currentUserStr = localStorage.getItem('currentUser');
        if (currentUserStr) {
            try {
                const currentUser = JSON.parse(currentUserStr);
                if (currentUser && currentUser.token) {
                    // Normalizar tipo para comparação
                    const tipo = currentUser.tipo ? currentUser.tipo.toUpperCase() : '';
                    
                    // Redirecionar apenas se estiver na página de login
                    if (tipo === 'DOCENTE') {
                        window.location.replace('professor-dashboard.html');
                        return;
                    } else {
                        window.location.replace('dashboard.html');
                        return;
                    }
                }
            } catch (e) {
                // Ignorar erro de parse
            }
        }
    }

    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        container.classList.add('active');
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        container.classList.remove('active');
    });

    // Toggle senha
    setupPasswordToggle('toggleLoginPassword', 'login-password');
    setupPasswordToggle('toggleRegPassword', 'reg-password');

    function setupPasswordToggle(toggleId, inputId) {
        const toggle = document.getElementById(toggleId);
        const input = document.getElementById(inputId);

        if (toggle && input) {
            toggle.addEventListener('click', function() {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                this.querySelector('i').classList.toggle('fa-eye');
                this.querySelector('i').classList.toggle('fa-eye-slash');
            });
        }
    }

    // Registro - Usando backend
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;
        const userType = document.getElementById('reg-user-type').value;

        let isValid = true;

        if (username.length === 0) {
            showError('reg-username-error', 'Por favor, insira um nome de usuário.');
            isValid = false;
        } else {
            hideError('reg-username-error');
        }

        if (password.length === 0) {
            showError('reg-password-error', 'Por favor, insira uma senha.');
            isValid = false;
        } else {
            hideError('reg-password-error');
        }

        if (password !== confirmPassword) {
            showError('reg-confirm-password-error', 'As senhas não coincidem.');
            isValid = false;
        } else {
            hideError('reg-confirm-password-error');
        }

        if (!userType) {
            showError('reg-type-error', 'Por favor, selecione um tipo de usuário.');
            isValid = false;
        } else {
            hideError('reg-type-error');
        }

        if (!isValid) {
            showToast('Por favor, corrija os erros no formulário.', 'error');
            return;
        }

        try {
            // Normalizar tipo de usuário para corresponder ao ENUM do banco: 'Docente', 'CAE', 'NAPNE'
            let tipoNormalizado = 'NAPNE'; // padrão
            const userTypeLower = userType.toLowerCase();
            if (userTypeLower === 'docente' || userTypeLower === 'professor') {
                tipoNormalizado = 'Docente';
            } else if (userTypeLower === 'cae') {
                tipoNormalizado = 'CAE';
            } else if (userTypeLower === 'napne') {
                tipoNormalizado = 'NAPNE';
            }

            // Fazer requisição para o backend
            const response = await fetch(API_CONFIG.baseURL + 'auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    senha: password,
                    tipo: tipoNormalizado,
                    nome: username,
                    email: username + '@napne.local'
                })
            });

            const data = await response.json();

            if (response.ok && data.token) {
                // Normalizar tipo do usuário
                let tipoUsuario = data.tipo || tipoNormalizado;
                if (tipoUsuario.toLowerCase() === 'docente') {
                    tipoUsuario = 'DOCENTE';
                } else if (tipoUsuario.toLowerCase() === 'napne') {
                    tipoUsuario = 'NAPNE';
                } else if (tipoUsuario.toLowerCase() === 'cae') {
                    tipoUsuario = 'CAE';
                }
                
                // Salvar dados do usuário no localStorage
                const userData = {
                    token: data.token,
                    siape: data.siape || '00000000',
                    username: data.username || username,
                    nome: data.nome || username,
                    tipo: tipoUsuario,
                    email: data.email || username + '@napne.local',
                    cpf: data.cpf || ''
                };
                
                localStorage.setItem('currentUser', JSON.stringify(userData));
                showToast(data.message || 'Conta criada com sucesso!', 'success');
                registerForm.reset();
                
                setTimeout(() => {
                    container.classList.remove('active');
                    // Redirecionar baseado no tipo de usuário
                    if (tipoUsuario === 'DOCENTE') {
                        window.location.replace('professor.html');
                    } else {
                        window.location.replace('dashboard.html');
                    }
                }, 2000);
            } else {
                const errorMsg = data.error || 'Erro ao criar conta. Tente novamente.';
                showToast(errorMsg, 'error');
                if (errorMsg.includes('já está em uso') || errorMsg.includes('já existe')) {
                    showError('reg-username-error', errorMsg);
                }
            }
        } catch (error) {
            console.error('Erro ao registrar:', error);
            showToast('Erro ao conectar com o servidor. Tente novamente.', 'error');
            showError('reg-username-error', 'Erro de conexão');
        }
    });

    // Login - Usando backend com JWT
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const loginUserInput = document.getElementById('login-username').value.trim();
        const loginPassInput = document.getElementById('login-password').value;

        let isValid = true;

        if (loginUserInput.length === 0) {
            showError('login-user-error', 'Digite seu usuário');
            isValid = false;
        } else {
            hideError('login-user-error');
        }

        if (loginPassInput.length === 0) {
            showError('login-pass-error', 'Digite sua senha');
            isValid = false;
        } else {
            hideError('login-pass-error');
        }

        if (!isValid) {
            showToast('Por favor, preencha todos os campos.', 'error');
            return;
        }

        try {
            // Fazer requisição para o backend
            const response = await fetch(API_CONFIG.baseURL + 'auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: loginUserInput,
                    senha: loginPassInput
                })
            });

            const data = await response.json();

            if (response.ok && data.token) {
                // Normalizar tipo do usuário
                let tipoUsuario = data.tipo || 'NAPNE';
                if (tipoUsuario.toLowerCase() === 'docente') {
                    tipoUsuario = 'DOCENTE';
                } else if (tipoUsuario.toLowerCase() === 'napne') {
                    tipoUsuario = 'NAPNE';
                } else if (tipoUsuario.toLowerCase() === 'cae') {
                    tipoUsuario = 'CAE';
                }
                
                // Salvar dados do usuário no localStorage
                const userData = {
                    token: data.token,
                    siape: data.siape || '00000000',
                    username: data.username || loginUserInput,
                    nome: data.nome || loginUserInput,
                    tipo: tipoUsuario,
                    email: data.email || loginUserInput + '@napne.local',
                    cpf: data.cpf || ''
                };
                
                localStorage.setItem('currentUser', JSON.stringify(userData));
                showToast('Login realizado com sucesso!', 'success');
                
                setTimeout(() => {
                    // Redirecionar baseado no tipo de usuário usando replace para evitar loop
                    if (tipoUsuario === 'DOCENTE') {
                        window.location.replace('professor.html');
                    } else {
                        window.location.replace('dashboard.html');
                    }
                }, 1000);
            } else {
                const errorMsg = data.error || 'Usuário ou senha incorretos.';
                showToast(errorMsg, 'error');
                showError('login-user-error', errorMsg);
                showError('login-pass-error', ' ');
            }
        } catch (error) {
            console.error('Erro ao fazer login:', error);
            showToast('Erro ao conectar com o servidor. Tente novamente.', 'error');
            showError('login-user-error', 'Erro de conexão');
        }
    });

    function showError(id, message) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
        }
    }

    function hideError(id) {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none';
        }
    }

    function showToast(message, type) {
        if (toast) {
            toast.textContent = message;
            toast.className = 'toast show ' + type;

            setTimeout(() => {
                toast.className = 'toast';
            }, 3000);
        }
    }

    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            const icon = this.parentElement.querySelector('i');
            if (icon) {
                icon.style.color = '#764ba2';
            }
        });

        input.addEventListener('blur', function() {
            const icon = this.parentElement.querySelector('i');
            if (icon) {
                icon.style.color = '#666';
            }
        });
    });
});
