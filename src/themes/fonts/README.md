# Offline theme fonts

OFL-1.1 fonts from the Google Fonts repository; retain the five adjacent OFL files when distributing these assets. Exact downloaded source and output SHA-256 values are in sources.json. No font CDN is used at runtime. Noto SC is the Chinese family named by the approved design tokens.

The Chinese subset contains the 3,500 level-one general-standard Chinese characters plus every character in src .ts, .tsx and .json files at generation time. The 3,500-character transcription comes from the source linked in sources.json. Font fallback continues to cover arbitrary user text outside this subset.

Rebuild with Python fonttools 4.66.1 and brotli 1.2.0. Download the non-italic variable TTF in each listed official family directory to .tmp/font-source/<family>.ttf, verify source hashes against sources.json, then run `python src/themes/fonts/subset.py`. Source Serif is instantiated at the specified 400 weight; the other families preserve variable weights. Review new application copy against subset-characters.txt when adding characters.

fonts.css declares local faces with swap. Browsers fetch only faces actually requested by the current theme; shared Chinese faces are reused across themes. Manifest fonts lists the exact local resources for cache consumers. Normal app offline caching is still required to make a previously unvisited page available offline.
