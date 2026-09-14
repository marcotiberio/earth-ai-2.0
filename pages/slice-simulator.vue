<script setup>
import { provide } from "vue";
import { components } from "~/slices";

provide("inSliceSimulator", true);
</script>

<template>
	<SliceSimulator #default="{ slices }">
		<SliceZone :slices="slices" :components="components" />
	</SliceSimulator>
</template>