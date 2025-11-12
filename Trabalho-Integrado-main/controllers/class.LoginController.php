<?php
require __DIR__ . "/../vendor/autoload.php";
use Firebase\JWT\JWT;

require_once __DIR__ . "/../config/index.php";
require_once __DIR__ . "/../lib/class.AuthDAO.php";

class LoginController {
    private $dao;

    function __construct(){
        $this->dao = new AuthDAO();
    }

    function login(){
        global $key;

        $dados = json_decode(file_get_contents("php://input"));

        $usuario = $this->dao->login($dados->username ?? $dados->email ?? '', $dados->senha ?? $dados->password ?? '');

        if ($usuario) {
            $payload = [
                'iss'=> 'http://localhost',
                'iat' => time(),
                'exp' => time() + 1 * 60 * 60 
            ];

            $payload['userId'] = $usuario->siape;

            $jwt = JWT::encode($payload, $key, 'HS256');

            return [
                'token' => $jwt,
                'siape' => $usuario->siape,
                'username' => $usuario->username,
                'nome' => $usuario->nome,
                'tipo' => $usuario->tipo,
                'email' => $usuario->email,
                'cpf' => $usuario->cpf
            ];
        }

        return ['error' => 'Usuário não encontrado!'];
    }
}

?>
