const { EangelparseMessageText } = require('../Strategies/Epicrise/Utils/utilities');

describe('Epicrise Message Parsing', () => {
    test('should correctly parse BUY message', () => {
        const message = 'ER Buy TATACHEM at 855.05 with Stop Loss at 850.00';
        const result = EangelparseMessageText(message);
        expect(result).toEqual({
            transactionType: 'Buy',
            symbol: 'TATACHEM',
            price: 855.05,
            stopLoss: 850.00
        });
    });

    test('should correctly parse SELL message', () => {
        const message = 'ER Sell TATACHEM at 845.00 with Stop Loss at 850.00';
        const result = EangelparseMessageText(message);
        expect(result).toEqual({
            transactionType: 'Sell',
            symbol: 'TATACHEM',
            price: 845.00,
            stopLoss: 850.00
        });
    });

    test('should return null for invalid message format', () => {
        const message = 'Invalid message format';
        const result = EangelparseMessageText(message);
        expect(result).toBeNull();
    });
});
