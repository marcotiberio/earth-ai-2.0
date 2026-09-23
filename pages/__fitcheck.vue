<script setup>
import { provide } from 'vue'
import StatsSolution from '~/slices/StatsSolution/index.vue'
import data from '~~/.fitcheck-data.json'

definePageMeta({ layout: false })
provide('inSliceSimulator', true)

const slice = { slice_type: 'stats_solution', variation: 'default', primary: data }
</script>

<template>
  <StatsSolution :slice="slice" />
</template>
