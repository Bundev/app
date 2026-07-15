module.exports = (req, name, breadcrumbs = []) => ({
    script: [{ src: `${name}.js` }],
    style: [{ href: `${name}.css` }],
    breadcrumbs: [
        { title: req.__('title.dashboard'), url: '/' },
        ...breadcrumbs
    ]
});