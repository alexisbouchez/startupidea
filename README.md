# Startup Idea Bot for Bluesky/ATProto

A bot that posts high-quality startup ideas to Bluesky using Ollama for idea generation.

## Features

- Generates concise, technical startup ideas about software, open source, and developer tools
- Uses XML-based system prompts for better LLM performance
- Posts to Bluesky/ATProto on a regular schedule
- Enforces strict formatting: `startup idea: <idea>` in lowercase
- No emojis, no slop, just good ideas
- Duplicate prevention with post history tracking
- Automatic fallback when Ollama is unavailable

## Requirements

- Bun runtime
- Ollama (optional, uses fallback ideas if not available)
- Bluesky account with app password

## Installation

```bash
# Clone this repository
git clone https://github.com/alexisbouchez/startupidea.git
cd startupidea

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Bluesky credentials

# For Ollama (optional)
ollama pull llama3
```

## Usage

### Run the bot
```bash
bun start
```

### Configuration

- **Posting interval**: 10 minutes (change `POST_INTERVAL_MS` in `.env.local`)
- **Model**: Defaults to `llama3` (change `OLLAMA_MODEL` in `.env.local`)
- **Character limit**: 140 characters max

## XML System Prompt

The bot uses `startup_prompt.xml` for generating ideas. You can modify this file to change the prompt structure, examples, and constraints.

## Environment Variables

- `BLUESKY_HANDLE`: Your Bluesky handle (e.g., `user.bsky.social`)
- `BLUESKY_PASSWORD`: Your Bluesky app password
- `OLLAMA_HOST`: Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL`: Model to use (default: `llama3`)
- `POST_INTERVAL_MS`: Posting interval in milliseconds (default: `600000` = 10 minutes)

## Example Output

```
startup idea: git for databases with time-travel debugging
startup idea: ai-powered code review that explains why your code sucks
startup idea: terminal-based spreadsheet for developers who hate excel
```

## Deployment

### Systemd Service

```bash
# Copy the systemd service file
sudo cp startupidea.service /etc/systemd/system/

# Enable and start the service
sudo systemctl enable startupidea
sudo systemctl start startupidea

# Monitor logs
journalctl -u startupidea -f
```

## License

MIT © 2026-present Alexis Bouchez
