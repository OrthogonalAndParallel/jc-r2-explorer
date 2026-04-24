<template>
  <q-btn dense flat round icon="menu" @click="$emit('toggle')" />

  <q-toolbar-title style="overflow: unset" class="text-bold">
    <q-avatar>
      <img src="/logo-white.svg">
    </q-avatar>
    {{ $t('app.title') }}
  </q-toolbar-title>
  <q-space />

  <!-- Language Switcher -->
  <q-btn-dropdown
    dense
    flat
    icon="language"
    class="q-mr-sm"
  >
    <q-list>
      <q-item
        clickable
        v-close-popup
        @click="switchLanguage('en')"
        :active="currentLocale === 'en'"
      >
        <q-item-section>
          <q-item-label>{{ $t('language.english') }}</q-item-label>
        </q-item-section>
      </q-item>
      <q-item
        clickable
        v-close-popup
        @click="switchLanguage('zh')"
        :active="currentLocale === 'zh'"
      >
        <q-item-section>
          <q-item-label>{{ $t('language.chinese') }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </q-btn-dropdown>

  <div v-if="mainStore.buckets.length > 1">
    <bucket-picker/>
  </div>
</template>

<script>
import BucketPicker from "components/main/BucketPicker.vue";
import { Lang } from "quasar";
import { useMainStore } from "stores/main-store";
import { defineComponent } from "vue";
import { useI18n } from "vue-i18n";

// Quasar language packs for dynamic loading
const quasarLangList = import.meta.glob("../../node_modules/quasar/lang/*.js");

export default defineComponent({
	name: "TopBar",
	emits: ["toggle"],
	components: { BucketPicker },
	setup() {
		const mainStore = useMainStore();
		const { locale } = useI18n();

		const switchLanguage = async (newLocale) => {
			locale.value = newLocale;
			localStorage.setItem("r2-explorer-lang", newLocale);

			// Sync Quasar language pack
			const quasarLangIso = newLocale === "zh" ? "zh-CN" : "en-US";
			try {
				const langModule =
					await quasarLangList[
						`../../node_modules/quasar/lang/${quasarLangIso}.js`
					]();
				Lang.set(langModule.default);
			} catch (err) {
				// Quasar language pack loading failed silently
			}
		};

		return {
			mainStore,
			currentLocale: locale,
			switchLanguage,
		};
	},
});
</script>
