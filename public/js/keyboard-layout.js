(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.KeyboardLayout = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const ENGLISH = "`qwertyuiop[]asdfghjkl;'zxcvbnm,./";
    const RUSSIAN = "ёйцукенгшщзхъфывапролджэячсмитьбю.";
    const UKRAINIAN = "ґйцукенгшщзхїфівапролджєячсмитьбю.";

    function convert(value, from, to) {
        return [...String(value || '')].map(character => {
            const lowerCharacter = character.toLocaleLowerCase();
            const index = from.indexOf(lowerCharacter);

            if (index === -1) return character;

            const replacement = to[index];
            return character === lowerCharacter
                ? replacement
                : replacement.toLocaleUpperCase();
        }).join('');
    }

    function variants(value) {
        const original = String(value || '').trim();
        if (!original) return [];

        return [...new Set([
            original,
            convert(original, ENGLISH, RUSSIAN),
            convert(original, ENGLISH, UKRAINIAN),
            convert(original, RUSSIAN, ENGLISH),
            convert(original, UKRAINIAN, ENGLISH)
        ])];
    }

    return { variants };
}));
