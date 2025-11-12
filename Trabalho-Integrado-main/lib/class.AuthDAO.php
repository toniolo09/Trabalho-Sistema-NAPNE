<?php
require_once "class.Banco.php";
require_once "models/class.Usuario.php";

class AuthDAO {
    private $pdo;

    function __construct() { $this->pdo = Banco::getConexao(); }

    function login($username, $senha) {
        // Permitir login com username, email ou CPF
        // Primeiro, limpar o CPF (remover pontos e traços)
        $cpfLimpo = preg_replace('/[^0-9]/', '', $username);
        $isCpf = strlen($cpfLimpo) === 11;
        
        // Primeiro, tentar buscar o usuário por username, email ou CPF (sem verificar senha ainda)
        // Usar LOWER() para comparar emails case-insensitive
        $sqlBuscar = "SELECT u.siape, u.username, u.senha, s.nome, s.tipo, s.email, s.cpf 
                      FROM USUARIOS u 
                      LEFT JOIN SERVIDORES s ON u.siape = s.siape 
                      WHERE u.username = :username 
                         OR LOWER(s.email) = LOWER(:email) 
                         OR s.cpf = :cpf";
        
        $stmtBuscar = $this->pdo->prepare($sqlBuscar);
        $stmtBuscar->execute([
            ':username' => $username,
            ':email' => $username, // Tentar como email também
            ':cpf' => $isCpf ? $cpfLimpo : $username // Se for CPF, usar limpo, senão usar original
        ]);

        $resultado = $stmtBuscar->fetch(PDO::FETCH_ASSOC);
        
        if ($resultado) {
            // Verificar senha
            if ($resultado['senha'] === $senha) {
                // Retornar objeto com dados do usuário
                return (object)[
                    'siape' => $resultado['siape'],
                    'username' => $resultado['username'],
                    'nome' => $resultado['nome'] ?? '',
                    'tipo' => $resultado['tipo'] ?? '',
                    'email' => $resultado['email'] ?? '',
                    'cpf' => $resultado['cpf'] ?? ''
                ];
            } else {
                // Senha incorreta
                error_log("Senha incorreta para usuário: $username");
                return null;
            }
        } else {
            // Usuário não encontrado
            error_log("Usuário não encontrado: $username");
            return null;
        }
    }
}

?>

