<?php

require_once "models/class.Estudante.php";
require_once "lib/class.EstudanteDAO.php";
require_once "interface.Controller.php";

class EstudanteController implements Controller {
    private $dao;

    function __construct() { $this->dao = new EstudanteDAO(); }

    function getTodos(){
        return $this->dao->buscarTodos();
    }

    function getPorId($id) {
        return $this->dao->buscarPorId($id);
    }
    
    function criar() {
        // Aceitar tanto POST quanto JSON
        $dados = !empty($_POST) ? $_POST : json_decode(file_get_contents('php://input'), true);
        
        // Matrícula é obrigatória - validar antes de criar
        if (!isset($dados['matricula']) || empty(trim($dados['matricula']))) {
            throw new Exception("Matrícula é obrigatória para cadastrar um estudante.");
        }
        
        if (!isset($dados['courseId']) || empty(trim($dados['courseId']))) {
            throw new Exception("Curso é obrigatório para cadastrar um estudante.");
        }
        
        $matriculaNum = trim($dados['matricula']);
        $cursoId = strval(trim($dados['courseId']));
        
        // Verificar se matrícula já existe na tabela ESTUDANTES ou MATRICULAS
        require_once "lib/class.MatriculaDAO.php";
        $matriculaDAO = new MatriculaDAO();
        try {
            $matriculaExistente = $matriculaDAO->buscarPorId($matriculaNum);
            if ($matriculaExistente) {
                throw new Exception("Matrícula já cadastrada no sistema. Use outro número de matrícula.");
            }
        } catch (Exception $e) {
            // Se não encontrou, continua (é o esperado)
            if (strpos($e->getMessage(), 'já cadastrada') !== false) {
                throw $e; // Re-lançar se for erro de duplicata
            }
        }
        
        $e = new Estudante();
        // Mapear campos do frontend para o backend
        $cpf = str_replace(['.', '-'], '', $dados['cpf'] ?? $dados['cpf'] ?? '');
        $e->setCpf($cpf);
        $e->setNome($dados['nome'] ?? $dados['name'] ?? '');
        $e->setContato($dados['contato'] ?? $dados['phone'] ?? '');
        $e->setMatricula($matriculaNum); // Matrícula agora vai direto na tabela ESTUDANTES
        // Garantir que precisa_atendimento_psicopedagogico seja sempre inteiro (0 ou 1)
        $precisaAtendimento = $dados['precisa_atendimento_psicopedagogico'] ?? $dados['psychopedagogical'] ?? 0;
        // Converter para inteiro: true/1/'1' -> 1, false/0/'0'/''/null -> 0
        $precisaAtendimento = ($precisaAtendimento === true || $precisaAtendimento === 'true' || $precisaAtendimento === '1' || $precisaAtendimento === 1) ? 1 : 0;
        $e->setPrecisaAtendimentoPsicopedagogico($precisaAtendimento);
        
        try {
            $estudante = $this->dao->inserir($e);
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'Duplicate entry') !== false || $e->getCode() == 23000) {
                if (strpos($e->getMessage(), 'matricula') !== false) {
                    throw new Exception("Matrícula já cadastrada no sistema. Use outro número de matrícula.");
                }
                if (strpos($e->getMessage(), 'cpf') !== false) {
                    throw new Exception("CPF já cadastrado no sistema.");
                }
                throw new Exception("Dados duplicados. Verifique CPF ou Matrícula.");
            }
            throw new Exception("Erro ao criar estudante: " . $e->getMessage());
        }
        
        // Criar registro na tabela MATRICULAS também (relaciona com curso)
        require_once "models/class.Matricula.php";
        $m = new Matricula();
        $m->setMatricula($matriculaNum);
        $m->setEstudanteId($estudante->getIdAluno());
        $m->setCursoId($cursoId); // curso_id é VARCHAR(50)
        $m->setAtivo(true);
        
        try {
            $matriculaDAO->inserir($m);
        } catch (PDOException $e) {
            // Se falhar, tentar deletar o estudante criado
            try {
                $this->dao->apagar($estudante->getIdAluno());
            } catch (Exception $e2) {
                error_log("Erro ao remover estudante após falha na criação de matrícula: " . $e2->getMessage());
            }
            
            if (strpos($e->getMessage(), 'Duplicate entry') !== false || $e->getCode() == 23000) {
                throw new Exception("Matrícula já cadastrada no sistema. Use outro número de matrícula.");
            }
            throw new Exception("Erro ao criar matrícula: " . $e->getMessage());
        }
        
        return $estudante;
    }

    function editar($id) {
        $dados = json_decode(file_get_contents('php://input'), true);
        
        // Buscar estudante existente para manter a matrícula se não vier nos dados
        $estudanteExistente = $this->dao->buscarPorId($id);
        if (!$estudanteExistente) {
            throw new Exception("Estudante não encontrado!");
        }
        
        $e = new Estudante();
        $cpf = str_replace(['.', '-'], '', $dados['cpf'] ?? '');
        $e->setCpf($cpf);
        $e->setNome($dados['nome'] ?? $dados['name'] ?? '');
        $e->setContato($dados['contato'] ?? $dados['phone'] ?? '');
        // Manter matrícula existente ou atualizar se vier nos dados
        $matricula = isset($dados['matricula']) && !empty(trim($dados['matricula'])) 
            ? trim($dados['matricula']) 
            : $estudanteExistente->getMatricula();
        $e->setMatricula($matricula);
        // Garantir que precisa_atendimento_psicopedagogico seja sempre inteiro (0 ou 1)
        $precisaAtendimento = $dados['precisa_atendimento_psicopedagogico'] ?? $dados['psychopedagogical'] ?? 0;
        // Converter para inteiro: true/1/'1' -> 1, false/0/'0'/''/null -> 0
        $precisaAtendimento = ($precisaAtendimento === true || $precisaAtendimento === 'true' || $precisaAtendimento === '1' || $precisaAtendimento === 1) ? 1 : 0;
        $e->setPrecisaAtendimentoPsicopedagogico($precisaAtendimento);
        
        try {
            return $this->dao->editar($id, $e);
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'Duplicate entry') !== false || $e->getCode() == 23000) {
                if (strpos($e->getMessage(), 'matricula') !== false) {
                    throw new Exception("Matrícula já cadastrada no sistema. Use outro número de matrícula.");
                }
                if (strpos($e->getMessage(), 'cpf') !== false) {
                    throw new Exception("CPF já cadastrado no sistema.");
                }
                throw new Exception("Dados duplicados. Verifique CPF ou Matrícula.");
            }
            throw $e;
        }
    }

    function apagar($id) {
        // Buscar o estudante antes de apagar para ter o CPF
        $estudante = $this->dao->buscarPorId($id);
        
        if (!$estudante) {
            throw new Exception("Estudante não encontrado!");
        }
        
        // Remover todas as necessidades relacionadas ao estudante
        $cpf = $estudante->getCpf();
        if ($cpf) {
            try {
                require_once "lib/class.EstudanteNecessidadeDAO.php";
                $estudanteNecessidadeDAO = new EstudanteNecessidadeDAO();
                
                // Buscar todas as necessidades do estudante pelo CPF
                $necessidadesDoEstudante = $estudanteNecessidadeDAO->buscarPorCpf($cpf);
                
                // Remover cada relação
                foreach ($necessidadesDoEstudante as $relacao) {
                    $ids = [
                        'estudante_cpf' => $relacao->getEstudanteCpf(),
                        'necessidade_id' => $relacao->getNecessidadeId()
                    ];
                    $estudanteNecessidadeDAO->apagar($ids);
                }
            } catch (Exception $e) {
                error_log("Erro ao remover necessidades do estudante: " . $e->getMessage());
                // Continuar mesmo se houver erro ao remover necessidades
            }
        }
        
        // Remover relação com responsável
        try {
            require_once "lib/class.RespEstudanteDAO.php";
            $respEstudanteDAO = new RespEstudanteDAO();
            
            // Buscar todas as relações do estudante
            $todasRelacoes = $respEstudanteDAO->buscarTodos();
            $relacoesDoEstudante = array_filter($todasRelacoes, function($relacao) use ($id) {
                return $relacao->getIdAluno() == $id;
            });
            
            // Remover cada relação
            foreach ($relacoesDoEstudante as $relacao) {
                $ids = [
                    'id_responsavel' => $relacao->getIdResponsavel(),
                    'id_aluno' => $relacao->getIdAluno()
                ];
                $respEstudanteDAO->apagar($ids);
            }
        } catch (Exception $e) {
            error_log("Erro ao remover relações com responsável: " . $e->getMessage());
            // Continuar mesmo se houver erro
        }
        
        // Agora apagar o estudante
        return $this->dao->apagar($id);
    }
}

?>