<?php

require_once "models/class.Usuario.php";
require_once "lib/class.UsuarioDAO.php";
require_once "interface.Controller.php";

class UsuarioController implements Controller {
    private $dao;

    function __construct() { $this->dao = new UsuarioDAO(); }

    function getTodos(){
        return $this->dao->buscarTodos();
    }

    function getPorId($id) {
        return $this->dao->buscarPorId($id);
    }
    
    function criar() {
        // Aceitar tanto POST quanto JSON
        $dados = !empty($_POST) ? $_POST : json_decode(file_get_contents('php://input'), true);
        
        $u = new Usuario();
        $u->setUsername($dados['username'] ?? '');
        
        // Hash da senha (usar password_hash em produção)
        $senha = $dados['senha'] ?? $dados['password'] ?? '';
        $u->setSenha(password_hash($senha, PASSWORD_DEFAULT));
        
        // Se vier siape, definir; caso contrário, gerar um temporário
        if (isset($dados['siape'])) {
            $u->setSiape($dados['siape']);
        }
        
        return $this->dao->inserir($u);
    }

    function editar($id) {
        $dados = json_decode(file_get_contents('php://input'), true);
        
        if (!$dados) {
            throw new Exception('Dados inválidos');
        }
        
        $u = new Usuario();
        $u->setSiape($id); // Manter o siape original
        $u->setUsername($dados['username'] ?? '');
        
        // Se vier senha, fazer hash; caso contrário, manter a atual
        if (isset($dados['senha']) || isset($dados['password'])) {
            $senha = $dados['senha'] ?? $dados['password'] ?? '';
            $u->setSenha(password_hash($senha, PASSWORD_DEFAULT));
        }
        
        return $this->dao->editar($id, $u);
    }

    function apagar($id) {
        return $this->dao->apagar($id);
    }
}

?>