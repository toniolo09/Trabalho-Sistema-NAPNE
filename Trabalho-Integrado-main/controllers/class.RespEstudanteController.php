<?php

require_once "models/class.RespEstudante.php";
require_once "lib/class.RespEstudanteDAO.php";
require_once "interface.Controller.php";

class RespEstudanteController implements Controller {
    private $dao;

    function __construct() { $this->dao = new RespEstudanteDAO(); }

    function getTodos(){
        return $this->dao->buscarTodos();
    }

    function getPorId($id) {
        // $id é uma string concatenada como "id_responsavel-id_aluno"
        $ids = explode('-', $id);
        $ids_array = ['id_responsavel' => $ids[0], 'id_aluno' => $ids[1]];
        return $this->dao->buscarPorId($ids_array);
    }
    
    function criar() {
        // Aceitar tanto POST quanto JSON
        $dados = !empty($_POST) ? $_POST : json_decode(file_get_contents('php://input'), true);
        
        if (!$dados) {
            throw new Exception('Dados inválidos');
        }
        
        $re = new RespEstudante();
        $re->setIdResponsavel($dados['id_responsavel'] ?? $dados['idResponsavel'] ?? null);
        $re->setIdAluno($dados['id_aluno'] ?? $dados['idAluno'] ?? null);
        return $this->dao->inserir($re);
    }

    function editar($id) {
        // $id é uma string concatenada como "id_responsavel-id_aluno"
        $ids = explode('-', $id);
        $ids_array = ['id_responsavel' => $ids[0], 'id_aluno' => $ids[1]];
        
        $dados = json_decode(file_get_contents('php://input'), true);
        
        if (!$dados) {
            throw new Exception('Dados inválidos');
        }
        
        $re = new RespEstudante();
        $re->setIdResponsavel($dados['id_responsavel'] ?? $dados['idResponsavel'] ?? null);
        $re->setIdAluno($dados['id_aluno'] ?? $dados['idAluno'] ?? null);
        return $this->dao->editar($ids_array, $re);
    }

    function apagar($id) {
        // $id é uma string concatenada como "id_responsavel-id_aluno"
        $ids = explode('-', $id);
        $ids_array = ['id_responsavel' => $ids[0], 'id_aluno' => $ids[1]];
        return $this->dao->apagar($ids_array);
    }
}

?>