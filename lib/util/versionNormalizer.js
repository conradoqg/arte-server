
const Tokenizr = require('tokenizr');

const versionNormalizer = (version) => {
    let lexer = new Tokenizr();

    lexer.rule(/[0-9]+/, (ctx, match) => {
        ctx.accept('number', parseInt(match[0]));
    });

    lexer.rule(/[^0-9]*/, (ctx) => {
        ctx.accept('string');
    });

    lexer.input(version);
    let normalizedVersion = '';
    lexer.tokens().forEach((token) => {
        if (token.type == 'number') normalizedVersion += token.text.padStart(10, '0');
        else normalizedVersion += token.text;
    });

    return normalizedVersion;
};

module.exports = versionNormalizer;