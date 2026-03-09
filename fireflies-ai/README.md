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
python3 pm/fireflies_transcripts_cli.py list
```

Optional filters:

```bash
python3 pm/fireflies_transcripts_cli.py --limit 50 --skip 0 --keyword demo list
python3 pm/fireflies_transcripts_cli.py --from-date 2026-01-01T00:00:00.000Z list
python3 pm/fireflies_transcripts_cli.py --last-n-days 14 list
```

`--last-n-days N` computes a UTC `fromDate` for the preceding `N` days and cannot
be combined with `--from-date`.

## Interactive download flow

```bash
python3 pm/fireflies_transcripts_cli.py -o pm/downloads interactive
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

Downloaded files go into `pm/downloads/` by default.

## Direct indexed download

```bash
python3 pm/fireflies_transcripts_cli.py -o pm/downloads download 1,3-5 --assets audio
python3 pm/fireflies_transcripts_cli.py -o pm/downloads download 1,3-5 --assets transcript,audio
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

## Convert a saved transcript JSON file into named text

```bash
python3 pm/fireflies_transcript_to_text.py \
  --token 'your-token-here' \
  -o pm/my-transcript.txt \
  pm/2026-03-03T20-00-42.942Z-030326---Autobroker-x-Cardog-Meeting-transcript.json
```

This script:

1. Reads the local transcript JSON file.
2. Extracts its transcript `id`.
3. Queries Fireflies for transcript detail, including speaker metadata.
4. Writes a timestamped text file with speaker names where available.

If a speaker cannot be resolved, the script falls back to `Speaker<speaker_id>`.

You can override the output path:

```bash
python3 pm/fireflies_transcript_to_text.py \
  --token 'your-token-here' \
  -o pm/my-transcript.txt \
  pm/your-transcript.json
```
