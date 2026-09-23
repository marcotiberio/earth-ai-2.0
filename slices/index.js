import { defineAsyncComponent } from "vue";
import { defineSliceZoneComponents } from "@prismicio/vue";

export const components = defineSliceZoneComponents({
  hero_image:      defineAsyncComponent(() => import("./HeroImage/index.vue")),
  video_scroll:    defineAsyncComponent(() => import("./VideoScroll/index.vue")),
  video_scroll_titles: defineAsyncComponent(() => import("./VideoScrollTitles/index.vue")),
  race_bars:       defineAsyncComponent(() => import("./RaceBars/index.vue")),
  supply_gap:      defineAsyncComponent(() => import("./SupplyGap/index.vue")),
  drilled_stats:   defineAsyncComponent(() => import("./DrilledStats/index.vue")),
  map_targets:     defineAsyncComponent(() => import("./MapTargets/index.vue")),
  wysiwyg:         defineAsyncComponent(() => import("./Wysiwyg/index.vue")),
  text_content:    defineAsyncComponent(() => import("./TextContent/index.vue")),
  feature_media:   defineAsyncComponent(() => import("./FeatureMedia/index.vue")),
  cta:             defineAsyncComponent(() => import("./Cta/index.vue")),
  press_quotes:    defineAsyncComponent(() => import("./PressQuotes/index.vue")),
  splasher:        defineAsyncComponent(() => import("./Splasher/index.vue")),
  horizontal_scroll: defineAsyncComponent(() => import("./HorizontalScroll/index.vue")),
  slider_images:   defineAsyncComponent(() => import("./SliderImages/index.vue")),
  stats_solution:  defineAsyncComponent(() => import("./StatsSolution/index.vue")),
});
