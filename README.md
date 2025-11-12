# Sistema NAPNE - Gestão de Planos Educacionais Individualizados (PEI)

Sistema web desenvolvido para gerenciar Planos Educacionais Individualizados (PEI) no contexto do Núcleo de Apoio às Pessoas com Necessidades Específicas (NAPNE). A aplicação permite a criação, edição, visualização e acompanhamento de PEIs gerais e adaptações curriculares, facilitando o trabalho colaborativo entre NAPNE, professores e CAE.

## 📋 Sobre o Projeto

Este sistema foi desenvolvido para atender às necessidades de gestão educacional inclusiva, permitindo que:

- **NAPNE** crie e gerencie PEIs gerais, vinculando-os a componentes curriculares específicos
- **Professores** visualizem PEIs atribuídos e criem adaptações curriculares baseadas nos planos gerais
- **CAE** visualize e acompanhe o status dos PEIs sem permissões de edição

O sistema garante que cada PEI esteja vinculado a um componente curricular específico, facilitando a organização e o acompanhamento pedagógico.

## 🛠️ Tecnologias Utilizadas

### Backend
- **PHP 7.4+** - Linguagem de programação server-side
- **MySQL/MariaDB** - Banco de dados relacional
- **PDO** - Camada de abstração para acesso ao banco de dados
- **JWT (JSON Web Tokens)** - Autenticação e autorização via biblioteca `firebase/php-jwt`
- **Composer** - Gerenciador de dependências PHP

### Frontend
- **HTML5** - Estrutura das páginas
- **CSS3** - Estilização com design moderno e responsivo
- **JavaScript (ES6+)** - Lógica de interação e comunicação com API
- **Font Awesome** - Ícones
- **html2pdf.js** - Geração de PDFs dos PEIs

### Arquitetura
- **MVC (Model-View-Controller)** - Padrão arquitetural
- **RESTful API** - Comunicação entre frontend e backend
- **DAO (Data Access Object)** - Camada de acesso a dados

## 📁 Estrutura do Projeto

```
Trabalho-Integrado-main/
├── _doc/
│   └── estrutura.sql          # Script de criação do banco de dados
├── config/
│   └── index.php              # Configurações gerais
├── controllers/               # Controladores (lógica de negócio)
│   ├── class.AuthController.php
│   ├── class.PeiGeralController.php
│   ├── class.PeiAdaptacaoController.php
│   └── ...
├── lib/                       # Bibliotecas e DAOs
│   ├── Auth.php              # Sistema de autenticação JWT
│   ├── class.Banco.php       # Conexão com banco de dados
│   ├── class.PeiGeralDAO.php
│   └── ...
├── models/                    # Modelos de dados
│   ├── class.PeiGeral.php
│   ├── class.PeiAdaptacao.php
│   └── ...
├── web/                       # Interface do usuário
│   ├── css/                  # Estilos
│   ├── js/                   # Scripts JavaScript
│   ├── peis.html             # Página de gestão de PEIs
│   ├── professor.html        # Dashboard do professor
│   └── ...
├── vendor/                    # Dependências do Composer
├── index.php                 # Ponto de entrada da API
├── composer.json             # Dependências do projeto
└── README.md                 # Este arquivo
```

## 🚀 Funcionalidades Principais

### Gestão de PEIs Gerais (NAPNE)
- Criação de PEIs gerais vinculados a componentes curriculares
- Edição e atualização de PEIs existentes
- Visualização estilizada com cards e layout moderno
- Geração de PDFs dos PEIs
- Atribuição de professores responsáveis
- Vinculação automática de necessidades específicas dos estudantes

### Adaptações Curriculares (Professores)
- Visualização de PEIs gerais atribuídos
- Criação de adaptações curriculares baseadas no PEI geral
- Respeito ao componente curricular definido pelo NAPNE
- Envio de adaptações para avaliação do NAPNE
- Edição de adaptações em rascunho

### Acompanhamento (CAE)
- Visualização de todos os PEIs
- Acompanhamento de status e evoluções
- Sem permissões de edição (somente leitura)

### Outras Funcionalidades
- Sistema de autenticação com JWT
- Gestão de estudantes, cursos e componentes curriculares
- Gestão de necessidades específicas
- Sistema de comentários do NAPNE sobre adaptações
- Filtros e buscas avançadas
- Interface responsiva e moderna

## 📦 Instalação

### Pré-requisitos
- XAMPP (ou servidor com PHP 7.4+ e MySQL/MariaDB)
- Composer
- Navegador web moderno

### Passos para Instalação

1. **Clone ou baixe o projeto** para a pasta `htdocs` do XAMPP:
   ```
   C:\xampp\htdocs\Trabalho-Integrado-main\
   ```

2. **Crie o banco de dados**:
   - Abra o phpMyAdmin (http://localhost/phpmyadmin)
   - Crie um banco de dados chamado `napne`
   - Importe o arquivo `_doc/estrutura.sql` para criar as tabelas

3. **Configure a conexão com o banco** (se necessário):
   - Edite `lib/class.Banco.php` se suas credenciais do MySQL forem diferentes de `root` sem senha

4. **Instale as dependências do Composer**:
   ```bash
   composer install
   ```

5. **Acesse o sistema**:
   - Abra o navegador e acesse: `http://localhost/Trabalho-Integrado-main/web/index.html`

## 👥 Perfis de Usuário

### NAPNE
- Criar, editar e excluir PEIs gerais
- Comentar e avaliar adaptações curriculares
- Visualizar todos os PEIs e adaptações
- Gerar PDFs

### Docente (Professor)
- Visualizar PEIs gerais atribuídos
- Criar adaptações curriculares
- Editar adaptações em rascunho
- Enviar adaptações para avaliação

### CAE
- Visualizar todos os PEIs (somente leitura)
- Acompanhar status e evoluções
- Sem permissões de edição

## 🔐 Segurança

- Autenticação via JWT (JSON Web Tokens)
- Validação de permissões por tipo de usuário
- Proteção contra SQL Injection (PDO com prepared statements)
- Headers CORS configurados
- Sanitização de dados de entrada

## 📝 Notas de Desenvolvimento

- O sistema utiliza migração automática de schema para adicionar a coluna `codigo_componente` em `PEI_GERAL` caso não exista
- A interface foi desenvolvida com foco em usabilidade e design moderno
- O código segue padrões de nomenclatura e organização consistentes
- Sistema de visualização estilizada implementado para melhor experiência do usuário

## 👨‍💻 Desenvolvimento

**Analista de Sistemas:** Vicente Toniolo Braga  
**Desenvolvedor:** Artur Cagliari
**Analista de Dados:** Felipe Trevisan

Este projeto foi desenvolvido seguindo as especificações e orientações do analista Vicente Toniolo Braga, com foco em criar uma solução completa e eficiente para a gestão de PEIs no contexto educacional inclusivo.

## 📄 Licença

Este projeto foi desenvolvido para fins acadêmicos e institucionais.

---

**Versão:** 1.0  
**Última atualização:** 2025

