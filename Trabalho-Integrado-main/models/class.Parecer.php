<?php
class Parecer implements JsonSerializable {
    private $id;
    private $pei_adaptacao_id;
    private $periodo;
    private $descricao;
    private $data_criacao;
    private $comentarios;
    
    public function setId($id) { $this->id = $id; }
    public function getId() { return $this->id; }
    
    public function setPeiAdaptacaoId($pei_adaptacao_id) { $this->pei_adaptacao_id = $pei_adaptacao_id; }
    public function getPeiAdaptacaoId() { return $this->pei_adaptacao_id; }
    
    public function setPeriodo($periodo) { $this->periodo = $periodo; }
    public function getPeriodo() { return $this->periodo; }
    
    public function setDescricao($descricao) { $this->descricao = $descricao; }
    public function getDescricao() { return $this->descricao; }
    
    public function setDataCriacao($data_criacao) { $this->data_criacao = $data_criacao; }
    public function getDataCriacao() { return $this->data_criacao; }
    
    public function setComentarios($comentarios) { $this->comentarios = $comentarios; }
    public function getComentarios() { return $this->comentarios; }
    
    public function jsonSerialize() {
        return [
            'id' => $this->id,
            'pei_adaptacao_id' => $this->pei_adaptacao_id,
            'periodo' => $this->periodo,
            'descricao' => $this->descricao,
            'data_criacao' => $this->data_criacao,
            'comentarios' => $this->comentarios
            // Nota: Para incluir dados de PEI_ADAPTACAO, carregue via FK
        ];
    }
}
?>