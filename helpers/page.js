const scannerPages = new Set(['products', 'products-add', 'product-edit', 'new']);

module.exports = (req, name, breadcrumbs = []) => ({
    script: [{ src: `${name}.js` }],
    style: [
        { href: `${name}.css` },
        ...(scannerPages.has(name) ? [{ href: 'barcode-scanner.css' }] : [])
    ],
    breadcrumbs: [
        { title: req.__('title.dashboard'), url: '/' },
        ...breadcrumbs
    ]
});
