<?php
require_once "class.Banco.php";
require_once "models/class.ComponenteCurricular.php";

class ComponenteCurricularDAO {
    private $pdo;

    function __construct() { $this->pdo = Banco::getConexao(); }

    function buscarTodos() {
        try {
            $sql = "SELECT codigo_componente, componente, carga_horaria, ementa FROM COMPONENTES_CURRICULARES";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute();

            $stmt->setFetchMode(PDO::FETCH_CLASS, ComponenteCurricular::class);
            $componentes = $stmt->fetchAll();

            return $componentes ?: [];
        } catch (PDOException $e) {
            error_log("Erro ao buscar componentes curriculares: " . $e->getMessage());
            throw new Exception("Erro ao buscar componentes curriculares");
        }
    }

    function buscarPorId($id) {
        $sql = "SELECT codigo_componente, componente, carga_horaria, ementa FROM COMPONENTES_CURRICULARES WHERE codigo_componente = :id";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':id' => $id]);

        $stmt->setFetchMode(PDO::FETCH_CLASS, ComponenteCurricular::class);
        $componente = $stmt->fetch();

        return $componente ?: null;
    }

    function inserir(ComponenteCurricular $componente) {
        try {
            // IGNORAR COMPLETAMENTE qualquer codigo_componente que possa estar no objeto
            // Sempre gerar um novo código sequencial válido
            
            // Buscar o maior código atual e incrementar
            $sql = "SELECT MAX(codigo_componente) as max_codigo FROM COMPONENTES_CURRICULARES";
            $stmt = $this->pdo->query($sql);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $codigo = 1; // Valor padrão inicial
            if ($result && isset($result['max_codigo']) && $result['max_codigo'] !== null) {
                $maxCodigo = intval($result['max_codigo']);
                // Validar que o máximo está dentro do range antes de incrementar
                if ($maxCodigo > 0 && $maxCodigo < 2147483647) {
                    $codigo = $maxCodigo + 1;
                } elseif ($maxCodigo >= 2147483647) {
                    // Se o máximo já está no limite, buscar um código disponível menor
                    $codigo = $this->encontrarProximoCodigoDisponivel();
                }
            }
            
            // VALIDAÇÃO FINAL: Garantir que está dentro do range válido de INT SIGNED
            if ($codigo <= 0 || $codigo > 2147483647) {
                throw new Exception("Não é possível gerar um código válido para o componente curricular! Código gerado: $codigo");
            }
            
            // NUNCA usar getCodigoComponente() do objeto - sempre usar o código gerado
            $sql = "INSERT INTO COMPONENTES_CURRICULARES(codigo_componente, componente, carga_horaria, ementa) VALUES (:codigo_componente, :componente, :carga_horaria, :ementa)";
            $stmt = $this->pdo->prepare($sql);
            $resultado = $stmt->execute([
                ':codigo_componente' => $codigo,
                ':componente' => $componente->getComponente(),
                ':carga_horaria' => $componente->getCargaHoraria(),
                ':ementa' => $componente->getEmenta()
            ]);
            
            if ($resultado) {
                return $this->buscarPorId($codigo);
            }
            
            throw new Exception("Erro ao inserir componente curricular!");
        } catch (PDOException $e) {
            error_log("Erro PDO ao inserir componente curricular: " . $e->getMessage());
            throw new Exception("Erro ao inserir componente curricular");
        }
    }
    
    private function encontrarProximoCodigoDisponivel() {
        // Buscar o menor código disponível começando de 1
        for ($i = 1; $i <= 1000; $i++) {
            $sql = "SELECT codigo_componente FROM COMPONENTES_CURRICULARES WHERE codigo_componente = :codigo";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':codigo' => $i]);
            if (!$stmt->fetch()) {
                return $i;
            }
        }
        // Se não encontrar nos primeiros 1000, retornar o próximo após o máximo
        $sql = "SELECT MAX(codigo_componente) as max_codigo FROM COMPONENTES_CURRICULARES";
        $stmt = $this->pdo->query($sql);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return ($result && $result['max_codigo'] ? intval($result['max_codigo']) + 1 : 1);
    }

    function editar($id, $componente) {
        $c = $this->buscarPorId($id);
        if (!$c) 
            throw new Exception("Componente curricular não encontrado!");

        $sql = "UPDATE COMPONENTES_CURRICULARES SET componente=:componente, carga_horaria=:carga_horaria, ementa=:ementa WHERE codigo_componente=:id";
        $query = $this->pdo->prepare($sql);
        $query->bindValue(':componente', $componente->getComponente());
        $query->bindValue(':carga_horaria', $componente->getCargaHoraria());
        $query->bindValue(':ementa', $componente->getEmenta());
        $query->bindValue(':id', $id);
        if (!$query->execute())
            throw new Exception("Erro ao atualizar registro.");

        $c->setComponente($componente->getComponente());
        $c->setCargaHoraria($componente->getCargaHoraria());
        $c->setEmenta($componente->getEmenta());
        return $c;
    }

    function apagar($id) {
        $componente = $this->buscarPorId($id);
        if (!$componente) 
            throw new Exception("Componente curricular não encontrado!");

        $sql = "DELETE FROM COMPONENTES_CURRICULARES WHERE codigo_componente=:id";
        $query = $this->pdo->prepare($sql);
        $query->bindValue(':id', $id);
        if (!$query->execute())
            throw new Exception("Erro ao apagar registro!");    

        return $componente;
    }
}
?>