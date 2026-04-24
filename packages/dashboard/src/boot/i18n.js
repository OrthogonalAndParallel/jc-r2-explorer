import { Lang } from "quasar";
import { boot } from "quasar/wrappers";
import en from "src/locales/en.json";
import zh from "src/locales/zh.json";
import { createI18n } from "vue-i18n";

// Quasar language packs for internal components
const quasarLangList = import.meta.glob("../../node_modules/quasar/lang/*.js");

const messages = { en, zh };

// Determine initial language
function getInitialLocale() {
	// 1. Check localStorage preference
	const stored = localStorage.getItem("r2-explorer-lang");
	if (stored && (stored === "en" || stored === "zh")) {
		return stored;
	}
	// 2. Check browser locale
	const browserLang = navigator.language.toLowerCase();
	if (browserLang.startsWith("zh")) {
		return "zh";
	}
	// 3. Default to English
	return "en";
}

const i18n = createI18n({
	locale: getInitialLocale(),
	fallbackLocale: "en",
	legacy: false, // Use Composition API mode
	globalInjection: true, // Enable $t() in templates
	messages,
});

export default boot(({ app }) => {
	app.use(i18n);

	// Sync Quasar language pack with vue-i18n locale
	const initialLocale = getInitialLocale();
	const quasarLangIso = initialLocale === "zh" ? "zh-CN" : "en-US";

	try {
		quasarLangList[`../../node_modules/quasar/lang/${quasarLangIso}.js`]().then(
			(lang) => Lang.set(lang.default),
		);
	} catch (err) {
		// Quasar language pack loading failed silently
	}
});

// Export for use in components
export { i18n };
