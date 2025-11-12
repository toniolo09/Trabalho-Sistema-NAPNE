<?php
require_once "class.Banco.php";
require_once "models/class.Usuario.php";

class UsuarioDAO {
    private $pdo;

    function __construct() { $this->pdo = Banco::getConexao(); }

    function buscarTodos() {
        try {
            // Usar LEFT JOIN para retornar usuários mesmo sem servidor (para evitar erros)
            $sql = "
                SELECT u.siape, u.username, u.senha, s.nome as servidor_nome 
                FROM USUARIOS u 
                LEFT JOIN SERVIDORES s 
                    ON (u.siape = s.siape)
            ";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute();

            $stmt->setFetchMode(PDO::FETCH_CLASS, Usuario::class);
            $usuarios = $stmt->fetchAll();

            return $usuarios ?: [];
        } catch (PDOException $e) {
            error_log("Erro ao buscar usuários: " . $e->getMessage());
            // Retornar array vazio em caso de erro para não quebrar a aplicação
            return [];
        }
    }

    function buscarPorId($id) {
        try {
            $sql = "SELECT siape, username, senha FROM USUARIOS WHERE siape = :id";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':id' => $id]);

            $stmt->setFetchMode(PDO::FETCH_CLASS, Usuario::class);
            $usuario = $stmt->fetch();

            return $usuario ?: null;
        } catch (PDOException $e) {
            error_log("Erro ao buscar usuário por ID: " . $e->getMessage());
            throw new Exception("Erro ao buscar usuário");
        }
    }

    function buscarPorUsername($username) {
        try {
            $sql = "SELECT siape, username, senha FROM USUARIOS WHERE username = :username";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':username' => $username]);

            $stmt->setFetchMode(PDO::FETCH_CLASS, Usuario::class);
            $usuario = $stmt->fetch();

            return $usuario ?: null;
        } catch (PDOException $e) {
            error_log("Erro ao buscar usuário por username: " . $e->getMessage());
            throw new Exception("Erro ao buscar usuário");
        }
    }

    function inserir(Usuario $usuario) {
        try {
            // Se tiver siape, usar; caso contrário, gerar um temporário baseado em timestamp
            $siape = $usuario->getSiape();
            if (!$siape) {
                // Gerar siape temporário (últimos 8 dígitos do timestamp)
                $siape = intval(substr(time(), -8));
            }
            
            $sql = "INSERT INTO USUARIOS(siape, username, senha) VALUES (:siape, :username, :senha)";
            $stmt = $this->pdo->prepare($sql);
            $resultado = $stmt->execute([
                ':siape' => $siape,
                ':username' => $usuario->getUsername(),
                ':senha' => $usuario->getSenha()
            ]);

            if ($resultado) {
                return $this->buscarPorId($siape);
            }
            
            throw new Exception("Erro ao inserir usuário!");
        } catch (PDOException $e) {
            error_log("Erro PDO ao inserir usuário: " . $e->getMessage());
            throw new Exception("Erro ao inserir usuário");
        }
    }

    function editar($id, $usuario) {
        $u = $this->buscarPorId($id);
        if (!$u) 
            throw new Exception("Usuário não encontrado!");

        $sql = "UPDATE USUARIOS SET username=:username, senha=:senha WHERE siape=:id";
        $query = $this->pdo->prepare($sql);
        $query->bindValue(':username', $usuario->getUsername());
        $query->bindValue(':senha', $usuario->getSenha());
        $query->bindValue(':id', $id);
        if (!$query->execute())
            throw new Exception("Erro ao atualizar registro.");

        $u->setUsername($usuario->getUsername());
        $u->setSenha($usuario->getSenha());
        return $u;
    }

    function apagar($id) {
        $usuario = $this->buscarPorId($id);
        if (!$usuario) 
            throw new Exception("Usuário não encontrado!");

        $sql = "DELETE FROM USUARIOS WHERE siape=:id";
        $query = $this->pdo->prepare($sql);
        $query->bindValue(':id', $id);
        if (!$query->execute())
            throw new Exception("Erro ao apagar registro!");    

        return $usuario;
    }
}
?>