<?php

require_once "models/class.PeiAdaptacao.php";
require_once "lib/class.PeiAdaptacaoDAO.php";
require_once "interface.Controller.php";

class PeiAdaptacaoController implements Controller {
    private $dao;

    function __construct() { $this->dao = new PeiAdaptacaoDAO(); }

    function getTodos(){
        return $this->dao->buscarTodos();
    }

    function getPorId($id) {
        return $this->dao->buscarPorId($id);
    }
    
    function criar() {
        // Aceitar tanto POST quanto JSON
        $dados = !empty($_POST) ? $_POST : json_decode(file_get_contents('php://input'), true);
        
        require_once "lib/class.ServidorDAO.php";
        $servidorDAO = new ServidorDAO();
        
        // Pegar o SIAPE do professor logado (se disponível no header ou dados)
        // Se não vier, usar o campo docente para buscar o SIAPE
        $professor_siape = null;
        
        // Primeiro tentar validar o siape enviado
        if (isset($dados['professor_siape']) && !empty($dados['professor_siape'])) {
            $siape_enviado = intval($dados['professor_siape']);
            // Verificar se o siape existe na tabela SERVIDORES
            $servidor = $servidorDAO->buscarPorId($siape_enviado);
            if ($servidor && $servidor->getTipo() === 'Docente') {
                $professor_siape = $siape_enviado;
            }
        }
        
        // Se não validou, tentar buscar pelo nome do docente
        if (!$professor_siape && isset($dados['docente']) && !empty($dados['docente'])) {
            $servidores = $servidorDAO->buscarTodos();
            foreach ($servidores as $s) {
                if ($s->getNome() === $dados['docente'] && $s->getTipo() === 'Docente') {
                    $professor_siape = $s->getSiape();
                    break;
                }
            }
        }
        
        // Se ainda não encontrou, usar o primeiro docente como padrão
        if (!$professor_siape) {
            $servidores = $servidorDAO->buscarTodos();
            foreach ($servidores as $s) {
                if ($s->getTipo() === 'Docente') {
                    $professor_siape = $s->getSiape();
                    break;
                }
            }
        }
        
        // Se ainda não encontrou, lançar erro
        if (!$professor_siape) {
            throw new Exception("Professor não identificado. É necessário ter pelo menos um docente cadastrado no sistema.");
        }
        
        $p = new PeiAdaptacao();
        $p->setPeiGeralId(intval($dados['pei_geral_id'] ?? $dados['pei_geral_id'] ?? 0));
        $p->setCodigoComponente(intval($dados['codigo_componente'] ?? $dados['codigo_componente'] ?? 0));
        $p->setProfessorSiape($professor_siape);
        $p->setEmenta($dados['ementa'] ?? $dados['ementa'] ?? '');
        $p->setObjetivosEspecificos($dados['objetivos_especificos'] ?? $dados['objetivos_especificos'] ?? '');
        $p->setMetodologia($dados['metodologia'] ?? $dados['metodologia'] ?? '');
        $p->setAvaliacao($dados['avaliacao'] ?? $dados['avaliacao'] ?? '');
        $p->setParecer($dados['parecer'] ?? $dados['parecer'] ?? '');
        $p->setStatus($dados['status'] ?? 'rascunho');
        $p->setComentariosNapne($dados['comentarios_napne'] ?? $dados['comentarios_napne'] ?? '');
        $p->setDocente($dados['docente'] ?? $dados['docente'] ?? ''); 
        return $this->dao->inserir($p);
    }

    function editar($id) {
        $dados = json_decode(file_get_contents('php://input'), true);
        
        // Função auxiliar para converter data ISO para formato MySQL
        $converterDataParaMySQL = function($dataISO) {
            if (empty($dataISO) || $dataISO === null) {
                return null;
            }
            
            // Se já está no formato MySQL (YYYY-MM-DD HH:MM:SS), retornar como está
            if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $dataISO)) {
                return $dataISO;
            }
            
            // Tentar converter de ISO 8601 (YYYY-MM-DDTHH:MM:SS.sssZ) para MySQL
            try {
                $timestamp = strtotime($dataISO);
                if ($timestamp !== false) {
                    return date('Y-m-d H:i:s', $timestamp);
                }
            } catch (Exception $e) {
                error_log("Erro ao converter data: " . $e->getMessage());
            }
            
            // Se não conseguir converter, retornar null
            return null;
        };
        
        // Buscar o PEI existente para manter o professor_siape se não vier nos dados
        $peiExistente = $this->dao->buscarPorId($id);
        $professor_siape = $peiExistente ? $peiExistente->getProfessorSiape() : null;
        
        // Se vier nos dados, usar
        if (isset($dados['professor_siape']) && !empty($dados['professor_siape'])) {
            $professor_siape = intval($dados['professor_siape']);
        }
        
        $p = new PeiAdaptacao();
        $p->setPeiGeralId(intval($dados['pei_geral_id'] ?? 0));
        $p->setCodigoComponente(intval($dados['codigo_componente'] ?? 0));
        if ($professor_siape) {
            $p->setProfessorSiape($professor_siape);
        }
        $p->setEmenta($dados['ementa'] ?? '');
        $p->setObjetivosEspecificos($dados['objetivos_especificos'] ?? '');
        $p->setMetodologia($dados['metodologia'] ?? '');
        $p->setAvaliacao($dados['avaliacao'] ?? '');
        $p->setParecer($dados['parecer'] ?? '');
        $p->setStatus($dados['status'] ?? $peiExistente->getStatus() ?? 'rascunho');
        $p->setComentariosNapne($dados['comentarios_napne'] ?? '');
        
        // Converter datas para formato MySQL se vierem em formato ISO
        $dataEnvioNapne = $dados['data_envio_napne'] ?? $peiExistente->getDataEnvioNapne() ?? null;
        $p->setDataEnvioNapne($converterDataParaMySQL($dataEnvioNapne));
        
        $dataRespostaNapne = $dados['data_resposta_napne'] ?? $peiExistente->getDataRespostaNapne() ?? null;
        $p->setDataRespostaNapne($converterDataParaMySQL($dataRespostaNapne));
        
        $p->setDocente($dados['docente'] ?? ''); // Manter para compatibilidade
        return $this->dao->editar($id, $p);
    }

    function apagar($id) {
        return $this->dao->apagar($id);
    }
}

?>