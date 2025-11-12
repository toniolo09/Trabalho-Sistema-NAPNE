// Configuração simples da API
// Centraliza todas as chamadas HTTP para o backend
const API_CONFIG = {
    // Detectar automaticamente a base URL da API
    baseURL: (function() {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port ? ':' + window.location.port : '';
        const path = window.location.pathname;
        let basePath = path;
        
        // Se estiver em /web/, a API está no diretório pai
        if (path.includes('/web/')) {
            basePath = path.split('/web/')[0];
        } else if (path.includes('/web')) {
            basePath = path.replace('/web', '');
        }
        
        // Remover nome do arquivo HTML se existir
        if (basePath.includes('.')) {
            const lastSlash = basePath.lastIndexOf('/');
            if (lastSlash >= 0) {
                basePath = basePath.substring(0, lastSlash + 1);
            } else {
                basePath = '/';
            }
        }
        
        // Garantir que termina com /
        if (!basePath.endsWith('/')) {
            basePath += '/';
        }
        
        const url = `${protocol}//${hostname}${port}${basePath}`;
        console.log('API Base URL detectada:', url);
        return url;
    })(),
    
    // Obter token do localStorage
    getToken() {
        const userData = localStorage.getItem('currentUser');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                return user.token || null;
            } catch (e) {
                return null;
            }
        }
        return null;
    },
    
    // Função simples para fazer requisições
    async request(endpoint, method = 'GET', data = null) {
        const url = this.baseURL + endpoint;
        const token = this.getToken();
        
        const headers = {
            'Content-Type': 'application/json',
        };
        
        // Adicionar token se existir (exceto para login)
        if (token && !endpoint.includes('auth/login')) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            // Criar AbortController para timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout
            
            const response = await fetch(url, {
                method: method,
                headers: headers,
                body: data ? JSON.stringify(data) : null,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const text = await response.text();
            
            // Se não foi OK, tratar como erro
            if (!response.ok) {
                let errorMessage = `Erro ${response.status}: Erro na requisição`;
                try {
                    if (text && text.trim().startsWith('{')) {
                        const json = JSON.parse(text);
                        errorMessage = json.error || errorMessage;
                    } else if (text.trim()) {
                        errorMessage = text.trim();
                    } else {
                        errorMessage = `Erro ${response.status}: ${response.statusText || 'Erro na requisição'}`;
                    }
                } catch (e) {
                    errorMessage = text.trim() || `Erro ${response.status}: Erro na requisição`;
                }
                const error = new Error(errorMessage);
                error.status = response.status;
                throw error;
            }
            
            // Se resposta vazia, retornar null
            if (!text || !text.trim()) {
                return null;
            }
            
            // Tentar parse JSON
            try {
                return JSON.parse(text.trim());
            } catch (e) {
                // Se não for JSON válido, retornar null (não quebrar)
                console.warn('Resposta não é JSON válido para:', endpoint);
                return null;
            }
            
        } catch (error) {
            // Se for erro de aborto (timeout), retornar erro específico
            if (error.name === 'AbortError') {
                console.warn('Requisição cancelada por timeout:', endpoint);
                throw new Error('Tempo de espera excedido. Verifique se o servidor está rodando.');
            }
            
            // Se for erro de rede ou outro erro, formatar mensagem
            if (error.message) {
                throw error;
            } else {
                throw new Error(`Erro ${response?.status || 'desconhecido'}: Erro na requisição`);
            }
        }
    },
    
    // Métodos auxiliares simplificados
    async get(endpoint) {
        try {
            const result = await this.request(endpoint, 'GET');
            return result || [];
        } catch (error) {
            console.error('Erro ao buscar:', endpoint, error.message);
            // Se for erro de conexão com banco, retornar array vazio silenciosamente
            if (error.message && (error.message.includes('MySQL') || error.message.includes('banco de dados') || error.message.includes('conectar'))) {
                console.warn('MySQL não está rodando. Retornando dados vazios.');
                return [];
            }
            return [];
        }
    },
    
    async post(endpoint, data) {
        try {
            return await this.request(endpoint, 'POST', data);
        } catch (error) {
            console.error('Erro ao criar:', endpoint, error.message);
            throw error;
        }
    },
    
    async put(endpoint, data) {
        try {
            return await this.request(endpoint, 'PUT', data);
        } catch (error) {
            console.error('Erro ao atualizar:', endpoint, error.message);
            throw error;
        }
    },
    
    async delete(endpoint) {
        try {
            return await this.request(endpoint, 'DELETE');
        } catch (error) {
            console.error('Erro ao excluir:', endpoint, error.message);
            throw error;
        }
    }
};
