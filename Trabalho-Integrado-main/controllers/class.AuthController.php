<?php
require __DIR__ . "/../vendor/autoload.php";
use Firebase\JWT\JWT;

require_once __DIR__ . "/../config/index.php";
require_once __DIR__ . "/../lib/class.AuthDAO.php";
require_once __DIR__ . "/../lib/class.UsuarioDAO.php";
require_once __DIR__ . "/../lib/class.ServidorDAO.php";
require_once __DIR__ . "/../models/class.Usuario.php";
require_once __DIR__ . "/../models/class.Servidor.php";

class AuthController {
    private $dao;
    private $usuarioDao;
    private $servidorDao;

    function __construct(){
        $this->dao = new AuthDAO();
        $this->usuarioDao = new UsuarioDAO();
        $this->servidorDao = new ServidorDAO();
    }

    function login(){
        global $key;

        try {
            $dados = json_decode(file_get_contents("php://input"));

            if (!$dados) {
                throw new Exception("Dados inválidos");
            }

            $username = $dados->username ?? $dados->email ?? '';
            $senha = $dados->senha ?? $dados->password ?? '';

            if (empty($username) || empty($senha)) {
                throw new Exception("Usuário e senha são obrigatórios");
            }

            $usuario = $this->dao->login($username, $senha);

            if (!$usuario) {
                error_log("Login falhou para: $username");
                throw new Exception("Usuário ou senha incorretos. Verifique se o usuário foi criado corretamente.");
            }

            // Verificar se o usuário tem siape válido
            if (empty($usuario->siape)) {
                error_log("Erro: Usuário sem SIAPE. Username: $username, Dados: " . json_encode($usuario));
                throw new Exception("Erro: Usuário sem SIAPE cadastrado. Verifique se o servidor foi criado corretamente.");
            }

            // Log de sucesso para debug
            error_log("Login bem-sucedido para: $username, SIAPE: " . $usuario->siape . ", Tipo: " . $usuario->tipo);

            // Verificar se a chave JWT está definida
            if (empty($key)) {
                error_log("Erro: Chave JWT não definida");
                throw new Exception("Erro de configuração do servidor");
            }

            $payload = [
                'iss'=> 'http://localhost',
                'iat' => time(),
                'exp' => time() + 1 * 60 * 60 
            ];

            $payload['userId'] = intval($usuario->siape);

            try {
                $jwt = JWT::encode($payload, $key, 'HS256');
            } catch (Exception $e) {
                error_log("Erro ao gerar JWT: " . $e->getMessage());
                throw new Exception("Erro ao gerar token: " . $e->getMessage());
            }

            if (empty($jwt)) {
                error_log("Erro: JWT gerado está vazio");
                throw new Exception("Erro ao gerar token de autenticação");
            }

            return [
                'token' => $jwt,
                'siape' => $usuario->siape,
                'username' => $usuario->username,
                'nome' => $usuario->nome,
                'tipo' => $usuario->tipo,
                'email' => $usuario->email,
                'cpf' => $usuario->cpf
            ];
        } catch (Exception $e) {
            error_log("Erro no login: " . $e->getMessage());
            throw $e;
        }
    }

    function register(){
        global $key;

        $dados = json_decode(file_get_contents("php://input"), true);

        if (!$dados) {
            throw new Exception("Dados inválidos");
        }

        $username = $dados['username'] ?? '';
        $senha = $dados['senha'] ?? $dados['password'] ?? '';
        $tipoRaw = $dados['tipo'] ?? $dados['userType'] ?? 'napne';
        $nome = $dados['nome'] ?? $username;
        $email = $dados['email'] ?? $username . '@napne.local';
        $cpf = $dados['cpf'] ?? '';
        $telefone = $dados['telefone'] ?? '';
        $siape = $dados['siape'] ?? null;

        if (empty($username) || empty($senha)) {
            throw new Exception("Usuário e senha são obrigatórios");
        }

        // Normalizar tipo para corresponder ao ENUM do banco: 'Docente', 'CAE', 'NAPNE'
        $tipo = 'NAPNE';
        $tipoLower = strtolower($tipoRaw);
        if ($tipoLower === 'docente' || $tipoLower === 'professor') {
            $tipo = 'Docente';
        } elseif ($tipoLower === 'cae') {
            $tipo = 'CAE';
        } elseif ($tipoLower === 'napne') {
            $tipo = 'NAPNE';
        }

        // Verificar se username já existe
        $usuarioExistente = $this->usuarioDao->buscarPorUsername($username);
        if ($usuarioExistente) {
            throw new Exception("Nome de usuário já está em uso");
        }

        // Carregar lista de servidores uma vez para validar
        $servidores = $this->servidorDao->buscarTodos();
        
        // Verificar se email já existe
        foreach ($servidores as $s) {
            if ($s->getEmail() === $email) {
                throw new Exception("Email já está em uso");
            }
        }

        // Gerar siape se não fornecido
        if (!$siape) {
            do {
                $siape = intval(substr(time(), -8)) + rand(1000, 9999);
                $servidorExistente = $this->servidorDao->buscarPorId($siape);
            } while ($servidorExistente);
        } else {
            $servidorExistente = $this->servidorDao->buscarPorId($siape);
            if ($servidorExistente) {
                throw new Exception("SIAPE já está em uso");
            }
        }

        // Gerar CPF se não fornecido
        if (empty($cpf)) {
            $cpf = str_pad($siape, 11, '0', STR_PAD_LEFT);
            $cpfExiste = false;
            foreach ($servidores as $s) {
                if ($s->getCpf() === $cpf) {
                    $cpfExiste = true;
                    break;
                }
            }
            if ($cpfExiste) {
                $cpf = str_pad($siape, 9, '0', STR_PAD_LEFT) . rand(10, 99);
            }
        } else {
            foreach ($servidores as $s) {
                if ($s->getCpf() === $cpf) {
                    throw new Exception("CPF já está em uso");
                }
            }
        }

        // Criar servidor primeiro
        $servidor = new Servidor();
        $servidor->setSiape($siape);
        $servidor->setCpf($cpf);
        $servidor->setNome($nome);
        $servidor->setEmail($email);
        $servidor->setTelefone($telefone);
        $servidor->setTipo($tipo);

        try {
            $servidorCriado = $this->servidorDao->inserir($servidor);
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'Duplicate entry') !== false || $e->getCode() == 23000) {
                if (strpos($e->getMessage(), 'cpf') !== false) {
                    throw new Exception('CPF já está em uso');
                }
                if (strpos($e->getMessage(), 'email') !== false) {
                    throw new Exception('Email já está em uso');
                }
                if (strpos($e->getMessage(), 'siape') !== false) {
                    throw new Exception('SIAPE já está em uso');
                }
                throw new Exception('Dados duplicados. Verifique CPF, Email ou SIAPE.');
            }
            throw new Exception('Erro ao criar servidor: ' . $e->getMessage());
        }

        // Criar usuário
        try {
            $usuario = new Usuario();
            $usuario->setSiape($siape);
            $usuario->setUsername($username);
            $usuario->setSenha($senha);

            $usuarioCriado = $this->usuarioDao->inserir($usuario);
        } catch (PDOException $e) {
            // Rollback: remover servidor se falhar
            try {
                $this->servidorDao->apagar($siape);
            } catch (Exception $e2) {
                error_log("Erro ao remover servidor: " . $e2->getMessage());
            }
            
            if (strpos($e->getMessage(), 'Duplicate entry') !== false || $e->getCode() == 23000) {
                throw new Exception('Nome de usuário já está em uso');
            }
            throw new Exception('Erro ao criar usuário: ' . $e->getMessage());
        }

        // Gerar token JWT
        $payload = [
            'iss'=> 'http://localhost',
            'iat' => time(),
            'exp' => time() + 1 * 60 * 60
        ];

        $payload['userId'] = $siape;
        $jwt = JWT::encode($payload, $key, 'HS256');

        return [
            'token' => $jwt,
            'siape' => $siape,
            'username' => $username,
            'nome' => $nome,
            'tipo' => $tipo,
            'email' => $email,
            'cpf' => $cpf,
            'message' => 'Usuário criado com sucesso!'
        ];
    }
}

?>
