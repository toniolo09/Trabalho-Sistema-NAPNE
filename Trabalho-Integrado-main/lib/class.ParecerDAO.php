<?php
require_once "class.Banco.php";
require_once "models/class.Parecer.php";

class ParecerDAO {
    private $pdo;

    function __construct() { $this->pdo = Banco::getConexao(); }

    function buscarTodos() {
        $sql = "
            SELECT p.id, p.pei_adaptacao_id, p.periodo, p.descricao, p.data_criacao, p.comentarios, pa.ementa as pei_adaptacao_ementa 
            FROM PARECERES p 
            INNER JOIN PEI_ADAPTACAO pa ON (p.pei_adaptacao_id = pa.id)
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute();

        $stmt->setFetchMode(PDO::FETCH_CLASS, Parecer::class);
        $pareceres = $stmt->fetchAll();

        return $pareceres ?: [];
    }

    function buscarPorId($id) {
        $sql = "SELECT id, pei_adaptacao_id, periodo, descricao, data_criacao, comentarios FROM PARECERES WHERE id = :id";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':id' => $id]);

        $stmt->setFetchMode(PDO::FETCH_CLASS, Parecer::class);
        $parecer = $stmt->fetch();

        return $parecer ?: null;
    }

    function inserir(Parecer $parecer) {
        $sql = "INSERT INTO PARECERES(pei_adaptacao_id, periodo, descricao, comentarios) VALUES (:pei_adaptacao_id, :periodo, :descricao, :comentarios)";
        $stmt = $this->pdo->prepare($sql);
        $resultado = $stmt->execute([
            ':pei_adaptacao_id' => $parecer->getPeiAdaptacaoId(),
            ':periodo' => $parecer->getPeriodo(),
            ':descricao' => $parecer->getDescricao(),
            ':comentarios' => $parecer->getComentarios()
        ]);

        if ($resultado) {
            $id = $this->pdo->lastInsertId();
            return $this->buscarPorId($id);
        }
    }

    function editar($id, $parecer) {
        $p = $this->buscarPorId($id);
        if (!$p) 
            throw new Exception("Parecer não encontrado!");

        $sql = "UPDATE PARECERES SET pei_adaptacao_id=:pei_adaptacao_id, periodo=:periodo, descricao=:descricao, comentarios=:comentarios WHERE id=:id";
        $query = $this->pdo->prepare($sql);
        $query->bindValue(':pei_adaptacao_id', $parecer->getPeiAdaptacaoId());
        $query->bindValue(':periodo', $parecer->getPeriodo());
        $query->bindValue(':descricao', $parecer->getDescricao());
        $query->bindValue(':comentarios', $parecer->getComentarios());
        $query->bindValue(':id', $id);
        if (!$query->execute())
            throw new Exception("Erro ao atualizar registro.");

        $p->setPeiAdaptacaoId($parecer->getPeiAdaptacaoId());
        $p->setPeriodo($parecer->getPeriodo());
        $p->setDescricao($parecer->getDescricao());
        $p->setComentarios($parecer->getComentarios());
        return $p;
    }

    function apagar($id) {
        $parecer = $this->buscarPorId($id);
        if (!$parecer) 
            throw new Exception("Parecer não encontrado!");

        $sql = "DELETE FROM PARECERES WHERE id=:id";
        $query = $this->pdo->prepare($sql);
        $query->bindValue(':id', $id);
        if (!$query->execute())
            throw new Exception("Erro ao apagar registro!");    

        return $parecer;
    }
}
?>