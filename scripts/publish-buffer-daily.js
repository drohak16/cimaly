name: Cimaly Daily Social

on:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  cimaly-social:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Select daily content
        env:
          TMDB_READ_TOKEN: ${{ secrets.TMDB_READ_TOKEN }}
          TMDB_API_KEY: ${{ secrets.TMDB_API_KEY }}
          BUFFER_API_KEY: ${{ secrets.BUFFER_API_KEY }}
        run: node scripts/cimaly-social.js

      - name: Generate daily social images
        env:
          TMDB_READ_TOKEN: ${{ secrets.TMDB_READ_TOKEN }}
        run: node scripts/generate-social-images.js

      - name: Commit generated images
        run: |
          git config user.name "cimaly-social-bot"
          git config user.email "actions@github.com"

          git add data/last-social-selection.json
          git add public/social/daily

          if git diff --cached --quiet; then
            echo "No changes"
          else
            git commit -m "Update Cimaly daily social images"
            git push
          fi

      - name: Wait for Cloudflare deployment
        run: sleep 60

      - name: Publish to Buffer
        env:
          BUFFER_API_KEY: ${{ secrets.BUFFER_API_KEY }}
          BUFFER_CHANNEL_ID_FACEBOOK: ${{ secrets.BUFFER_CHANNEL_ID_FACEBOOK }}
          BUFFER_CHANNEL_ID_INSTAGRAM: ${{ secrets.BUFFER_CHANNEL_ID_INSTAGRAM }}
        run: node scripts/publish-buffer-daily.js
