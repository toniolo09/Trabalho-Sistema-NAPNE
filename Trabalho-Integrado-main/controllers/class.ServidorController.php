<?php

require_once "models/class.Servidor.php";
require_once "lib/class.ServidorDAO.php";
require_once "interface.Controller.php";

class ServidorController implements Controller {
    private $dao;

    function __construct() { $this->dao = new ServidorDAO(); }

    function getTodos(){
        return $this->dao->buscarTodos();
    }

    function getPorId($id) {
        return $this->dao->buscarPorId($id);
    }
    
    function criar() {
        // Aceitar tanto POST quanto JSON
        $dados = !empty($_POST) ? $_POST : json_decode(file_get_contents('php://input'), true);
        
        if (!$dados) {
            throw new Exception('Dados inválidos');
        }
        
        // Validar campos obrigatórios
        if (empty($dados['siape']) || empty($dados['nome']) || empty($dados['email']) || empty($dados['cpf']) || empty($dados['tipo'])) {
            throw new Exception('Campos obrigatórios: SIAPE, Nome, Email, CPF e Tipo');
        }
        
        $s = new Servidor();
        $cpf = str_replace(['.', '-'], '', $dados['cpf'] ?? '');
        $siape = intval($dados['siape'] ?? 0);
        $tipo = strtolower($dados['tipo'] ?? $dados['type'] ?? '');
        
        // Normalizar tipo para corresponder ao ENUM: 'Docente', 'CAE', 'NAPNE'
        $tipoNormalizado = 'CAE';
        if ($tipo === 'docente' || $tipo === 'professor') {
            $tipoNormalizado = 'Docente';
        } elseif ($tipo === 'napne') {
            $tipoNormalizado = 'NAPNE';
        } elseif ($tipo === 'cae') {
            $tipoNormalizado = 'CAE';
        }
        
        $s->setSiape($siape);
        $s->setCpf($cpf);
        $s->setNome($dados['nome'] ?? $dados['name'] ?? '');
        $s->setEmail($dados['email'] ?? '');
        $s->setTelefone($dados['telefone'] ?? $dados['phone'] ?? '');
        $s->setTipo($tipoNormalizado);
        
        try {
            $servidorCriado = $this->dao->inserir($s);
            
            // Se for Docente ou NAPNE, criar usuário automaticamente
            if ($tipoNormalizado === 'Docente' || $tipoNormalizado === 'NAPNE') {
                try {
                    require_once "lib/class.UsuarioDAO.php";
                    require_once "models/class.Usuario.php";
                    $usuarioDAO = new UsuarioDAO();
                    
                    // Verificar se já existe usuário para este SIAPE
                    $usuarioExistente = $usuarioDAO->buscarPorId($siape);
                    if (!$usuarioExistente) {
                        // Criar usuário automaticamente
                        $usuario = new Usuario();
                        $usuario->setSiape($siape);
                        
                        // Username será o email do servidor
                        $username = strtolower(trim($dados['email'] ?? ''));
                        // Se o email estiver vazio, usar o CPF como username
                        if (empty($username)) {
                            $username = $cpf;
                        }
                        
                        // Senha padrão: CPF do servidor (sem formatação)
                        $senhaPadrao = $cpf;
                        
                        $usuario->setUsername($username);
                        $usuario->setSenha($senhaPadrao);
                        
                        try {
                            $usuarioDAO->inserir($usuario);
                            error_log("Usuário criado automaticamente para servidor SIAPE $siape (Tipo: $tipoNormalizado) - Username: $username, Senha padrão: CPF");
                        } catch (Exception $e) {
                            // Se der erro ao criar usuário, logar mas não falhar (servidor já foi criado)
                            error_log("Erro ao criar usuário automaticamente para SIAPE $siape: " . $e->getMessage());
                            // Não lançar exceção para não reverter a criação do servidor
                        }
                    }
                } catch (Exception $e) {
                    error_log("Erro ao tentar criar usuário automaticamente para servidor SIAPE $siape: " . $e->getMessage());
                    // Não lançar exceção para não reverter a criação do servidor
                }
            }
            
            return $servidorCriado;
        } catch (PDOException $e) {
            // Verificar se é erro de duplicata
            if (strpos($e->getMessage(), 'Duplicate entry') !== false || $e->getCode() == 23000) {
                if (strpos($e->getMessage(), 'cpf') !== false) {
                    throw new Exception('CPF já cadastrado!');
                }
                if (strpos($e->getMessage(), 'email') !== false) {
                    throw new Exception('Email já cadastrado!');
                }
                if (strpos($e->getMessage(), 'siape') !== false) {
                    throw new Exception('SIAPE já cadastrado!');
                }
                throw new Exception('Dados duplicados. Verifique CPF, Email ou SIAPE.');
            }
            throw new Exception('Erro ao salvar servidor: ' . $e->getMessage());
        }
    }

    function editar($id) {
        $dados = json_decode(file_get_contents('php://input'), true);
        
        if (!$dados) {
            throw new Exception('Dados inválidos');
        }
        
        // Validar campos obrigatórios
        if (empty($dados['nome']) || empty($dados['email']) || empty($dados['cpf']) || empty($dados['tipo'])) {
            throw new Exception('Campos obrigatórios: Nome, Email, CPF e Tipo');
        }
        
        $tipo = strtolower($dados['tipo'] ?? $dados['type'] ?? '');
        
        // Normalizar tipo para corresponder ao ENUM: 'Docente', 'CAE', 'NAPNE'
        $tipoNormalizado = 'CAE';
        if ($tipo === 'docente' || $tipo === 'professor') {
            $tipoNormalizado = 'Docente';
        } elseif ($tipo === 'napne') {
            $tipoNormalizado = 'NAPNE';
        } elseif ($tipo === 'cae') {
            $tipoNormalizado = 'CAE';
        }
        
        $s = new Servidor();
        $cpf = str_replace(['.', '-'], '', $dados['cpf'] ?? '');
        $s->setCpf($cpf);
        $s->setNome($dados['nome'] ?? $dados['name'] ?? '');
        $s->setEmail($dados['email'] ?? '');
        $s->setTelefone($dados['telefone'] ?? $dados['phone'] ?? '');
        $s->setTipo($tipoNormalizado);
        
        try {
            $servidorAtualizado = $this->dao->editar($id, $s);
            
            // Se for Docente ou NAPNE, garantir que existe usuário
            if ($tipoNormalizado === 'Docente' || $tipoNormalizado === 'NAPNE') {
                try {
                    require_once "lib/class.UsuarioDAO.php";
                    require_once "models/class.Usuario.php";
                    $usuarioDAO = new UsuarioDAO();
                    
                    // Verificar se já existe usuário para este SIAPE
                    $usuarioExistente = $usuarioDAO->buscarPorId($id);
                    if (!$usuarioExistente) {
                        // Criar usuário automaticamente
                        $usuario = new Usuario();
                        $usuario->setSiape($id);
                        
                        // Username será o email do servidor
                        $username = strtolower(trim($dados['email'] ?? ''));
                        // Se o email estiver vazio, usar o CPF como username
                        if (empty($username)) {
                            $username = $cpf;
                        }
                        
                        // Senha padrão: CPF do servidor (sem formatação)
                        $senhaPadrao = $cpf;
                        
                        $usuario->setUsername($username);
                        $usuario->setSenha($senhaPadrao);
                        
                        try {
                            $usuarioDAO->inserir($usuario);
                            error_log("Usuário criado automaticamente para servidor SIAPE $id (Tipo: $tipoNormalizado) - Username: $username, Senha padrão: CPF");
                        } catch (Exception $e) {
                            // Se der erro ao criar usuário, logar mas não falhar
                            error_log("Erro ao criar usuário automaticamente para SIAPE $id: " . $e->getMessage());
                        }
                    }
                } catch (Exception $e) {
                    error_log("Erro ao tentar criar usuário automaticamente para servidor SIAPE $id: " . $e->getMessage());
                    // Não lançar exceção para não reverter a atualização do servidor
                }
            }
            
            return $servidorAtualizado;
        } catch (PDOException $e) {
            // Verificar se é erro de duplicata
            if (strpos($e->getMessage(), 'Duplicate entry') !== false || $e->getCode() == 23000) {
                if (strpos($e->getMessage(), 'cpf') !== false) {
                    throw new Exception('CPF já cadastrado!');
                }
                if (strpos($e->getMessage(), 'email') !== false) {
                    throw new Exception('Email já cadastrado!');
                }
                throw new Exception('Dados duplicados. Verifique CPF ou Email.');
            }
            throw new Exception('Erro ao atualizar servidor: ' . $e->getMessage());
        }
    }

    function apagar($id) {
        // Antes de deletar o servidor, deletar o usuário associado (se existir)
        try {
            require_once "lib/class.UsuarioDAO.php";
            $usuarioDAO = new UsuarioDAO();
            
            // Tentar buscar e deletar o usuário associado ao SIAPE
            try {
                $usuario = $usuarioDAO->buscarPorId($id);
                if ($usuario) {
                    $usuarioDAO->apagar($id);
                    error_log("Usuário deletado antes de deletar servidor: SIAPE $id");
                }
            } catch (Exception $e) {
                // Se não encontrar usuário ou der erro, apenas logar e continuar
                error_log("Usuário não encontrado ou erro ao deletar usuário para SIAPE $id: " . $e->getMessage());
            }
        } catch (Exception $e) {
            error_log("Erro ao tentar deletar usuário antes de deletar servidor: " . $e->getMessage());
            // Continuar mesmo se der erro ao deletar usuário
        }
        
        // Agora deletar o servidor
        return $this->dao->apagar($id);
    }
}

?>