import { User } from '../../src/domain/User.js';

/**
 * Object Mother: fornece instâncias prontas e fixas de User.
 * Usuários são entidades simples com poucas variações (PADRAO / PREMIUM),
 * então um catálogo de "personagens" nomeados é suficiente e legível.
 */
export class UserMother {
    static umUsuarioPadrao() {
        return new User(1, 'Usuário Padrão', 'padrao@email.com', 'PADRAO');
    }

    static umUsuarioPremium() {
        return new User(2, 'Usuário Premium', 'premium@email.com', 'PREMIUM');
    }
}
