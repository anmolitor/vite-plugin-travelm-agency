# Vite Plugin for Travelm Agency ![NPM](https://img.shields.io/npm/v/vite-plugin-travelm-agency)

This is a vite plugin that runs the Travelm-Agency compiler on your translation files
on build start and also when the translation files change.

The options are the same as for the Travelm-Agency compiler itself, but use defaults to simplify configuration in most cases.

The options and defaults explained:

- `translationDir` (relative path to the directory with your translation files) defaults to 'translations'.
- `elmPath` (relative path where the .elm file should be generated) defaults to 'src/Translations.elm'.
- `i18nArgFirst` (do we want the I18n argument in the generated functions first or last) defaults to 'false'.
- `generatorMode` (inline for strings in .elm file, dynamic for .json file generation) defaults to 'inline'.
- `addContentHash` (content hashes for generated .json files, only relevant for dynamic generatorMode) defaults to 'true'.
- `jsonPath` (subfolder where we want our generated .json files to be served from) defaults to 'i18n'.
- `prefixFileIdentifier` (should all translations be prefixed by the file name they are defined in?) defaults to 'false'.
- `defaultLanguage`: No default. Necessary when language-specific builds are used.

DevMode is automatically turned on/off depending on if you are running the dev server
or bundling for production.

When using dynamic mode with content hashes, the generated Elm code knows which language corresponds to which filename.
However, if you want to i.e. preload some translations in JS, this plugin leverages Rollups virtual modules to provide an easy solution.
Just import `virtual:travelm-agency` whose default export will be an object with your translation identifiers as keys and the
resulting filenames as values.

For example, if I run the plugin in dynamic mode with hashes on, 'i18n' as `jsonPath` and a single `test.en.properties` file
as my translations, the default export of `virtual:travelm-agency` will be
`{ 'test.en': '/i18n/test.en.[hash].json' }`.

The example directory provides two mini projects, one demonstrating inline mode and one demonstrating dynamic mode and the
virtual module feature.

## Language-specific builds

Travelm-Agency has two modes, inline and dynamic. This plugin essentially adds a third mode: language-specific builds.
A language-specific build in this context means that multiple html files are emitted, one per language.
This minimizes roundtrips to the server and means translations will always be available synchronously.
To use language-specific builds, some setup is necessary.

1. Set the `defaultLanguage` option on the vite-travelm-agency-plugin. This sets the language used in the "standard" html asset (in the location where the html asset would have been without language-specific builds).
2. Add the `__TRAVELM_AGENCY_bundleName__` placeholder in the html file at a useful location, where `bundleName` is your bundle name, e.g. `messages`. This placeholder will be replaced at build time by the generated translations JSON. In most cases you will want to do something like

```html
<script>
    window.translations = __TRAVELM_AGENCY_bundleName__;
<script>
```

3. Use the JSON somewhere. For example, you could pass it into your Elm application as a flag:

```js
Elm.Main.init({ flags: { translations: window.translations } });
```

4. Setup your production file server to handle routing/redirects based on the `accept-language` header. E.g. if your default language is `en`, but I request the `/index.html` with `accept-language: de-DE`, I should get `/de/index.html` instead.

## Why is this plugin not Rollup compatible

To work well with [vite-plugin-elm](https://github.com/hmsk/vite-plugin-elm), which is vite-only also,
we use the `handleHotUpdate` hook. Moreover, for dynamic mode we use the `configureServer` hook to
avoid disk writes and serve the generated .json files from memory.
