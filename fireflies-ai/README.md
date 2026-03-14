# Fireflies Transcript CLI

This folder contains a small Python CLI for listing Fireflies meeting transcripts
and downloading transcript/audio/video assets with a bearer token. It also
contains a second script for converting a saved transcript JSON file into a
timestamped text transcript with speaker names resolved from the Fireflies API.

## Requirements

- Python 3.10+
- A Fireflies bearer token

Set the token in an environment variable:

```bash
export FIREFLIES_API_KEY='your-token-here'
```

Or pass it directly with `--token`.

## List transcripts

```bash
python3 fireflies-ai/fireflies_transcripts_cli.py list
```

This default `list` output shows only the compact one-line table. To show the
expanded per-transcript detail view instead, use:

```bash
python3 fireflies-ai/fireflies_transcripts_cli.py --detail list
```

Optional filters:

```bash
python3 fireflies-ai/fireflies_transcripts_cli.py --limit 25 --page 2 list
python3 fireflies-ai/fireflies_transcripts_cli.py --limit 50 --skip 0 --keyword demo list
python3 fireflies-ai/fireflies_transcripts_cli.py --from-date 2026-01-01T00:00:00.000Z list
python3 fireflies-ai/fireflies_transcripts_cli.py --last-n-days 14 list
```

`--last-n-days N` computes a UTC `fromDate` for the preceding `N` days and cannot
be combined with `--from-date`.

Fireflies transcript listing uses `limit` and `skip` pagination. The CLI now
adds `--page` as a convenience layer:

- `--page 1` is the default
- effective skip is computed as `(page - 1) * limit`
- `--page` and `--skip` cannot be used together unless `--page` is left at `1`

For example, to fetch the third page of 25 meetings:

```bash
python3 fireflies-ai/fireflies_transcripts_cli.py --limit 25 --page 3 list
```

## Interactive download flow

```bash
python3 fireflies-ai/fireflies_transcripts_cli.py -o fireflies-ai/downloads interactive
```

The interactive flow will:

1. List transcript rows and detailed URLs.
2. Ask which row indexes to download.
3. Ask what asset kinds to try:
   - `transcript`
   - `audio`
   - `video`
   - `all`

You can enter a comma-separated selection such as:

- `transcript`
- `audio,video`
- `transcript,audio`
- `all`

Downloaded files go into `fireflies-ai/downloads/` by default.

## Direct indexed download

```bash
python3 fireflies-ai/fireflies_transcripts_cli.py -o fireflies-ai/downloads download 1,3-5 --assets audio
python3 fireflies-ai/fireflies_transcripts_cli.py -o fireflies-ai/downloads download 1,3-5 --assets transcript,audio
```

When you use `--page`, the displayed indexes and the accepted download indexes
follow that page offset instead of resetting to `1`. For example, page 2 of
25 items will display indexes `26..50`, and those are the indexes you should
pass to `download`:

```bash
python3 fireflies-ai/fireflies_transcripts_cli.py --limit 25 --page 2 list
python3 fireflies-ai/fireflies_transcripts_cli.py --limit 25 --page 2 download 26,27 --assets transcript
```

The `download` command now accepts those absolute listing indexes even if you
omit `--page`; it will fetch the required page(s) automatically:

```bash
python3 fireflies-ai/fireflies_transcripts_cli.py --limit 25 download 26,27 --assets transcript
```

## Transcript downloads

The Fireflies docs I used document transcript records with:

- `transcript_url`
- `audio_url`
- `video_url`

Transcript downloads are now treated as structured transcript assets instead of
assumed PDFs. The CLI fetches transcript payloads through the Fireflies
`transcript(id: ...)` GraphQL query and saves the result as `.json`.

Audio and video downloads still use the `audio_url` and `video_url` fields from
the transcript listing.

## Convert a saved transcript JSON file into SRT or PDF

```bash
python3 fireflies-ai/fireflies_transcript_to_text.py \
  --token 'your-token-here' \
  -o fireflies-ai/my-transcript.srt \
  fireflies-ai/2026-03-03T20-00-42.942Z-030326---Autobroker-x-Cardog-Meeting-transcript.json
```

This script:

1. Reads the local transcript JSON file.
2. Extracts its transcript `id`.
3. Queries Fireflies for transcript detail, including speaker metadata.
4. Writes SRT by default, or PDF if requested, with speaker names where available.

If a speaker cannot be resolved, the script falls back to `Speaker<speaker_id>`.

SRT is the default format:

```bash
python3 fireflies-ai/fireflies_transcript_to_text.py \
  --token 'your-token-here' \
  fireflies-ai/your-transcript.json
```

Explicit SRT output:

```bash
python3 fireflies-ai/fireflies_transcript_to_text.py \
  --token 'your-token-here' \
  -f srt \
  -o fireflies-ai/my-transcript.srt \
  fireflies-ai/your-transcript.json
```

PDF output uses `enscript` and `ghostscript`:

```bash
sudo apt install enscript ghostscript
python3 fireflies-ai/fireflies_transcript_to_text.py \
  --token 'your-token-here' \
  -f pdf \
  -o fireflies-ai/my-transcript.pdf \
  fireflies-ai/your-transcript.json
```
