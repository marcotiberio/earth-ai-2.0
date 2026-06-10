<script setup>
import { provide } from "vue";
import { components } from "~/slices";

// Tells scroll-scrub slices (ScrubScene) they're rendering inside the Slice
// Simulator — used by the Page Builder's live sidebar previews and by "Update
// screenshot". In that context they collapse to a single composed frame
// (video + headline) instead of a tall pinned section that crops to a bare
// video strip. The live site is unaffected.
provide("inSliceSimulator", true);
</script>

<template>
	<SliceSimulator #default="{ slices }">
		<SliceZone :slices="slices" :components="components" />
	</SliceSimulator>
</template>