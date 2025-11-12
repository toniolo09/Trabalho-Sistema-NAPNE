<?php

require_once "models/class.PeiGeral.php";
require_once "lib/class.PeiGeralDAO.php";
require_once "interface.Controller.php";

class PeiGeralController implements Controller {
    private $dao;

    function __construct() { $this->dao = new PeiGeralDAO(); }

    function getTodos(){
        return $this->dao->buscarTodos();
    }

    function getPorId($id) {
        return $this->dao->buscarPorId($id);
    }
    
    function getPorProfessor($siape) {
        return $this->dao->buscarPorProfessor($siape);
    }
    
    function criar() {
        // Aceitar tanto POST quanto JSON
        $dados = !empty($_POST) ? $_POST : json_decode(file_get_contents('php://input'), true);
        
        require_once "lib/class.MatriculaDAO.php";
        require_once "lib/class.EstudanteDAO.php";
        require_once "models/class.Matricula.php";
        $matriculaDAO = new MatriculaDAO();
        $estudanteDAO = new EstudanteDAO();
        
        // Buscar id_aluno pela matrícula ou diretamente
        $id_aluno = null;
        $matricula = null;
        $matriculaNum = null;
        
        if (isset($dados['id_aluno']) && !empty($dados['id_aluno'])) {
            $id_aluno = intval($dados['id_aluno']);
            // Buscar matrícula do aluno
            $matriculas = $matriculaDAO->buscarTodos();
            foreach ($matriculas as $m) {
                if ($m->getEstudanteId() == $id_aluno) {
                    $matricula = $m;
                    $matriculaNum = $m->getMatricula();
                    break;
                }
            }
        } elseif (isset($dados['matricula']) && !empty($dados['matricula'])) {
            $matriculaNum = $dados['matricula'];
            $matricula = $matriculaDAO->buscarPorId($matriculaNum);
            if ($matricula) {
                $id_aluno = $matricula->getEstudanteId();
            }
        }
        
        // Se não encontrou matrícula mas tem id_aluno, criar matrícula automaticamente
        if ($id_aluno && !$matricula) {
            // Buscar estudante para validar
            $estudante = $estudanteDAO->buscarPorId($id_aluno);
            if (!$estudante) {
                throw new Exception("Estudante não encontrado.");
            }
            
            // Verificar se há courseId nos dados (pode vir como 'courseId', 'cursoId', 'curso_id' ou 'course_id')
            $cursoId = null;
            if (isset($dados['courseId']) && !empty($dados['courseId'])) {
                $cursoId = intval($dados['courseId']);
            } elseif (isset($dados['cursoId']) && !empty($dados['cursoId'])) {
                $cursoId = intval($dados['cursoId']);
            } elseif (isset($dados['curso_id']) && !empty($dados['curso_id'])) {
                $cursoId = intval($dados['curso_id']);
            } elseif (isset($dados['course_id']) && !empty($dados['course_id'])) {
                $cursoId = intval($dados['course_id']);
            }
            
            // Se não tem cursoId, buscar primeiro curso disponível
            if (!$cursoId) {
                require_once "lib/class.CursoDAO.php";
                $cursoDAO = new CursoDAO();
                $cursos = $cursoDAO->buscarTodos();
                if (count($cursos) > 0) {
                    $cursoId = $cursos[0]->getId(); // Usar primeiro curso disponível
                    error_log("AVISO: Criando matrícula para aluno $id_aluno sem curso especificado. Usando primeiro curso disponível (ID: $cursoId)");
                } else {
                    throw new Exception("Não há cursos cadastrados no sistema. É necessário cadastrar pelo menos um curso antes de criar um PEI.");
                }
            }
            
            // Gerar número de matrícula único se não foi fornecida
            if (!$matriculaNum) {
                $matriculaNum = 'MAT' . str_pad($id_aluno, 6, '0', STR_PAD_LEFT) . date('y');
                
                // Verificar se matrícula já existe e gerar nova se necessário
                $tentativas = 0;
                while ($tentativas < 100) {
                    try {
                        $matriculaExistente = $matriculaDAO->buscarPorId($matriculaNum);
                        if ($matriculaExistente) {
                            // Matrícula existe, gerar nova
                            $matriculaNum = 'MAT' . str_pad($id_aluno, 6, '0', STR_PAD_LEFT) . date('y') . rand(100, 999);
                            $tentativas++;
                        } else {
                            break; // Matrícula não existe, pode usar
                        }
                    } catch (Exception $e) {
                        // Matrícula não existe, pode usar
                        break;
                    }
                }
            }
            
            // Criar matrícula automaticamente
            try {
                $novaMatricula = new Matricula();
                $novaMatricula->setMatricula($matriculaNum);
                $novaMatricula->setEstudanteId($id_aluno);
                $novaMatricula->setCursoId($cursoId);
                $novaMatricula->setAtivo(true);
                $matricula = $matriculaDAO->inserir($novaMatricula);
                $matriculaNum = $matricula->getMatricula();
                error_log("Matrícula criada automaticamente: $matriculaNum para aluno $id_aluno no curso $cursoId");
            } catch (PDOException $e) {
                error_log("Erro ao criar matrícula: " . $e->getMessage());
                throw new Exception("Erro ao criar matrícula para o estudante: " . $e->getMessage());
            }
        }
        
        // Buscar professor_siape do usuário logado ou dos dados
        require_once "lib/class.ServidorDAO.php";
        $servidorDAO = new ServidorDAO();
        $professor_siape = null;
        
        // Primeiro tentar validar o siape enviado
        if (isset($dados['professor_siape']) && !empty($dados['professor_siape'])) {
            $siape_enviado = intval($dados['professor_siape']);
            // Verificar se o siape existe na tabela SERVIDORES e é um docente
            $servidor = $servidorDAO->buscarPorId($siape_enviado);
            if ($servidor && $servidor->getTipo() === 'Docente') {
                $professor_siape = $siape_enviado;
            }
        }
        
        // Se não validou, usar primeiro docente como padrão
        if (!$professor_siape) {
            $servidores = $servidorDAO->buscarTodos();
            foreach ($servidores as $s) {
                if ($s->getTipo() === 'Docente') {
                    $professor_siape = $s->getSiape();
                    break;
                }
            }
        }
        
        if (!$id_aluno) {
            throw new Exception("ID do aluno não encontrado. Verifique se o estudante foi selecionado corretamente.");
        }
        
        if (!$matriculaNum) {
            throw new Exception("Erro: Matrícula não pôde ser criada ou encontrada. Verifique os logs do servidor.");
        }
        
        if (!$professor_siape) {
            throw new Exception("Professor não identificado. É necessário ter pelo menos um docente cadastrado no sistema.");
        }
        
        // Validar campos obrigatórios
        if (empty($dados['objetivo_geral']) && empty($dados['objetivoGeral'])) {
            throw new Exception("Objetivo geral é obrigatório.");
        }
        
        if (empty($dados['conteudos']) && empty($dados['contents'])) {
            throw new Exception("Conteúdos são obrigatórios.");
        }
        
        if (empty($dados['parecer']) && empty($dados['napneOpinion'])) {
            throw new Exception("Parecer do NAPNE é obrigatório.");
        }
        
        $p = new PeiGeral();
        $p->setIdAluno($id_aluno);
        $p->setMatricula($matriculaNum);
        $p->setProfessorSiape($professor_siape);
        $p->setPeriodo($dados['periodo'] ?? $dados['yearSemester'] ?? '');
        // Definir componente curricular (pode vir com diferentes chaves)
        $codigoComponente = null;
        if (isset($dados['codigo_componente']) && $dados['codigo_componente'] !== '') {
            $codigoComponente = intval($dados['codigo_componente']);
        } elseif (isset($dados['codigoComponente']) && $dados['codigoComponente'] !== '') {
            $codigoComponente = intval($dados['codigoComponente']);
        } elseif (isset($dados['subject']) && $dados['subject'] !== '') {
            $codigoComponente = intval($dados['subject']);
        } elseif (isset($dados['subjectId']) && $dados['subjectId'] !== '') {
            $codigoComponente = intval($dados['subjectId']);
        }
        if (!$codigoComponente) {
            throw new Exception("Componente curricular é obrigatório para o PEI.");
        }
        $p->setCodigoComponente($codigoComponente);

        $p->setNecessidadeEspecifica($dados['necessidade_especifica'] ?? $dados['necessidadeEspecifica'] ?? '');
        $p->setObjetivoGeral($dados['objetivo_geral'] ?? $dados['objetivoGeral'] ?? '');
        $p->setConteudos($dados['conteudos'] ?? $dados['contents'] ?? '');
        $p->setParecer($dados['parecer'] ?? $dados['napneOpinion'] ?? '');
        $p->setDificuldades($dados['dificuldades'] ?? '');
        $p->setInteressesHabilidades($dados['interesses_habilidades'] ?? $dados['interessesHabilidades'] ?? '');
        $p->setEstrategias($dados['estrategias'] ?? '');
        $p->setObservacoes($dados['observacoes'] ?? '');
        $p->setHistorico($dados['historico'] ?? '');
        return $this->dao->inserir($p);
    }

    function editar($id) {
        $dados = json_decode(file_get_contents('php://input'), true);
        
        // Buscar PEI existente para manter id_aluno e professor_siape se não vierem nos dados
        $peiExistente = $this->dao->buscarPorId($id);
        $id_aluno = $peiExistente ? $peiExistente->getIdAluno() : null;
        $professor_siape = $peiExistente ? $peiExistente->getProfessorSiape() : null;
        
        // Se vier nos dados, usar
        if (isset($dados['id_aluno']) && !empty($dados['id_aluno'])) {
            $id_aluno = intval($dados['id_aluno']);
        }
        
        if (isset($dados['professor_siape']) && !empty($dados['professor_siape'])) {
            $professor_siape = intval($dados['professor_siape']);
        }
        
        $p = new PeiGeral();
        if ($id_aluno) {
            $p->setIdAluno($id_aluno);
        }
        $p->setMatricula($dados['matricula'] ?? '');
        if ($professor_siape) {
            $p->setProfessorSiape($professor_siape);
        }
        $p->setPeriodo($dados['periodo'] ?? '');
        // Definir componente curricular (manter existente se não vier nos dados)
        $codigoComponente = $peiExistente ? $peiExistente->getCodigoComponente() : null;
        if (isset($dados['codigo_componente']) && $dados['codigo_componente'] !== '') {
            $codigoComponente = intval($dados['codigo_componente']);
        } elseif (isset($dados['codigoComponente']) && $dados['codigoComponente'] !== '') {
            $codigoComponente = intval($dados['codigoComponente']);
        } elseif (isset($dados['subject']) && $dados['subject'] !== '') {
            $codigoComponente = intval($dados['subject']);
        } elseif (isset($dados['subjectId']) && $dados['subjectId'] !== '') {
            $codigoComponente = intval($dados['subjectId']);
        }
        $p->setCodigoComponente($codigoComponente);

        $p->setNecessidadeEspecifica($dados['necessidade_especifica'] ?? $dados['necessidadeEspecifica'] ?? '');
        $p->setObjetivoGeral($dados['objetivo_geral'] ?? $dados['objetivoGeral'] ?? '');
        $p->setConteudos($dados['conteudos'] ?? $dados['conteudos'] ?? '');
        $p->setParecer($dados['parecer'] ?? $dados['parecer'] ?? '');
        $p->setDificuldades($dados['dificuldades'] ?? '');
        $p->setInteressesHabilidades($dados['interesses_habilidades'] ?? '');
        $p->setEstrategias($dados['estrategias'] ?? '');
        $p->setObservacoes($dados['observacoes'] ?? '');
        $p->setHistorico($dados['historico'] ?? '');
        return $this->dao->editar($id, $p);
    }

    function apagar($id) {
        return $this->dao->apagar($id);
    }
}

?>