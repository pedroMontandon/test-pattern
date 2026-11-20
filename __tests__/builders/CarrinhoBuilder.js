import { Carrinho } from '../../src/domain/Carrinho.js';
import { Item } from '../../src/domain/Item.js';
import { UserMother } from './UserMother.js';

/**
 * Data Builder: monta um Carrinho com valores padrão sensatos e permite
 * que cada teste sobrescreva, de forma fluente, apenas o que importa
 * para o seu cenário.
 */
export class CarrinhoBuilder {
    constructor() {
        // Padrão: usuário comum com 1 item de R$ 100,00
        this.user = UserMother.umUsuarioPadrao();
        this.itens = [new Item('Produto Padrão', 100)];
    }

    static umCarrinho() {
        return new CarrinhoBuilder();
    }

    comUser(user) {
        this.user = user;
        return this;
    }

    comItens(itens) {
        this.itens = [...itens];
        return this;
    }

    comItem(nome, preco) {
        this.itens.push(new Item(nome, preco));
        return this;
    }

    vazio() {
        this.itens = [];
        return this;
    }

    build() {
        return new Carrinho(this.user, [...this.itens]);
    }
}
