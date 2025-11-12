<?php
class Banco {
    private static $pdo;

    static function getConexao(){
        if (!self::$pdo) {
            // Tentar diferentes métodos de conexão para compatibilidade com XAMPP
            // Banco de dados: napne (minúsculo)
            $opcoes = [
                // Opção 1: Conexão via 127.0.0.1 com porta
                [
                    "mysql:dbname=napne;host=127.0.0.1;port=3306;charset=utf8mb4",
                    'root',
                    ''
                ],
                // Opção 2: Conexão via localhost com porta
                [
                    "mysql:dbname=napne;host=localhost;port=3306;charset=utf8mb4",
                    'root',
                    ''
                ],
                // Opção 3: Conexão via 127.0.0.1 sem porta
                [
                    "mysql:dbname=napne;host=127.0.0.1;charset=utf8mb4",
                    'root',
                    ''
                ],
                // Opção 4: Conexão via localhost sem porta
                [
                    "mysql:dbname=napne;host=localhost;charset=utf8mb4",
                    'root',
                    ''
                ],
                // Opção 5: Conexão via socket do XAMPP (macOS)
                [
                    "mysql:unix_socket=/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock;dbname=napne;charset=utf8mb4",
                    'root',
                    ''
                ]
            ];
            
            $ultimoErro = null;
            $conectado = false;
            
            foreach ($opcoes as $opcao) {
                try {
                    self::$pdo = new PDO(
                        $opcao[0],
                        $opcao[1],
                        $opcao[2],
                        [
                            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                            PDO::ATTR_EMULATE_PREPARES => false,
                            PDO::ATTR_TIMEOUT => 5
                        ]
                    );
                    
                    // Testar a conexão
                    self::$pdo->query("SELECT 1");
                    $conectado = true;
                    break;
                    
                } catch(PDOException $e) {
                    $ultimoErro = $e->getMessage();
                    error_log("Tentativa de conexão falhou: " . $ultimoErro);
                    self::$pdo = null;
                    continue;
                }
            }
            
            if (!$conectado) {
                error_log("Erro ao conectar com o banco de dados. Última tentativa: " . $ultimoErro);
                
                // Verificar se é erro de MySQL não rodando ou outro problema
                $erroMySQLNaoRodando = (
                    strpos($ultimoErro, "Connection refused") !== false ||
                    strpos($ultimoErro, "Connection timed out") !== false ||
                    strpos($ultimoErro, "Can't connect") !== false ||
                    strpos($ultimoErro, "No connection") !== false ||
                    strpos($ultimoErro, "Unknown MySQL server host") !== false
                );
                
                if ($erroMySQLNaoRodando) {
                    throw new Exception("MySQL não está rodando. Inicie o MySQL pelo XAMPP Control Panel ou execute: sudo /Applications/XAMPP/xamppfiles/xampp startmysql");
                }
                
                // Tentar criar o banco se não existir (apenas se não for erro de conexão)
                try {
                    $dsnSemBanco = str_replace('dbname=napne;', '', $opcoes[0][0]);
                    $dsnSemBanco = str_replace('dbname=napne', '', $dsnSemBanco);
                    if (empty($dsnSemBanco)) {
                        $dsnSemBanco = "mysql:host=127.0.0.1;port=3306;charset=utf8mb4";
                    }
                    $pdoTemp = new PDO($dsnSemBanco, $opcoes[0][1], $opcoes[0][2], [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_TIMEOUT => 3
                    ]);
                    $pdoTemp->exec("CREATE DATABASE IF NOT EXISTS napne CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                    // Tentar conectar novamente
                    self::$pdo = new PDO($opcoes[0][0], $opcoes[0][1], $opcoes[0][2], [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        PDO::ATTR_EMULATE_PREPARES => false,
                        PDO::ATTR_TIMEOUT => 5
                    ]);
                    self::$pdo->query("SELECT 1");
                    $conectado = true;
                } catch (PDOException $e) {
                    error_log("Erro ao criar banco: " . $e->getMessage());
                    throw new Exception("Erro ao conectar com o banco de dados. Verifique se o MySQL está rodando. Último erro: " . $ultimoErro);
                }
            }
        }
        
        if (!self::$pdo) {
            throw new Exception("Conexão com banco de dados não foi estabelecida");
        }
        
        return self::$pdo;
    }    
}
?>