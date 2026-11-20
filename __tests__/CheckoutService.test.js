import { CheckoutService } from '../src/services/CheckoutService.js';
import { Item } from '../src/domain/Item.js';
import { Pedido } from '../src/domain/Pedido.js';
import { UserMother } from './builders/UserMother.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';

const CARTAO = '4111-1111-1111-1111';

describe('CheckoutService', () => {
    describe('quando o pagamento falha', () => {
        let carrinho;
        let gatewayStub;
        let repositoryDummy;
        let emailDummy;
        let checkoutService;

        beforeEach(() => {
            // Arrange
            carrinho = CarrinhoBuilder.umCarrinho().build();

            // Stub: única responsabilidade é devolver uma resposta pré-definida
            gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };

            // Dummies: apenas preenchem o construtor; não devem ser usados
            repositoryDummy = { salvar: jest.fn() };
            emailDummy = { enviarEmail: jest.fn() };

            checkoutService = new CheckoutService(gatewayStub, repositoryDummy, emailDummy);
        });

        it('deve retornar null', async () => {
            // Act
            const pedido = await checkoutService.processarPedido(carrinho, CARTAO);

            // Assert (Verificação de Estado)
            expect(pedido).toBeNull();
        });

        it('não deve salvar o pedido nem enviar e-mail', async () => {
            // Act
            await checkoutService.processarPedido(carrinho, CARTAO);

            // Assert (Verificação de Comportamento)
            expect(repositoryDummy.salvar).not.toHaveBeenCalled();
            expect(emailDummy.enviarEmail).not.toHaveBeenCalled();
        });
    });

    describe('quando um cliente Padrão finaliza a compra', () => {
        it('deve retornar o pedido salvo com o totalFinal sem desconto', async () => {
            // Arrange
            const carrinho = CarrinhoBuilder.umCarrinho()
                .comUser(UserMother.umUsuarioPadrao())
                .comItens([new Item('Teclado', 150), new Item('Mouse', 50)])
                .build();

            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = {
                salvar: jest.fn().mockImplementation(async (pedido) =>
                    new Pedido(10, pedido.carrinho, pedido.totalFinal, pedido.status)),
            };
            const emailStub = { enviarEmail: jest.fn().mockResolvedValue(undefined) };

            const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailStub);

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, CARTAO);

            // Assert (Verificação de Estado)
            expect(pedido).toBeInstanceOf(Pedido);
            expect(pedido.id).toBe(10);
            expect(pedido.totalFinal).toBe(200);
            expect(pedido.status).toBe('PROCESSADO');
        });
    });

    describe('quando um cliente Premium finaliza a compra', () => {
        let usuarioPremium;
        let carrinho;
        let gatewayStub;
        let repositoryStub;
        let emailMock;
        let checkoutService;

        beforeEach(() => {
            // Arrange
            usuarioPremium = UserMother.umUsuarioPremium();
            carrinho = CarrinhoBuilder.umCarrinho()
                .comUser(usuarioPremium)
                .comItens([new Item('Fone de Ouvido', 120), new Item('Carregador', 80)]) // R$ 200,00
                .build();

            // Stubs: controlam o fluxo devolvendo respostas fixas
            gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            repositoryStub = {
                salvar: jest.fn().mockResolvedValue(new Pedido(42, carrinho, 180, 'PROCESSADO')),
            };

            // Mock: queremos verificar se e como foi chamado
            emailMock = { enviarEmail: jest.fn().mockResolvedValue(undefined) };

            checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailMock);
        });

        it('deve cobrar o valor com 10% de desconto e enviar o e-mail de aprovação', async () => {
            // Act
            const pedido = await checkoutService.processarPedido(carrinho, CARTAO);

            // Assert (Verificação de Comportamento)
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, CARTAO);

            expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
            expect(emailMock.enviarEmail).toHaveBeenCalledWith(
                'premium@email.com',
                'Seu Pedido foi Aprovado!',
                expect.stringContaining('Pedido 42'),
            );

            // Assert (Verificação de Estado) complementar
            expect(pedido.id).toBe(42);
        });

        it('deve persistir o pedido com o total já com desconto', async () => {
            // Act
            await checkoutService.processarPedido(carrinho, CARTAO);

            // Assert
            expect(repositoryStub.salvar).toHaveBeenCalledTimes(1);
            expect(repositoryStub.salvar).toHaveBeenCalledWith(
                expect.objectContaining({ totalFinal: 180, status: 'PROCESSADO', carrinho }),
            );
        });
    });

    describe('quando o carrinho está vazio', () => {
        it('deve cobrar R$ 0,00 do gateway', async () => {
            // Arrange
            const carrinho = CarrinhoBuilder.umCarrinho().vazio().build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
            const checkoutService = new CheckoutService(gatewayStub, { salvar: jest.fn() }, { enviarEmail: jest.fn() });

            // Act
            await checkoutService.processarPedido(carrinho, CARTAO);

            // Assert
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(0, CARTAO);
        });
    });

    describe('quando o envio de e-mail falha após pagamento aprovado', () => {
        it('não deve falhar o checkout e deve retornar o pedido salvo', async () => {
            // Arrange
            const carrinho = CarrinhoBuilder.umCarrinho().build();
            const pedidoSalvo = new Pedido(7, carrinho, 100, 'PROCESSADO');
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = { salvar: jest.fn().mockResolvedValue(pedidoSalvo) };
            const emailStub = {
                enviarEmail: jest.fn().mockRejectedValue(new Error('SMTP indisponível')),
            };
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailStub);

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, CARTAO);

            // Assert
            expect(pedido).toBe(pedidoSalvo);
            expect(consoleSpy).toHaveBeenCalledWith('Falha ao enviar e-mail', 'SMTP indisponível');

            consoleSpy.mockRestore();
        });
    });
});
