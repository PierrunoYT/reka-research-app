# Reka Research Web App

A modern web application for interacting with the Reka Research API, built with Flask, HTML, CSS, JavaScript, and SQLite for persistent storage.

## Features

- 🔍 **AI-Powered Research**: Leverage Reka's research capabilities with web browsing
- 💬 **Real-time Chat Interface**: Smooth, responsive chat experience with markdown formatting
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 🎨 **Modern UI**: Clean, professional interface with smooth animations
- 🔒 **Secure**: Environment-based API key management
- 📚 **Citation Support**: Reka provides answers with inline citations and clickable links
- 💾 **Research History**: SQLite database stores all research queries with full persistence
- 🔍 **Search Functionality**: Find past research by keywords across all queries and responses
- 📊 **Analytics Dashboard**: Track usage statistics and metrics in real-time
- 🗂️ **Session Management**: Organize conversations by session with easy switching
- 🔄 **Database Reset**: Safe database management with double confirmation
- ⚡ **Real-time Updates**: History and statistics refresh automatically after each query
- 🎯 **Interactive History**: Click any session to restore complete conversation history
- 📈 **Usage Statistics**: Track total queries, sessions, and performance metrics

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/PierrunoYT/reka-research-app.git
cd reka-research-app
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your Reka API key:
```
REKA_API_KEY=your-reka-api-key-here
SECRET_KEY=your-secret-key-here
```

### 4. Initialize Database

```bash
python init_db.py
```

### 5. Run the Application

```bash
python app.py
```

The app will be available at `http://localhost:5000`

## Project Structure

```
RekaResearch/
├── app.py                      # Flask backend with API endpoints
├── database.py                 # SQLite database management
├── init_db.py                  # Database initialization script
├── requirements.txt            # Python dependencies
├── research.db                 # SQLite database (auto-created)
├── .env.example               # Environment variables template
├── reka-research-api-guide.md  # API documentation
├── templates/
│   └── index.html             # Main HTML template
└── static/
    ├── styles.css             # CSS styling
    └── script.js              # JavaScript functionality
```

## API Endpoints

### Core Endpoints
- `GET /` - Main chat interface
- `POST /api/chat` - Send messages to Reka Research
- `GET /api/health` - Health check endpoint
- `GET /api/models` - List available models

### Database Endpoints
- `GET /api/history` - Get all research sessions with summary info
- `GET /api/history/<session_id>` - Get specific session history and conversation
- `GET /api/search?q=<term>` - Search research queries and responses
- `GET /api/stats` - Get database statistics and usage metrics
- `POST /api/clear` - Clear all research history (requires confirmation)
- `POST /api/reset` - Reset database (requires confirmation)

## Database Features

### Research Storage
- **Automatic Storage**: Every research query is automatically saved to SQLite
- **Session Tracking**: Conversations are organized by unique session IDs
- **Metadata**: Stores response time, tokens used, model info, and timestamps
- **Full History**: Complete conversation history preserved across app restarts

### Search and Analytics
- **Full-text Search**: Search across all queries and responses instantly
- **Usage Statistics**: Track total queries, sessions, and tokens in real-time
- **Performance Metrics**: Monitor average response times and system usage
- **Session Analytics**: View conversation patterns and detailed history

### Database Management
- **Safe Reset**: Database reset with double confirmation for safety
- **Data Persistence**: All data survives application restarts
- **Automatic Indexing**: Optimized for fast searches and retrieval
- **Backup Safe**: Manual database file backup supported

### Database Schema
- `research_sessions`: Session tracking with created/updated timestamps
- `research_queries`: Query storage with full metadata and performance metrics
- **Indexes**: Optimized for session_id, created_at, and full-text search

## Development

### Running in Development Mode

```bash
export FLASK_ENV=development
export FLASK_DEBUG=True
python app.py
```

### Production Deployment

For production, use a WSGI server like Gunicorn:

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Database Management

```bash
# Initialize/reset database
python init_db.py

# Test database functionality
python -c "from database import ResearchDatabase; db = ResearchDatabase(); print(db.get_database_stats())"

# Reset database via API (requires confirmation)
curl -X POST http://localhost:5000/api/reset -H "Content-Type: application/json" -d '{"confirm": true}'
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REKA_API_KEY` | Your Reka API key | Required |
| `SECRET_KEY` | Flask secret key | Required |
| `FLASK_ENV` | Flask environment | development |
| `PORT` | Server port | 5000 |

## Usage

1. Open the web application in your browser
2. Type your research question in the chat input
3. Press Enter or click the send button
4. Wait for Reka to research and provide a comprehensive answer with citations
5. All queries are automatically saved to the database
6. Use the API endpoints to retrieve history and search past research

## Features in Detail

### Chat Interface
- Auto-resizing text input with Enter key support
- Real-time message display with markdown formatting
- Loading indicators and comprehensive error handling
- Proper citation link formatting with external link support
- Session-based conversation tracking with visual indicators

### History Management
- **Interactive History Sidebar**: Browse all past research sessions
- **Session Restoration**: Click any session to restore complete conversation
- **Real-time Search**: Search across all queries and responses instantly
- **Statistics Dashboard**: Live metrics for queries, sessions, and performance
- **Database Reset**: Safe database management with double confirmation

### Database Integration
- **Automatic Storage**: Every query/response saved automatically to SQLite
- **Session Management**: Conversations tracked by unique session IDs
- **Search Capability**: Full-text search across all stored research
- **Analytics Dashboard**: Real-time usage statistics and performance metrics
- **Data Persistence**: All data survives app restarts and system reboots

### Responsive Design
- Mobile-first approach
- Tablet and desktop optimizations
- Touch-friendly interface
- Smooth animations and transitions

### API Integration
- OpenAI-compatible client using `reka-flash-research` model
- Conversation history management
- Error handling and retry logic
- Health monitoring and status checks

## API Usage Examples

### Get Research History
```bash
curl http://localhost:5000/api/history
```

### Search Past Research
```bash
curl "http://localhost:5000/api/search?q=travel&limit=10"
```

### Get Database Statistics
```bash
curl http://localhost:5000/api/stats
```

### Get Session History
```bash
curl http://localhost:5000/api/history/session-id-here
```

### Clear All History
```bash
curl -X POST http://localhost:5000/api/clear \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'
```

### Reset Database
```bash
curl -X POST http://localhost:5000/api/reset \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (including database functionality)
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues related to:
- **Reka API**: Visit [docs.reka.ai](https://docs.reka.ai) or [docs.reka.ai/research](https://docs.reka.ai/research)
- **This Web App**: Create an issue in this repository

## Technical Details

- **Backend**: Flask with SQLite database and comprehensive API endpoints
- **Frontend**: Vanilla JavaScript with modern CSS Grid/Flexbox layouts
- **Database**: SQLite with optimized indexes and full-text search
- **API**: OpenAI-compatible Reka Research API with session management
- **Storage**: Persistent research history and real-time analytics
- **Security**: Environment-based configuration with safe database operations
- **UI**: Responsive design with interactive history management
- **Features**: Real-time updates, search functionality, and database reset capabilities