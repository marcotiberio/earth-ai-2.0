// Static content — mirrors Prismic slice structure exactly.
// When Prismic is connected, delete this file and fetch from the API instead.
//
// Drafted from the Figma "V4_SCROLL" master frame (node 442:4677). Each block
// below maps to one slide in that comp; see the slice components in /slices.
//
// Scroll-scrub videos accept a per-section `scrub_start` in `primary`:
//   'top'    → scrub starts when the section's top hits the viewport top
//   'middle' → scrub starts when the section's top hits the viewport centre
// Omit it on pinned scenes (hero / overlay / CTA) to keep their full-travel scrub.

export const homePage = {
  data: {
    meta_title: 'Earth AI — Supplying Critical Minerals for the New Industrial Era',
    meta_description: 'Earth AI is a vertically integrated, AI-powered explorer that discovers, develops, and owns critical mineral mines.',
    slices: [

      // ── Slide 2 · Datacenter / $12T Lower ───────────────────────────────────────
      {
        slice_type: 'video_scroll',
        variation: 'overlay',
        primary: {
          video_url: '/videos/_test/EAI_Datacenter-ChipDrawer_30fps_BTR10.mp4',
          scrub_start: 'middle', // 'top' | 'middle'
          image: {
            url: '/images/EAI_Datacenter-ChipDrawer_SideScroll01.jpg',
            alt: 'Data centre server racks',
          },
          title: 'The future requires <em>$12 trillion</em> of critical minerals.',
          body: 'AI data centres, next-gen processors, quantum computing, GPUs, green energy, and batteries all depend on minerals that are increasingly scarce.',
        },
      },

      // ── Slide 2 · Datacenter / $12T Higher ───────────────────────────────────────
      {
        slice_type: 'video_scroll',
        variation: 'overlay',
        primary: {
          video_url: '/videos/_test/EAI_Datacenter-ChipDrawer_60fps_BTR20.mp4',
          scrub_start: 'middle', // 'top' | 'middle'
          image: {
            url: '/images/EAI_Datacenter-ChipDrawer_SideScroll01.jpg',
            alt: 'Data centre server racks',
          },
          title: 'The future requires <em>$12 trillion</em> of critical minerals.',
          body: 'AI data centres, next-gen processors, quantum computing, GPUs, green energy, and batteries all depend on minerals that are increasingly scarce.',
        },
      },

      // ── Slide 3 · Chip (full-bleed overlay) ───────────────────────────────
      {
        slice_type: 'video_scroll',
        variation: 'overlay',
        primary: {
          video_url: '/videos/EAI_Chip-Rock.mp4',
          image: {
            url: '/images/EAI_Chip-Rock.jpg',
            alt: 'Processor chip close-up',
          },
          title: 'All cannot exist without <em>critical minerals</em>.',
        },
      },

      // ── Slide 4.4 · Demand vs supply chart (animated, pinned) ─────────────
      // Curves + fills wipe in left→right and the endpoint figures count up as
      // the pinned section scrolls. Same data as the static `supply_chart`.
      {
        slice_type: 'supply_gap',
        variation: 'default',
        primary: {
          heading: 'Demand is set, but supply is completely <em>uncertain</em>.',
          body: 'A typical mine contains $10 billion of revenue. By 2040, there is a 643-mine deficit comprising a massive $6.5 trillion gap that remains unfulfilled.',
          y_ticks: ['10', '20', '30', '40', '50'],
          x_labels: ['2030', '2035', '2040'],
          demand: { label: 'DEMAND', value: '1270' },
          supply: { label: 'CURRENT AND DEVELOPING MINES', value: '627' },
        },
      },

      // ── Slide 5.4 · Incumbents comparison (animated race bars) ────────────
      // Bars grow left→right and the numbers count up the first time the
      // section scrolls into view. Same data as the static `comparison_bars`.
      {
        slice_type: 'race_bars',
        variation: 'default',
        primary: {
          heading: 'Incumbents created the problem, but they won’t be <em>the ones to solve</em> it.',
        },
        items: [
          {
            metric: 'DISCOVERY TIMELINE',
            unit: 'YEARS',
            rows: [
              { label: 'EARTH AI', value: 3, highlight: true },
              { label: 'Other Explorers', value: 15 },
            ],
          },
          {
            metric: 'SUCCESS RATE',
            unit: '%',
            rows: [
              { label: 'Other Explorers', value: 0.5 },
              { label: 'EARTH AI', value: 80, highlight: true },
            ],
          },
        ],
      },

      // ── Slide 6 · Statement ───────────────────────────────────────────────
      {
        slice_type: 'wysiwyg',
        variation: 'statement',
        primary: {
          content: 'Traditional explorers will soon be replaced by <em>AI-software defined explorers</em>.',
        },
      },

      // ── Slide 7.2 · Mineral Targeting Platform ────────────────────────────
      {
        slice_type: 'feature_media',
        variation: 'default',
        primary: {
          video_url: '/videos/EAI_Scan.mp4',
          image: {
            url: '/images/EAI_Scan.jpg',
            alt: 'Continental-scale targeting map',
          },
          heading: 'We operate like no other mineral exploration company.',
          body: 'Mineral Targeting Platform (MTP) is our proprietary geology deep-learning system for hydrothermal mineralization discovery. Unlike conventional localized exploration, MTP provides continental-scale predictive capability that discovered 850 new targets at 80% precision.',
        },
      },

      // ── Slide 7.4 · Mineral Targeting Platform (pinned target map) ────────
      // Animated successor to the static `feature_media` slide above: the
      // metrics count up and the continental target markers wipe in left→right
      // as the pinned section scrolls.
      {
        slice_type: 'map_targets',
        variation: 'default',
        primary: {
          title: 'We operate <em>like no other</em> mineral exploration company.',
          body: 'Mineral Targeting Platform (MTP) is our proprietary geology deep learning system for hydrothermal mineralization discovery. Unlike conventional localized exploration, MTP provides continental-scale predictive capability that discovered 1,500 new targets at 83% precision.',
          stats: [
            { label: 'New Targets', value: '1,500' },
            { label: 'Precision',   value: '83%' },
          ],
        },
      },

      // ── Slide 8.4 · Drill stats (pinned arrow scene) ──────────────────────
      {
        slice_type: 'drilled_stats',
        variation: 'default',
        primary: {
          title: 'We drilled through the stratosphere.',
          feet_value: '96,000',
          feet_label: 'Feet Drilled',
          stats: [
            { label: 'Deposits',                value: '6' },
            { label: 'Acres of Mineral Rights', value: '4.1 mil' },
            { label: 'Holes Drilled',           value: '62' },
            { label: 'Projects',                value: '28' },
          ],
        },
      },

      // ── Slide 9 · CTA ─────────────────────────────────────────────────────
      {
        slice_type: 'cta',
        variation: 'default',
        primary: {
          video_url: '/videos/EAI_FutureCity.mp4',
          image: {
            url: '/images/EAI_FutureCity.jpg',
            alt: 'Continental-scale targeting map',
          },
          title: 'Let’s build the <em>future</em> together.',
          button_link: { url: '#contact', text: 'Contact us' },
        },
      },

    ],
  },
}
