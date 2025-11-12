<?php
// Handler de erros para capturar erros fatais
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== NULL && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        // Limpar qualquer buffer
        while (ob_get_level()) {
            ob_end_clean();
        }
        
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        
        $errorMsg = 'Erro interno do servidor';
        if (strpos($error['message'], 'syntax error') !== false) {
            $errorMsg = 'Erro de sintaxe no código: ' . basename($error['file']) . ' linha ' . $error['line'];
        }
        
        error_log("Erro fatal: " . $error['message'] . " em " . $error['file'] . ":" . $error['line']);
        
        echo json_encode(['error' => $errorMsg], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
});

// Iniciar output buffering para evitar que warnings/notices corrompam o JSON
ob_start();

// Desabilitar exibição de erros na saída (mas manter logging)
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Headers CORS para permitir requisições do frontend
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Responder a requisições OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    echo '{}';
    exit;
}

// Carregar configuração e Auth
require_once __DIR__ . '/config/index.php';
require_once __DIR__ . '/lib/Auth.php';

function converterNomeController($palavra) {
    // Mapear rotas do frontend para nomes de controllers
    $mapeamento = [
        'estudantes' => 'EstudanteController',
        'cursos' => 'CursoController',
        'componentes' => 'ComponenteCurricularController',
        'matriculas' => 'MatriculaController',
        'usuarios' => 'UsuarioController',
        'servidores' => 'ServidorController',
        'necessidades' => 'NecessidadeEspecificaController',
        'estudantes-necessidades' => 'EstudanteNecessidadeController',
        'responsaveis' => 'ResponsavelController',
        'resp-estudantes' => 'RespEstudanteController',
        'pareceres' => 'ParecerController',
        'peis' => 'PeiGeralController',
        'adaptacoes' => 'PeiAdaptacaoController',
        'comentarios' => 'ComentarioController',
        'auth' => 'AuthController'
    ];
    
    if (isset($mapeamento[$palavra])) {
        return $mapeamento[$palavra];
    }
    
    // Fallback: tentar converter automaticamente
    return ucfirst(rtrim($palavra, 's')) . 'Controller';
}

function error($msg, $code = 404) {
    // Limpar qualquer buffer anterior
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    
    $json = json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        // Fallback se JSON encoding falhar
        die('{"error":"Erro ao processar resposta"}');
    }
    die($json);
}

spl_autoload_register(function($nomeDaClasse){
    try {
        $arquivo = __DIR__ . '/controllers/class.' . $nomeDaClasse . '.php';

        if (!file_exists($arquivo)) {
            error_log("Arquivo não encontrado: $arquivo para classe: $nomeDaClasse");
            error("Controller '$nomeDaClasse' não existe! Arquivo: $arquivo");
        }
        
        require_once $arquivo;
        
        // Verificar se a classe existe após carregar
        if (!class_exists($nomeDaClasse)) {
            error_log("Classe '$nomeDaClasse' não encontrada no arquivo: $arquivo");
            error("Classe '$nomeDaClasse' não foi encontrada no arquivo!");
        }
    } catch (Throwable $e) {
        error_log("Erro ao carregar classe '$nomeDaClasse': " . $e->getMessage());
        error("Erro ao carregar controller '$nomeDaClasse': " . $e->getMessage());
    }
});

$method = $_SERVER['REQUEST_METHOD'];

// Detectar automaticamente o caminho base
$scriptName = dirname($_SERVER['SCRIPT_NAME']);
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$url = str_replace($scriptName, '', $requestUri);
$url = ltrim($url, '/');
$partes = array_filter(explode("/", $url));
$partes = array_values($partes); // Reindexar array

// Log para debug
error_log("Rota detectada: " . json_encode([
    'method' => $method,
    'scriptName' => $scriptName,
    'requestUri' => $requestUri,
    'url' => $url,
    'partes' => $partes
]));

// Rotas especiais de autenticação: auth/login e auth/register
if ($partes[0] === 'auth' && count($partes) === 2) {
    try {
        require_once __DIR__ . '/controllers/class.AuthController.php';
        $controller = new AuthController();
        
        ob_clean();
        
        if ($partes[1] === 'login' && $method === 'POST') {
            try {
                $resultado = $controller->login();
                
                // Verificar se o resultado tem erro
                if (isset($resultado['error'])) {
                    ob_end_clean();
                    http_response_code(401);
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode($resultado, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                    exit;
                }
                
                // Garantir que o token foi gerado
                if (!isset($resultado['token']) || empty($resultado['token'])) {
                    error_log("Erro: Token não gerado. Resultado: " . json_encode($resultado));
                    ob_end_clean();
                    http_response_code(500);
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode(['error' => 'Erro ao gerar token de autenticação. Verifique os logs do servidor.'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                    exit;
                }
            } catch (Exception $e) {
                ob_end_clean();
                error_log("Erro no login: " . $e->getMessage());
                http_response_code(401);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                exit;
            }
        } elseif ($partes[1] === 'register' && $method === 'POST') {
            $resultado = $controller->register();
        } else {
            ob_end_clean();
            error("Método não permitido para esta rota", 405);
            exit;
        }
        
        $json = json_encode($resultado, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        
        if ($json === false) {
            ob_end_clean();
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => 'Erro ao serializar resposta'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            exit;
        }
        
        ob_end_clean();
        echo $json;
        exit;
    } catch (PDOException $e) {
        ob_end_clean();
        error_log("Erro PDO em auth: " . $e->getMessage() . " | Código: " . $e->getCode());
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        $errorMsg = 'Erro ao processar requisição. Verifique os dados e tente novamente.';
        
        if (strpos($e->getMessage(), 'Duplicate entry') !== false || $e->getCode() == 23000) {
            $errorMsg = 'Dados duplicados. Verifique se o usuário, email ou CPF já existe.';
        } elseif (strpos($e->getMessage(), 'doesn\'t exist') !== false) {
            $errorMsg = 'Erro de configuração do banco de dados.';
        }
        
        echo json_encode(['error' => $errorMsg], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    } catch (Exception $e) {
        ob_end_clean();
        error_log("Erro em auth: " . $e->getMessage() . " | Trace: " . $e->getTraceAsString());
        $code = ($partes[1] === 'login') ? 401 : 400;
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    } catch (Error $e) {
        ob_end_clean();
        error_log("Erro fatal em auth: " . $e->getMessage() . " | Trace: " . $e->getTraceAsString());
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        $errorMsg = 'Erro interno do servidor: ' . $e->getMessage();
        if (strpos($e->getMessage(), 'JWT') !== false || strpos($e->getMessage(), 'vendor') !== false) {
            $errorMsg = 'Biblioteca JWT não encontrada. Execute "composer install" na raiz do projeto.';
        }
        echo json_encode(['error' => $errorMsg], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}

if ($method === 'POST' && count($partes) != 1) {
    error("Requisição inválida! POST requer 1 parte, recebido: " . count($partes));
}
if (in_array($method, ['PUT', 'DELETE']) && count($partes) != 2) {
    error("Requisição inválida! " . $method . " requer 2 partes, recebido: " . count($partes));
}
if ($method === 'GET' && (count($partes) < 1 || count($partes) > 2)) {
    error("Requisição inválida! GET requer 1-2 partes, recebido: " . count($partes));
}
if (empty($partes[0])) {
    error("Requisição inválida! Rota vazia.");
}

// Verificar autenticação para rotas protegidas (exceto auth/login e auth/register)
if ($partes[0] !== 'auth' && !Auth::check()) {
    ob_end_clean();
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Você não está autenticado.'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$nomeDoController = converterNomeController($partes[0]); 
error_log("Controller: " . $nomeDoController);

try {
    // Verificar se a classe existe antes de instanciar
    if (!class_exists($nomeDoController)) {
        error_log("Classe '$nomeDoController' não existe");
        error("Controller '$nomeDoController' não encontrado. Verifique se o arquivo existe.", 500);
    }
    
    $controller = new $nomeDoController();
} catch (TypeError $e) {
    error_log("Erro de tipo ao instanciar controller '$nomeDoController': " . $e->getMessage());
    error("Erro ao criar controller '$nomeDoController': " . $e->getMessage(), 500);
} catch (Error $e) {
    error_log("Erro fatal ao instanciar controller '$nomeDoController': " . $e->getMessage() . " | Trace: " . $e->getTraceAsString());
    error("Controller '$nomeDoController' não pôde ser instanciado: " . $e->getMessage(), 500);
} catch (Exception $e) {
    error_log("Exceção ao instanciar controller '$nomeDoController': " . $e->getMessage());
    error("Erro ao criar controller '$nomeDoController': " . $e->getMessage(), 500);
}

try {
    // Limpar qualquer saída anterior
    ob_clean();
    
    // Verificar se o controller implementa os métodos necessários
    if (!method_exists($controller, $method === 'GET' ? (count($partes) === 1 ? 'getTodos' : 'getPorId') : 
        ($method === 'POST' ? 'criar' : ($method === 'PUT' ? 'editar' : 'apagar')))) {
        error_log("Método não encontrado no controller '$nomeDoController' para método HTTP '$method'");
        error("Método não implementado no controller", 500);
    }
    
    $resultado = null;
    switch($method) {
        case 'GET':
            // Verificar se há query parameter professor
            $queryParams = $_GET;
            if (count($partes) === 1 && isset($queryParams['professor']) && method_exists($controller, 'getPorProfessor')) {
                $resultado = $controller->getPorProfessor($queryParams['professor']);
            } else {
                $resultado = (count($partes) === 1) 
                    ? $controller->getTodos() 
                    : $controller->getPorId($partes[1]);
            }
            break;
        case 'POST': 
            $resultado = $controller->criar();
            break;
        case 'PUT': 
            $resultado = $controller->editar($partes[1]);
            break;
        case 'DELETE':  
            $resultado = $controller->apagar($partes[1]);
            break;
        default: 
            ob_end_clean();
            error('Método inválido!', 405);
            return;
    }
    
    // Garantir que sempre retorna JSON válido
    if ($resultado === null) {
        $resultado = [];
    }
    
    $json = json_encode($resultado, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    
    if ($json === false) {
        ob_end_clean();
        error('Erro ao serializar resposta: ' . json_last_error_msg(), 500);
        return;
    }
    
    // Limpar buffer e enviar JSON
    ob_end_clean();
    echo $json;
    
}catch(PDOException $e) {
    // Erro específico de banco de dados
    ob_end_clean();
    $errorMsg = $e->getMessage();
    error_log("Erro PDO: " . $errorMsg . " | Código: " . $e->getCode());
    
    // Mensagem mais amigável baseada no código de erro
    if (strpos($errorMsg, "doesn't exist") !== false || strpos($errorMsg, "Unknown database") !== false) {
        $userMsg = "Banco de dados 'napne' não existe. Execute o script estrutura.sql primeiro.";
    } elseif (strpos($errorMsg, "Table") !== false && strpos($errorMsg, "doesn't exist") !== false) {
        $userMsg = "Tabela não encontrada. Verifique se o banco de dados foi criado corretamente.";
    } elseif (strpos($errorMsg, "Access denied") !== false) {
        $userMsg = "Erro de autenticação no banco de dados. Verifique usuário e senha.";
    } elseif (strpos($errorMsg, "Connection refused") !== false || 
              strpos($errorMsg, "Connection timed out") !== false ||
              strpos($errorMsg, "Can't connect") !== false ||
              strpos($errorMsg, "MySQL não está rodando") !== false) {
        $userMsg = "MySQL não está rodando. Inicie o MySQL pelo XAMPP Control Panel.";
    } else {
        $userMsg = "Erro ao conectar com o banco de dados: " . $errorMsg;
    }
    
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $userMsg], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}catch(Exception $e) {
    ob_end_clean();
    $errorMsg = $e->getMessage();
    error_log("Erro: " . $errorMsg . " | Trace: " . $e->getTraceAsString());
    
    // Garantir que sempre retorna JSON válido
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $errorMsg], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}catch(Error $e) {
    ob_end_clean();
    error_log("Erro fatal: " . $e->getMessage());
    // Garantir que sempre retorna JSON válido
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Erro interno do servidor'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}catch(Throwable $e) {
    // Captura qualquer outro tipo de erro
    ob_end_clean();
    error_log("Erro inesperado: " . $e->getMessage());
    // Garantir que sempre retorna JSON válido
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Erro interno do servidor'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}


?>